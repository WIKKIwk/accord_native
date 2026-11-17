import ExpoModulesCore
import UIKit

/** Native identity tombstones prevent a stale prop/event from adopting another original parent. */
@MainActor final class AdminSheetPortalRegistry {
  private final class Parent {
    weak var marker: UIView?
    weak var controller: UIViewController?
    weak var window: UIWindow?
    init(_ marker: UIView, _ controller: UIViewController, _ window: UIWindow) { self.marker = marker; self.controller = controller; self.window = window }
  }
  private var used = Set<String>()
  private var portals: [String: AdminSheetPortalView] = [:]
  private var parents: [String: Parent] = [:]
  private(set) var destroyed = false
  func claim(_ ticket: String, _ portal: AdminSheetPortalView) -> Bool {
    guard !destroyed, parents[ticket] == nil, used.insert(ticket).inserted else { return false }
    portals[ticket] = portal; return true
  }
  func claimParent(_ ticket: String, marker: UIView, controller: UIViewController, window: UIWindow) -> Bool {
    guard !destroyed else { return false }
    if let original = parents[ticket] {
      guard original.marker === marker && original.controller === controller && original.window === window else { return false }
      return !used.contains(ticket) || portals[ticket]?.ownsNativeParent(marker: marker, controller: controller, window: window) == true
    }
    if used.contains(ticket) {
      guard portals[ticket]?.ownsNativeParent(marker: marker, controller: controller, window: window) == true else { return false }
    }
    parents[ticket] = Parent(marker, controller, window); return true
  }
  func release(_ ticket: String?, _ portal: AdminSheetPortalView) {
    guard let ticket, portals[ticket] === portal else { return }; portals.removeValue(forKey: ticket)
    // Child cleanup can unblock an already retired original parent; never choose a different parent.
    for original in Array(portals.values) { original.originalChildReleased() }
  }
  func destroy() {
    guard !destroyed else { return }; destroyed = true
    for portal in Array(portals.values) { portal.retireResources() }
  }
}

public class AccordAdminPresentationModule: Module {
  @MainActor private var sheets: AdminSheetPortalRegistry?
  @MainActor private func registry() -> AdminSheetPortalRegistry {
    if let sheets { return sheets }; let created = AdminSheetPortalRegistry(); sheets = created; return created
  }
  public func definition() -> ModuleDefinition {
    Name("AccordAdminPresentation")
    AsyncFunction("sheetCapability") { () -> [String: Any]? in
      MainActor.assumeIsolated {
        self.registry().destroyed ? nil : ["protocol": 1, "platform": "ios", "guarantee": "owned-uikit-presentation-and-dismissal", "viewName": "AdminSheetPortal"]
      }
    }.runOnQueue(.main)
    View(AdminSheetPortalView.self) {
      ViewName("AdminSheetPortal")
      Events("onSheetEvent")
      Prop("configuration") { (view: AdminSheetPortalView, value: AdminSheetConfiguration) in view.pendingConfiguration = value }
      Prop("acceptedClose") { (view: AdminSheetPortalView, value: AdminSheetAcceptedClose?) in view.pendingAcceptedClose = value }
      Prop("dismissalEnabled", false) { (view: AdminSheetPortalView, value: Bool) in view.dismissalEnabled = value }
      Prop("layoutRoot", false) { (view: AdminSheetPortalView, value: Bool) in view.layoutRoot = value }
      OnViewDidUpdateProps { (view: AdminSheetPortalView) in view.commitProps(registry: self.registry()) }
    }
    OnDestroy { DispatchQueue.main.async { self.sheets?.destroy() } }
  }
}
