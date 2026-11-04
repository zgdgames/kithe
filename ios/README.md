# Kithe for iOS

The iOS build of Kithe — a WKWebView browser matching the Android app:
address bar that tells URLs from searches, back/forward/reload, load progress,
edge-swipe history, external schemes handed to the system, and the same
blue/purple dark theme.

**This source is complete but has never been compiled.** It was written on
Linux, where the iOS SDK doesn't exist. Expect to fix a small compile error or
two on first build — that's normal for unbuilt code, and nothing here is
exotic.

## What you need

A **Mac with Xcode**. There is no way around this: the iOS SDK (UIKit, WebKit)
ships only inside Xcode, and Xcode runs only on macOS. No Linux or Windows
toolchain can build an iPhone app.

If you don't have a Mac: borrow one, use a Mac cloud host (MacStadium,
Scaleway, GitHub Actions' free `macos-latest` runners), or hand this folder to
someone who has one.

## Building it

### Option A — no extra tools

1. Open Xcode → **File → New → Project → iOS → App**.
2. Product Name **Kithe**, Interface **Storyboard**, Language **Swift**.
   Save it somewhere new.
3. Delete the generated `ViewController.swift`, `Main.storyboard`, and
   `Assets.xcassets` from the project navigator (choose **Move to Trash**).
4. Drag these into the project, ticking **Copy items if needed**:
   - `Kithe/AppDelegate.swift`
   - `Kithe/SceneDelegate.swift`
   - `Kithe/BrowserViewController.swift`
   - `Kithe/Assets.xcassets`
5. Replace the generated `Info.plist` with `Kithe/Info.plist`.
6. In **Signing & Capabilities**, pick your team. Set the bundle identifier to
   something unique to you, e.g. `com.yourname.kithe`.
7. Press **⌘R**.

### Option B — XcodeGen

```sh
brew install xcodegen
cd ios
xcodegen generate
open Kithe.xcodeproj
```

`project.yml` already sets the bundle ID, icon, deployment target (iOS 15) and
device family (iPhone + iPad).

## Getting it onto a phone

This is the part with no shortcuts, and it's why iOS trails every other
platform.

| Route | Cost | Expires | Reach |
|---|---|---|---|
| Simulator | free | — | your Mac only |
| Free Apple ID sideload | free | **7 days** | your own devices |
| TestFlight | $99/yr | 90 days per build | 10,000 testers |
| App Store | $99/yr | — | everyone |

**Free sideload:** plug the iPhone in, select it in Xcode, press ⌘R. Then on
the phone, **Settings → General → VPN & Device Management** → trust your
developer certificate. The app stops opening after 7 days; rebuilding resets
it.

**TestFlight** is the realistic way to hand this to other people. It needs a
paid Apple Developer account, App Store Connect setup, and a review pass for
external testers (usually a day or two).

**You cannot put an `.ipa` on the website for people to tap and install.**
Apple only allows that for enterprise-signed apps under a $299/yr account
restricted to your own employees. Kithe's iOS card on the site says exactly
this, which is why there's no iOS download button.

## App Store review, if you go that far

Two rules to know before investing time:

- **Guideline 2.5.6** — third-party browsers must use WebKit. This app already
  does, so it complies. (The EU now permits alternative engines, but that needs
  a separate entitlement and an EU-only build.)
- A plain WebView wrapper around a single site gets rejected under **4.2
  (Minimum Functionality)**. A real browser with an address bar and navigation
  is fine, which is what this is.

## Files

| File | Role |
|---|---|
| `Kithe/BrowserViewController.swift` | the whole browser — chrome, WebView, navigation |
| `Kithe/SceneDelegate.swift` | window setup, handles incoming URLs |
| `Kithe/AppDelegate.swift` | app lifecycle |
| `Kithe/Info.plist` | bundle config, dark mode, URL schemes |
| `Kithe/Assets.xcassets` | app icon (1024px, opaque as Apple requires) |
| `project.yml` | XcodeGen spec |
