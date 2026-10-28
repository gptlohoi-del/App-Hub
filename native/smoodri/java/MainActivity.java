package vn.gptlohoi.apphub;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean autoPiP = false;

    @Override public void onCreate(Bundle state) {
        registerPlugin(SmooDriMotionPlugin.class);
        registerPlugin(AppHubPiPPlugin.class);
        super.onCreate(state);
    }

    public void setAppHubAutoPiP(boolean enabled) {
        autoPiP = enabled;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setPictureInPictureParams(new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .setAutoEnterEnabled(enabled)
                .setSeamlessResizeEnabled(false)
                .build());
        }
    }

    public boolean enterAppHubPiP() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        return enterPictureInPictureMode(new PictureInPictureParams.Builder()
            .setAspectRatio(new Rational(16, 9)).build());
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
