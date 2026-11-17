package expo.modules.accordadminpresentation;

import java.util.ArrayList;
import java.util.List;

public final class AdminSheetRetirementHostTest {
  private static final class Replies implements AdminSheetRetirement.Reply {
    final List<AdminSheetRetirement.Receipt> receipts = new ArrayList<>(); final List<String> failures = new ArrayList<>();
    public void success(AdminSheetRetirement.Receipt receipt) { receipts.add(receipt); }
    public void failure(String code) { failures.add(code); }
    boolean pending() { return receipts.isEmpty() && failures.isEmpty(); }
  }
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private final Object owner = new Object(); private int next;
  private final AdminSheetRetirement ledger = new AdminSheetRetirement(() -> String.format("00000000-0000-4000-8000-%012d", ++next));
  private final Replies replies = new Replies();
  private void claim() { check(ledger.claim("P", "parent", owner), "claim"); }
  private void issue() { claim(); check(ledger.issuePresentation("P", owner), "issue"); }
  private void ready() { ledger.presentationCompleted("P", owner); ledger.attached("P", owner); }
  private void gone() { ledger.detached("P", owner); ledger.dismissed("P", owner); }
  private void request(Replies value) { ledger.request("P", "parent", "R", value); }
  private void run(String name) {
    switch (name) {
      case "before-mount-tombstone-prevents-delayed-claim": request(replies); check(replies.receipts.get(0).disposition.equals("neverPresented") && !ledger.claim("P", "parent", owner) && !ledger.claim("P", "new-parent", owner), "delayed claim revived"); break;
      case "mounted-before-call-preempted-without-native-ack": claim(); request(replies); check(replies.receipts.get(0).disposition.equals("neverPresented") && !ledger.issuePresentation("P", owner), "preempted call issued"); break;
      case "issued-call-never-becomes-never-presented": issue(); request(replies); check(replies.pending() && !ledger.mayDismiss("P", owner), "absence became receipt"); break;
      case "real-presentation-or-attachment-is-only-action-readiness": issue(); request(replies); ledger.presentationCompleted("P", owner); check(!ledger.mayDismiss("P", owner), "OnShow was attachment"); ledger.attached("P", owner); check(ledger.mayDismiss("P", owner) && replies.pending(), "readiness became removal"); break;
      case "dismiss-request-is-not-removal": issue(); request(replies); ready(); check(ledger.issueDismissal("P", owner) && !ledger.issueDismissal("P", owner) && replies.pending(), "duplicate request/ACK"); break;
      case "only-genuine-platform-removal-completes": issue(); request(replies); ready(); ledger.issueDismissal("P", owner); ledger.dismissed("P", owner); check(replies.pending(), "OnDismiss without decor detach"); ledger.detached("P", owner); check(replies.receipts.get(0).disposition.equals("removed"), "real removal lost"); break;
      case "android-detach-without-dismiss-is-not-completion": issue(); request(replies); ready(); ledger.detached("P", owner); check(replies.pending(), "detach alone completed"); ledger.dismissed("P", owner); check(replies.receipts.get(0).disposition.equals("removed"), "join failed"); break;
      case "early-actual-removal-retained-until-original-R": issue(); ready(); gone(); check(replies.pending(), "unrequested result"); request(replies); check(replies.receipts.get(0).disposition.equals("removed"), "early fact lost"); break;
      case "duplicate-pending-R-has-one-receipt-identity": {
        issue(); request(replies); Replies second = new Replies(); request(second); ready(); gone(); check(replies.receipts.size() == 1 && replies.receipts.get(0).receiptID.equals(second.receipts.get(0).receiptID), "duplicate replaced original");
        Replies late = new Replies(); request(late); check(late.receipts.get(0).receiptID.equals(replies.receipts.get(0).receiptID), "duplicate minted UUID"); break;
      }
      case "foreign-parent-or-R-cannot-replace-original": { issue(); request(replies); Replies bad = new Replies(); ledger.request("P", "different-parent", "R", bad); ledger.request("P", "parent", "other-R", bad); check(bad.failures.size() == 2 && replies.pending() && ledger.matchesIntent("P", "parent", "R"), "foreign adopted"); ready(); gone(); check(replies.receipts.size() == 1, "original lost"); break; }
      case "retirement-R-cannot-move-to-another-presentation": { request(replies); Replies bad = new Replies(); ledger.request("other-P", "parent", "R", bad); check(bad.failures.get(0).equals("retirement_ticket_reused") && replies.receipts.size() == 1, "R retargeted"); break; }
      case "foreign-native-owner-callbacks-cannot-remove-original": { issue(); request(replies); Object other = new Object(); ledger.presentationCompleted("P", other); ledger.attached("P", other); ledger.dismissed("P", other); ledger.detached("P", other); check(replies.pending() && !ledger.mayDismiss("P", owner), "foreign native facts"); ready(); gone(); check(replies.receipts.size() == 1, "own lost"); break; }
      case "private-retirement-before-late-R-keeps-proof": claim(); ledger.retireOwner("P", owner); check(!ledger.issuePresentation("P", owner), "private revived"); request(replies); check(replies.receipts.get(0).disposition.equals("neverPresented"), "late lost"); break;
      case "Source-retirement-does-not-drop-pending-present-completion": issue(); ledger.retireOwner("P", owner); request(replies); check(replies.pending(), "pending inferredgone"); ready(); check(ledger.mayDismiss("P", owner), "Source dropped completion"); gone(); check(replies.receipts.get(0).disposition.equals("removed"), "cleanup blocked"); break;
      case "destroy-rejects-pending-and-future-without-success": { issue(); request(replies); ledger.destroy(); check(replies.failures.get(0).equals("module_destroyed") && replies.receipts.isEmpty(), "destroy became ACK"); ready(); gone(); Replies future = new Replies(); request(future); check(future.failures.get(0).equals("module_destroyed") && !ledger.claim("new", "parent", new Object()), "destroy revived"); break; }
      case "retiring-owner-does-not-require-account-authority": issue(); request(replies); ready(); gone(); check(replies.receipts.get(0).disposition.equals("removed"), "resource adopted Source authority"); break;
      case "invalid-identity-aliases-reject-before-recording": { Replies bad = new Replies(); ledger.request("P", "P", "R", bad); ledger.request("P", "parent", "P", bad); ledger.request("bad ticket", "parent", "R", bad); check(bad.failures.size() == 3 && ledger.claim("P", "parent", owner), "bad tuple poisoned P"); break; }
      case "receipt-UUID-and-R-cannot-be-reused-as-P": request(replies); check(!ledger.claim(replies.receipts.get(0).receiptID, "parent", new Object()) && !ledger.claim("R", "parent", new Object()), "namespace reused"); break;
      case "known-child-hold-does-not-consume-dismiss-reservation": { issue(); request(replies); ready(); check(replies.pending() && ledger.mayDismiss("P", owner), "hold was ACK"); Replies duplicate = new Replies(); request(duplicate); check(ledger.issueDismissal("P", owner), "child release couldnotresume"); gone(); check(duplicate.receipts.get(0).receiptID.equals(replies.receipts.get(0).receiptID), "retry retargeted"); break; }
      case "late-Source-close-after-resource-release-never-represents": {
        issue(); ready(); AdminSheetTransaction source = new AdminSheetTransaction("P", "parent"); check(source.beginPresentation(), "Source begin"); source.presentationCompleted(); source.interactiveWillDismiss();
        String transaction = source.transaction(); source.didDismiss(transaction); gone();
        check(ledger.state("P", owner).terminal && !ledger.issuePresentation("P", owner), "released P re-presented");
        List<AdminSheetTransaction.Event> events = source.acceptClose("P", "source-close", transaction);
        check(events != null && events.size() == 2 && events.get(0).kind.equals("closeAccepted") && events.get(1).kind.equals("closeJoined"), "late Source C lost original core"); break;
      }
      default: throw new AssertionError(name);
    }
    System.out.println(name + " passed");
  }
  public static void main(String[] args) { new AdminSheetRetirementHostTest().run(args[0]); }
}
