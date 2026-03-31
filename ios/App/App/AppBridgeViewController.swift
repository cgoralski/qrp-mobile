import UIKit
import Capacitor

/// Forces the WKWebView to use the bundled `public/` folder from `npx cap sync`.
///
/// Capacitor may persist `serverBasePath` (Ionic-style live updates / snapshots). When that path is stale or
/// empty, the runtime loads from `Library/NoCloud/ionic_built_snapshots/...` instead of the app bundle — the
/// synced `public/index.html` is never used (black screen; Safari console often empty).
final class AppBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // Cold launch: transparent WKWebView can look like a black screen until the first paint.
        bridge?.webView?.isOpaque = true
        bridge?.webView?.backgroundColor = .systemBackground
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        bridge?.webView?.setNeedsLayout()
        bridge?.webView?.layoutIfNeeded()
    }

    override func instanceDescriptor() -> InstanceDescriptor {
        if let stale = KeyValueStore.standard["serverBasePath", as: String.self], !stale.isEmpty {
            NSLog("⚡️ QRP Mobile: clearing persisted serverBasePath (was: %@) — using bundled public/", stale)
        }
        KeyValueStore.standard["serverBasePath"] = nil as String?
        return super.instanceDescriptor()
    }
}
