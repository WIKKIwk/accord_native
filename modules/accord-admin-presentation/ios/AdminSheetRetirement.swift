import Foundation

/** Resource retirement only. No account, Source result, route POP or Source close ticket is read here. */
@MainActor final class AdminSheetRetirement {
  struct Receipt: Equatable {
    let presentation: String, parent: String, retirement: String, receiptID: String, disposition: String
  }
  struct State {
    let retiring: Bool, issued: Bool, presentationCompleted: Bool, attached: Bool, dismissalIssued: Bool, terminal: Bool
  }
  enum Failure: Error { case code(String) }
  typealias Reply = (Result<Receipt, Failure>) -> Void
  private final class Record {
    let presentation: String, parent: String
    weak var owner: AnyObject?
    var retirement: String?
    var retiring = false, issued = false, presentationCompleted = false, attached = false
    var detached = false, dismissed = false, dismissalIssued = false
    var physical: (id: String, disposition: String)?
    var replies: [Reply] = []
    init(_ presentation: String, _ parent: String, _ owner: AnyObject?) {
      self.presentation = presentation; self.parent = parent; self.owner = owner
    }
  }
  let platform: String
  private var records: [String: Record] = [:]
  private var retirementOwners: [String: String] = [:]
  private var usedReceipts = Set<String>()
  private(set) var destroyed = false
  private let nextID: () -> String
  init(platform: String, nextID: @escaping () -> String = { UUID().uuidString }) {
    precondition(platform == "ios" || platform == "android"); self.platform = platform; self.nextID = nextID
  }
  func claim(_ presentation: String, _ parent: String, _ owner: AnyObject) -> Bool {
    guard !destroyed, valid(presentation), valid(parent), presentation != parent, records[presentation] == nil,
          retirementOwners[presentation] == nil, retirementOwners[parent] == nil, !usedReceipts.contains(presentation), !usedReceipts.contains(parent) else { return false }
    records[presentation] = Record(presentation, parent, owner); return true
  }
  private func valid(_ value: String) -> Bool { AdminSheetTransaction.validTicket(value) }
  func contains(_ presentation: String) -> Bool { records[presentation] != nil }
  private func original(_ presentation: String, _ owner: AnyObject) -> Record? {
    guard let record = records[presentation], record.owner === owner else { return nil }; return record
  }
  func state(_ presentation: String, _ owner: AnyObject) -> State? {
    guard let value = original(presentation, owner) else { return nil }
    return State(retiring: value.retiring, issued: value.issued, presentationCompleted: value.presentationCompleted,
      attached: value.attached, dismissalIssued: value.dismissalIssued, terminal: value.physical != nil)
  }
  func issuePresentation(_ presentation: String, _ owner: AnyObject) -> Bool {
    guard !destroyed, let value = original(presentation, owner), !value.retiring, !value.issued, value.physical == nil else { return false }
    value.issued = true; return true
  }
  func presentationCompleted(_ presentation: String, _ owner: AnyObject) {
    guard let value = original(presentation, owner), value.issued, value.physical == nil else { return }; value.presentationCompleted = true
  }
  func attached(_ presentation: String, _ owner: AnyObject) {
    guard let value = original(presentation, owner), value.issued, value.physical == nil else { return }; value.attached = true
  }
  func mayDismiss(_ presentation: String, _ owner: AnyObject) -> Bool {
    guard let value = original(presentation, owner), value.retiring, value.issued, !value.dismissalIssued, value.physical == nil else { return false }
    return platform == "ios" ? value.presentationCompleted : value.attached
  }
  /** The platform must check its actual child guard immediately before this atomic reservation. */
  func issueDismissal(_ presentation: String, _ owner: AnyObject) -> Bool {
    guard mayDismiss(presentation, owner), let value = original(presentation, owner) else { return false }; value.dismissalIssued = true; return true
  }
  func detached(_ presentation: String, _ owner: AnyObject) {
    guard platform == "android", let value = original(presentation, owner), value.issued, value.attached else { return }
    value.detached = true; if value.dismissed { complete(value, "removed") }
  }
  func dismissed(_ presentation: String, _ owner: AnyObject) {
    guard let value = original(presentation, owner), value.issued else { return }
    value.dismissed = true
    if platform == "ios" || value.detached { complete(value, "removed") }
  }
  /** Unexpected React removal may start private cleanup before a later original R arrives. */
  func retireOwner(_ presentation: String, _ owner: AnyObject) {
    guard let value = original(presentation, owner) else { return }; value.retiring = true
    if !value.issued { complete(value, "neverPresented") }
  }
  func request(_ presentation: String, _ parent: String, _ retirement: String, _ reply: @escaping Reply) {
    guard !destroyed else { reply(.failure(.code("module_destroyed"))); return }
    guard valid(presentation), valid(parent), valid(retirement), Set([presentation, parent, retirement]).count == 3,
          retirementOwners[presentation] == nil, retirementOwners[parent] == nil, records[retirement] == nil,
          !usedReceipts.contains(presentation), !usedReceipts.contains(parent), !usedReceipts.contains(retirement) else { reply(.failure(.code("invalid_retirement_tuple"))); return }
    if let assigned = retirementOwners[retirement], assigned != presentation { reply(.failure(.code("retirement_ticket_reused"))); return }
    let value: Record
    if let existing = records[presentation] { value = existing }
    else { value = Record(presentation, parent, nil); records[presentation] = value }
    guard value.parent == parent, value.retirement == nil || value.retirement == retirement else { reply(.failure(.code("foreign_retirement"))); return }
    value.retirement = retirement; value.retiring = true; retirementOwners[retirement] = presentation
    value.replies.append(reply)
    if !value.issued { complete(value, "neverPresented") } else { deliver(value) }
  }
  func matchesIntent(_ presentation: String, _ parent: String, _ retirement: String) -> Bool {
    !destroyed && records[presentation]?.parent == parent && records[presentation]?.retirement == retirement
  }
  private func complete(_ value: Record, _ disposition: String) {
    if value.physical == nil {
      let id = nextID()
      guard valid(id), UUID(uuidString: id) != nil, ![value.presentation, value.parent, value.retirement].compactMap({ $0 }).contains(id),
            records[id] == nil, retirementOwners[id] == nil, usedReceipts.insert(id).inserted else { fail(value, "invalid_retirement_receipt_identity"); return }
      value.physical = (id, disposition)
    }
    deliver(value)
  }
  private func deliver(_ value: Record) {
    guard let physical = value.physical, let retirement = value.retirement else { return }
    let receipt = Receipt(presentation: value.presentation, parent: value.parent, retirement: retirement, receiptID: physical.id, disposition: physical.disposition)
    let replies = value.replies; value.replies.removeAll()
    for reply in replies { reply(destroyed ? .failure(.code("module_destroyed")) : .success(receipt)) }
  }
  private func fail(_ value: Record, _ code: String) {
    let replies = value.replies; value.replies.removeAll(); for reply in replies { reply(.failure(.code(code))) }
  }
  func destroy() {
    guard !destroyed else { return }; destroyed = true
    for value in records.values { value.retiring = true; fail(value, "module_destroyed") }
  }
}
