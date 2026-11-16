import ExpoModulesCore
import UIKit

public class AccordAdminLayoutModule: Module {
  private var tokens: [NSObjectProtocol] = []
  private var last: NSDictionary?
  private var destroyed = false
  @MainActor private var scaffoldLayouts: ScaffoldLayoutRegistryCore?
  @MainActor private func scaffoldRegistry() -> ScaffoldLayoutRegistryCore {
    if let scaffoldLayouts { return scaffoldLayouts }
    let registry = ScaffoldLayoutRegistryCore(host: ScaffoldLayoutUIKitHost(appContext)) { [weak self] value in self?.sendEvent("onScaffoldLayoutChange", ScaffoldLayoutWire.event(value)) }
    scaffoldLayouts = registry; return registry
  }

  public func definition() -> ModuleDefinition {
    Name("AccordAdminLayout")
    Events("onInsetsChange", "onScaffoldLayoutChange")

    AsyncFunction("scaffoldLayoutCapability") { () -> [String: Any]? in
      MainActor.assumeIsolated { self.destroyed ? nil : ["protocol": 1, "guarantee": "original-window-layout-snapshot", "platform": "ios", "rawIme": true] }
    }.runOnQueue(.main)
    AsyncFunction("bindScaffoldViewport") { (tag: Int, id: String, ticket: String) throws -> [String: Any] in
      try MainActor.assumeIsolated { guard !self.destroyed else { throw ScaffoldLayoutFailure.code("module_destroyed") }; return ScaffoldLayoutWire.receipt(try self.scaffoldRegistry().bindViewport(tag, id, ticket)) }
    }.runOnQueue(.main)
    AsyncFunction("bindScaffoldParts") { (handle: String, owner: String, dockTag: Int, dockID: String, fixedTag: Int, fixedID: String, ticket: String) throws -> [String: Any] in
      try MainActor.assumeIsolated { guard !self.destroyed else { throw ScaffoldLayoutFailure.code("module_destroyed") }; return ScaffoldLayoutWire.receipt(try self.scaffoldRegistry().bindParts(handle, owner, dockTag, dockID, fixedTag, fixedID, ticket)) }
    }.runOnQueue(.main)
    AsyncFunction("bindScaffoldDock") { (handle: String, owner: String, tag: Int, id: String, ticket: String) throws -> [String: Any] in
      try MainActor.assumeIsolated { guard !self.destroyed else { throw ScaffoldLayoutFailure.code("module_destroyed") }; return ScaffoldLayoutWire.receipt(try self.scaffoldRegistry().bindDock(handle, owner, tag, id, ticket)) }
    }.runOnQueue(.main)
    AsyncFunction("releaseScaffoldLayout") { (handle: String, ticket: String) -> Bool in MainActor.assumeIsolated { self.scaffoldLayouts?.release(handle, ticket) ?? false } }.runOnQueue(.main)
    AsyncFunction("cancelScaffoldLayoutTicket") { (ticket: String) -> Bool in MainActor.assumeIsolated { self.destroyed ? false : self.scaffoldRegistry().cancelTicket(ticket) } }.runOnQueue(.main)

    // V2 never queries Android navigation mode on Apple platforms.
    AsyncFunction("isGestureNavigation") { false }.runOnQueue(.main)
    AsyncFunction("readInsets") { () -> [String: Any]? in
      MainActor.assumeIsolated { self.snapshot() }
    }.runOnQueue(.main)

    OnStartObserving("onInsetsChange") {
      DispatchQueue.main.async { if !self.destroyed { self.startObserving() } }
    }
    OnStopObserving("onInsetsChange") { DispatchQueue.main.async { self.stopObserving() } }
    OnDestroy { DispatchQueue.main.async { self.destroyed = true; self.stopObserving(); self.scaffoldLayouts?.destroy(); self.scaffoldLayouts = nil } }
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
