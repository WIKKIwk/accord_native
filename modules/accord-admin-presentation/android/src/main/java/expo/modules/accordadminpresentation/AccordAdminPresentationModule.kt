package expo.modules.accordadminpresentation

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.View
import com.facebook.react.uimanager.util.ReactFindViewUtil
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Native window-tree detachment only. Authentication, owner and accepted-close checks stay in JS. */
class AccordAdminPresentationModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var destroyed = false
  private val windows by lazy { PresentationWindowRegistry(AndroidHost()) }
  private var ownedSheets: AdminSheetPortalRegistry? = null
  private fun sheetRegistry(): AdminSheetPortalRegistry = ownedSheets ?: AdminSheetPortalRegistry().also { ownedSheets = it }

  override fun definition() = ModuleDefinition {
    Name("AccordAdminPresentation")
    AsyncFunction("sheetRetirementCapability") {
      if (destroyed) null else mapOf("protocol" to 1, "platform" to "android", "guarantee" to "owned-original-sheet-retirement")
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("retireSheet") { presentation: String, parent: String, retirement: String, promise: Promise ->
      if (destroyed) promise.reject("module_destroyed", "Presentation module destroyed", null)
      else sheetRegistry().retire(presentation, parent, retirement, object : AdminSheetRetirement.Reply {
        override fun success(value: AdminSheetRetirement.Receipt) {
          promise.resolve(mapOf("protocol" to 1, "platform" to "android", "presentationTicket" to value.presentation,
            "parentTicket" to value.parent, "retirementTicket" to value.retirement, "receiptID" to value.receiptID, "disposition" to value.disposition))
        }
        override fun failure(code: String) { promise.reject(code, "Original sheet retirement ended: $code", null) }
      })
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("sheetCapability") {
      if (destroyed) null else mapOf("protocol" to 1, "platform" to "android", "guarantee" to "owned-android-presentation-and-dismissal", "viewName" to "AdminSheetPortal")
    }.runOnQueue(Queues.MAIN)
    View(AdminSheetPortalView::class) {
      Name("AdminSheetPortal")
      Events("onSheetEvent")
      Prop("configuration") { view: AdminSheetPortalView, value: AdminSheetConfiguration -> view.pendingConfiguration = value }
      Prop("acceptedClose") { view: AdminSheetPortalView, value: AdminSheetAcceptedClose? -> view.pendingAcceptedClose = value }
      Prop("layoutRoot") { view: AdminSheetPortalView, value: Boolean -> view.layoutRoot = value }
      Prop("dismissalEnabled") { view: AdminSheetPortalView, value: Boolean -> view.dismissalEnabled = value }
      OnViewDidUpdateProps { view: AdminSheetPortalView -> view.commitProps(sheetRegistry()) }
      OnViewDestroys { view: AdminSheetPortalView -> view.retireResources() }
      GroupView<AdminSheetPortalView> {
        AddChildView<View> { parent, child, index -> parent.mountOriginalChild(child, index) }
        GetChildCount { parent -> parent.logicalChildCount() }
        GetChildViewAt<View> { parent, index -> parent.logicalChildAt(index) }
        RemoveChildViewAt { parent, index -> parent.removeOriginalChild(index) }
        RemoveChildView<View> { parent, child -> parent.removeOriginalChild(child) }
      }
    }
    AsyncFunction("capabilities") {
      check(!destroyed) { "Presentation module destroyed" }
      mapOf("protocol" to 1, "platform" to "android", "guarantee" to PresentationWindowRegistry.GUARANTEE)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("arm") { tag: Double, ticket: String, promise: Promise ->
      if (destroyed) promise.reject("module_destroyed", "Presentation module destroyed", null)
      else if (!tag.isFinite() || tag <= 0 || tag > Int.MAX_VALUE || tag % 1.0 != 0.0) promise.reject("invalid_marker", "Invalid presentation marker tag", null)
      else windows.arm(tag.toInt(), ticket, reply(promise, false))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("waitForDetach") { handle: String, ticket: String, promise: Promise ->
      if (destroyed) promise.reject("module_destroyed", "Presentation module destroyed", null)
      else windows.waitForDetach(handle, ticket, reply(promise, true))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancelPending") { ticket: String ->
      if (destroyed) false else windows.cancelPending(ticket)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancel") { handle: String, ticket: String ->
      if (destroyed) false else windows.cancel(handle, ticket)
    }.runOnQueue(Queues.MAIN)
    OnActivityDestroys { onMain { windows.activityDestroyed(); ownedSheets?.invalidateActivity() } }
    OnDestroy { destroyed = true; onMain { windows.destroy(); ownedSheets?.destroy() } }
  }

  private fun onMain(action: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) action() else main.post { action() }
  }
  private fun reply(promise: Promise, detached: Boolean) = object : PresentationWindowRegistry.Reply<PresentationWindowRegistry.Receipt> {
    override fun success(value: PresentationWindowRegistry.Receipt) {
      promise.resolve(mapOf("protocol" to 1, "guarantee" to PresentationWindowRegistry.GUARANTEE,
        "handle" to value.handle, "ticket" to value.ticket, "viewTag" to value.viewTag,
        "state" to if (detached) "detached" else "armed"))
    }
    override fun failure(code: String) { promise.reject(code, "Presentation window observation ended: $code", null) }
  }

  private class WindowNode(val view: View) : PresentationWindowRegistry.Node {
    override fun identity(): Any = view
    override fun windowToken(): Any? = view.windowToken
    override fun attached(): Boolean = view.isAttachedToWindow
    override fun root(): PresentationWindowRegistry.Node = WindowNode(view.rootView)
    override fun observe(listener: PresentationWindowRegistry.Attachment): PresentationWindowRegistry.Subscription {
      val actual = object : View.OnAttachStateChangeListener {
        override fun onViewAttachedToWindow(view: View) { listener.attached() }
        override fun onViewDetachedFromWindow(view: View) { listener.detached() }
      }
      view.addOnAttachStateChangeListener(actual)
      return PresentationWindowRegistry.Subscription { view.removeOnAttachStateChangeListener(actual) }
    }
  }
  private inner class AndroidHost : PresentationWindowRegistry.Host {
    override fun assertMainThread() { check(Looper.myLooper() == Looper.getMainLooper()) }
    override fun activity(): Any? = appContext.currentActivity
    override fun activityUsable(original: Any): Boolean = original is Activity && !original.isFinishing && !original.isDestroyed
    override fun activityRoot(original: Any): PresentationWindowRegistry.Node? = (original as? Activity)?.window?.decorView?.let(::WindowNode)
    override fun resolveMarker(tag: Int, ticket: String): PresentationWindowRegistry.Node? {
      // Expo SDK58 AppContext implements ConverterContext.findView; Fabric resolves on the UI thread.
      val view = appContext.findView<View>(tag) ?: return null
      return if (ReactFindViewUtil.findView(view, ticket) === view) WindowNode(view) else null
    }
    override fun markerMatches(original: PresentationWindowRegistry.Node, tag: Int, ticket: String): Boolean {
      val view = (original as? WindowNode)?.view ?: return false
      return view.id == tag && appContext.findView<View>(tag) === view && ReactFindViewUtil.findView(view, ticket) === view
    }
  }
}
