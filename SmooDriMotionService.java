package vn.gptlohoi.apphub;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import org.json.JSONObject;

/**
 * User-started, visible foreground service. No startup after reboot and no hidden tracking.
 * Calculations in this service are APPROXIMATE: the web SmooDri scoring engine is separate.
 * Device must remain fixed in the vehicle. No GPS or uploads are performed.
 */
public final class SmooDriMotionService extends Service implements SensorEventListener {
    public static final String ACTION_START = "vn.gptlohoi.apphub.motion.START";
    public static final String ACTION_STOP = "vn.gptlohoi.apphub.motion.STOP";
    public static final String EXTRA_COMFORT = "comfort";
    private static final int NOTIFICATION_ID = 4207;
    private static final String CHANNEL_ID = "smoodri_motion_monitor_v1";
    private static final double G = 9.80665;

    private static volatile boolean active = false;
    private static volatile String lastStatus = "Chưa bắt đầu";
    private static volatile String lastData = "{}";
    private static volatile int latestSamples = 0;

    private SensorManager manager;
    private Sensor accelerometer;
    private Sensor linearAccelerometer;
    private HandlerThread worker;
    private Handler handler;
    private PowerManager.WakeLock wakeLock;
    private int comfort = 60;
    private int count = 0;
    private int violations = 0;
    private int score = 100;
    private double tripPenalty = 0;
    private boolean violating = false;
    private long startedAtMs = 0;
    private long lastTsNs = 0;
    private long lastUiMs = 0;
    private int calibrationCount = 0;
    private double ox = 0, oy = 0, oz = 0, calibrationVariance = 0;
    private boolean calibrated = false;
    private double sx = 0, sl = 0, sv = 0, vertBaseline = 0;
    private final float[] linear = new float[3];
    private boolean hasLinear = false;
    private volatile int gaPct = 0, brakePct = 0, turnPct = 0, bumpPct = 0;

    public static JSONObject state() {
        JSONObject result = new JSONObject();
        try {
            result.put("running", active);
            result.put("status", lastStatus);
            result.put("score", readInt("score", 100));
            result.put("ga", readInt("ga", 0));
            result.put("phanh", readInt("phanh", 0));
            result.put("cua", readInt("cua", 0));
            result.put("xoc", readInt("xoc", 0));
            result.put("violations", readInt("violations", 0));
            result.put("samples", latestSamples);
            result.put("details", new JSONObject(lastData));
        } catch (Exception ignored) { }
        return result;
    }

    private static int readInt(String key, int fallback) {
        try { return new JSONObject(lastData).optInt(key, fallback); }
        catch (Exception e) { return fallback; }
    }

    @Override public void onCreate() {
        super.onCreate();
        manager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        accelerometer = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        linearAccelerometer = manager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
        worker = new HandlerThread("SmooDriMotionSensors");
        worker.start();
        handler = new Handler(worker.getLooper());
        createChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            endSession();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent == null || !ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;
        if (active) return START_NOT_STICKY; // Do not reset an ongoing drive when re-opening the WebView.
        comfort = intent.getIntExtra(EXTRA_COMFORT, 60);
        comfort = Math.max(20, Math.min(100, comfort));
        lastStatus = "Đang chuẩn bị cảm biến";
        try {
            Notification n = notification(lastStatus);
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
        } catch (Exception e) {
            lastStatus = "Android không cho khởi chạy dịch vụ: " + e.getClass().getSimpleName();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (accelerometer == null) {
            lastStatus = "Thiết bị không có gia tốc kế";
            endSession();
            stopSelf();
            return START_NOT_STICKY;
        }
        active = true;
        lastData = "{}";
        startedAtMs = SystemClock.elapsedRealtime();
        lastTsNs = 0;
        calibrationCount = 0;
        calibrationVariance = 0;
        ox = oy = oz = vertBaseline = sx = sl = sv = 0;
        calibrated = false;
        count = violations = 0;
        score = 100;
        tripPenalty = 0;
        violating = false;
        hasLinear = false;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AppHub:SmooDriMotion");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(12L * 60 * 60 * 1000); // explicit maximum; release on Stop/Destroy
        boolean listenerRegistered = manager.registerListener(this, accelerometer, 40_000, handler); // ~25 Hz
        if (!listenerRegistered) {
            lastStatus = "Không đăng ký được gia tốc kế";
            endSession(); stopSelf();
            return START_NOT_STICKY;
        }
        if (linearAccelerometer != null) manager.registerListener(this, linearAccelerometer, 40_000, handler);
        return START_NOT_STICKY;
    }

    @Override public void onSensorChanged(SensorEvent event) {
        if (!active) return;
        if (event.sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION) {
            System.arraycopy(event.values, 0, linear, 0, 3);
            hasLinear = true;
            return;
        }
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;
        final long ts = event.timestamp;
        final double x = event.values[0] / G, y = event.values[1] / G, z = event.values[2] / G;
        if (!Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(z)) return;
        count++;
        if (!calibrated) {
            calibrationCount++;
            double dx = x - ox, dy = y - oy, dz = z - oz;
            ox += dx / calibrationCount; oy += dy / calibrationCount; oz += dz / calibrationCount;
            calibrationVariance += (dx * (x - ox) + dy * (y - oy) + dz * (z - oz));
            if (SystemClock.elapsedRealtime() - startedAtMs < 1800 || calibrationCount < 15) return;
            double variation = Math.sqrt(Math.max(0, calibrationVariance / calibrationCount));
            if (variation > 0.07 || Math.sqrt(ox * ox + oy * oy + oz * oz) < 0.55) {
                lastStatus = "Cân chỉnh thất bại: giữ điện thoại cố định khi xe dừng rồi thử lại";
                new Handler(getMainLooper()).post(() -> { endSession(); stopSelf(); });
                return;
            }
            calibrated = true;
            lastTsNs = ts;
            lastStatus = "Đang đo chuyển động";
            return;
        }
        if (lastTsNs == 0) { lastTsNs = ts; return; }
        double dt = Math.max(0.012, Math.min(0.15, (ts - lastTsNs) / 1e9));
        lastTsNs = ts;
        double dx = x - ox, dy = y - oy, dz = z - oz;
        double yz = Math.hypot(oy, oz), norm = Math.sqrt(ox * ox + oy * oy + oz * oz);
        if (norm < 0.001) norm = 1;
        double lon = yz > 0.25 ? (dy * oz - dz * oy) / yz : dy;
        double vert = (dx * ox + dy * oy + dz * oz) / norm;
        vertBaseline += (vert - vertBaseline) * (1.0 - Math.exp(-dt / 0.55));
        double vx = dx, vl = lon, vv = Math.abs(vert - vertBaseline);
        if (hasLinear) {
            double lx = linear[0] / G, ly = linear[1] / G, lz = linear[2] / G;
            double linearLon = yz > 0.25 ? (ly * oz - lz * oy) / yz : ly;
            double linearVert = Math.abs((lx * ox + ly * oy + lz * oz) / norm);
            vx = 0.25 * dx + 0.75 * lx;
            vl = 0.25 * lon + 0.75 * linearLon;
            vv = 0.35 * vv + 0.65 * linearVert;
        }
        double alpha = 1.0 - Math.exp(-dt / 0.12);
        sx += (vx - sx) * alpha; sl += (vl - sl) * alpha; sv += (vv - sv) * alpha;
        double ratio = (140.0 - comfort) / 100;
        double tGa = Math.max(0.05, 0.25 * ratio);
        double tBrake = Math.max(0.05, 0.28 * ratio);
        double tTurn = Math.max(0.05, 0.25 * ratio);
        double tBump = Math.max(0.08, 0.30 * ratio);
        gaPct = Math.min(150, (int)Math.round(Math.max(0, sl) / tGa * 100));
        brakePct = Math.min(150, (int)Math.round(Math.max(0, -sl) / tBrake * 100));
        turnPct = Math.min(150, (int)Math.round(Math.abs(sx) / tTurn * 100));
        bumpPct = Math.min(150, (int)Math.round(sv / tBump * 100));
        int max = Math.max(Math.max(gaPct, brakePct), Math.max(turnPct, bumpPct));
        if (max >= 100 && !violating) { violations++; violating = true; }
        if (max < 85) violating = false;
        double discomfort = over(gaPct) * .8 + over(brakePct) * 1.15 + over(turnPct) * .95 + over(bumpPct) * 1.4;
        tripPenalty += dt * discomfort * 1.9;
        score = Math.max(0, (int)Math.round(100 - tripPenalty));
        long now = SystemClock.elapsedRealtime();
        if (now - lastUiMs >= 1200) {
            lastUiMs = now;
            lastStatus = max >= 100 ? "Vượt ngưỡng chuyển động" : "Đang theo dõi chuyển động";
            JSONObject data = new JSONObject();
            try {
                data.put("score", score); data.put("ga", gaPct);
                data.put("phanh", brakePct); data.put("cua", turnPct);
                data.put("xoc", bumpPct); data.put("violations", violations);
                data.put("samples", count); data.put("lastUpdateMs", System.currentTimeMillis());
            } catch (Exception ignored) { }
            lastData = data.toString();
            latestSamples = count;
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(
                NOTIFICATION_ID,
                notification("Điểm ≈ " + score + " · GA " + gaPct + "% · Phanh " + brakePct + "% · Cua " + turnPct + "% · Xóc " + bumpPct + "%"));
        }
    }

    private static double over(int pct) { return Math.max(0.0, (pct - 95.0) / 35.0); }
    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "SmooDri - theo dõi chuyển động", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Theo dõi cảm biến khi người dùng chủ động bắt đầu chuyến đi");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private Notification notification(String message) {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(this, 3, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, SmooDriMotionService.class);
        stop.setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(this, 4, stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentTitle("SmooDri · Đang đo nền")
            .setContentText(message)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_pause, "DỪNG ĐO", stopIntent)
            .build();
    }

    private void endSession() {
        active = false;
        if (manager != null) manager.unregisterListener(this);
        if (!lastStatus.contains("thất bại") && !lastStatus.contains("không có") &&
            !lastStatus.contains("Không đăng ký") && !lastStatus.contains("không cho")) {
            lastStatus = "Đã dừng đo nền";
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    @Override public void onDestroy() {
        endSession();
        if (worker != null) worker.quitSafely();
        super.onDestroy();
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        // Removing App Hub (including a dismissed PiP task) must not leave
        // a battery-consuming foreground sensor service running invisibly.
        endSession();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
