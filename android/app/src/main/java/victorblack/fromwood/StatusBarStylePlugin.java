package victorblack.fromwood;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.view.Window;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Minimal stand-in for @capacitor/status-bar. The app only ever flips the
 * status bar icon colour to match its theme; the stock plugin also reads and
 * writes Window.setStatusBarColor and the SYSTEM_UI_FLAG_* bits, all of which
 * Android 15 deprecates and Play flags on edge-to-edge apps. The window is
 * drawn edge-to-edge by MainActivity, so the bar background is the page's own.
 */
@CapacitorPlugin(name = "StatusBarStyle")
public class StatusBarStylePlugin extends Plugin {

    /** style: "dark" for light icons on a dark page, "light" for dark icons on a light page. */
    @PluginMethod
    public void setStyle(PluginCall call) {
        String style = call.getString("style", "dark");
        boolean lightIcons = !"light".equals(style);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            // "Light status bars" means dark icons for a light background.
            controller.setAppearanceLightStatusBars(!lightIcons);
            controller.setAppearanceLightNavigationBars(!lightIcons);
            call.resolve();
        });
    }
}
