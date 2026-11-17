import ExpoModulesCore
import UIKit

struct AdminSheetConfiguration: Record {
  @Field var presentationTicket: String = ""
  @Field var parentTicket: String = ""
  @Field var parentViewTag: Int = 0
  @Field var parentNativeID: String = ""
  @Field var heightPoints: Double = 0
  @Field var cornerRadius: Double = 0
}
struct AdminSheetAcceptedClose: Record {
  @Field var presentationTicket: String = ""
  @Field var closeTicket: String = ""
  @Field var transaction: String? = nil
}
struct AdminSheetConfigurationSnapshot: Equatable {
  let presentationTicket: String, parentTicket: String, parentNativeID: String
  let parentViewTag: Int
  let heightPoints: Double, cornerRadius: Double
  init?(_ value: AdminSheetConfiguration) {
    guard AdminSheetTransaction.validTicket(value.presentationTicket), AdminSheetTransaction.validTicket(value.parentTicket),
          value.presentationTicket != value.parentTicket, value.parentViewTag > 0,
          !value.parentNativeID.isEmpty, value.parentNativeID.utf8.count <= 160,
          value.heightPoints.isFinite, value.heightPoints > 0,
          value.cornerRadius.isFinite, value.cornerRadius >= 0 else { return nil }
    presentationTicket = value.presentationTicket; parentTicket = value.parentTicket; parentNativeID = value.parentNativeID
    parentViewTag = value.parentViewTag; heightPoints = value.heightPoints; cornerRadius = value.cornerRadius
  }
}

/** The anchor stays in the original parent's tree; Fabric children live in the owned controller. */
@MainActor final class AdminSheetPortalView: ExpoView {
  let onSheetEvent = EventDispatcher()
  var pendingConfiguration: AdminSheetConfiguration?
  var pendingAcceptedClose: AdminSheetAcceptedClose?
  var dismissalEnabled = false { didSet { updateInteraction() } }
  var layoutRoot = false
  private var configuration: AdminSheetConfigurationSnapshot?
  private var core: AdminSheetTransaction?
  private weak var registry: AdminSheetPortalRegistry?
  private weak var parentMarker: UIView?
  private weak var originalParent: UIViewController?
  private weak var originalWindow: UIWindow?
  private var controller: AdminSheetViewController?
  private var children: [UIView] = []
  private var presentationStarted = false
  private var hadSuperview = false
  private var programmaticDismissStarted = false
  private var invalidated = false
  private var retirementDismissStarted = false
  private var lastSize: CGSize?
  private var sequence = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // This view is an in-tree portal anchor, never a second painted copy of the content.
    backgroundColor = .clear; isUserInteractionEnabled = false
  }
  func commitProps(registry: AdminSheetPortalRegistry) {
    guard !invalidated else { return }
    guard layoutRoot, let value = pendingConfiguration, let snapshot = AdminSheetConfigurationSnapshot(value) else { invalidate("invalid_configuration"); return }
    if let configuration {
      guard configuration == snapshot, self.registry === registry else { invalidate("configuration_retargeted"); return }
    } else {
      guard registry.claim(snapshot.presentationTicket, self), let transaction = AdminSheetTransaction(presentation: snapshot.presentationTicket, parent: snapshot.parentTicket) else {
        invalidate("presentation_ticket_reused"); return
      }
      configuration = snapshot; self.registry = registry; core = transaction
    }
    tryPresent()
    applyAcceptedClose()
  }
  private func applyAcceptedClose() {
    guard !invalidated, core?.phase != .created else { return }
    if let close = pendingAcceptedClose {
      guard originalRelation(allowDetachedParent: true) else { invalidate("close_original_parent_changed"); return }
      guard let events = core?.acceptClose(presentation: close.presentationTicket, ticket: close.closeTicket, transaction: close.transaction) else { invalidate("foreign_or_invalid_close"); return }
      emit(events); updateInteraction(); tryDismiss()
    }
  }
  override func mountChildComponentView(_ childComponentView: UIView, index: Int) {
    guard !invalidated, children.isEmpty, index == 0, childComponentView.superview == nil else { invalidate("one_original_content_root_required"); return }
    children.append(childComponentView)
    if let controller { controller.loadViewIfNeeded(); controller.contentContainer.addSubview(childComponentView) }
    tryPresent()
  }
  override func unmountChildComponentView(_ childComponentView: UIView, index: Int) {
    guard index == 0, children.first === childComponentView else { invalidate("foreign_content_unmount"); return }
    childComponentView.removeFromSuperview(); children.removeAll()
    // React body removal is not a dismissal acknowledgment.
    invalidate("original_content_unmounted")
  }
  override func didMoveToWindow() { super.didMoveToWindow(); tryPresent() }
  override func didMoveToSuperview() {
    super.didMoveToSuperview()
    if superview != nil { hadSuperview = true; tryPresent() }
    else if hadSuperview { retireResources() }
  }
  override func prepareForRecycle() { retireResources(); super.prepareForRecycle() }

  private func nearestController(_ view: UIView) -> UIViewController? {
    var current: UIResponder? = view
    var visited = Set<ObjectIdentifier>()
    while let next = current, visited.insert(ObjectIdentifier(next)).inserted {
      if let controller = next as? UIViewController { return controller }; current = next.next
    }
    return nil
  }
  private func tryPresent() {
    guard !invalidated, !presentationStarted, let configuration, let core, children.count == 1, let window, superview != nil else { return }
    guard !window.isHidden, let marker = appContext?.findView(withTag: configuration.parentViewTag, ofType: UIView.self),
          marker !== self, marker.window === window, isDescendant(of: marker),
          AccordAdminSheetMatchesNativeID(marker, configuration.parentNativeID),
          let parent = nearestController(self), nearestController(marker) === parent,
          parent.viewIfLoaded?.window === window, !parent.isBeingDismissed, !parent.isBeingPresented,
          parent.presentedViewController == nil,
          registry?.claimParent(configuration.parentTicket, marker: marker, controller: parent, window: window) == true else {
      invalidate("original_parent_unavailable"); return
    }
    parentMarker = marker; originalParent = parent; originalWindow = window
    let owned = AdminSheetViewController(); controller = owned
    owned.modalPresentationStyle = .pageSheet; owned.isModalInPresentation = true
    guard let sheet = owned.sheetPresentationController else { invalidate("native_sheet_unavailable"); return }
    sheet.detents = [.custom(identifier: .init(configuration.presentationTicket)) { context in min(CGFloat(configuration.heightPoints), context.maximumDetentValue) }]
    sheet.prefersGrabberVisible = false; sheet.preferredCornerRadius = CGFloat(configuration.cornerRadius)
    owned.onLayout = { [weak self, weak owned] size in
      guard let self, let owned, self.controller === owned else { return }; self.publishSize(size)
    }
    owned.onAttempt = { [weak self, weak owned] in
      guard let self, let owned, self.controller === owned, self.originalRelation(allowDetachedParent: false) else { return }
      self.emit(self.core?.attemptedDismissal() ?? [])
    }
    owned.onWillDismiss = { [weak self, weak owned] in
      guard let self, let owned, self.controller === owned, self.originalRelation(allowDetachedParent: false) else { self?.invalidate("dismissal_parent_changed"); return nil }
      let events = self.core?.interactiveWillDismiss() ?? []
      self.emit(events); self.updateInteraction()
      return events.contains { $0.kind == "willDismiss" } ? self.core?.transaction : nil
    }
    owned.onCancelled = { [weak self, weak owned] transaction in
      guard let self, let owned, self.controller === owned, self.originalRelation(allowDetachedParent: false) else { return }
      self.emit(self.core?.interactiveCancelled(transaction) ?? []); self.updateInteraction()
    }
    owned.onDidDismiss = { [weak self, weak owned] transaction in
      guard let self, let owned, self.controller === owned else { return }; self.actualDismissed(owned, transaction: transaction)
    }
    owned.loadViewIfNeeded(); owned.contentContainer.addSubview(children[0]); owned.contentContainer.isUserInteractionEnabled = false
    sheet.delegate = owned
    guard core.beginPresentation() else { invalidate("presentation_state_invalid"); return }
    presentationStarted = true
    applyAcceptedClose()
    guard !invalidated else { return }
    parent.present(owned, animated: true) { [weak self, weak owned] in
      guard let self, let owned, self.controller === owned, !self.invalidated else { return }
      guard self.originalRelation(allowDetachedParent: false), owned.presentingViewController === parent,
            parent.presentedViewController === owned, owned.viewIfLoaded?.window === window else { self.invalidate("presentation_relation_changed"); return }
      self.emit(core.presentationCompleted()); self.updateInteraction(); self.tryDismiss()
    }
  }
  private func originalRelation(allowDetachedParent: Bool) -> Bool {
    guard !invalidated, let configuration, let marker = parentMarker, let parent = originalParent, let window = originalWindow,
          !window.isHidden, appContext?.findView(withTag: configuration.parentViewTag, ofType: UIView.self) === marker,
          AccordAdminSheetMatchesNativeID(marker, configuration.parentNativeID), isDescendant(of: marker),
          nearestController(self) === parent, nearestController(marker) === parent else { return false }
    return marker.window === window && parent.viewIfLoaded?.window === window || allowDetachedParent && marker.window == nil && parent.viewIfLoaded?.window == nil
  }
  func ownsNativeParent(marker: UIView, controller: UIViewController, window: UIWindow) -> Bool {
    guard !invalidated, core?.mayInteract == true, self.controller === controller,
          controller.viewIfLoaded?.window === window, let content = self.controller?.contentContainer else { return false }
    return marker === content || marker.isDescendant(of: content)
  }
  private func publishSize(_ size: CGSize) {
    guard !invalidated, size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0, size != lastSize else { return }
    lastSize = size
    // Public Expo Fabric state update. Children remain in this logical root's Yoga subtree.
    setStyleSize(NSNumber(value: Double(size.width)), height: NSNumber(value: Double(size.height)))
    send("layout", extra: ["width": Double(size.width), "height": Double(size.height)])
  }
  private func updateInteraction() {
    let interactive = !invalidated && core?.mayInteract == true
    controller?.isModalInPresentation = !interactive || !dismissalEnabled
    // Fence React content without interrupting UIKit's own in-flight sheet pan gesture.
    controller?.contentContainer.isUserInteractionEnabled = interactive
    controller?.contentContainer.accessibilityElementsHidden = !interactive
  }
  private func tryDismiss() {
    guard !invalidated, core?.needsProgrammaticDismiss == true, !programmaticDismissStarted,
          let controller, let transaction = core?.transaction else { return }
    guard originalRelation(allowDetachedParent: true), controller.presentedViewController == nil else { return }
    // Never issue a second dismissal through an interactive transition still in progress.
    if controller.isBeingDismissed { return }
    guard controller.presentingViewController === originalParent else { invalidate("dismissal_relation_changed"); return }
    programmaticDismissStarted = true
    controller.dismiss(animated: true) { [weak self, weak controller] in
      guard let self, let controller, self.controller === controller else { return }
      self.actualDismissed(controller, transaction: transaction)
    }
  }
  private func actualDismissed(_ owned: AdminSheetViewController, transaction: String?) {
    guard !invalidated, originalRelation(allowDetachedParent: true), owned.presentingViewController == nil,
          originalParent?.presentedViewController !== owned, owned.presentedViewController == nil else { invalidate("dismissal_not_original_or_has_child"); return }
    emit(core?.didDismiss(transaction: transaction) ?? []); updateInteraction(); owned.releaseTouches()
  }
  private func emit(_ values: [AdminSheetTransaction.Event]) {
    for value in values {
      send(value.kind, extra: ["transaction": value.transaction as Any? ?? NSNull(), "acceptedClose": value.acceptedClose as Any? ?? NSNull(), "reason": value.reason as Any? ?? NSNull()])
    }
  }
  private func send(_ kind: String, extra: [String: Any] = [:]) {
    sequence += 1
    var event: [String: Any] = ["protocol": 1, "kind": kind, "sequence": sequence,
      "presentationTicket": configuration?.presentationTicket ?? "", "parentTicket": configuration?.parentTicket ?? ""]
    event.merge(extra) { _, newest in newest }; onSheetEvent(event)
  }
  private func invalidate(_ reason: String) {
    guard !invalidated else { return }
    if let core { emit(core.fail(reason)) } else { send("failed", extra: ["reason": reason]) }
    retireResources()
  }
  func retireResources() {
    guard !invalidated else { return }; invalidated = true; emit(core?.retire() ?? [])
    controller?.viewIfLoaded?.isUserInteractionEnabled = false; controller?.releaseTouches()
    finishRetirement()
  }
  func finishRetirement() {
    guard invalidated, !retirementDismissStarted else { return }
    // Keep the original inert parent while a physical child is above it. No ancestor dismiss cascade.
    guard controller?.presentedViewController == nil else { return }
    retirementDismissStarted = true
    let originalRegistry = registry, ticket = configuration?.presentationTicket
    // Cleanup only. Neither this request nor its completion reports a successful Source close.
    if let controller, controller.presentingViewController != nil {
      controller.dismiss(animated: false) { [self, originalRegistry] in originalRegistry?.release(ticket, self) }
    } else { originalRegistry?.release(ticket, self) }
  }
  func originalChildReleased() {
    if invalidated { finishRetirement() } else { tryDismiss() }
  }
}
