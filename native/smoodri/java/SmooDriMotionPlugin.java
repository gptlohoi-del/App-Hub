package vn.gptlohoi.apphub;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import org.json.JSONObject;

@CapacitorPlugin(name = "SmooDriMotion", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class SmooDriMotionPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Bạn cần cho phép thông báo để thấy dịch vụ đo nền và nút Dừng đo.", "NOTIFICATION_PERMISSION_DENIED");
            return;
        }
        startService(call);
    }

    private void startService(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), SmooDriMotionService.class);
            intent.setAction(SmooDriMotionService.ACTION_START);
            Integer comfort = call.getInt("comfort");
            intent.putExtra(SmooDriMotionService.EXTRA_COMFORT, comfort == null ? 60 : comfort);
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            JSObject response = new JSObject();
            response.put("requested", true);
            call.resolve(response);
        } catch (Exception e) {
            call.reject("Không thể chạy đo nền: " + e.getMessage(), "START_FAILED", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), SmooDriMotionService.class);
        intent.setAction(SmooDriMotionService.ACTION_STOP);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Không thể dừng dịch vụ đo nền: " + e.getMessage(), "STOP_FAILED", e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            JSONObject state = SmooDriMotionService.state();
            JSObject result = new JSObject();
            java.util.Iterator<String> it = state.keys();
            while (it.hasNext()) {
                String key = it.next();
                result.put(key, state.opt(key));
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Không đọc được trạng thái cảm biến", "STATUS_FAILED", e);
        }
    }
}
