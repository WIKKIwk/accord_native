package expo.modules.accordadminpresentation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/** Native facts only. A joined receipt is not authentication, Source acceptance, or a route POP. */
public final class AdminSheetTransaction {
  public enum Phase { CREATED, PRESENTING, SHOWN, DISMISSING, DISMISSED, FAILED, RETIRED }
  public static final class Event {
    public final String kind, presentation, parent, transaction, acceptedClose, reason;
    Event(String kind, String presentation, String parent, String transaction, String acceptedClose, String reason) {
      this.kind = kind; this.presentation = presentation; this.parent = parent; this.transaction = transaction; this.acceptedClose = acceptedClose; this.reason = reason;
    }
  }
  public final String presentation, parent;
  private Phase phase = Phase.CREATED;
  private String transaction, acceptedClose, acceptedOriginTransaction;
  private boolean physicalDismissed, joined;
  private final Set<String> used = new HashSet<>();
  private final Supplier<String> nextID;
  public AdminSheetTransaction(String presentation, String parent) { this(presentation, parent, () -> UUID.randomUUID().toString()); }
  public AdminSheetTransaction(String presentation, String parent, Supplier<String> nextID) {
    if (!validTicket(presentation) || !validTicket(parent) || presentation.equals(parent) || nextID == null) throw new IllegalArgumentException("Original sheet identity required");
    this.presentation = presentation; this.parent = parent; this.nextID = nextID;
  }
  public Phase phase() { return phase; }
  public String transaction() { return transaction; }
  public String acceptedClose() { return acceptedClose; }
  public boolean physicalDismissed() { return physicalDismissed; }
  public boolean joined() { return joined; }
  public boolean mayInteract() { return phase == Phase.SHOWN && transaction == null && acceptedClose == null; }
  public boolean needsProgrammaticDismiss() { return phase == Phase.DISMISSING && acceptedClose != null && !physicalDismissed; }
  private static boolean alphaNumeric(char value) { return value >= '0' && value <= '9' || value >= 'A' && value <= 'Z' || value >= 'a' && value <= 'z'; }
  public static boolean validTicket(String value) {
    if (value == null || value.isEmpty() || value.length() > 160 || !alphaNumeric(value.charAt(0))) return false;
    for (char item : value.toCharArray()) if (!alphaNumeric(item) && item != ':' && item != '.' && item != '_' && item != '-') return false;
    return true;
  }
  private Event event(String kind) { return event(kind, null); }
  private Event event(String kind, String reason) { return new Event(kind, presentation, parent, transaction, acceptedClose, reason); }
  private boolean newTransaction(String excluding) {
    String id = nextID.get();
    if (!validTicket(id) || id.equals(presentation) || id.equals(parent) || id.equals(excluding) || !used.add(id)) return false;
    transaction = id; return true;
  }
  public boolean beginPresentation() { if (phase != Phase.CREATED) return false; phase = Phase.PRESENTING; return true; }
  public List<Event> presentationCompleted() {
    if (phase != Phase.PRESENTING) return Collections.emptyList();
    phase = acceptedClose == null ? Phase.SHOWN : Phase.DISMISSING; return Collections.singletonList(event("shown"));
  }
  public List<Event> attemptedDismissal() { return mayInteract() ? Collections.singletonList(event("attempt")) : Collections.emptyList(); }
  public List<Event> interactiveWillDismiss() {
    if (!mayInteract()) return Collections.emptyList();
    if (!newTransaction(null)) return fail("transaction_identity_invalid");
    phase = Phase.DISMISSING; return Collections.singletonList(event("willDismiss"));
  }
  public List<Event> interactiveCancelled(String original) {
    if (phase != Phase.DISMISSING || !Objects.equals(transaction, original) || physicalDismissed) return Collections.emptyList();
    if (acceptedClose != null) return fail("accepted_interactive_transition_cancelled");
    Event value = event("cancelled"); transaction = null; phase = Phase.SHOWN; return Collections.singletonList(value);
  }
  /** Null rejects a foreign close. An empty list is the idempotent original accepted close. */
  public List<Event> acceptClose(String original, String ticket, String expected) {
    if (!presentation.equals(original) || !validTicket(ticket) || ticket.equals(parent) || ticket.equals(presentation) || phase == Phase.CREATED || phase == Phase.FAILED || phase == Phase.RETIRED) return null;
    if (acceptedClose != null) return acceptedClose.equals(ticket) && Objects.equals(expected, acceptedOriginTransaction) ? Collections.emptyList() : null;
    if (used.contains(ticket)) return null;
    if (phase == Phase.SHOWN || phase == Phase.PRESENTING) { if (expected != null || !newTransaction(ticket)) return null; }
    // Null is independent Source acceptance crossing the native gesture on the bridge. Bind only
    // this SAME immutable presentation's actual transaction; explicit native receipts remain exact.
    else if (expected != null && !expected.equals(transaction)) return null;
    acceptedClose = ticket; acceptedOriginTransaction = expected; used.add(ticket);
    if (phase == Phase.SHOWN) phase = Phase.DISMISSING;
    List<Event> events = new ArrayList<>(); events.add(event("closeAccepted")); events.addAll(joinIfPossible()); return events;
  }
  /** Called only by the owned Dialog's real OnDismiss listener. Hidden/settling is not this receipt. */
  public List<Event> didDismiss(String original) {
    if (phase != Phase.SHOWN && phase != Phase.DISMISSING || physicalDismissed) return Collections.emptyList();
    if (transaction != null) { if (!transaction.equals(original)) return Collections.emptyList(); }
    else { if (original != null) return Collections.emptyList(); if (!newTransaction(null)) return fail("transaction_identity_invalid"); }
    physicalDismissed = true; phase = Phase.DISMISSED;
    List<Event> events = new ArrayList<>(); events.add(event("didDismiss")); events.addAll(joinIfPossible()); return events;
  }
  private List<Event> joinIfPossible() {
    if (!physicalDismissed || acceptedClose == null || joined || phase != Phase.DISMISSED) return Collections.emptyList();
    joined = true; return Collections.singletonList(event("closeJoined"));
  }
  public List<Event> fail(String reason) {
    if (phase == Phase.FAILED || phase == Phase.RETIRED || joined) return Collections.emptyList();
    phase = Phase.FAILED; return Collections.singletonList(event("failed", reason));
  }
  public List<Event> retire() {
    if (phase == Phase.RETIRED) return Collections.emptyList(); phase = Phase.RETIRED; return Collections.singletonList(event("retired"));
  }
}
