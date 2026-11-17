import UIKit

/** Owns the physical content root. Appearance callbacks are deliberately not readiness. */
@MainActor final class AdminSheetViewController: UIViewController, UIAdaptivePresentationControllerDelegate {
  var onLayout: ((CGSize) -> Void)?
  var onAttempt: (() -> Void)?
  var onWillDismiss: (() -> String?)?
  var onDidDismiss: ((String?) -> Void)?
  var onCancelled: ((String) -> Void)?
  private var touchHandler: UIGestureRecognizer?
  private var interactiveTransaction: String?
  let contentContainer = UIView()
  override func loadView() {
    view = UIView(); view.backgroundColor = .clear
    contentContainer.frame = view.bounds; contentContainer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(contentContainer)
    touchHandler = AccordAdminSheetAttachTouchHandler(view)
  }
  override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); contentContainer.frame = view.bounds; onLayout?(view.bounds.size) }
  func presentationControllerDidAttemptToDismiss(_ presentationController: UIPresentationController) {
    guard presentationController.presentedViewController === self else { return }; onAttempt?()
  }
  func presentationControllerWillDismiss(_ presentationController: UIPresentationController) {
    guard presentationController.presentedViewController === self else { return }
    let transaction = onWillDismiss?(); interactiveTransaction = transaction
    // An actual cancelled transition completion, never absence of a coordinator, restores availability.
    transitionCoordinator?.animate(alongsideTransition: nil, completion: { [weak self] context in
      if context.isCancelled, let transaction {
        self?.onCancelled?(transaction)
        if self?.interactiveTransaction == transaction { self?.interactiveTransaction = nil }
      }
    })
  }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    guard presentationController.presentedViewController === self else { return }; onDidDismiss?(interactiveTransaction)
  }
  func releaseTouches() {
    if let touchHandler, let view = viewIfLoaded { AccordAdminSheetDetachTouchHandler(touchHandler, view) }
    touchHandler = nil
  }
}
