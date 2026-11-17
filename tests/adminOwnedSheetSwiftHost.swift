import Foundation

@main struct AdminOwnedSheetHost {
  static func check(_ condition: @autoclosure () -> Bool, _ message: String) { precondition(condition(), message) }
  static func main() {
    let name = CommandLine.arguments[1]
    var number = 0
    func make(_ ids: [String]? = nil) -> AdminSheetTransaction {
      var supplied = ids ?? []
      return AdminSheetTransaction(presentation: "original-sheet", parent: "original-parent", nextID: {
        if !supplied.isEmpty { return supplied.removeFirst() }; number += 1; return "native-transaction-\(number)"
      })!
    }
    func shown(_ value: AdminSheetTransaction) { check(value.beginPresentation(), "begin"); check(value.presentationCompleted().map(\.kind) == ["shown"], "actual completion"); check(value.mayInteract, "shown interactive") }
    let value = make()
    switch name {
    case "membership-and-attempt-never-ready":
      check(!value.mayInteract && value.attemptedDismissal().isEmpty, "membership ready")
      check(value.beginPresentation() && !value.mayInteract, "presenting ready")
      check(value.attemptedDismissal().isEmpty && !value.physicalDismissed, "attempt is ACK")
      check(value.presentationCompleted().map(\.kind) == ["shown"] && value.mayInteract, "actual completion absent")
    case "blocked-pull-down-is-only-attempt":
      shown(value); check(value.attemptedDismissal().map(\.kind) == ["attempt"], "attempt missing")
      check(value.mayInteract && value.transaction == nil && !value.physicalDismissed, "attempt changed lifetime")
    case "gesture-begins-fence-without-source-close":
      shown(value); let events = value.interactiveWillDismiss()
      check(events.map(\.kind) == ["willDismiss"] && !value.mayInteract, "gesture fence")
      check(value.acceptedClose == nil && !value.physicalDismissed && !value.needsProgrammaticDismiss, "inferred Source close")
    case "physical-before-source-retains-exact-receipt":
      shown(value); _ = value.interactiveWillDismiss(); let transaction = value.transaction!
      check(value.didDismiss(transaction: transaction).map(\.kind) == ["didDismiss"], "early receipt lost")
      check(!value.mayInteract && !value.joined, "early success")
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: transaction)?.map(\.kind) == ["closeAccepted", "closeJoined"], "late join")
    case "source-before-physical-awaits-genuine-dismiss":
      shown(value); let accepted = value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil)
      check(accepted?.map(\.kind) == ["closeAccepted"] && value.needsProgrammaticDismiss && !value.joined, "request is ACK")
      check(value.didDismiss(transaction: value.transaction).map(\.kind) == ["didDismiss", "closeJoined"], "actual join")
    case "queued-close-before-show-does-not-manufacture-ready":
      check(value.beginPresentation(), "begin")
      _ = value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil)
      check(!value.mayInteract && !value.needsProgrammaticDismiss && !value.physicalDismissed, "early native close")
      check(value.presentationCompleted().map(\.kind) == ["shown"] && value.needsProgrammaticDismiss && !value.mayInteract, "queued close lost")
    case "foreign-presentation-cannot-close":
      shown(value); check(value.acceptClose(presentation: "replacement-sheet", ticket: "source-close", transaction: nil) == nil && value.mayInteract, "foreign adopted")
    case "foreign-gesture-cannot-join":
      shown(value); _ = value.interactiveWillDismiss(); let transaction = value.transaction!
      _ = value.didDismiss(transaction: transaction)
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: "replacement-gesture") == nil && !value.joined, "foreign joined")
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil) == nil, "absent receipt joined")
    case "foreign-completion-cannot-remove-original":
      shown(value); _ = value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil)
      check(value.didDismiss(transaction: "replacement-transaction").isEmpty && !value.physicalDismissed, "foreign physical ACK")
    case "duplicate-accepted-close-and-native-completion-once":
      shown(value); _ = value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil)
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil)?.isEmpty == true, "idempotent request")
      let transaction = value.transaction
      check(value.didDismiss(transaction: transaction).filter { $0.kind == "closeJoined" }.count == 1, "missing join")
      check(value.didDismiss(transaction: transaction).isEmpty, "duplicate join")
      check(value.acceptClose(presentation: "original-sheet", ticket: "new-close", transaction: transaction) == nil, "replacement close stolen")
    case "real-cancel-restores-same-original-without-ready-event":
      shown(value); _ = value.interactiveWillDismiss(); let transaction = value.transaction!
      check(value.interactiveCancelled("other").isEmpty && !value.mayInteract, "foreign cancellation")
      check(value.interactiveCancelled(transaction).map(\.kind) == ["cancelled"] && value.mayInteract && value.transaction == nil, "actual cancellation lost")
      check(value.didDismiss(transaction: transaction).isEmpty && !value.physicalDismissed, "cancelled transaction revived")
    case "native-identity-never-reused":
      let original = make(["same-native", "same-native"]); shown(original)
      _ = original.interactiveWillDismiss(); _ = original.interactiveCancelled("same-native")
      check(original.interactiveWillDismiss().map(\.kind) == ["failed"] && original.phase == .failed, "native identity reused")
    case "accepted-close-cannot-share-native-identity":
      let original = make(["source-close"]); shown(original)
      check(original.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil) == nil && original.mayInteract, "close/native alias")
    case "accepted-cancelled-transition-fails-without-ack":
      shown(value); _ = value.interactiveWillDismiss(); let transaction = value.transaction!
      _ = value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: transaction)
      check(value.interactiveCancelled(transaction).first?.reason == "accepted_interactive_transition_cancelled" && !value.joined && !value.mayInteract, "cancellation invented dismiss")
    case "retirement-before-or-after-physical-never-joins":
      shown(value); _ = value.interactiveWillDismiss(); let transaction = value.transaction!
      _ = value.didDismiss(transaction: transaction); check(value.retire().map(\.kind) == ["retired"], "retire absent")
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: transaction) == nil && !value.joined, "retired join")
      let early = make(); _ = early.retire(); check(!early.beginPresentation() && early.presentationCompleted().isEmpty, "retired presentation revived")
    case "physical-without-will-retains-native-transaction":
      shown(value); let event = value.didDismiss(transaction: nil).first
      check(event?.kind == "didDismiss" && event?.transaction != nil && !value.joined && !value.mayInteract, "spontaneous fact lost")
      check(value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: event?.transaction)?.last?.kind == "closeJoined", "spontaneous join")
    case "strict-opaque-ticket-validation":
      for ticket in ["", "bad ticket", "../sheet", "é", String(repeating: "x", count: 161)] { check(AdminSheetTransaction(presentation: ticket, parent: "parent") == nil, "invalid ticket") }
      check(AdminSheetTransaction(presentation: "same", parent: "same") == nil, "parent/presentation alias")
    case "failed-receipts-cannot-revive":
      shown(value); _ = value.fail("original_parent_changed")
      check(value.presentationCompleted().isEmpty && value.didDismiss(transaction: nil).isEmpty && value.acceptClose(presentation: "original-sheet", ticket: "source-close", transaction: nil) == nil, "failed revived")
    default: preconditionFailure(name)
    }
    print(name + " passed")
  }
}
