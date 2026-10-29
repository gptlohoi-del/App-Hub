package vn.gptlohoi.apphub;

import android.Manifest;
import android.content.pm.PackageManager;
import android.app.PictureInPictureParams;
import android.app.PendingIntent;
import android.app.RemoteAction;
import android.content.Intent;
import android.graphics.drawable.Icon;
import java.util.Collections;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import android.util.Rational;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean autoPiP = false;
    private static final String ACTION_END_SESSION = "vn.gptlohoi.apphub.action.END_SMOODRI";

    // A single native action closes the PiP window AND releases its sensor service.
    private void endSmooDriAndClose() {
        autoPiP = false;
        try {
            stopService(new Intent(this, SmooDriMotionService.class));
        } catch (Exception ignored) { /* Android is already shutting down the app */ }
        finishAndRemoveTask();
    }

    private RemoteAction makeEndSessionAction() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(ACTION_END_SESSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 7411, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RemoteAction(
                Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel),
                "KẾT THÚC", "Đóng PiP và dừng đo SmooDri", pending);
    }

    private PictureInPictureParams buildPiPParams(boolean enableAuto) {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9));
        RemoteAction end = makeEndSessionAction();
        builder.setActions(Collections.singletonList(end));
        // Android 13+: the normal PiP X button runs the same cleanup action.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            builder.setCloseAction(end);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(enableAuto)
                    .setSeamlessResizeEnabled(false);
        }
        return builder.build();
    }

    @Override public void onCreate(Bundle state) {
        registerPlugin(SmooDriMotionPlugin.class);
        registerPlugin(AppHubPiPPlugin.class);
        super.onCreate(state);
        if (ACTION_END_SESSION.equals(getIntent() == null ? null : getIntent().getAction())) {
            endSmooDriAndClose();
            return;
        }
        // Request foreground location permission for SmooDri GPS speed.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }, 7041);
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (ACTION_END_SESSION.equals(intent == null ? null : intent.getAction())) {
            endSmooDriAndClose();
        }
    }

    @Override public void onDestroy() {
        // Do not stop merely because the user presses Home; auto PiP needs it.
        // A deliberate Activity finish/close ends the measuring session.
        if (isFinishing() && !isChangingConfigurations()) {
            try { stopService(new Intent(this, SmooDriMotionService.class)); }
            catch (Exception ignored) { }
        }
        super.onDestroy();
    }

    public void setAppHubAutoPiP(boolean enabled) {
        autoPiP = enabled;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setPictureInPictureParams(buildPiPParams(enabled));
        }
    }

    public boolean enterAppHubPiP() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        return enterPictureInPictureMode(buildPiPParams(autoPiP));
    }

    // On Android 8–11, automatic PiP is triggered on Home/Recents.
    // Android 12+ uses setAutoEnterEnabled while the service is running.
    @Override protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S && autoPiP &&
            !isInPictureInPictureMode()) {
            try { enterAppHubPiP(); } catch (Exception ignored) { }
        }
    }

    @Override public void onPictureInPictureModeChanged(boolean enabled, Configuration config) {
        super.onPictureInPictureModeChanged(enabled, config);
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final String js = "window.dispatchEvent(new CustomEvent('apphub:native-pip',{detail:{active:" + enabled + "}}));";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
