package vn.gptlohoi.apphub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SmooDriMotionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
