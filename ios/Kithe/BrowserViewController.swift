import UIKit
import WebKit

/// Kithe for iOS - the browser chrome rebuilt on WKWebView.
///
/// Mirrors the Android build: address bar that tells URLs from searches,
/// back/forward/reload, a load-progress bar, and edge-swipe history gestures.
/// Apple requires third-party browsers to use WebKit, so WKWebView is not a
/// shortcut here - it's the only option.
final class BrowserViewController: UIViewController {

    private enum Const {
        static let home = "https://duckduckgo.com/"
        static let search = "https://duckduckgo.com/?q="
    }

    // Matches the desktop and Android themes.
    private enum Theme {
        static let bg = UIColor(red: 0.118, green: 0.122, blue: 0.149, alpha: 1)      // #1E1F26
        static let elevated = UIColor(red: 0.149, green: 0.153, blue: 0.184, alpha: 1) // #26272F
        static let text = UIColor(red: 0.910, green: 0.910, blue: 0.933, alpha: 1)     // #E8E8EE
        static let dim = UIColor(red: 0.604, green: 0.604, blue: 0.647, alpha: 1)      // #9A9AA5
        static let accent = UIColor(red: 0.357, green: 0.549, blue: 1.0, alpha: 1)     // #5B8CFF
        static let border = UIColor(red: 0.204, green: 0.208, blue: 0.247, alpha: 1)   // #34353F
    }

    private var webView: WKWebView!
    private let addressBar = UITextField()
    private let progressBar = UIProgressView(progressViewStyle: .bar)
    private let backButton = UIButton(type: .system)
    private let forwardButton = UIButton(type: .system)
    private let reloadButton = UIButton(type: .system)

    private var progressObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?
    private var navObservations: [NSKeyValueObservation] = []

    /// A URL handed over by another app, if Kithe was opened as the browser.
    var initialURL: URL?

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.bg

        buildWebView()
        buildChrome()
        layout()
        observeWebView()

        load(initialURL?.absoluteString ?? Const.home)
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    // MARK: - Construction

    private func buildWebView() {
        // No site cache is kept; cookies and site logins are untouched, so
        // you stay signed in.
        URLCache.shared = URLCache(memoryCapacity: 0, diskCapacity: 0, directory: nil)
        clearSiteCache()
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.clearSiteCache()
        }

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        if #available(iOS 16.4, *) { webView.isInspectable = false }
        webView.allowsBackForwardNavigationGestures = true   // edge-swipe history
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.backgroundColor = .white
    }

    private func clearSiteCache() {
        let cacheTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
            WKWebsiteDataTypeFetchCache,
            WKWebsiteDataTypeServiceWorkerRegistrations,
        ]
        WKWebsiteDataStore.default().removeData(ofTypes: cacheTypes, modifiedSince: .distantPast) {}
    }

    private func buildChrome() {
        addressBar.translatesAutoresizingMaskIntoConstraints = false
        addressBar.backgroundColor = Theme.bg
        addressBar.textColor = Theme.text
        addressBar.tintColor = Theme.accent
        addressBar.font = .systemFont(ofSize: 14)
        addressBar.layer.cornerRadius = 18
        addressBar.layer.borderWidth = 1
        addressBar.layer.borderColor = Theme.border.cgColor
        addressBar.autocapitalizationType = .none
        addressBar.autocorrectionType = .no
        addressBar.keyboardType = .webSearch
        addressBar.returnKeyType = .go
        addressBar.clearButtonMode = .whileEditing
        addressBar.delegate = self
        addressBar.attributedPlaceholder = NSAttributedString(
            string: "Search or enter address",
            attributes: [.foregroundColor: Theme.dim]
        )
        // Inset the text off the rounded edge.
        let pad = UIView(frame: CGRect(x: 0, y: 0, width: 14, height: 1))
        addressBar.leftView = pad
        addressBar.leftViewMode = .always

        configure(backButton, systemName: "chevron.left", action: #selector(goBack))
        configure(forwardButton, systemName: "chevron.right", action: #selector(goForward))
        configure(reloadButton, systemName: "arrow.clockwise", action: #selector(reload))

        progressBar.translatesAutoresizingMaskIntoConstraints = false
        progressBar.progressTintColor = Theme.accent
        progressBar.trackTintColor = .clear
        progressBar.alpha = 0
    }

    private func configure(_ button: UIButton, systemName: String, action: Selector) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setImage(UIImage(systemName: systemName), for: .normal)
        button.tintColor = Theme.text
        button.addTarget(self, action: action, for: .touchUpInside)
        button.widthAnchor.constraint(equalToConstant: 34).isActive = true
    }

    private func layout() {
        let bar = UIView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.backgroundColor = Theme.elevated

        let stack = UIStackView(arrangedSubviews: [backButton, forwardButton, addressBar, reloadButton])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 6
        stack.alignment = .center

        bar.addSubview(stack)
        view.addSubview(bar)
        view.addSubview(progressBar)
        view.addSubview(webView)

        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: guide.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            stack.topAnchor.constraint(equalTo: bar.topAnchor, constant: 6),
            stack.bottomAnchor.constraint(equalTo: bar.bottomAnchor, constant: -6),
            stack.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -8),

            addressBar.heightAnchor.constraint(equalToConstant: 38),

            progressBar.topAnchor.constraint(equalTo: bar.bottomAnchor),
            progressBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressBar.heightAnchor.constraint(equalToConstant: 3),

            webView.topAnchor.constraint(equalTo: progressBar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        updateNavButtons()
    }

    // MARK: - Observation

    private func observeWebView() {
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] web, _ in
            guard let self else { return }
            let done = web.estimatedProgress >= 1
            self.progressBar.setProgress(Float(web.estimatedProgress), animated: true)
            UIView.animate(withDuration: 0.2) { self.progressBar.alpha = done ? 0 : 1 }
            if done { self.progressBar.setProgress(0, animated: false) }
        }

        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] web, _ in
            self?.showURL(web.url?.absoluteString)
        }

        navObservations = [
            webView.observe(\.canGoBack) { [weak self] _, _ in self?.updateNavButtons() },
            webView.observe(\.canGoForward) { [weak self] _, _ in self?.updateNavButtons() },
        ]
    }

    /// Keeps the bar showing the live URL unless the user is mid-edit.
    private func showURL(_ url: String?) {
        guard !addressBar.isFirstResponder, let url else { return }
        addressBar.text = url
    }

    private func updateNavButtons() {
        backButton.isEnabled = webView.canGoBack
        backButton.alpha = webView.canGoBack ? 1 : 0.35
        forwardButton.isEnabled = webView.canGoForward
        forwardButton.alpha = webView.canGoForward ? 1 : 0.35
    }

    // MARK: - Navigation

    /// Treats input as a URL when it looks like one, otherwise searches.
    func load(_ input: String) {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        let target: String
        if text.hasPrefix("http://") || text.hasPrefix("https://") {
            target = text
        } else if !text.contains(" "), text.contains(".") {
            target = "https://" + text
        } else {
            let escaped = text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? text
            target = Const.search + escaped
        }

        guard let url = URL(string: target) else { return }
        webView.load(URLRequest(url: url))
    }

    @objc private func goBack() { if webView.canGoBack { webView.goBack() } }
    @objc private func goForward() { if webView.canGoForward { webView.goForward() } }
    @objc private func reload() { webView.reload() }
}

// MARK: - UITextFieldDelegate

extension BrowserViewController: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        load(textField.text ?? "")
        textField.resignFirstResponder()
        return true
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {
        textField.selectAll(nil)
    }

    func textFieldDidEndEditing(_ textField: UITextField) {
        showURL(webView.url?.absoluteString)
    }
}

// MARK: - WKNavigationDelegate

extension BrowserViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // Hand non-web schemes (tel:, mailto:, maps:) to the system.
        if let scheme = url.scheme, !["http", "https", "about", "data"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        present(errorAlert(error), animated: true)
    }

    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        // Cancelled loads fire here too; they aren't worth interrupting for.
        if (error as NSError).code == NSURLErrorCancelled { return }
        present(errorAlert(error), animated: true)
    }

    private func errorAlert(_ error: Error) -> UIAlertController {
        let alert = UIAlertController(title: "Couldn't load page",
                                      message: error.localizedDescription,
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        return alert
    }
}

// MARK: - WKUIDelegate

extension BrowserViewController: WKUIDelegate {
    /// Opens target=_blank links in the same view rather than dropping them.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}
