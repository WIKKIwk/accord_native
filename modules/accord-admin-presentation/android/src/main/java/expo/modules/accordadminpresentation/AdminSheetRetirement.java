package expo.modules.accordadminpresentation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.lang.ref.WeakReference;

/** Resource facts only. Source close/result/route and account authority are deliberately absent. */
public final class AdminSheetRetirement {
  public interface Reply { void success(Receipt receipt); void failure(String code); }
  public static final class Receipt {
    public final String presentation, parent, retirement, receiptID, disposition;
    Receipt(String presentation, String parent, String retirement, String receiptID, String disposition) { this.presentation = presentation; this.parent = parent; this.retirement = retirement; this.receiptID = receiptID; this.disposition = disposition; }
  }
  public static final class State {
    public final boolean retiring, issued, presentationCompleted, attached, dismissalIssued, terminal;
    State(Entry value) { retiring = value.retiring; issued = value.issued; presentationCompleted = value.presentationCompleted; attached = value.attached; dismissalIssued = value.dismissalIssued; terminal = value.receiptID != null; }
  }
  private static final class Entry {
    final String presentation, parent; final WeakReference<Object> owner;
    String retirement, receiptID, disposition;
    boolean retiring, issued, presentationCompleted, attached, detached, dismissed, dismissalIssued;
    final List<Reply> replies = new ArrayList<>();
    Entry(String presentation, String parent, Object owner) { this.presentation = presentation; this.parent = parent; this.owner = new WeakReference<>(owner); }
  }
  private final Map<String, Entry> entries = new HashMap<>();
  private final Map<String, String> retirementOwners = new HashMap<>();
  private final Set<String> usedReceipts = new HashSet<>();
  private final Supplier<String> nextID;
  private boolean destroyed;
  public AdminSheetRetirement() { this(() -> UUID.randomUUID().toString()); }
  public AdminSheetRetirement(Supplier<String> nextID) { this.nextID = nextID; }
  private static boolean valid(String value) { return AdminSheetTransaction.validTicket(value); }
  public boolean destroyed() { return destroyed; }
  public boolean contains(String presentation) { return entries.containsKey(presentation); }
  public boolean claim(String presentation, String parent, Object owner) {
    if (destroyed || owner == null || !valid(presentation) || !valid(parent) || presentation.equals(parent) || entries.containsKey(presentation) || retirementOwners.containsKey(presentation) || retirementOwners.containsKey(parent) || usedReceipts.contains(presentation) || usedReceipts.contains(parent)) return false;
    entries.put(presentation, new Entry(presentation, parent, owner)); return true;
  }
  private Entry original(String presentation, Object owner) { Entry value = entries.get(presentation); return value != null && owner != null && value.owner.get() == owner ? value : null; }
  public State state(String presentation, Object owner) { Entry value = original(presentation, owner); return value == null ? null : new State(value); }
  public boolean issuePresentation(String presentation, Object owner) {
    Entry value = original(presentation, owner);
    if (destroyed || value == null || value.retiring || value.issued || value.receiptID != null) return false;
    value.issued = true; return true;
  }
  public void presentationCompleted(String presentation, Object owner) { Entry value = original(presentation, owner); if (value != null && value.issued && value.receiptID == null) value.presentationCompleted = true; }
  public void attached(String presentation, Object owner) { Entry value = original(presentation, owner); if (value != null && value.issued && value.receiptID == null) value.attached = true; }
  public boolean mayDismiss(String presentation, Object owner) { Entry value = original(presentation, owner); return value != null && value.retiring && value.issued && value.attached && !value.dismissalIssued && value.receiptID == null; }
  public boolean issueDismissal(String presentation, Object owner) { if (!mayDismiss(presentation, owner)) return false; original(presentation, owner).dismissalIssued = true; return true; }
  public void detached(String presentation, Object owner) { Entry value = original(presentation, owner); if (value == null || !value.issued || !value.attached) return; value.detached = true; if (value.dismissed) complete(value, "removed"); }
  public void dismissed(String presentation, Object owner) { Entry value = original(presentation, owner); if (value == null || !value.issued) return; value.dismissed = true; if (value.detached) complete(value, "removed"); }
  public void retireOwner(String presentation, Object owner) { Entry value = original(presentation, owner); if (value == null) return; value.retiring = true; if (!value.issued) complete(value, "neverPresented"); }
  public void request(String presentation, String parent, String retirement, Reply reply) {
    if (destroyed) { reply.failure("module_destroyed"); return; }
    if (!valid(presentation) || !valid(parent) || !valid(retirement) || presentation.equals(parent) || presentation.equals(retirement) || parent.equals(retirement) || retirementOwners.containsKey(presentation) || retirementOwners.containsKey(parent) || entries.containsKey(retirement) || usedReceipts.contains(presentation) || usedReceipts.contains(parent) || usedReceipts.contains(retirement)) { reply.failure("invalid_retirement_tuple"); return; }
    String assigned = retirementOwners.get(retirement);
    if (assigned != null && !assigned.equals(presentation)) { reply.failure("retirement_ticket_reused"); return; }
    Entry value = entries.get(presentation);
    if (value == null) { value = new Entry(presentation, parent, null); entries.put(presentation, value); }
    if (!value.parent.equals(parent) || value.retirement != null && !value.retirement.equals(retirement)) { reply.failure("foreign_retirement"); return; }
    value.retirement = retirement; value.retiring = true; retirementOwners.put(retirement, presentation); value.replies.add(reply);
    if (!value.issued) complete(value, "neverPresented"); else deliver(value);
  }
  public boolean matchesIntent(String presentation, String parent, String retirement) { Entry value = entries.get(presentation); return !destroyed && value != null && value.parent.equals(parent) && retirement.equals(value.retirement); }
  private void complete(Entry value, String disposition) {
    if (value.receiptID == null) {
      String id = nextID.get();
      if (!valid(id) || !id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}") || id.equals(value.presentation) || id.equals(value.parent) || id.equals(value.retirement) || entries.containsKey(id) || retirementOwners.containsKey(id) || !usedReceipts.add(id)) { fail(value, "invalid_retirement_receipt_identity"); return; }
      value.receiptID = id; value.disposition = disposition;
    }
    deliver(value);
  }
  private void deliver(Entry value) {
    if (value.receiptID == null || value.retirement == null) return;
    Receipt receipt = new Receipt(value.presentation, value.parent, value.retirement, value.receiptID, value.disposition);
    List<Reply> replies = new ArrayList<>(value.replies); value.replies.clear();
    for (Reply reply : replies) { if (destroyed) reply.failure("module_destroyed"); else reply.success(receipt); }
  }
  private void fail(Entry value, String code) { List<Reply> replies = new ArrayList<>(value.replies); value.replies.clear(); for (Reply reply : replies) reply.failure(code); }
  public void destroy() { if (destroyed) return; destroyed = true; for (Entry value : entries.values()) { value.retiring = true; fail(value, "module_destroyed"); } }
}
