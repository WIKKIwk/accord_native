package expo.modules.accordadminpresentation

import android.app.Activity
import android.os.IBinder
import android.os.Looper
import android.view.View
import java.lang.ref.WeakReference

/** Public parent-window evidence: ORIGINAL root identity and tokens, not an inferred Window object. */
internal class AdminSheetParent(activity: Activity, marker: View, root: View, decor: View, val rootToken: IBinder, val applicationToken: IBinder, val activityToken: IBinder,
  val rootLayoutToken: IBinder, val activityLayoutToken: IBinder, val rootType: Int, val activityType: Int, val displayId: Int) {
  val activity = WeakReference(activity); val marker = WeakReference(marker); val root = WeakReference(root); val decor = WeakReference(decor)
  fun same(other: AdminSheetParent): Boolean = activity.get() === other.activity.get() && marker.get() === other.marker.get() && root.get() === other.root.get() && decor.get() === other.decor.get() &&
    rootToken === other.rootToken && applicationToken === other.applicationToken && activityToken === other.activityToken &&
    rootLayoutToken === other.rootLayoutToken && activityLayoutToken === other.activityLayoutToken && rootType == other.rootType && activityType == other.activityType && displayId == other.displayId
}
internal class AdminSheetPortalRegistry {
  private val used = mutableSetOf<String>()
  private val parents = mutableMapOf<String, AdminSheetParent>()
  private val portals = mutableMapOf<String, AdminSheetPortalView>()
  var destroyed = false; private set
  fun assertMain() { check(Looper.myLooper() == Looper.getMainLooper()) }
  fun claim(ticket: String, portal: AdminSheetPortalView): Boolean {
    assertMain(); if (destroyed || parents.containsKey(ticket) || !used.add(ticket)) return false
    portals[ticket] = portal; return true
  }
  fun claimParent(ticket: String, parent: AdminSheetParent): Boolean {
    assertMain(); if (destroyed) return false
    val original = parents[ticket]
    if (original != null && !original.same(parent)) return false
    if (used.contains(ticket) && portals[ticket]?.ownsNativeParent(parent) != true) return false
    parents[ticket] = original ?: parent; return true
  }
  fun hasChild(ticket: String?): Boolean = ticket != null && portals.values.any { it.configuration?.parentTicket == ticket && it.hasNativeIntent() }
  fun release(ticket: String?, original: AdminSheetPortalView) {
    assertMain(); if (ticket == null || portals[ticket] !== original) return
    portals.remove(ticket); portals.values.toList().forEach { it.originalChildReleased() }
  }
  fun invalidateActivity() { assertMain(); portals.values.toList().forEach { it.retireResources() } }
  fun destroy() { assertMain(); if (destroyed) return; destroyed = true; invalidateActivity() }
}
