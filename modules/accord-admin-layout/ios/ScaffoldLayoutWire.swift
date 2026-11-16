import Foundation

enum ScaffoldLayoutWire {
  private static func rect(_ value: ScaffoldRect) -> [String: Any] { ["x": value.x, "y": value.y, "width": value.width, "height": value.height] }
  private static func viewport(_ value: ScaffoldViewport) -> [String: Any] { ["rect": rect(value.rect), "rawImeBottom": value.rawImeBottom,
    "viewPaddingBottom": value.viewPaddingBottom, "systemGestureBottom": value.systemGestureBottom, "safeTop": value.safeTop, "safeLeft": value.safeLeft, "safeRight": value.safeRight] }
  static func event(_ value: ScaffoldLayoutEvent) -> [String: Any] {
    ["protocol": 1, "guarantee": "original-window-layout-snapshot", "platform": "ios", "kind": value.kind,
      "handle": value.handle, "ticket": value.ticket, "windowID": value.windowID, "viewportHandle": value.viewportHandle,
      "revision": value.revision, "frame": value.frame, "retired": value.retired, "viewport": (value.viewport.map(viewport) as Any?) ?? NSNull(),
      "dock": (value.dock.map { ["viewport": viewport($0.viewport), "dockHeight": $0.dockHeight] as [String: Any] } as Any?) ?? NSNull(),
      "pair": (value.pair.map { ["viewport": viewport($0.viewport), "fixed": rect($0.fixed), "dockHeight": $0.dockHeight] as [String: Any] } as Any?) ?? NSNull()]
  }
  static func receipt(_ value: ScaffoldLayoutReceipt) -> [String: Any] { ["handle": value.handle, "ticket": value.ticket, "windowID": value.windowID, "initial": event(value.initial)] }
}
