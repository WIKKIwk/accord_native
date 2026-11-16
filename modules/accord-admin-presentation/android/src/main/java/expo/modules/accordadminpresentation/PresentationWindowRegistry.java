package expo.modules.accordadminpresentation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Observes one original non-Activity window tree. This does not infer a dialog from a class name,
 * observe marker removal, or assert that the compositor's final animation frame has finished.
 * The caller must put its uniquely identified marker inside its actual presented content.
 * All methods and host callbacks belong to the UI thread.
 */
public final class PresentationWindowRegistry {
  public static final String GUARANTEE = "window-tree-detach";
  public interface Subscription { void close(); }
  public interface Attachment { void attached(); void detached(); }
  public interface Node {
    Object identity();
    Object windowToken();
    boolean attached();
    Node root();
    Subscription observe(Attachment listener);
  }
  public interface Host {
    void assertMainThread();
    Object activity();
    boolean activityUsable(Object original);
    Node activityRoot(Object original);
    Node resolveMarker(int tag, String ticket);
    boolean markerMatches(Node original, int tag, String ticket);
  }
  public interface Reply<T> { void success(T value); void failure(String code); }
  public static final class Receipt {
    public final String handle;
    public final String ticket;
    public final int viewTag;
    Receipt(String handle, String ticket, int viewTag) { this.handle = handle; this.ticket = ticket; this.viewTag = viewTag; }
  }
  private enum Phase { PENDING, ARMED, DETACHED, RETIRED }
  private static final class Entry {
    final Receipt receipt;
    final Object activity;
    final Object activityRoot;
    final Object activityToken;
    Node marker;
    Node root;
    Phase phase = Phase.PENDING;
    Subscription markerSubscription;
    Subscription rootSubscription;
    Reply<Receipt> arm;
    Reply<Receipt> wait;
    Entry(Receipt receipt, Object activity, Node activityRoot, Node marker, Reply<Receipt> arm) {
      this.receipt = receipt; this.activity = activity; this.activityRoot = activityRoot.identity();
      this.activityToken = activityRoot.windowToken(); this.marker = marker; this.arm = arm;
    }
  }
  private final Host host;
  private final Map<String, Entry> handles = new HashMap<>();
  private final Map<String, Entry> tickets = new HashMap<>();
  // Only opaque IDs survive completion. Native Views, Activities, listeners and replies do not.
  // An old pending-cancel can therefore never target a later arm reusing the same client ID.
  private final Set<String> usedTickets = new HashSet<>();
  private boolean destroyed;
  public PresentationWindowRegistry(Host host) { this.host = host; }
  public static boolean validId(String value) { return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9:._-]{0,159}"); }
  private boolean live(Entry entry) { return handles.get(entry.receipt.handle) == entry && tickets.get(entry.receipt.ticket) == entry; }
  private boolean originalActivity(Entry entry) {
    if (destroyed || host.activity() != entry.activity || !host.activityUsable(entry.activity)) return false;
    Node root = host.activityRoot(entry.activity);
    return root != null && root.identity() == entry.activityRoot && root.attached() && root.windowToken() == entry.activityToken;
  }
  private static void close(Subscription subscription) { if (subscription != null) { try { subscription.close(); } catch (RuntimeException ignored) {} } }
  private static <T> void fail(Reply<T> reply, String code) { if (reply != null) { try { reply.failure(code); } catch (RuntimeException ignored) {} } }
  private void remove(Entry entry) {
    entry.phase = Phase.RETIRED; handles.remove(entry.receipt.handle); tickets.remove(entry.receipt.ticket);
    Subscription marker = entry.markerSubscription, root = entry.rootSubscription;
    entry.markerSubscription = null; entry.rootSubscription = null; entry.marker = null; entry.root = null;
    close(marker); close(root);
  }
  private void cancelEntry(Entry entry, String code) {
    if (!live(entry)) return; Reply<Receipt> arm = entry.arm, wait = entry.wait; entry.arm = null; entry.wait = null;
    remove(entry); fail(arm, code); fail(wait, code);
  }
  public void arm(int tag, String ticket, Reply<Receipt> reply) {
    host.assertMainThread();
    if (destroyed) { fail(reply, "module_destroyed"); return; }
    if (tag <= 0 || !validId(ticket)) { fail(reply, "invalid_marker"); return; }
    if (!usedTickets.add(ticket)) { fail(reply, "ticket_reused"); return; }
    Entry entry;
    try {
      Object activity = host.activity(); Node activityRoot = activity == null ? null : host.activityRoot(activity);
      if (activity == null || !host.activityUsable(activity) || activityRoot == null || !activityRoot.attached() || activityRoot.windowToken() == null) { fail(reply, "activity_unavailable"); return; }
      Node marker = host.resolveMarker(tag, ticket);
      if (marker == null || !host.markerMatches(marker, tag, ticket)) { fail(reply, "marker_unavailable"); return; }
      entry = new Entry(new Receipt("window-" + UUID.randomUUID(), ticket, tag), activity, activityRoot, marker, reply);
    } catch (RuntimeException error) { fail(reply, "marker_unavailable"); return; }
    handles.put(entry.receipt.handle, entry); tickets.put(ticket, entry);
    try {
      if (entry.marker.attached()) attemptArm(entry);
      else {
        Subscription subscription = entry.marker.observe(new Attachment() {
          public void attached() { attemptArm(entry); }
          public void detached() { host.assertMainThread(); cancelEntry(entry, "marker_detached_before_arm"); }
        });
        if (!live(entry) || entry.phase != Phase.PENDING) close(subscription);
        else { entry.markerSubscription = subscription; if (entry.marker.attached()) attemptArm(entry); }
      }
    } catch (RuntimeException error) { cancelEntry(entry, "observer_failed"); }
  }
  private void attemptArm(Entry entry) {
    host.assertMainThread(); if (!live(entry) || entry.phase != Phase.PENDING) return;
    try {
      if (!originalActivity(entry)) { cancelEntry(entry, "activity_changed"); return; }
      Node marker = entry.marker;
      if (!host.markerMatches(marker, entry.receipt.viewTag, entry.receipt.ticket)) { cancelEntry(entry, "marker_changed"); return; }
      if (!marker.attached()) return;
      Node root = marker.root(); Object token = marker.windowToken();
      if (root == null || !root.attached() || root.identity() == entry.activityRoot || token == null || root.windowToken() != token || token == entry.activityToken) { cancelEntry(entry, "not_separate_window"); return; }
      entry.root = root;
      Subscription subscription = root.observe(new Attachment() {
        public void attached() { /* Reattachment never constitutes completion. */ }
        public void detached() { rootDetached(entry); }
      });
      if (!live(entry)) { close(subscription); return; }
      entry.rootSubscription = subscription;
      // No acknowledgment until the exact root listener is installed and the original tree still exists.
      if (!originalActivity(entry) || !root.attached() || !marker.attached() || marker.root().identity() != root.identity() || root.windowToken() != token || marker.windowToken() != token || !host.markerMatches(marker, entry.receipt.viewTag, entry.receipt.ticket)) { cancelEntry(entry, "window_changed_before_ack"); return; }
      close(entry.markerSubscription); entry.markerSubscription = null; entry.marker = null; entry.phase = Phase.ARMED;
      Reply<Receipt> reply = entry.arm; entry.arm = null;
      try { reply.success(entry.receipt); } catch (RuntimeException error) { cancelEntry(entry, "arm_reply_failed"); }
    } catch (RuntimeException error) { cancelEntry(entry, "observer_failed"); }
  }
  private void rootDetached(Entry entry) {
    host.assertMainThread(); if (!live(entry)) return;
    try {
      if (!originalActivity(entry)) { cancelEntry(entry, "activity_changed"); return; }
      // Android dispatches this exact listener before clearing the root's AttachInfo. Its attached
      // getter can still be true here; the native detach event is the evidence, not that getter.
      if (entry.phase != Phase.ARMED || entry.root == null) { cancelEntry(entry, "window_changed_before_ack"); return; }
      entry.phase = Phase.DETACHED; close(entry.rootSubscription); entry.rootSubscription = null; entry.root = null;
      if (entry.wait != null) complete(entry);
    } catch (RuntimeException error) { cancelEntry(entry, "observer_failed"); }
  }
  private void complete(Entry entry) {
    Reply<Receipt> reply = entry.wait; entry.wait = null; remove(entry);
    try { reply.success(entry.receipt); } catch (RuntimeException ignored) {}
  }
  public void waitForDetach(String handle, String ticket, Reply<Receipt> reply) {
    host.assertMainThread(); Entry entry = handles.get(handle);
    if (!validId(handle) || !validId(ticket) || entry == null || !entry.receipt.ticket.equals(ticket)) { fail(reply, "unknown_window"); return; }
    try { if (!originalActivity(entry)) { cancelEntry(entry, "activity_changed"); fail(reply, "activity_changed"); return; } }
    catch (RuntimeException error) { cancelEntry(entry, "observer_failed"); fail(reply, "observer_failed"); return; }
    if (entry.phase == Phase.PENDING) { fail(reply, "window_not_armed"); return; }
    if (entry.wait != null) { fail(reply, "already_waiting"); return; }
    entry.wait = reply; if (entry.phase == Phase.DETACHED) complete(entry);
  }
  public boolean cancelPending(String ticket) {
    host.assertMainThread(); Entry entry = tickets.get(ticket);
    if (entry == null || entry.phase != Phase.PENDING) return false;
    cancelEntry(entry, "window_cancelled"); return true;
  }
  public boolean cancel(String handle, String ticket) {
    host.assertMainThread(); Entry entry = handles.get(handle);
    if (entry == null || !entry.receipt.ticket.equals(ticket)) return false;
    cancelEntry(entry, "window_cancelled"); return true;
  }
  public void activityDestroyed() { host.assertMainThread(); for (Entry entry : new ArrayList<>(handles.values())) cancelEntry(entry, "activity_destroyed"); }
  public void destroy() { host.assertMainThread(); destroyed = true; for (Entry entry : new ArrayList<>(handles.values())) cancelEntry(entry, "module_destroyed"); usedTickets.clear(); }
}
