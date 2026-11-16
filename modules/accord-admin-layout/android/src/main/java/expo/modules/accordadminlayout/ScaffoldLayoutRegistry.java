package expo.modules.accordadminlayout;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Original-view/window registration and two-phase layout ownership. Contains no Android dependencies. */
public final class ScaffoldLayoutRegistry {
  public static final int PROTOCOL = 1;
  public static final String GUARANTEE = "original-window-layout-snapshot";
  public interface Node {
    Object identity();
    boolean attached();
    Object rootIdentity();
    Object windowIdentity();
    Object windowToken();
  }
  public interface Subscription { void close(); }
  public interface Changed { void run(); }
  public interface Host {
    void assertMainThread();
    Node resolve(int tag, String nativeID);
    boolean matches(Node original, int tag, String nativeID);
    boolean contains(Node ancestor, Node descendant);
    Subscription observe(Node viewport, Changed changed);
    Viewport readViewport(Node viewport);
    Dock readDock(Node viewport, Node dock);
    Pair readPair(Node viewport, Node dock, Node fixed);
  }
  public interface Sink { void changed(Event event); }
  public static final class Rect {
    public final double x, y, width, height;
    public Rect(double x, double y, double width, double height) { this.x = x; this.y = y; this.width = width; this.height = height; }
  }
  public static final class Viewport {
    public final Rect rect;
    public final double rawImeBottom, viewPaddingBottom, systemGestureBottom, safeTop, safeLeft, safeRight;
    public Viewport(Rect rect, double rawImeBottom, double viewPaddingBottom, double systemGestureBottom, double safeTop, double safeLeft, double safeRight) {
      this.rect = rect; this.rawImeBottom = rawImeBottom; this.viewPaddingBottom = viewPaddingBottom;
      this.systemGestureBottom = systemGestureBottom; this.safeTop = safeTop; this.safeLeft = safeLeft; this.safeRight = safeRight;
    }
  }
  public static final class Pair {
    public final Viewport viewport;
    public final Rect fixed;
    public final double dockHeight;
    public Pair(Viewport viewport, Rect fixed, double dockHeight) { this.viewport = viewport; this.fixed = fixed; this.dockHeight = dockHeight; }
  }
  public static final class Dock {
    public final Viewport viewport; public final double dockHeight;
    public Dock(Viewport viewport, double dockHeight) { this.viewport = viewport; this.dockHeight = dockHeight; }
  }
  public static final class Event {
    public final String kind, handle, ticket, windowID, viewportHandle;
    public final long revision, frame;
    public final boolean retired;
    public final Viewport viewport;
    public final Dock dock;
    public final Pair pair;
    Event(String kind, String handle, String ticket, String windowID, String viewportHandle, long revision, long frame, boolean retired, Viewport viewport, Dock dock, Pair pair) {
      this.kind = kind; this.handle = handle; this.ticket = ticket; this.windowID = windowID; this.viewportHandle = viewportHandle;
      this.revision = revision; this.frame = frame; this.retired = retired; this.viewport = viewport; this.dock = dock; this.pair = pair;
    }
  }
  public static final class Receipt {
    public final String handle, ticket, windowID;
    public final Event initial;
    Receipt(String handle, String ticket, String windowID, Event initial) { this.handle = handle; this.ticket = ticket; this.windowID = windowID; this.initial = initial; }
  }
  private static final class Marker {
    final int tag; final String id; final Node node;
    Marker(int tag, String id, Node node) { this.tag = tag; this.id = id; this.node = node; }
  }
  private static final class ViewportEntry {
    final String handle, ticket, windowID = "scaffold-window-" + UUID.randomUUID();
    final Marker marker; final Object root, window, token;
    final Map<String, PartEntry> parts = new HashMap<>();
    Subscription subscription; Event last; long revision, frame; boolean sampling, retired;
    ViewportEntry(String handle, String ticket, Marker marker) {
      this.handle = handle; this.ticket = ticket; this.marker = marker;
      root = marker.node.rootIdentity(); window = marker.node.windowIdentity(); token = marker.node.windowToken();
    }
  }
  private static final class PartEntry {
    final String handle, ticket; final ViewportEntry owner; final Marker dock, fixed;
    Event last; long revision; boolean retired;
    PartEntry(String handle, String ticket, ViewportEntry owner, Marker dock, Marker fixed) {
      this.handle = handle; this.ticket = ticket; this.owner = owner; this.dock = dock; this.fixed = fixed;
    }
  }
  private final Host host; private final Sink sink;
  private final Map<String, ViewportEntry> viewports = new HashMap<>();
  private final Map<String, PartEntry> parts = new HashMap<>();
  private final Set<String> usedTickets = new HashSet<>();
  private boolean destroyed;
  public ScaffoldLayoutRegistry(Host host, Sink sink) { this.host = host; this.sink = sink; }
  public static boolean validID(String value) { return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9:._-]{0,159}"); }
  private static IllegalStateException failure(String code) { return new IllegalStateException(code); }
  private void reserve(String ticket) {
    host.assertMainThread(); if (destroyed) throw failure("module_destroyed");
    if (!validID(ticket)) throw failure("invalid_ticket"); if (!usedTickets.add(ticket)) throw failure("ticket_reused");
  }
  private Marker resolve(int tag, String nativeID) {
    if (tag <= 0 || !validID(nativeID)) throw failure("invalid_marker");
    Node node = host.resolve(tag, nativeID);
    if (node == null || !host.matches(node, tag, nativeID)) throw failure("marker_unavailable");
    return new Marker(tag, nativeID, node);
  }
  private boolean matches(Marker marker) { return host.matches(marker.node, marker.tag, marker.id); }
  private boolean live(ViewportEntry owner) { return !destroyed && !owner.retired && viewports.get(owner.handle) == owner; }
  private boolean sameWindow(ViewportEntry owner, Node node) {
    return node.attached() && node.rootIdentity() == owner.root && node.windowIdentity() == owner.window && node.windowToken() == owner.token;
  }
  private boolean original(ViewportEntry owner) {
    if (!live(owner)) return false;
    if (!matches(owner.marker)) { retire(owner); return false; }
    // Retained UIKit full-screen pages can temporarily leave their original window.
    if (!owner.marker.node.attached()) return false;
    if (!sameWindow(owner, owner.marker.node)) { retire(owner); return false; }
    return true;
  }
  /** Called only after the caller has the actual viewport marker's native layout/tag. No attach polling or default viewport. */
  public Receipt bindViewport(int tag, String nativeID, String ticket) {
    reserve(ticket); Marker marker = resolve(tag, nativeID);
    if (!marker.node.attached() || marker.node.rootIdentity() == null || marker.node.windowIdentity() == null || marker.node.windowToken() == null) throw failure("viewport_not_attached");
    ViewportEntry owner = new ViewportEntry("scaffold-viewport-" + UUID.randomUUID(), ticket, marker); viewports.put(owner.handle, owner);
    try {
      Subscription subscription = host.observe(marker.node, () -> refresh(owner));
      if (subscription == null) throw failure("observer_unavailable");
      if (!live(owner)) { close(subscription); throw failure("viewport_retired"); }
      owner.subscription = subscription; refresh(owner);
      if (!live(owner) || !original(owner)) throw failure("viewport_retired");
      return new Receipt(owner.handle, owner.ticket, owner.windowID, owner.last);
    } catch (RuntimeException error) { retire(owner); throw error; }
  }
  /** Actual dock and fixed marker descendants are mandatory. A numeric host extent never registers a part. */
  public Receipt bindParts(String viewportHandle, String viewportTicket, int dockTag, String dockID, int fixedTag, String fixedID, String ticket) {
    reserve(ticket); ViewportEntry owner = viewports.get(viewportHandle);
    if (owner == null || !owner.ticket.equals(viewportTicket) || !original(owner)) throw failure("unknown_viewport");
    if (owner.sampling) throw failure("viewport_busy");
    Marker dock = resolve(dockTag, dockID), fixed = resolve(fixedTag, fixedID);
    if (dock.node.identity() == fixed.node.identity() || dock.node.identity() == owner.marker.node.identity() || fixed.node.identity() == owner.marker.node.identity() ||
        !host.contains(owner.marker.node, dock.node) || !host.contains(owner.marker.node, fixed.node) || host.contains(dock.node, fixed.node) || host.contains(fixed.node, dock.node) ||
        !sameWindow(owner, dock.node) || !sameWindow(owner, fixed.node) || !original(owner)) throw failure("parts_not_in_original_viewport");
    PartEntry entry = new PartEntry("scaffold-parts-" + UUID.randomUUID(), ticket, owner, dock, fixed);
    owner.parts.put(entry.handle, entry); parts.put(entry.handle, entry); refresh(owner);
    if (entry.retired || !live(owner) || parts.get(entry.handle) != entry) throw failure("parts_retired");
    return new Receipt(entry.handle, entry.ticket, owner.windowID, entry.last);
  }
  public Receipt bindDock(String viewportHandle, String viewportTicket, int tag, String id, String ticket) {
    reserve(ticket); ViewportEntry owner = viewports.get(viewportHandle);
    if (owner == null || !owner.ticket.equals(viewportTicket) || !original(owner)) throw failure("unknown_viewport");
    if (owner.sampling) throw failure("viewport_busy"); Marker dock = resolve(tag, id);
    if (dock.node.identity() == owner.marker.node.identity() || !host.contains(owner.marker.node, dock.node) || !sameWindow(owner, dock.node) || !original(owner)) throw failure("dock_not_in_original_viewport");
    PartEntry entry = new PartEntry("scaffold-dock-" + UUID.randomUUID(), ticket, owner, dock, null);
    owner.parts.put(entry.handle, entry); parts.put(entry.handle, entry); refresh(owner);
    if (entry.retired || !live(owner) || parts.get(entry.handle) != entry) throw failure("parts_retired");
    return new Receipt(entry.handle, entry.ticket, owner.windowID, entry.last);
  }
  private static boolean nonnegative(double value) { return Double.isFinite(value) && value >= 0; }
  private static boolean rect(Rect value) { return value != null && Double.isFinite(value.x) && Double.isFinite(value.y) && nonnegative(value.width) && value.width > 0 && nonnegative(value.height) && value.height > 0; }
  private static boolean valid(Viewport value) { return value != null && rect(value.rect) && nonnegative(value.rawImeBottom) && nonnegative(value.viewPaddingBottom) && nonnegative(value.systemGestureBottom) && nonnegative(value.safeTop) && nonnegative(value.safeLeft) && nonnegative(value.safeRight) && value.safeLeft + value.safeRight < value.rect.width; }
  private static boolean equal(Rect a, Rect b) { return a == b || a != null && b != null && a.x == b.x && a.y == b.y && a.width == b.width && a.height == b.height; }
  private static boolean equal(Viewport a, Viewport b) { return a == b || a != null && b != null && equal(a.rect, b.rect) && a.rawImeBottom == b.rawImeBottom && a.viewPaddingBottom == b.viewPaddingBottom && a.systemGestureBottom == b.systemGestureBottom && a.safeTop == b.safeTop && a.safeLeft == b.safeLeft && a.safeRight == b.safeRight; }
  private static boolean equal(Pair a, Pair b) { return a == b || a != null && b != null && equal(a.viewport, b.viewport) && equal(a.fixed, b.fixed) && a.dockHeight == b.dockHeight; }
  private static boolean equal(Dock a, Dock b) { return a == b || a != null && b != null && equal(a.viewport, b.viewport) && a.dockHeight == b.dockHeight; }
  private void emit(Event event) { try { sink.changed(event); } catch (RuntimeException ignored) {} }
  private void publish(ViewportEntry owner, Viewport value) {
    if (owner.last != null && !owner.last.retired && equal(owner.last.viewport, value)) return;
    owner.last = new Event("viewport", owner.handle, owner.ticket, owner.windowID, owner.handle, ++owner.revision, owner.frame, false, value, null, null); emit(owner.last);
  }
  private void publish(PartEntry entry, Pair value) {
    if (entry.last != null && !entry.last.retired && equal(entry.last.pair, value)) return;
    entry.last = new Event("pair", entry.handle, entry.ticket, entry.owner.windowID, entry.owner.handle, ++entry.revision, entry.owner.frame, false, null, null, value); emit(entry.last);
  }
  private void publishDock(PartEntry entry, Dock value) {
    if (entry.last != null && !entry.last.retired && equal(entry.last.dock, value)) return;
    entry.last = new Event("dock", entry.handle, entry.ticket, entry.owner.windowID, entry.owner.handle, ++entry.revision, entry.owner.frame, false, null, value, null); emit(entry.last);
  }
  private boolean original(PartEntry entry) {
    ViewportEntry owner = entry.owner;
    if (entry.retired || parts.get(entry.handle) != entry || !live(owner)) return false;
    if (!matches(entry.dock) || !host.contains(owner.marker.node, entry.dock.node) || entry.fixed != null && (!matches(entry.fixed) || !host.contains(owner.marker.node, entry.fixed.node) || host.contains(entry.dock.node, entry.fixed.node) || host.contains(entry.fixed.node, entry.dock.node))) { retire(entry); return false; }
    if (!entry.dock.node.attached() || entry.fixed != null && !entry.fixed.node.attached()) return false;
    if (!sameWindow(owner, entry.dock.node) || entry.fixed != null && !sameWindow(owner, entry.fixed.node)) { retire(entry); return false; }
    return true;
  }
  private void refresh(ViewportEntry owner) {
    host.assertMainThread(); if (!live(owner) || owner.sampling) return; owner.sampling = true; owner.frame++;
    try {
      Viewport viewport = null;
      if (original(owner)) { viewport = host.readViewport(owner.marker.node); if (!valid(viewport) || !original(owner)) viewport = null; }
      if (!live(owner)) return; publish(owner, viewport);
      for (PartEntry entry : new ArrayList<>(owner.parts.values())) {
        if (entry.fixed == null) {
          Dock dock = null;
          if (viewport != null && original(owner) && original(entry)) {
            dock = host.readDock(owner.marker.node, entry.dock.node);
            if (dock == null || !valid(dock.viewport) || !nonnegative(dock.dockHeight) || dock.dockHeight <= 0 || !original(owner) || !original(entry)) dock = null;
          }
          if (live(owner) && !entry.retired) publishDock(entry, dock); continue;
        }
        Pair pair = null;
        if (viewport != null && original(owner) && original(entry)) {
          pair = host.readPair(owner.marker.node, entry.dock.node, entry.fixed.node);
          if (pair == null || !valid(pair.viewport) || !rect(pair.fixed) || !nonnegative(pair.dockHeight) || pair.dockHeight <= 0 || !original(owner) || !original(entry)) pair = null;
        }
        if (live(owner) && !entry.retired) publish(entry, pair);
      }
    } catch (RuntimeException error) {
      if (live(owner)) { publish(owner, null); for (PartEntry entry : new ArrayList<>(owner.parts.values())) if (!entry.retired) { if (entry.fixed == null) publishDock(entry, null); else publish(entry, null); } }
    } finally { owner.sampling = false; }
  }
  private static void close(Subscription subscription) { if (subscription != null) { try { subscription.close(); } catch (RuntimeException ignored) {} } }
  private void retire(PartEntry entry) {
    if (entry.retired) return; entry.retired = true; parts.remove(entry.handle); entry.owner.parts.remove(entry.handle);
    entry.last = new Event(entry.fixed == null ? "dock" : "pair", entry.handle, entry.ticket, entry.owner.windowID, entry.owner.handle, ++entry.revision, Math.max(1, entry.owner.frame), true, null, null, null); emit(entry.last);
  }
  private void retire(ViewportEntry owner) {
    if (owner.retired) return; owner.retired = true; viewports.remove(owner.handle); close(owner.subscription); owner.subscription = null;
    for (PartEntry entry : new ArrayList<>(owner.parts.values())) retire(entry);
    owner.last = new Event("viewport", owner.handle, owner.ticket, owner.windowID, owner.handle, ++owner.revision, Math.max(1, owner.frame), true, null, null, null); emit(owner.last);
  }
  public boolean release(String handle, String ticket) {
    host.assertMainThread(); ViewportEntry viewport = viewports.get(handle);
    if (viewport != null && viewport.ticket.equals(ticket)) { retire(viewport); return true; }
    PartEntry entry = parts.get(handle); if (entry != null && entry.ticket.equals(ticket)) { retire(entry); return true; } return false;
  }
  /** Records cancellation even when the queued native bind has not executed yet. IDs can never be reused. */
  public boolean cancelTicket(String ticket) {
    host.assertMainThread(); if (!validID(ticket)) return false; boolean fresh = usedTickets.add(ticket);
    for (ViewportEntry entry : new ArrayList<>(viewports.values())) if (entry.ticket.equals(ticket)) { retire(entry); return true; }
    for (PartEntry entry : new ArrayList<>(parts.values())) if (entry.ticket.equals(ticket)) { retire(entry); return true; } return fresh;
  }
  public void destroy() { host.assertMainThread(); if (destroyed) return; destroyed = true; for (ViewportEntry entry : new ArrayList<>(viewports.values())) retire(entry); usedTickets.clear(); }
  public void invalidate() { host.assertMainThread(); for (ViewportEntry entry : new ArrayList<>(viewports.values())) retire(entry); }
}
