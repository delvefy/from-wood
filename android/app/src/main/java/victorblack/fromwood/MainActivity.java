package victorblack.fromwood;

import android.os.Bundle;
import android.view.View;
import androidx.activity.EdgeToEdge;
import androidx.core.view.ViewCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Draw behind the system bars on every Android version, not only 15+
        // where the platform enforces it. The web layer pads with
        // env(safe-area-inset-*) (index.html sets viewport-fit=cover).
        // After super.onCreate: BridgeActivity swaps in AppTheme.NoActionBar
        // there, and touching the window before that leaves the action bar on.
        registerPlugin(StatusBarStylePlugin.class);
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);

        // The CoordinatorLayout holding the WebView pads itself with the system
        // bar insets, which would letterbox the page in the window background.
        // Pass the insets through untouched so the page reaches the screen
        // edges and its own env(safe-area-inset-*) padding does the work.
        View webView = getBridge().getWebView();
        if (webView != null && webView.getParent() instanceof View) {
            View root = (View) webView.getParent();
            root.setFitsSystemWindows(false);
            root.setPadding(0, 0, 0, 0);
            ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> insets);
            ViewCompat.requestApplyInsets(root);
        }
    }
}
