package expo.modules.accordadminpresentation;

import java.util.ArrayList;
import java.util.List;

/** Executes the production registry on a plain JVM with controlled host/window attachment events. */
public final class PresentationWindowHostTest {
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  private static final class Reply implements PresentationWindowRegistry.Reply<PresentationWindowRegistry.Receipt> {
    PresentationWindowRegistry.Receipt value; String error; int successes; Runnable successAction;
    public void success(PresentationWindowRegistry.Receipt receipt) { value = receipt; successes++; if (successAction != null) successAction.run(); }
    public void failure(String code) { error = code; }
  }
  private static final class Node implements PresentationWindowRegistry.Node {
    boolean attached = true; Object token = new Object(); Node root = this; String nativeId; int tag;
    boolean detachOnObserve, throwOnObserve; final List<PresentationWindowRegistry.Attachment> listeners = new ArrayList<>();
    public Object identity() { return this; }
    public Object windowToken() { return token; }
    public boolean attached() { return attached; }
    public Node root() { return root; }
    public PresentationWindowRegistry.Subscription observe(PresentationWindowRegistry.Attachment listener) {
      if (throwOnObserve) throw new IllegalStateException("Controlled subscription failure");
      listeners.add(listener); if (detachOnObserve) detach(); return () -> listeners.remove(listener);
    }
    void attach() { attached = true; for (PresentationWindowRegistry.Attachment listener : new ArrayList<>(listeners)) listener.attached(); }
    // AOSP View.dispatchDetachedFromWindow notifies listeners before clearing mAttachInfo.
    void detach() { for (PresentationWindowRegistry.Attachment listener : new ArrayList<>(listeners)) listener.detached(); attached = false; }
  }
  private static final class Host implements PresentationWindowRegistry.Host {
    final Object originalActivity = new Object(); Object activity = originalActivity; boolean usable = true, main = true; Node activityRoot = new Node(), marker = new Node();
    Host() { marker.tag = 17; marker.nativeId = "original"; marker.root = new Node(); marker.token = marker.root.token; }
    public void assertMainThread() { if (!main) throw new IllegalStateException("Not UI thread"); }
    public Object activity() { return activity; }
    public boolean activityUsable(Object value) { return value == originalActivity && usable; }
    public Node activityRoot(Object value) { return value == originalActivity ? activityRoot : null; }
    public Node resolveMarker(int tag, String id) { return marker != null && marker.tag == tag && marker.nativeId.equals(id) ? marker : null; }
    public boolean markerMatches(PresentationWindowRegistry.Node value, int tag, String id) { return marker == value && marker.tag == tag && marker.nativeId.equals(id); }
  }
  private static final class Fixture {
    final Host host = new Host(); final PresentationWindowRegistry registry = new PresentationWindowRegistry(host); final Reply arm = new Reply(); final Node root = host.marker.root;
    void arm() { registry.arm(17, "original", arm); }
    Reply waitForDetach() { Reply reply = new Reply(); registry.waitForDetach(arm.value.handle, "original", reply); return reply; }
  }
  public static void main(String[] args) {
    String name = args[0]; Fixture f = new Fixture();
    switch (name) {
      case "armed-listener-before-ack":
        f.arm.successAction = () -> check(f.root.listeners.size() == 1, "ACK before exact window listener"); f.arm(); check(f.arm.successes == 1, "no ACK"); check(f.host.marker.listeners.isEmpty(), "marker listener retained after arm"); break;
      case "pending-native-attach":
        f.host.marker.attached = false; f.arm(); check(f.arm.value == null, "unattached marker acknowledged"); check(f.host.marker.listeners.size() == 1, "no native attach subscription"); f.host.marker.attach(); check(f.arm.successes == 1 && f.root.listeners.size() == 1, "actual attach did not arm"); break;
      case "pending-cancel-exact":
        f.host.marker.attached = false; f.arm(); check(!f.registry.cancelPending("different"), "wrong pending ticket cancelled"); check(f.registry.cancelPending("original"), "pending cancel rejected"); check(f.host.marker.listeners.isEmpty(), "pending listener leaked"); f.host.marker.attach(); check(f.arm.value == null && "window_cancelled".equals(f.arm.error), "cancelled arm revived"); break;
      case "marker-removal-not-completion": {
        f.arm(); Reply wait = f.waitForDetach(); f.host.marker.detach(); check(wait.value == null && wait.error == null, "marker detach completed window"); f.root.detach(); check(wait.successes == 1, "real root detach lost"); check(f.root.listeners.isEmpty(), "window listener leaked"); break;
      }
      case "detach-before-wait-retained": {
        f.arm(); f.root.detach(); check(f.root.listeners.isEmpty(), "detached listener leaked"); Reply wait = f.waitForDetach(); check(wait.value != null && wait.value.handle.equals(f.arm.value.handle), "real observed detach lost before wait"); Reply again = f.waitForDetach(); check("unknown_window".equals(again.error), "consumed receipt revived"); break;
      }
      case "real-detach-event-before-flag-clear": {
        f.arm(); Reply wait = f.waitForDetach(); boolean[] attachedDuringCallback = { false }; f.root.observe(new PresentationWindowRegistry.Attachment() {
          public void attached() {}
          public void detached() { attachedDuringCallback[0] = f.root.attached; }
        }); f.root.detach(); check(attachedDuringCallback[0] && wait.successes == 1, "real native callback ordering was rejected"); break;
      }
      case "duplicate-wait-cannot-steal": {
        f.arm(); Reply first = f.waitForDetach(), second = f.waitForDetach(); check("already_waiting".equals(second.error), "second wait replaced original"); f.root.detach(); check(first.successes == 1 && second.successes == 0, "wrong wait settled"); break;
      }
      case "exact-handle-and-ticket": {
        f.arm(); Reply wrong = new Reply(); f.registry.waitForDetach(f.arm.value.handle, "other", wrong); check("unknown_window".equals(wrong.error), "wrong original ticket allowed"); check(!f.registry.cancel(f.arm.value.handle, "other"), "wrong cancellation targeted owner"); check(!f.registry.cancelPending("original"), "pending cancel targeted armed ticket"); Reply wait = f.waitForDetach(); f.registry.cancel(f.arm.value.handle, "original"); check("window_cancelled".equals(wait.error), "cancel did not reject wait"); check(f.root.listeners.isEmpty(), "cancel leaked root listener"); f.root.detach(); check(wait.successes == 0, "cancelled window completed"); break;
      }
      case "reject-activity-root":
        f.host.marker.root = f.host.activityRoot; f.host.marker.token = f.host.activityRoot.token; f.arm(); check("not_separate_window".equals(f.arm.error), "Activity decor accepted"); break;
      case "reject-shared-window-token":
        f.host.marker.token = f.root.token = f.host.activityRoot.token; f.arm(); check("not_separate_window".equals(f.arm.error), "same Activity token accepted"); break;
      case "reject-missing-window-token":
        f.host.marker.token = f.root.token = null; f.arm(); check("not_separate_window".equals(f.arm.error), "missing token accepted"); break;
      case "reject-native-id-tag-change":
        f.host.marker.attached = false; f.arm(); f.host.marker.nativeId = "replacement"; f.host.marker.attach(); check("marker_changed".equals(f.arm.error), "replacement marker armed"); check(f.root.listeners.isEmpty(), "replacement marker acquired root"); break;
      case "activity-change-before-arm":
        f.host.marker.attached = false; f.arm(); f.host.activity = new Object(); f.host.marker.attach(); check("activity_changed".equals(f.arm.error), "new Activity armed old marker"); break;
      case "activity-change-after-detach": {
        f.arm(); f.root.detach(); f.host.activity = new Object(); Reply wait = f.waitForDetach(); check("activity_changed".equals(wait.error) && wait.value == null, "old detached proof revived across Activity"); break;
      }
      case "activity-decor-replacement-cancels": {
        f.arm(); Reply wait = f.waitForDetach(); f.host.activityRoot = new Node(); f.root.detach(); check("activity_changed".equals(wait.error) && wait.successes == 0, "replacement Activity decor reused old observer"); break;
      }
      case "parallel-windows-remain-independent": {
        f.arm(); Reply originalWait = f.waitForDetach(); Node second = new Node(); second.tag = 19; second.nativeId = "second"; second.root = new Node(); second.token = second.root.token; f.host.marker = second;
        Reply secondArm = new Reply(); f.registry.arm(19, "second", secondArm); Reply secondWait = new Reply(); f.registry.waitForDetach(secondArm.value.handle, "second", secondWait);
        f.registry.cancel(f.arm.value.handle, "original"); check("window_cancelled".equals(originalWait.error) && secondWait.error == null, "old cancellation targeted successor"); f.root.detach(); check(secondWait.value == null, "old root completed successor"); second.root.detach(); check(secondWait.successes == 1, "successor lost its own event"); break;
      }
      case "activity-destroy-cancels": {
        f.arm(); Reply wait = f.waitForDetach(); f.registry.activityDestroyed(); f.root.detach(); check("activity_destroyed".equals(wait.error) && wait.successes == 0, "Activity destruction counted as normal detach"); check(f.root.listeners.isEmpty(), "destroy leaked listener"); break;
      }
      case "finishing-activity-detach-cancels": {
        f.arm(); Reply wait = f.waitForDetach(); f.host.usable = false; f.root.detach(); check("activity_changed".equals(wait.error) && wait.successes == 0, "finishing Activity completed normally"); break;
      }
      case "module-destroy-is-permanent": {
        f.host.marker.attached = false; f.arm(); f.registry.destroy(); f.host.marker.attach(); check("module_destroyed".equals(f.arm.error), "pending arm survived destroy"); Reply later = new Reply(); f.registry.arm(17, "fresh", later); check("module_destroyed".equals(later.error), "destroyed registry revived"); break;
      }
      case "root-detach-before-ack-rejects":
        f.root.detachOnObserve = true; f.arm(); check(f.arm.value == null && "window_changed_before_ack".equals(f.arm.error), "pre-ACK detach was acknowledged"); check(f.root.listeners.isEmpty(), "reentrant registration listener leaked"); break;
      case "arm-reentrant-cancel":
        f.arm.successAction = () -> f.registry.cancel(f.arm.value.handle, "original"); f.arm(); check(f.root.listeners.isEmpty(), "reentrant cancellation leaked observer"); check("unknown_window".equals(f.waitForDetach().error), "reentrant cancellation revived"); break;
      case "subscription-failure-rejects":
        f.root.throwOnObserve = true; f.arm(); check("observer_failed".equals(f.arm.error) && f.arm.value == null, "failed native subscription acknowledged"); break;
      case "reparent-never-retargets-root": {
        f.arm(); Reply wait = f.waitForDetach(); Node newer = new Node(); f.host.marker.root = newer; f.host.marker.token = newer.token; newer.detach(); check(wait.value == null, "replacement root completed original"); f.root.detach(); check(wait.successes == 1, "original root lost after marker reparent"); break;
      }
      case "opaque-ticket-never-reused": {
        f.arm(); f.registry.cancel(f.arm.value.handle, "original"); Reply again = new Reply(); f.registry.arm(17, "original", again); check("ticket_reused".equals(again.error), "old pending cancellation could target reused ticket"); check(f.root.listeners.isEmpty(), "reused ID mounted observer"); break;
      }
      case "ui-thread-required":
        f.host.main = false; boolean threw = false; try { f.arm(); } catch (IllegalStateException expected) { threw = true; } check(threw && f.arm.value == null, "off-thread arm accepted"); break;
      default: throw new AssertionError("Unknown fixture " + name);
    }
    System.out.println(name + " passed");
  }
}
