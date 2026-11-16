import Foundation

@MainActor private final class Node: ScaffoldLayoutNode {
  let tag: Int; var id: String; var attached = true; var parent: Node?
  var root: AnyObject; var window: AnyObject; var token: AnyObject
  init(_ tag: Int, _ id: String, _ root: AnyObject, _ window: AnyObject, _ token: AnyObject) { self.tag = tag; self.id = id; self.root = root; self.window = window; self.token = token }
  var identity: AnyObject { self }; var rootIdentity: AnyObject? { root }; var windowIdentity: AnyObject? { window }; var windowToken: AnyObject? { token }
}
@MainActor private final class Host: ScaffoldLayoutHost {
  let root = NSObject(), window = NSObject(), token = NSObject()
  var nodes: [Int: Node] = [:]; var observers: [UUID: () -> Void] = [:]; var known = true; var ime = 0.0; var dockHeight = 199.0; var duringRead: (() -> Void)?
  var viewport: Node { nodes[1]! }; var dock: Node { nodes[2]! }; var fixed: Node { nodes[3]! }
  init() { for (tag, id) in [(1, "viewport"), (2, "dock"), (3, "fixed")] { nodes[tag] = Node(tag, id, root, window, token) }; dock.parent = viewport; fixed.parent = viewport }
  func assertMainThread() { precondition(Thread.isMainThread) }
  func resolve(_ tag: Int, _ nativeID: String) -> ScaffoldLayoutNode? { guard let node = nodes[tag], node.id == nativeID else { return nil }; return node }
  func matches(_ node: ScaffoldLayoutNode, _ tag: Int, _ nativeID: String) -> Bool { nodes[tag] === node.identity && nodes[tag]?.id == nativeID }
  func contains(_ ancestor: ScaffoldLayoutNode, _ descendant: ScaffoldLayoutNode) -> Bool { var parent = (descendant as? Node)?.parent; while let current = parent { if current === ancestor.identity { return true }; parent = current.parent }; return false }
  func observe(_ viewport: ScaffoldLayoutNode, _ changed: @escaping () -> Void) throws -> () -> Void { let id = UUID(); observers[id] = changed; return { self.observers.removeValue(forKey: id) } }
  func readViewport(_ viewport: ScaffoldLayoutNode) -> ScaffoldViewport? {
    let action = duringRead; duringRead = nil; action?()
    return known ? ScaffoldViewport(rect: ScaffoldRect(x: 0, y: 0, width: 400, height: 800), rawImeBottom: ime, viewPaddingBottom: 24, systemGestureBottom: 0, safeTop: 30, safeLeft: 11, safeRight: 23) : nil
  }
  func readDock(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode) -> ScaffoldDock? { guard let value = readViewport(viewport) else { return nil }; return ScaffoldDock(viewport: value, dockHeight: dockHeight) }
  func readPair(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode, _ fixed: ScaffoldLayoutNode) -> ScaffoldPair? { guard let value = readViewport(viewport) else { return nil }; return ScaffoldPair(viewport: value, fixed: ScaffoldRect(x: 0, y: 0, width: 400, height: 500), dockHeight: dockHeight) }
  func changed() { for observer in Array(observers.values) { observer() } }
}
@MainActor private final class Transform: ScaffoldTransformNode {
  var identity: AnyObject { self }; var untransformed = true; var next: Transform?
  var parent: ScaffoldTransformNode? { next }
}
@main struct ScaffoldHostTests {
  @MainActor static func main() throws {
    func check(_ value: @autoclosure () -> Bool, _ message: String) { precondition(value(), message) }
    func fails(_ code: String, _ action: () throws -> Void) { do { try action(); preconditionFailure("accepted " + code) } catch ScaffoldLayoutFailure.code(let value) { check(value == code, "wrong failure " + value) } catch { preconditionFailure("unexpected " + String(describing: error)) } }
    let name = CommandLine.arguments[1], host = Host(); var events: [ScaffoldLayoutEvent] = []
    let registry = ScaffoldLayoutRegistryCore(host: host) { events.append($0) }
    func viewport() throws -> ScaffoldLayoutReceipt { try registry.bindViewport(1, "viewport", "viewport-watch") }
    func pair(_ owner: ScaffoldLayoutReceipt) throws -> ScaffoldLayoutReceipt { try registry.bindParts(owner.handle, owner.ticket, 2, "dock", 3, "fixed", "pair-watch") }
    switch name {
    case "identity-native-ancestor-path":
      let root = Transform(), parent = Transform(), marker = Transform(); marker.next = parent; parent.next = root; check(ScaffoldLayoutTransforms.supported(marker, root), "real identity path rejected")
    case "ancestor-transform-never-combines-transformed-origin-with-plain-size":
      let root = Transform(), parent = Transform(), marker = Transform(); marker.next = parent; parent.next = root; parent.untransformed = false; check(!ScaffoldLayoutTransforms.supported(marker, root), "ancestor transform adopted")
      parent.untransformed = true; root.untransformed = false; check(!ScaffoldLayoutTransforms.supported(marker, root), "root transform adopted")
    case "transform-path-never-substitutes-another-root-or-cycle":
      let root = Transform(), parent = Transform(), marker = Transform(); marker.next = parent; check(!ScaffoldLayoutTransforms.supported(marker, root), "missing root adopted"); parent.next = marker; check(!ScaffoldLayoutTransforms.supported(marker, root), "cyclic path admitted")
    case "bootstrap-actual-dock-before-fixed":
      let owner = try viewport(); check(owner.initial.viewport?.safeTop == 30, "no top"); host.nodes.removeValue(forKey: 3)
      let dock = try registry.bindDock(owner.handle, owner.ticket, 2, "dock", "dock-watch"); check(dock.initial.dock?.dockHeight == 199 && dock.initial.pair == nil, "invented fixed")
    case "all-three-original-markers-and-raw-ime":
      host.ime = 300; let value = try pair(viewport()).initial.pair; check(value?.viewport.rawImeBottom == 300 && value?.fixed.height == 500 && value?.viewport.rect.height == 800, "double resize")
    case "foreign-window-rejected":
      let owner = try viewport(); host.dock.window = NSObject(); fails("parts_not_in_original_viewport") { _ = try pair(owner) }
    case "same-window-foreign-ancestor-rejected":
      let owner = try viewport(); host.dock.parent = nil; fails("parts_not_in_original_viewport") { _ = try pair(owner) }
    case "nested-parts-never-become-siblings":
      _ = try pair(viewport()); host.dock.parent = host.fixed; host.changed(); check(events.last?.retired == true, "nested part adopted")
    case "tag-or-native-id-recycle-retires":
      _ = try pair(viewport()); host.fixed.id = "recycled"; host.changed(); check(events.last?.retired == true, "recycled id adopted")
    case "retained-detach-reattach-same-window":
      _ = try pair(viewport()); host.viewport.attached = false; host.changed(); check(events.last?.pair == nil && events.last?.retired == false, "detach acknowledged")
      host.viewport.attached = true; host.changed(); check(events.last?.pair != nil, "reattach lost")
    case "different-window-cannot-revive":
      _ = try pair(viewport()); host.viewport.token = NSObject(); host.changed(); check(events.last?.retired == true && host.observers.isEmpty, "new window adopted")
    case "unknown-layout-never-becomes-zero":
      host.known = false; let owner = try viewport(); check(owner.initial.viewport == nil, "unknown invented"); let value = try pair(owner); check(value.initial.pair == nil, "unknown pair invented")
      host.known = true; host.changed(); check(events.last?.pair != nil, "new real facts lost")
    case "actual-pixel-height-not-semantic-target":
      host.dockHeight = 547.0 / 2.75; let value = try pair(viewport()); check(value.initial.pair?.dockHeight == 547.0 / 2.75 && host.dockHeight != 199, "coerced target")
    case "reentrant-window-change-before-ack":
      host.duringRead = { host.viewport.window = NSObject() }; fails("viewport_retired") { _ = try viewport() }; check(host.observers.isEmpty, "observer leaked")
    case "exact-release-and-never-reused-ticket":
      let owner = try viewport(); check(!registry.release(owner.handle, "other"), "foreign release"); check(registry.release(owner.handle, owner.ticket), "release lost"); fails("ticket_reused") { _ = try viewport() }
    case "cancel-before-native-bind":
      check(registry.cancelTicket("viewport-watch"), "pending cancel lost"); fails("ticket_reused") { _ = try viewport() }
    case "stale-release-does-not-touch-fresh-owner":
      let owner = try viewport(); _ = registry.release(owner.handle, owner.ticket); _ = try registry.bindViewport(1, "viewport", "fresh-watch"); check(!registry.release(owner.handle, owner.ticket) && host.observers.count == 1, "old release hit fresh")
    case "frame-revisions-dedup-and-source-changes":
      _ = try pair(viewport()); let count = events.count; host.changed(); check(events.count == count, "flooded JS"); host.ime = 100; host.changed(); check(events[events.count - 2].frame == events.last?.frame && events.last!.revision > 1, "frame identity lost")
    case "module-destroy-permanent-activity-invalidate-rebinds":
      _ = try pair(viewport()); registry.invalidate(); _ = try registry.bindViewport(1, "viewport", "fresh-watch"); registry.destroy(); fails("module_destroyed") { _ = try registry.bindViewport(1, "viewport", "destroyed-watch") }; check(host.observers.isEmpty, "destroy leaked")
    default: preconditionFailure(name)
    }
    registry.destroy(); print(name + " passed")
  }
}
