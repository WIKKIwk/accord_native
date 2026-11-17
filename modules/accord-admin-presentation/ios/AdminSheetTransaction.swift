import Foundation

/** Native facts only. A joined receipt is not authentication, Source acceptance, or a route POP. */
final class AdminSheetTransaction {
  enum Phase: String { case created, presenting, shown, dismissing, dismissed, failed, retired }
  struct Event: Equatable {
    let kind: String
    let presentation: String
    let parent: String
    let transaction: String?
    let acceptedClose: String?
    let reason: String?
  }
  let presentation: String
  let parent: String
  private(set) var phase: Phase = .created
  private(set) var transaction: String?
  private(set) var acceptedClose: String?
  private(set) var physicalDismissed = false
  private(set) var joined = false
  private var acceptedOriginTransaction: String?
  private var used = Set<String>()
  private let nextID: () -> String
  var mayInteract: Bool { phase == .shown && transaction == nil && acceptedClose == nil }
  var needsProgrammaticDismiss: Bool { phase == .dismissing && acceptedClose != nil && !physicalDismissed }
  static func validTicket(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    func alphaNumeric(_ byte: UInt8) -> Bool { (48...57).contains(byte) || (65...90).contains(byte) || (97...122).contains(byte) }
    return !bytes.isEmpty && bytes.count <= 160 && alphaNumeric(bytes[0]) && bytes.allSatisfy { alphaNumeric($0) || [58, 46, 95, 45].contains($0) }
  }
  init?(presentation: String, parent: String, nextID: @escaping () -> String = { UUID().uuidString }) {
    guard Self.validTicket(presentation), Self.validTicket(parent), presentation != parent else { return nil }
    self.presentation = presentation; self.parent = parent; self.nextID = nextID
  }
  private func event(_ kind: String, _ reason: String? = nil) -> Event {
    Event(kind: kind, presentation: presentation, parent: parent, transaction: transaction, acceptedClose: acceptedClose, reason: reason)
  }
  private func newTransaction(excluding: String? = nil) -> Bool {
    let id = nextID()
    guard Self.validTicket(id), id != presentation, id != parent, id != excluding, used.insert(id).inserted else { return false }
    transaction = id; return true
  }
  func beginPresentation() -> Bool {
    guard phase == .created else { return false }; phase = .presenting; return true
  }
  func presentationCompleted() -> [Event] {
    guard phase == .presenting else { return [] }
    phase = acceptedClose == nil ? .shown : .dismissing
    return [event("shown")]
  }
  /** A blocked UIKit pull-down is an attempt, never a native dismissal/request acknowledgment. */
  func attemptedDismissal() -> [Event] { mayInteract ? [event("attempt")] : [] }
  func interactiveWillDismiss() -> [Event] {
    guard mayInteract else { return [] }
    guard newTransaction() else { return fail("transaction_identity_invalid") }
    phase = .dismissing; return [event("willDismiss")]
  }
  /** Real transition cancellation restores only this same presentation, without a synthetic shown event. */
  func interactiveCancelled(_ original: String) -> [Event] {
    guard phase == .dismissing, transaction == original, !physicalDismissed else { return [] }
    if acceptedClose != nil { return fail("accepted_interactive_transition_cancelled") }
    let value = event("cancelled"); transaction = nil; phase = .shown; return [value]
  }
  /** Source supplies its exact accepted-close ticket. No command is inferred from a native gesture. */
  func acceptClose(presentation original: String, ticket: String, transaction expected: String?) -> [Event]? {
    guard original == presentation, Self.validTicket(ticket), ticket != parent, ticket != presentation,
          phase != .created, phase != .failed, phase != .retired else { return nil }
    if let acceptedClose { return acceptedClose == ticket && expected == acceptedOriginTransaction ? [] : nil }
    guard !used.contains(ticket) else { return nil }
    if phase == .shown || phase == .presenting {
      guard expected == nil, newTransaction(excluding: ticket) else { return nil }
    } else {
      // A programmatic Source close may cross an in-flight native gesture on the bridge.
      // Null is an independent accepted Source intent; bind this SAME presentation's actual receipt.
      // An explicit native cancellation receipt must still match exactly.
      if let expected, expected != transaction { return nil }
    }
    acceptedClose = ticket; acceptedOriginTransaction = expected; used.insert(ticket)
    if phase == .shown { phase = .dismissing }
    var result = [event("closeAccepted")]
    result += joinIfPossible(); return result
  }
  /** Only UIKit didDismiss or this owner's dismiss completion calls this method. */
  func didDismiss(transaction original: String?) -> [Event] {
    guard phase == .shown || phase == .dismissing, !physicalDismissed else { return [] }
    if let transaction { guard original == transaction else { return [] } }
    else {
      guard original == nil else { return [] }
      guard newTransaction() else { return fail("transaction_identity_invalid") }
    }
    physicalDismissed = true; phase = .dismissed
    return [event("didDismiss")] + joinIfPossible()
  }
  private func joinIfPossible() -> [Event] {
    guard physicalDismissed, acceptedClose != nil, !joined, phase == .dismissed else { return [] }
    joined = true; return [event("closeJoined")]
  }
  func fail(_ reason: String) -> [Event] {
    guard phase != .failed && phase != .retired && !joined else { return [] }
    phase = .failed; return [event("failed", reason)]
  }
  func retire() -> [Event] {
    guard phase != .retired else { return [] }
    phase = .retired; return [event("retired")]
  }
}
