import ExpoModulesCore
import UIKit

public class AccordAdminLayoutModule: Module {
  private var tokens: [NSObjectProtocol] = []
  private var last: NSDictionary?
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("AccordAdminLayout")
    Events("onInsetsChange")

    // V2 never queries Android navigation mode on Apple platforms.
    AsyncFunction("isGestureNavigation") { false }.runOnQueue(.main)
    AsyncFunction("readInsets") { () -> [String: Any]? in
      MainActor.assumeIsolated { self.snapshot() }
    }.runOnQueue(.main)

    OnStartObserving("onInsetsChange") {
      DispatchQueue.main.async { if !self.destroyed { self.startObserving() } }
    }
    OnStopObserving("onInsetsChange") { DispatchQueue.main.async { self.stopObserving() } }
    OnDestroy { DispatchQueue.main.async { self.destroyed = true; self.stopObserving() } }
  }

  @MainActor private func snapshot() -> [String: Any]? {
    guard let controller = appContext?.utilities?.currentViewController(),
          let window = controller.viewIfLoaded?.window,
          !window.isHidden, window.bounds.width > 0, window.bounds.height > 0 else { return nil }
    window.layoutIfNeeded()
    let bounds = window.bounds
    let safe = window.safeAreaInsets
    let keyboard = window.keyboardLayoutGuide.layoutFrame
    // UIKit's default guide follows docked keyboards only; hidden/floating guide top is safe-area bottom.
    // Read it without changing followsUndockedKeyboard or any global keyboard/inset observer.
    let docked = keyboard.maxY >= bounds.maxY && keyboard.minY < bounds.maxY - safe.bottom
    let inset = docked ? max(0, bounds.maxY - keyboard.minY) : 0
    return [
      "platform": "ios", "width": Double(bounds.width), "height": Double(bounds.height),
      "viewPaddingBottom": Double(safe.bottom),
      // Flutter's iOS viewport setter updates safe-area padding; system-gesture metrics retain zero.
      "systemGestureInsetsBottom": 0.0, "viewInsetsBottom": Double(inset),
    ]
  }

  @MainActor private func startObserving() {
    guard tokens.isEmpty else { return }
    let names: [Notification.Name] = [
      UIApplication.didBecomeActiveNotification, UIWindow.didBecomeKeyNotification,
      UIWindow.didBecomeVisibleNotification, UIDevice.orientationDidChangeNotification,
      UIResponder.keyboardWillShowNotification, UIResponder.keyboardDidShowNotification,
      UIResponder.keyboardWillHideNotification, UIResponder.keyboardDidHideNotification,
      UIResponder.keyboardWillChangeFrameNotification, UIResponder.keyboardDidChangeFrameNotification,
    ]
    for name in names {
      tokens.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        DispatchQueue.main.async { self?.emitChanged() }
      })
    }
    emitChanged()
  }

  @MainActor private func stopObserving() {
    tokens.forEach { NotificationCenter.default.removeObserver($0) }
    tokens.removeAll()
    last = nil
  }

  @MainActor private func emitChanged() {
    guard !destroyed, !tokens.isEmpty else { return }
    let value = snapshot()
    let dictionary = value.map { NSDictionary(dictionary: $0) }
    if dictionary != last {
      last = dictionary
      sendEvent("onInsetsChange", ["metrics": value.map { $0 as Any } ?? NSNull()])
    }
  }
}
