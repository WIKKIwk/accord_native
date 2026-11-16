import Foundation

// Foundation-only ownership core, executable in host tests without UIKit or an app build.
struct ScaffoldRect: Equatable { let x, y, width, height: Double }
struct ScaffoldViewport: Equatable {
  let rect: ScaffoldRect
  let rawImeBottom, viewPaddingBottom, systemGestureBottom, safeTop, safeLeft, safeRight: Double
}
struct ScaffoldPair: Equatable { let viewport: ScaffoldViewport; let fixed: ScaffoldRect; let dockHeight: Double }
struct ScaffoldDock: Equatable { let viewport: ScaffoldViewport; let dockHeight: Double }
@MainActor protocol ScaffoldLayoutNode: AnyObject {
  var identity: AnyObject { get }; var attached: Bool { get }; var rootIdentity: AnyObject? { get }
  var windowIdentity: AnyObject? { get }; var windowToken: AnyObject? { get }
}
@MainActor protocol ScaffoldLayoutHost: AnyObject {
  func assertMainThread()
  func resolve(_ tag: Int, _ nativeID: String) -> ScaffoldLayoutNode?
  func matches(_ node: ScaffoldLayoutNode, _ tag: Int, _ nativeID: String) -> Bool
  func contains(_ ancestor: ScaffoldLayoutNode, _ descendant: ScaffoldLayoutNode) -> Bool
  func observe(_ viewport: ScaffoldLayoutNode, _ changed: @escaping () -> Void) throws -> () -> Void
  func readViewport(_ viewport: ScaffoldLayoutNode) -> ScaffoldViewport?
  func readDock(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode) -> ScaffoldDock?
  func readPair(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode, _ fixed: ScaffoldLayoutNode) -> ScaffoldPair?
}
struct ScaffoldLayoutEvent {
  let kind, handle, ticket, windowID, viewportHandle: String
  let revision, frame: Int; let retired: Bool; let viewport: ScaffoldViewport?; let dock: ScaffoldDock?; let pair: ScaffoldPair?
}
struct ScaffoldLayoutReceipt { let handle, ticket, windowID: String; let initial: ScaffoldLayoutEvent }
enum ScaffoldLayoutFailure: Error { case code(String) }
@MainActor final class ScaffoldLayoutRegistryCore {
  static let guarantee = "original-window-layout-snapshot"
  private struct Marker { let tag: Int; let id: String; let node: ScaffoldLayoutNode }
  private final class ViewportEntry {
    let handle = "scaffold-viewport-" + UUID().uuidString; let windowID = "scaffold-window-" + UUID().uuidString
    let ticket: String; let marker: Marker; let root, window, token: AnyObject
    var parts: [String: PartEntry] = [:]; var stop: (() -> Void)?; var last: ScaffoldLayoutEvent?; var revision = 0; var frame = 0; var sampling = false; var retired = false
    init(_ ticket: String, _ marker: Marker, _ root: AnyObject, _ window: AnyObject, _ token: AnyObject) {
      self.ticket = ticket; self.marker = marker; self.root = root; self.window = window; self.token = token
    }
  }
  private final class PartEntry {
    let handle = "scaffold-parts-" + UUID().uuidString; let ticket: String; unowned let owner: ViewportEntry; let dock: Marker; let fixed: Marker?
    var last: ScaffoldLayoutEvent?; var revision = 0; var retired = false
    init(_ ticket: String, _ owner: ViewportEntry, _ dock: Marker, _ fixed: Marker?) { self.ticket = ticket; self.owner = owner; self.dock = dock; self.fixed = fixed }
  }
  private let host: ScaffoldLayoutHost; private let sink: (ScaffoldLayoutEvent) -> Void
  private var viewports: [String: ViewportEntry] = [:], parts: [String: PartEntry] = [:], usedTickets: Set<String> = []; private var destroyed = false
  init(host: ScaffoldLayoutHost, sink: @escaping (ScaffoldLayoutEvent) -> Void) { self.host = host; self.sink = sink }
  static func validID(_ value: String) -> Bool {
    guard let match = value.range(of: "^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$", options: .regularExpression) else { return false }
    return match.lowerBound == value.startIndex && match.upperBound == value.endIndex
  }
  private func reserve(_ ticket: String) throws {
    host.assertMainThread(); if destroyed { throw ScaffoldLayoutFailure.code("module_destroyed") }
    guard Self.validID(ticket) else { throw ScaffoldLayoutFailure.code("invalid_ticket") }
    guard usedTickets.insert(ticket).inserted else { throw ScaffoldLayoutFailure.code("ticket_reused") }
  }
  private func resolve(_ tag: Int, _ id: String) throws -> Marker {
    guard tag > 0, Self.validID(id) else { throw ScaffoldLayoutFailure.code("invalid_marker") }
    guard let node = host.resolve(tag, id), host.matches(node, tag, id) else { throw ScaffoldLayoutFailure.code("marker_unavailable") }
    return Marker(tag: tag, id: id, node: node)
  }
  private func live(_ owner: ViewportEntry) -> Bool { !destroyed && !owner.retired && viewports[owner.handle] === owner }
  private func matches(_ marker: Marker) -> Bool { host.matches(marker.node, marker.tag, marker.id) }
  private func sameWindow(_ owner: ViewportEntry, _ node: ScaffoldLayoutNode) -> Bool {
    node.attached && node.rootIdentity === owner.root && node.windowIdentity === owner.window && node.windowToken === owner.token
  }
  private func original(_ owner: ViewportEntry) -> Bool {
    guard live(owner) else { return false }; guard matches(owner.marker) else { retire(owner); return false }
    guard owner.marker.node.attached else { return false }
    guard sameWindow(owner, owner.marker.node) else { retire(owner); return false }; return true
  }
  func bindViewport(_ tag: Int, _ id: String, _ ticket: String) throws -> ScaffoldLayoutReceipt {
    try reserve(ticket); let marker = try resolve(tag, id)
    guard marker.node.attached, let root = marker.node.rootIdentity, let window = marker.node.windowIdentity, let token = marker.node.windowToken else { throw ScaffoldLayoutFailure.code("viewport_not_attached") }
    let owner = ViewportEntry(ticket, marker, root, window, token); viewports[owner.handle] = owner
    do {
      let stop = try host.observe(marker.node) { [weak self, weak owner] in if let owner { self?.refresh(owner) } }
      guard live(owner) else { stop(); throw ScaffoldLayoutFailure.code("viewport_retired") }; owner.stop = stop; refresh(owner)
      guard live(owner), original(owner), let initial = owner.last else { throw ScaffoldLayoutFailure.code("viewport_retired") }
      return ScaffoldLayoutReceipt(handle: owner.handle, ticket: ticket, windowID: owner.windowID, initial: initial)
    } catch { retire(owner); throw error }
  }
  func bindParts(_ handle: String, _ ownerTicket: String, _ dockTag: Int, _ dockID: String, _ fixedTag: Int, _ fixedID: String, _ ticket: String) throws -> ScaffoldLayoutReceipt {
    try reserve(ticket); guard let owner = viewports[handle], owner.ticket == ownerTicket, original(owner) else { throw ScaffoldLayoutFailure.code("unknown_viewport") }
    guard !owner.sampling else { throw ScaffoldLayoutFailure.code("viewport_busy") }
    let dock = try resolve(dockTag, dockID), fixed = try resolve(fixedTag, fixedID)
    guard dock.node.identity !== fixed.node.identity, dock.node.identity !== owner.marker.node.identity, fixed.node.identity !== owner.marker.node.identity,
      host.contains(owner.marker.node, dock.node), host.contains(owner.marker.node, fixed.node), !host.contains(dock.node, fixed.node), !host.contains(fixed.node, dock.node),
      sameWindow(owner, dock.node), sameWindow(owner, fixed.node), original(owner) else { throw ScaffoldLayoutFailure.code("parts_not_in_original_viewport") }
    let entry = PartEntry(ticket, owner, dock, fixed); owner.parts[entry.handle] = entry; parts[entry.handle] = entry; refresh(owner)
    guard !entry.retired, live(owner), parts[entry.handle] === entry, let initial = entry.last else { throw ScaffoldLayoutFailure.code("parts_retired") }
    return ScaffoldLayoutReceipt(handle: entry.handle, ticket: ticket, windowID: owner.windowID, initial: initial)
  }
  func bindDock(_ handle: String, _ ownerTicket: String, _ tag: Int, _ id: String, _ ticket: String) throws -> ScaffoldLayoutReceipt {
    try reserve(ticket); guard let owner = viewports[handle], owner.ticket == ownerTicket, original(owner) else { throw ScaffoldLayoutFailure.code("unknown_viewport") }
    guard !owner.sampling else { throw ScaffoldLayoutFailure.code("viewport_busy") }; let dock = try resolve(tag, id)
    guard dock.node.identity !== owner.marker.node.identity, host.contains(owner.marker.node, dock.node), sameWindow(owner, dock.node), original(owner) else { throw ScaffoldLayoutFailure.code("dock_not_in_original_viewport") }
    let entry = PartEntry(ticket, owner, dock, nil); owner.parts[entry.handle] = entry; parts[entry.handle] = entry; refresh(owner)
    guard !entry.retired, live(owner), parts[entry.handle] === entry, let initial = entry.last else { throw ScaffoldLayoutFailure.code("parts_retired") }
    return ScaffoldLayoutReceipt(handle: entry.handle, ticket: ticket, windowID: owner.windowID, initial: initial)
  }
  private func valid(_ value: ScaffoldViewport) -> Bool {
    let rect = value.rect
    return [rect.x, rect.y].allSatisfy(\.isFinite) && [rect.width, rect.height].allSatisfy { $0.isFinite && $0 > 0 } &&
      [value.rawImeBottom, value.viewPaddingBottom, value.systemGestureBottom, value.safeTop, value.safeLeft, value.safeRight].allSatisfy { $0.isFinite && $0 >= 0 } && value.safeLeft + value.safeRight < rect.width
  }
  private func valid(_ value: ScaffoldPair) -> Bool { valid(value.viewport) && [value.fixed.x, value.fixed.y].allSatisfy(\.isFinite) && [value.fixed.width, value.fixed.height, value.dockHeight].allSatisfy { $0.isFinite && $0 > 0 } }
  private func original(_ entry: PartEntry) -> Bool {
    let owner = entry.owner; guard !entry.retired, parts[entry.handle] === entry, live(owner) else { return false }
    guard matches(entry.dock), host.contains(owner.marker.node, entry.dock.node) else { retire(entry); return false }
    if let fixed = entry.fixed {
      guard matches(fixed), host.contains(owner.marker.node, fixed.node), !host.contains(entry.dock.node, fixed.node), !host.contains(fixed.node, entry.dock.node) else { retire(entry); return false }
      guard fixed.node.attached else { return false }; guard sameWindow(owner, fixed.node) else { retire(entry); return false }
    }
    guard entry.dock.node.attached else { return false }; guard sameWindow(owner, entry.dock.node) else { retire(entry); return false }; return true
  }
  private func publish(_ owner: ViewportEntry, _ viewport: ScaffoldViewport?) {
    if let last = owner.last, !last.retired, last.viewport == viewport { return }; owner.revision += 1
    let event = ScaffoldLayoutEvent(kind: "viewport", handle: owner.handle, ticket: owner.ticket, windowID: owner.windowID, viewportHandle: owner.handle, revision: owner.revision, frame: owner.frame, retired: false, viewport: viewport, dock: nil, pair: nil)
    owner.last = event; sink(event)
  }
  private func publish(_ entry: PartEntry, _ pair: ScaffoldPair?) {
    if let last = entry.last, !last.retired, last.pair == pair { return }; entry.revision += 1
    let event = ScaffoldLayoutEvent(kind: "pair", handle: entry.handle, ticket: entry.ticket, windowID: entry.owner.windowID, viewportHandle: entry.owner.handle, revision: entry.revision, frame: entry.owner.frame, retired: false, viewport: nil, dock: nil, pair: pair)
    entry.last = event; sink(event)
  }
  private func publishDock(_ entry: PartEntry, _ dock: ScaffoldDock?) {
    if let last = entry.last, !last.retired, last.dock == dock { return }; entry.revision += 1
    let event = ScaffoldLayoutEvent(kind: "dock", handle: entry.handle, ticket: entry.ticket, windowID: entry.owner.windowID, viewportHandle: entry.owner.handle, revision: entry.revision, frame: entry.owner.frame, retired: false, viewport: nil, dock: dock, pair: nil)
    entry.last = event; sink(event)
  }
  private func refresh(_ owner: ViewportEntry) {
    host.assertMainThread(); guard live(owner), !owner.sampling else { return }; owner.sampling = true; owner.frame += 1; defer { owner.sampling = false }
    var viewport: ScaffoldViewport?
    if original(owner), let next = host.readViewport(owner.marker.node), valid(next), original(owner) { viewport = next }
    guard live(owner) else { return }; publish(owner, viewport)
    for entry in Array(owner.parts.values) {
      guard let fixed = entry.fixed else {
        var dock: ScaffoldDock?
        if viewport != nil, original(owner), original(entry), let next = host.readDock(owner.marker.node, entry.dock.node), valid(next.viewport), next.dockHeight.isFinite, next.dockHeight > 0, original(owner), original(entry) { dock = next }
        if live(owner), !entry.retired { publishDock(entry, dock) }; continue
      }
      var pair: ScaffoldPair?
      if viewport != nil, original(owner), original(entry), let next = host.readPair(owner.marker.node, entry.dock.node, fixed.node), valid(next), original(owner), original(entry) { pair = next }
      if live(owner), !entry.retired { publish(entry, pair) }
    }
  }
  private func retire(_ entry: PartEntry) {
    guard !entry.retired else { return }; entry.retired = true; parts.removeValue(forKey: entry.handle); entry.owner.parts.removeValue(forKey: entry.handle); entry.revision += 1
    let event = ScaffoldLayoutEvent(kind: entry.fixed == nil ? "dock" : "pair", handle: entry.handle, ticket: entry.ticket, windowID: entry.owner.windowID, viewportHandle: entry.owner.handle, revision: entry.revision, frame: max(1, entry.owner.frame), retired: true, viewport: nil, dock: nil, pair: nil); entry.last = event; sink(event)
  }
  private func retire(_ owner: ViewportEntry) {
    guard !owner.retired else { return }; owner.retired = true; viewports.removeValue(forKey: owner.handle); let stop = owner.stop; owner.stop = nil; stop?()
    for entry in Array(owner.parts.values) { retire(entry) }; owner.revision += 1
    let event = ScaffoldLayoutEvent(kind: "viewport", handle: owner.handle, ticket: owner.ticket, windowID: owner.windowID, viewportHandle: owner.handle, revision: owner.revision, frame: max(1, owner.frame), retired: true, viewport: nil, dock: nil, pair: nil); owner.last = event; sink(event)
  }
  func release(_ handle: String, _ ticket: String) -> Bool {
    host.assertMainThread(); if let owner = viewports[handle], owner.ticket == ticket { retire(owner); return true }
    if let entry = parts[handle], entry.ticket == ticket { retire(entry); return true }; return false
  }
  func cancelTicket(_ ticket: String) -> Bool {
    host.assertMainThread(); guard Self.validID(ticket) else { return false }; let fresh = usedTickets.insert(ticket).inserted
    if let owner = viewports.values.first(where: { $0.ticket == ticket }) { retire(owner); return true }
    if let entry = parts.values.first(where: { $0.ticket == ticket }) { retire(entry); return true }; return fresh
  }
  func invalidate() { host.assertMainThread(); for owner in Array(viewports.values) { retire(owner) } }
  func destroy() { host.assertMainThread(); guard !destroyed else { return }; destroyed = true; invalidate(); usedTickets.removeAll() }
}
