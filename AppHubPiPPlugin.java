package vn.gptlohoi.apphub;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppHubPiP")
public class AppHubPiPPlugin extends Plugin {
    private boolean supported() {
        Activity a = getActivity();
        return a != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            a.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    @PluginMethod public void isSupported(PluginCall call) {
        JSObject data = new JSObject();
        data.put("supported", supported());
        call.resolve(data);
    }

    @PluginMethod public void setAutoEnter(PluginCall call) {
        if (!supported()) { call.reject("PiP unavailable", "PIP_UNAVAILABLE"); return; }
        Boolean enabled = call.getBoolean("enabled");
        getActivity().runOnUiThread(() -> {
            try {
                ((MainActivity)getActivity()).setAppHubAutoPiP(Boolean.TRUE.equals(enabled));
                call.resolve();
            } catch (Exception e) { call.reject("Could not set PiP mode: " + e.getMessage()); }
        });
    }

    @PluginMethod public void setAspectRatio(PluginCall call) {
        if (!supported()) { call.reject("PiP unavailable", "PIP_UNAVAILABLE"); return; }
        Integer width = call.getInt("width");
        Integer height = call.getInt("height");
        if (width == null || height == null || !(
            (width == 16 && height == 9) || (width == 4 && height == 3) || (width == 1 && height == 1))) {
            call.reject("Only 16:9, 4:3, 1:1 are supported", "PIP_BAD_RATIO");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                ((MainActivity)getActivity()).setAppHubPiPAspectRatio(width, height);
                call.resolve();
            } catch (Exception e) { call.reject("Could not update PiP ratio: " + e.getMessage()); }
        });
    }

    @PluginMethod public void enter(PluginCall call) {
        if (!supported()) { call.reject("PiP unavailable", "PIP_UNAVAILABLE"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                if (((MainActivity)getActivity()).enterAppHubPiP()) call.resolve();
                else call.reject("Android refused PiP");
            } catch (Exception e) { call.reject("Could not enter PiP: " + e.getMessage()); }
        });
    }
}
