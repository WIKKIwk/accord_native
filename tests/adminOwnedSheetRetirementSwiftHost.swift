import Foundation

@MainActor private final class Replies {
  var receipts: [AdminSheetRetirement.Receipt] = []; var failures: [String] = []
  func receive(_ value: Result<AdminSheetRetirement.Receipt, AdminSheetRetirement.Failure>) {
    switch value { case .success(let receipt): receipts.append(receipt); case .failure(.code(let code)): failures.append(code) }
  }
  var pending: Bool { receipts.isEmpty && failures.isEmpty }
}
@main struct AdminOwnedSheetRetirementHost {
  static func check(_ condition: @autoclosure () -> Bool, _ message: String) { precondition(condition(), message) }
  @MainActor static func main() {
    let name = CommandLine.arguments[1], platform = CommandLine.arguments[2]
    var next = 0
    let ledger = AdminSheetRetirement(platform: platform, nextID: { next += 1; return String(format: "00000000-0000-4000-8000-%012d", next) })
    let owner = NSObject(), replies = Replies()
    func claim() { check(ledger.claim("P", "parent", owner), "claim") }
    func issue() { claim(); check(ledger.issuePresentation("P", owner), "issue") }
    func ready() { ledger.presentationCompleted("P", owner); ledger.attached("P", owner) }
    func gone() { ledger.detached("P", owner); ledger.dismissed("P", owner) }
    func request(_ target: Replies? = nil) { let target = target ?? replies; ledger.request("P", "parent", "R", target.receive) }
    switch name {
    case "before-mount-tombstone-prevents-delayed-claim":
      request(); check(replies.receipts.first?.disposition == "neverPresented", "no authoritative never-presented fact")
      check(!ledger.claim("P", "parent", owner) && !ledger.claim("P", "new-parent", owner), "delayed native claim revived")
    case "mounted-before-call-preempted-without-native-ack":
      claim(); request(); check(replies.receipts.first?.disposition == "neverPresented" && !ledger.issuePresentation("P", owner), "preempted call issued")
    case "issued-call-never-becomes-never-presented":
      issue(); request(); check(replies.pending && !ledger.mayDismiss("P", owner), "absence became a receipt")
    case "real-presentation-or-attachment-is-only-action-readiness":
      issue(); request()
      if platform == "ios" { ledger.attached("P", owner); check(!ledger.mayDismiss("P", owner), "attach was UIKit completion"); ledger.presentationCompleted("P", owner) }
      else { ledger.presentationCompleted("P", owner); check(!ledger.mayDismiss("P", owner), "OnShow was Android attachment"); ledger.attached("P", owner) }
      check(ledger.mayDismiss("P", owner) && replies.pending, "native readiness became removal")
    case "dismiss-request-is-not-removal":
      issue(); request(); ready(); check(ledger.issueDismissal("P", owner), "own removal not reserved")
      check(!ledger.issueDismissal("P", owner) && replies.pending, "duplicate removal or fabricated receipt")
    case "only-genuine-platform-removal-completes":
      issue(); request(); ready(); _ = ledger.issueDismissal("P", owner)
      ledger.dismissed("P", owner)
      if platform == "android" { check(replies.pending, "OnDismiss without decor detach"); ledger.detached("P", owner) }
      check(replies.receipts.first?.disposition == "removed", "real removal lost")
    case "android-detach-without-dismiss-is-not-completion":
      issue(); request(); ready(); ledger.detached("P", owner); check(replies.pending, "detach alone completed")
      ledger.dismissed("P", owner); check(replies.receipts.first?.disposition == "removed", "join failed")
    case "early-actual-removal-retained-until-original-R":
      issue(); ready(); gone(); check(replies.pending, "unrequested result")
      request(); check(replies.receipts.first?.disposition == "removed", "early physical receipt lost")
    case "duplicate-pending-R-has-one-receipt-identity":
      issue(); request(); let second = Replies(); request(second); ready(); gone()
      check(replies.receipts.count == 1 && second.receipts == replies.receipts, "duplicate waiter replaced original")
      let late = Replies(); request(late); check(late.receipts == replies.receipts, "late duplicate minted new UUID")
    case "foreign-parent-or-R-cannot-replace-original":
      issue(); request(); let bad = Replies()
      ledger.request("P", "different-parent", "R", bad.receive); ledger.request("P", "parent", "other-R", bad.receive)
      check(bad.failures.count == 2 && replies.pending && ledger.matchesIntent("P", "parent", "R"), "foreign cleanup adopted")
      ready(); gone(); check(replies.receipts.count == 1, "original waiter lost")
    case "retirement-R-cannot-move-to-another-presentation":
      request(); let bad = Replies(); ledger.request("other-P", "parent", "R", bad.receive)
      check(bad.failures == ["retirement_ticket_reused"] && replies.receipts.count == 1, "R retargeted")
    case "foreign-native-owner-callbacks-cannot-remove-original":
      issue(); request(); let other = NSObject(); ledger.presentationCompleted("P", other); ledger.attached("P", other); ledger.dismissed("P", other); ledger.detached("P", other)
      check(replies.pending && !ledger.mayDismiss("P", owner), "foreign owner supplied native facts"); ready(); gone(); check(replies.receipts.count == 1, "own receipt lost")
    case "private-retirement-before-late-R-keeps-proof":
      claim(); ledger.retireOwner("P", owner); check(!ledger.issuePresentation("P", owner), "private retirement revived")
      request(); check(replies.receipts.first?.disposition == "neverPresented", "late R lost private proof")
    case "Source-retirement-does-not-drop-pending-present-completion":
      issue(); ledger.retireOwner("P", owner); request(); check(replies.pending, "pending present inferred gone")
      ready(); check(ledger.mayDismiss("P", owner), "Source retirement discarded actual completion"); gone(); check(replies.receipts.first?.disposition == "removed", "resource cleanup blocked by Source")
    case "destroy-rejects-pending-and-future-without-success":
      issue(); request(); ledger.destroy(); check(replies.failures == ["module_destroyed"] && replies.receipts.isEmpty, "destroy became removal")
      ready(); gone(); let future = Replies(); request(future); check(future.failures == ["module_destroyed"] && !ledger.claim("new", "parent", NSObject()), "destroyed module revived")
    case "retiring-owner-does-not-require-account-authority":
      issue(); request(); ready(); gone(); check(replies.receipts.first?.disposition == "removed", "resource cleanup adopted Source dependency")
    case "invalid-identity-aliases-reject-before-recording":
      let bad = Replies(); ledger.request("P", "P", "R", bad.receive); ledger.request("P", "parent", "P", bad.receive); ledger.request("bad ticket", "parent", "R", bad.receive)
      check(bad.failures.count == 3 && ledger.claim("P", "parent", owner), "invalid tuple poisoned genuine P")
    case "receipt-UUID-and-R-cannot-be-reused-as-P":
      request(); let receipt = replies.receipts[0]
      check(UUID(uuidString: receipt.receiptID) != nil && !ledger.claim(receipt.receiptID, "parent", NSObject()) && !ledger.claim("R", "parent", NSObject()), "receipt namespace reused")
    case "known-child-hold-does-not-consume-dismiss-reservation":
      issue(); request(); ready(); check(replies.pending && ledger.mayDismiss("P", owner), "hold manufactured removal")
      // The real platform guard withheld issueDismissal while a child existed. A duplicate R only retries that guard.
      let duplicate = Replies(); request(duplicate); check(ledger.issueDismissal("P", owner), "genuine child release could not resume same R"); gone(); check(duplicate.receipts == replies.receipts, "retry retargeted cleanup")
    case "late-Source-close-after-resource-release-never-represents":
      issue(); ready()
      let source = AdminSheetTransaction(presentation: "P", parent: "parent")!
      check(source.beginPresentation(), "Source begin"); _ = source.presentationCompleted(); _ = source.interactiveWillDismiss()
      let transaction = source.transaction!; _ = source.didDismiss(transaction: transaction); gone()
      check(ledger.state("P", owner)?.terminal == true && !ledger.issuePresentation("P", owner), "released original P re-presented")
      check(source.acceptClose(presentation: "P", ticket: "source-close", transaction: transaction)?.map(\.kind) == ["closeAccepted", "closeJoined"], "late Source C lost original core")
    default: preconditionFailure(name)
    }
    print(name + " passed")
  }
}
