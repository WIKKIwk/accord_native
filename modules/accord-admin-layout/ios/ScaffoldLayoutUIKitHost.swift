import ExpoModulesCore
import UIKit

/** This zero-size native attachment observer changes no React child layout, window mode or inset policy. */
@MainActor private final class ScaffoldLayoutSentinel: UIView {
  var changed: (() -> Void)?; private var pulse: CADisplayLink?; private var closed = false
  override func didMoveToWindow() {
    super.didMoveToWindow(); pulse?.invalidate(); pulse = nil
    if !closed, window != nil { let link = CADisplayLink(target: self, selector: #selector(tick)); link.add(to: .main, forMode: .common); pulse = link }
    changed?()
  }
  @objc private func tick() { if !closed { changed?() } }
  func close() { closed = true; changed = nil; pulse?.invalidate(); pulse = nil; removeFromSuperview() }
}
@MainActor final class ScaffoldLayoutUIKitHost: ScaffoldLayoutHost {
  private weak var context: AppContext?
  private final class TransformNode: ScaffoldTransformNode {
    let view: UIView
    init(_ view: UIView) { self.view = view }
    var identity: AnyObject { view }
    var untransformed: Bool { view.transform.isIdentity && CATransform3DIsIdentity(view.layer.transform) && CATransform3DIsIdentity(view.layer.sublayerTransform) }
    var parent: ScaffoldTransformNode? { view.superview.map(TransformNode.init) }
  }
  private final class Node: ScaffoldLayoutNode {
    let view: UIView
    init(_ view: UIView) { self.view = view }
    var identity: AnyObject { view }
    var attached: Bool { view.window != nil }
    // UIKit fullScreen carriers can share one UIWindow; actual viewport ancestry is checked separately.
    var rootIdentity: AnyObject? { view.window }
    var windowIdentity: AnyObject? { view.window }
    var windowToken: AnyObject? { view.window }
  }
  init(_ context: AppContext?) { self.context = context }
  func assertMainThread() { precondition(Thread.isMainThread) }
  func resolve(_ tag: Int, _ nativeID: String) -> ScaffoldLayoutNode? {
    guard let view = context?.findView(withTag: tag, ofType: UIView.self), AccordAdminScaffoldViewMatchesNativeID(view, nativeID) else { return nil }; return Node(view)
  }
  func matches(_ node: ScaffoldLayoutNode, _ tag: Int, _ nativeID: String) -> Bool {
    guard let node = node as? Node else { return false }
    return context?.findView(withTag: tag, ofType: UIView.self) === node.view && AccordAdminScaffoldViewMatchesNativeID(node.view, nativeID)
  }
  func contains(_ ancestor: ScaffoldLayoutNode, _ descendant: ScaffoldLayoutNode) -> Bool {
    guard let parent = ancestor as? Node, let child = descendant as? Node, parent.view !== child.view else { return false }
    return child.view.isDescendant(of: parent.view)
  }
  func observe(_ viewport: ScaffoldLayoutNode, _ changed: @escaping () -> Void) throws -> () -> Void {
    guard let node = viewport as? Node else { throw ScaffoldLayoutFailure.code("marker_unavailable") }
    let sentinel = ScaffoldLayoutSentinel(frame: .zero); sentinel.isUserInteractionEnabled = false; sentinel.isAccessibilityElement = false; sentinel.accessibilityElementsHidden = true
    sentinel.changed = changed; node.view.addSubview(sentinel)
    return { sentinel.close() }
  }
  private func rect(_ view: UIView, _ window: UIWindow) -> ScaffoldRect? {
    guard view.window === window, view.bounds.width > 0, view.bounds.height > 0, ScaffoldLayoutTransforms.supported(TransformNode(view), window) else { return nil }
    let frame = view.convert(view.bounds, to: window)
    return ScaffoldRect(x: Double(frame.minX), y: Double(frame.minY), width: Double(frame.width), height: Double(frame.height))
  }
  func readViewport(_ viewport: ScaffoldLayoutNode) -> ScaffoldViewport? {
    guard let view = (viewport as? Node)?.view, let window = view.window, !window.isHidden else { return nil }
    window.layoutIfNeeded()
    guard let frame = rect(view, window), frame.x == Double(window.bounds.minX), frame.y == Double(window.bounds.minY),
      frame.width == Double(window.bounds.width), frame.height == Double(window.bounds.height) else { return nil }
    let safe = view.safeAreaInsets, keyboard = view.keyboardLayoutGuide.layoutFrame
    // Read the actual owning viewport's guide; keep its default docked-only policy unchanged.
    guard !view.keyboardLayoutGuide.followsUndockedKeyboard else { return nil }
    let docked = keyboard.maxY >= view.bounds.maxY && keyboard.minY < view.bounds.maxY - safe.bottom
    let ime = docked ? max(0, view.bounds.maxY - keyboard.minY) : 0
    return ScaffoldViewport(rect: frame, rawImeBottom: Double(ime), viewPaddingBottom: Double(safe.bottom), systemGestureBottom: 0,
      safeTop: Double(safe.top), safeLeft: Double(safe.left), safeRight: Double(safe.right))
  }
  func readDock(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode) -> ScaffoldDock? {
    guard let original = readViewport(viewport), let view = (viewport as? Node)?.view, let window = view.window,
      let dockView = (dock as? Node)?.view, let dockFrame = rect(dockView, window) else { return nil }
    let bottom = original.rect.y + original.rect.height, dockBottom = dockFrame.y + dockFrame.height
    // Only floating-point arithmetic error is tolerated, never a physical safe-area/keyboard gap.
    let epsilon = Double.ulpOfOne * max(1, abs(bottom), abs(dockBottom)) * 16
    guard dockFrame.x == original.rect.x, dockFrame.width == original.rect.width, abs(bottom - dockBottom) <= epsilon else { return nil }
    return ScaffoldDock(viewport: original, dockHeight: dockFrame.height)
  }
  func readPair(_ viewport: ScaffoldLayoutNode, _ dock: ScaffoldLayoutNode, _ fixed: ScaffoldLayoutNode) -> ScaffoldPair? {
    guard let original = readDock(viewport, dock), let window = (viewport as? Node)?.view.window, let fixedView = (fixed as? Node)?.view, let fixedFrame = rect(fixedView, window) else { return nil }
    return ScaffoldPair(viewport: original.viewport, fixed: fixedFrame, dockHeight: original.dockHeight)
  }
}
