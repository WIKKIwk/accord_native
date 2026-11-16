package expo.modules.accordadminlayout;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class ScaffoldLayoutHostTest {
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static final class Node implements ScaffoldLayoutRegistry.Node {
    final int tag; String id; boolean attached = true; Object root, window, token; Node parent;
    Node(int tag, String id, Object root, Object window, Object token) { this.tag = tag; this.id = id; this.root = root; this.window = window; this.token = token; }
    public Object identity() { return this; } public boolean attached() { return attached; }
    public Object rootIdentity() { return root; } public Object windowIdentity() { return window; } public Object windowToken() { return token; }
  }
  static final class Host implements ScaffoldLayoutRegistry.Host {
    final Map<Integer, Node> nodes = new HashMap<>(); final List<ScaffoldLayoutRegistry.Changed> observers = new ArrayList<>();
    final Object root = new Object(), window = new Object(), token = new Object(); final Node viewport = node(1, "viewport"), dock = node(2, "dock"), fixed = node(3, "fixed");
    boolean main = true, known = true; Runnable duringRead; double ime = 0, dockHeight = 199;
    Host() { dock.parent = fixed.parent = viewport; }
    Node node(int tag, String id) { Node value = new Node(tag, id, root, window, token); nodes.put(tag, value); return value; }
    public void assertMainThread() { if (!main) throw new IllegalStateException("not_main"); }
    public ScaffoldLayoutRegistry.Node resolve(int tag, String id) { Node node = nodes.get(tag); return node != null && node.id.equals(id) ? node : null; }
    public boolean matches(ScaffoldLayoutRegistry.Node original, int tag, String id) { return nodes.get(tag) == original.identity() && ((Node)original).id.equals(id); }
    public boolean contains(ScaffoldLayoutRegistry.Node ancestor, ScaffoldLayoutRegistry.Node descendant) { Node parent = ((Node)descendant).parent; while (parent != null) { if (parent == ancestor.identity()) return true; parent = parent.parent; } return false; }
    public ScaffoldLayoutRegistry.Subscription observe(ScaffoldLayoutRegistry.Node viewport, ScaffoldLayoutRegistry.Changed changed) { observers.add(changed); return () -> observers.remove(changed); }
    public ScaffoldLayoutRegistry.Viewport readViewport(ScaffoldLayoutRegistry.Node viewport) {
      if (duringRead != null) { Runnable action = duringRead; duringRead = null; action.run(); }
      return known ? new ScaffoldLayoutRegistry.Viewport(new ScaffoldLayoutRegistry.Rect(0, 0, 400, 800), ime, 24, 16, 30, 11, 23) : null;
    }
    public ScaffoldLayoutRegistry.Dock readDock(ScaffoldLayoutRegistry.Node viewport, ScaffoldLayoutRegistry.Node dock) { return new ScaffoldLayoutRegistry.Dock(readViewport(viewport), dockHeight); }
    public ScaffoldLayoutRegistry.Pair readPair(ScaffoldLayoutRegistry.Node viewport, ScaffoldLayoutRegistry.Node dock, ScaffoldLayoutRegistry.Node fixed) { return new ScaffoldLayoutRegistry.Pair(readViewport(viewport), new ScaffoldLayoutRegistry.Rect(0, 0, 400, 500), dockHeight); }
    void changed() { for (ScaffoldLayoutRegistry.Changed observer : new ArrayList<>(observers)) observer.run(); }
  }
  static final class Fixture {
    final Host host = new Host(); final List<ScaffoldLayoutRegistry.Event> events = new ArrayList<>(); final ScaffoldLayoutRegistry registry = new ScaffoldLayoutRegistry(host, events::add);
    ScaffoldLayoutRegistry.Receipt viewport() { return registry.bindViewport(1, "viewport", "viewport-watch"); }
    ScaffoldLayoutRegistry.Receipt pair(ScaffoldLayoutRegistry.Receipt owner) { return registry.bindParts(owner.handle, owner.ticket, 2, "dock", 3, "fixed", "pair-watch"); }
  }
  static final class Transform implements ScaffoldLayoutTransforms.Node {
    Transform parent; boolean identity = true;
    public Object identity() { return this; } public boolean untransformed() { return identity; } public ScaffoldLayoutTransforms.Node parent() { return parent; }
  }
  static void fails(String code, Runnable action) { try { action.run(); throw new AssertionError("accepted " + code); } catch (IllegalStateException error) { check(code.equals(error.getMessage()), "wrong error " + error); } }
  public static void main(String[] args) {
    Fixture f = new Fixture(); ScaffoldLayoutRegistry.Receipt owner;
    switch (args[0]) {
      case "identity-native-ancestor-path": {
        Transform root = new Transform(), parent = new Transform(), marker = new Transform(); marker.parent = parent; parent.parent = root;
        check(ScaffoldLayoutTransforms.supported(marker, root), "real identity path rejected"); break;
      }
      case "ancestor-transform-never-combines-transformed-origin-with-plain-size": {
        Transform root = new Transform(), parent = new Transform(), marker = new Transform(); marker.parent = parent; parent.parent = root;
        parent.identity = false; check(!ScaffoldLayoutTransforms.supported(marker, root), "scaled/rotated ancestor admitted");
        parent.identity = true; root.identity = false; check(!ScaffoldLayoutTransforms.supported(marker, root), "transformed original root admitted"); break;
      }
      case "transform-path-never-substitutes-another-root-or-cycle": {
        Transform root = new Transform(), parent = new Transform(), marker = new Transform(); marker.parent = parent;
        check(!ScaffoldLayoutTransforms.supported(marker, root), "missing original root substituted"); parent.parent = marker; check(!ScaffoldLayoutTransforms.supported(marker, root), "cyclic path admitted"); break;
      }
      case "bootstrap-actual-dock-before-fixed":
        owner = f.viewport(); check(owner.initial.viewport.safeTop == 30 && owner.initial.viewport.rect.height == 800, "no original viewport");
        f.host.nodes.remove(3); ScaffoldLayoutRegistry.Receipt dock = f.registry.bindDock(owner.handle, owner.ticket, 2, "dock", "dock-watch"); check(dock.initial.dock.dockHeight == 199 && dock.initial.pair == null, "bootstrap invented fixed"); break;
      case "all-three-original-markers-and-raw-ime":
        f.host.ime = 300; owner = f.viewport(); ScaffoldLayoutRegistry.Pair pair = f.pair(owner).initial.pair; check(pair.viewport.rawImeBottom == 300 && pair.fixed.height == 500 && pair.viewport.rect.height == 800, "IME double resize/substitution"); break;
      case "foreign-window-rejected":
        owner = f.viewport(); final ScaffoldLayoutRegistry.Receipt foreignOwner = owner; f.host.dock.window = new Object(); fails("parts_not_in_original_viewport", () -> f.pair(foreignOwner)); break;
      case "same-window-foreign-ancestor-rejected":
        owner = f.viewport(); final ScaffoldLayoutRegistry.Receipt ancestorOwner = owner; f.host.dock.parent = null; fails("parts_not_in_original_viewport", () -> f.pair(ancestorOwner)); break;
      case "nested-parts-never-become-siblings":
        owner = f.viewport(); f.pair(owner); f.host.dock.parent = f.host.fixed; f.host.changed(); check(f.events.get(f.events.size() - 1).retired, "reparented parts retained"); break;
      case "tag-or-native-id-recycle-retires":
        owner = f.viewport(); f.pair(owner); f.host.fixed.id = "recycled"; f.host.changed(); check(f.events.get(f.events.size() - 1).retired, "nativeID replacement adopted"); break;
      case "retained-detach-reattach-same-window":
        owner = f.viewport(); f.pair(owner); f.host.viewport.attached = false; f.host.changed(); check(f.events.get(f.events.size() - 1).pair == null && !f.events.get(f.events.size() - 1).retired, "temporary detach became completion");
        f.host.viewport.attached = true; f.host.changed(); check(f.events.get(f.events.size() - 1).pair != null, "same original window could not resume"); break;
      case "different-window-cannot-revive":
        owner = f.viewport(); f.pair(owner); f.host.viewport.token = new Object(); f.host.changed(); check(f.host.observers.isEmpty(), "changed window observer retained"); check(f.events.get(f.events.size() - 1).retired, "new token adopted"); break;
      case "unknown-layout-never-becomes-zero":
        f.host.known = false; owner = f.viewport(); check(owner.initial.viewport == null, "unknown viewport fabricated"); check(f.pair(owner).initial.pair == null, "unknown pair fabricated"); f.host.known = true; f.host.changed(); check(f.events.get(f.events.size() - 1).pair != null, "genuine later layout lost"); break;
      case "actual-pixel-height-not-semantic-target":
        f.host.dockHeight = 547.0 / 2.75; owner = f.viewport(); check(f.pair(owner).initial.pair.dockHeight == 547.0 / 2.75 && heightNot199(f), "measured height coerced"); break;
      case "reentrant-window-change-before-ack":
        f.host.duringRead = () -> f.host.viewport.window = new Object(); fails("viewport_retired", f::viewport); check(f.host.observers.isEmpty(), "reentrant retirement leaked observer"); break;
      case "exact-release-and-never-reused-ticket":
        owner = f.viewport(); check(!f.registry.release(owner.handle, "other"), "foreign release accepted"); check(f.registry.release(owner.handle, owner.ticket), "original release lost"); fails("ticket_reused", f::viewport); check(f.host.observers.isEmpty(), "release leaked observer"); break;
      case "cancel-before-native-bind":
        check(f.registry.cancelTicket("viewport-watch"), "pending cancel lost"); fails("ticket_reused", f::viewport); break;
      case "stale-release-does-not-touch-fresh-owner":
        owner = f.viewport(); f.registry.release(owner.handle, owner.ticket); ScaffoldLayoutRegistry.Receipt fresh = f.registry.bindViewport(1, "viewport", "fresh-watch"); check(!f.registry.release(owner.handle, owner.ticket) && !fresh.initial.retired && f.host.observers.size() == 1, "old release hit fresh"); break;
      case "frame-revisions-dedup-and-source-changes":
        owner = f.viewport(); f.pair(owner); int count = f.events.size(); f.host.changed(); check(f.events.size() == count, "unchanged frame flooded JS"); f.host.ime = 100; f.host.changed(); ScaffoldLayoutRegistry.Event a = f.events.get(f.events.size() - 2), b = f.events.get(f.events.size() - 1); check(a.frame == b.frame && b.revision > 1, "atomic frame identity lost"); break;
      case "module-destroy-permanent-activity-invalidate-rebinds":
        owner = f.viewport(); f.pair(owner); f.registry.invalidate(); f.registry.bindViewport(1, "viewport", "fresh-watch"); f.registry.destroy(); fails("module_destroyed", () -> f.registry.bindViewport(1, "viewport", "after-destroy")); check(f.host.observers.isEmpty(), "destroy leaked views"); break;
      case "off-ui-thread-rejected":
        f.host.main = false; fails("not_main", f::viewport); break;
      default: throw new AssertionError(args[0]);
    }
    f.host.main = true; f.registry.destroy(); System.out.println(args[0] + " passed");
  }
  private static boolean heightNot199(Fixture f) { return f.host.dockHeight != 199; }
}
