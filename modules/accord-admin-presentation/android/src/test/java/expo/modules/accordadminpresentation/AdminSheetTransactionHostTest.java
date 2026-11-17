package expo.modules.accordadminpresentation;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public final class AdminSheetTransactionHostTest {
  private static int number;
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static AdminSheetTransaction make(String... ids) {
    ArrayDeque<String> supplied = new ArrayDeque<>(Arrays.asList(ids));
    return new AdminSheetTransaction("original-sheet", "original-parent", () -> supplied.isEmpty() ? "native-transaction-" + (++number) : supplied.removeFirst());
  }
  private static String kinds(List<AdminSheetTransaction.Event> events) { return events == null ? "REJECTED" : events.stream().map(event -> event.kind).collect(Collectors.joining(",")); }
  private static void shown(AdminSheetTransaction value) { check(value.beginPresentation(), "begin"); check(kinds(value.presentationCompleted()).equals("shown") && value.mayInteract(), "actual completion"); }
  public static void main(String[] args) {
    String name = args[0]; AdminSheetTransaction value = make(); String transaction;
    switch (name) {
      case "membership-and-attempt-never-ready":
        check(!value.mayInteract() && value.attemptedDismissal().isEmpty(), "membership ready");
        check(value.beginPresentation() && !value.mayInteract(), "presenting ready");
        check(value.attemptedDismissal().isEmpty() && !value.physicalDismissed(), "attempt is ACK");
        check(kinds(value.presentationCompleted()).equals("shown") && value.mayInteract(), "actual completion absent"); break;
      case "blocked-pull-down-is-only-attempt":
        shown(value); check(kinds(value.attemptedDismissal()).equals("attempt") && value.mayInteract() && value.transaction() == null && !value.physicalDismissed(), "attempt changed lifetime"); break;
      case "gesture-begins-fence-without-source-close":
        shown(value); check(kinds(value.interactiveWillDismiss()).equals("willDismiss") && !value.mayInteract() && value.acceptedClose() == null && !value.physicalDismissed() && !value.needsProgrammaticDismiss(), "gesture inferred Source close"); break;
      case "physical-before-source-retains-exact-receipt":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction();
        check(kinds(value.didDismiss(transaction)).equals("didDismiss") && !value.mayInteract() && !value.joined(), "early success");
        check(kinds(value.acceptClose("original-sheet", "source-close", transaction)).equals("closeAccepted,closeJoined"), "late join"); break;
      case "source-before-physical-awaits-genuine-dismiss":
        shown(value); check(kinds(value.acceptClose("original-sheet", "source-close", null)).equals("closeAccepted") && value.needsProgrammaticDismiss() && !value.joined(), "request is ACK");
        check(kinds(value.didDismiss(value.transaction())).equals("didDismiss,closeJoined"), "actual join"); break;
      case "queued-close-before-show-does-not-manufacture-ready":
        check(value.beginPresentation(), "begin"); value.acceptClose("original-sheet", "source-close", null);
        check(!value.mayInteract() && !value.needsProgrammaticDismiss() && !value.physicalDismissed(), "early native close");
        check(kinds(value.presentationCompleted()).equals("shown") && value.needsProgrammaticDismiss() && !value.mayInteract(), "queued close lost"); break;
      case "foreign-presentation-cannot-close":
        shown(value); check(value.acceptClose("replacement-sheet", "source-close", null) == null && value.mayInteract(), "foreign adopted"); break;
      case "foreign-gesture-cannot-join":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction(); value.didDismiss(transaction);
        check(value.acceptClose("original-sheet", "source-close", "replacement-gesture") == null && !value.joined(), "foreign joined");
        check(kinds(value.acceptClose("original-sheet", "source-close", transaction)).equals("closeAccepted,closeJoined"), "exact receipt lost"); break;
      case "independent-source-close-crosses-native-gesture":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction();
        List<AdminSheetTransaction.Event> crossing = value.acceptClose("original-sheet", "source-close", null);
        check(kinds(crossing).equals("closeAccepted") && crossing.get(0).transaction.equals(transaction) && !value.joined(), "atomic binding lost");
        check(value.acceptClose("original-sheet", "source-close", null).isEmpty(), "null repeat lost");
        check(value.acceptClose("original-sheet", "source-close", transaction) == null, "accepted intent retargeted");
        check(kinds(value.didDismiss(transaction)).equals("didDismiss,closeJoined"), "actual bound receipt lost"); break;
      case "independent-source-close-crosses-physical-dismissal":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction(); value.didDismiss(transaction);
        check(value.acceptClose("replacement-sheet", "source-close", null) == null && !value.joined(), "replacement adopted");
        List<AdminSheetTransaction.Event> late = value.acceptClose("original-sheet", "source-close", null);
        check(kinds(late).equals("closeAccepted,closeJoined") && late.get(1).transaction.equals(transaction), "actual early receipt lost");
        check(value.acceptClose("original-sheet", "source-close", null).isEmpty(), "null repeat after physical lost"); break;
      case "foreign-completion-cannot-remove-original":
        shown(value); value.acceptClose("original-sheet", "source-close", null);
        check(value.didDismiss("replacement-transaction").isEmpty() && !value.physicalDismissed(), "foreign physical ACK"); break;
      case "duplicate-accepted-close-and-native-completion-once":
        shown(value); value.acceptClose("original-sheet", "source-close", null);
        check(value.acceptClose("original-sheet", "source-close", null).isEmpty(), "idempotent request"); transaction = value.transaction();
        check(kinds(value.didDismiss(transaction)).equals("didDismiss,closeJoined") && value.didDismiss(transaction).isEmpty(), "duplicate join");
        check(value.acceptClose("original-sheet", "new-close", transaction) == null, "replacement stolen"); break;
      case "real-cancel-restores-same-original-without-ready-event":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction();
        check(value.interactiveCancelled("other").isEmpty() && !value.mayInteract(), "foreign cancellation");
        check(kinds(value.interactiveCancelled(transaction)).equals("cancelled") && value.mayInteract() && value.transaction() == null, "cancellation lost");
        check(value.didDismiss(transaction).isEmpty() && !value.physicalDismissed(), "cancelled revived"); break;
      case "native-identity-never-reused":
        AdminSheetTransaction original = make("same-native", "same-native"); shown(original); original.interactiveWillDismiss(); original.interactiveCancelled("same-native");
        check(kinds(original.interactiveWillDismiss()).equals("failed") && original.phase() == AdminSheetTransaction.Phase.FAILED, "native reused"); break;
      case "accepted-close-cannot-share-native-identity":
        AdminSheetTransaction alias = make("source-close"); shown(alias);
        check(alias.acceptClose("original-sheet", "source-close", null) == null && alias.mayInteract(), "close/native alias"); break;
      case "accepted-cancelled-transition-fails-without-ack":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction(); value.acceptClose("original-sheet", "source-close", transaction);
        check(value.interactiveCancelled(transaction).get(0).reason.equals("accepted_interactive_transition_cancelled") && !value.joined() && !value.mayInteract(), "cancel invented dismiss"); break;
      case "retirement-before-or-after-physical-never-joins":
        shown(value); value.interactiveWillDismiss(); transaction = value.transaction(); value.didDismiss(transaction); check(kinds(value.retire()).equals("retired"), "retire absent");
        check(value.acceptClose("original-sheet", "source-close", transaction) == null && !value.joined(), "retired joined");
        AdminSheetTransaction early = make(); early.retire(); check(!early.beginPresentation() && early.presentationCompleted().isEmpty(), "retired revived"); break;
      case "physical-without-will-retains-native-transaction":
        shown(value); List<AdminSheetTransaction.Event> physical = value.didDismiss(null);
        check(kinds(physical).equals("didDismiss") && physical.get(0).transaction != null && !value.joined() && !value.mayInteract(), "spontaneous lost");
        check(kinds(value.acceptClose("original-sheet", "source-close", physical.get(0).transaction)).equals("closeAccepted,closeJoined"), "spontaneous join"); break;
      case "strict-opaque-ticket-validation":
        for (String ticket : Arrays.asList("", "bad ticket", "../sheet", "é", new String(new char[161]).replace('\0', 'x'))) {
          boolean rejected = false; try { new AdminSheetTransaction(ticket, "parent"); } catch (IllegalArgumentException expected) { rejected = true; } check(rejected, "invalid ticket");
        }
        boolean rejected = false; try { new AdminSheetTransaction("same", "same"); } catch (IllegalArgumentException expected) { rejected = true; } check(rejected, "parent/presentation alias"); break;
      case "failed-receipts-cannot-revive":
        shown(value); value.fail("original_parent_changed");
        check(value.presentationCompleted().isEmpty() && value.didDismiss(null).isEmpty() && value.acceptClose("original-sheet", "source-close", null) == null, "failed revived"); break;
      default: throw new AssertionError(name);
    }
    System.out.println(name + " passed");
  }
}
