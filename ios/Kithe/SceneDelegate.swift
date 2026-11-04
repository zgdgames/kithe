import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?
    private var browser: BrowserViewController?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let controller = BrowserViewController()
        // A URL passed in by another app (Kithe set as the default browser).
        controller.initialURL = connectionOptions.urlContexts.first?.url
        browser = controller

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = controller
        window.overrideUserInterfaceStyle = .dark
        window.makeKeyAndVisible()
        self.window = window
    }

    /// Handles links opened while Kithe is already running.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        browser?.load(url.absoluteString)
    }
}
