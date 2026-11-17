package expo.modules.accordadminpresentation

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.util.ReactFindViewUtil
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.shape.MaterialShapeDrawable
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.roundToInt

/** A logical Fabric anchor; its ONE original React child is physically inside the owned Dialog. */
@SuppressLint("ViewConstructor")
internal class AdminSheetPortalView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onSheetEvent by EventDispatcher<Map<String, Any?>>()
  var pendingConfiguration: AdminSheetConfiguration? = null
  var pendingAcceptedClose: AdminSheetAcceptedClose? = null
  var layoutRoot = false
  var dismissalEnabled = false
  var configuration: AdminSheetConfigurationSnapshot? = null; private set
  private var registry: AdminSheetPortalRegistry? = null
  private var core: AdminSheetTransaction? = null
  private var originalParent: AdminSheetParent? = null
  private var child: View? = null
  private var root: AdminSheetRootView? = null
  private var dialog: AdminSheetDialog? = null
  private var ownWindow: Window? = null
  private var ownDecor: View? = null
  private var ownToken: android.os.IBinder? = null
  private var originalFabricTag: Int? = null
  private var extraWindowNotified = false
  private var actualDetach = false
  private var showObserved = false
  private var shownAcknowledged = false
  private var showIssued = false
  private var showCallActive = false
  private var invalidated = false
  private var hadParent = false
  private var cleanupStarted = false
  private var cleanupFinished = false
  private var dismissStarted = false
  private var sequence = 0L
  private var lastWidth = 0
  private var lastHeight = 0
  private val nativeAttachment = object : OnAttachStateChangeListener {
    override fun onViewAttachedToWindow(view: View) { if (view === ownDecor) acknowledgeShown() }
    override fun onViewDetachedFromWindow(view: View) {
      if (view !== ownDecor || invalidated) return
      if (shownAcknowledged) actualDetach = true else invalidate("owned_window_detached_before_show_ack")
    }
  }
  private val contentAttachment = object : OnAttachStateChangeListener {
    override fun onViewAttachedToWindow(view: View) { if (view === child) acknowledgeShown() }
    override fun onViewDetachedFromWindow(view: View) { /* Content removal is not window dismissal. */ }
  }
  private fun assertMain() { check(Looper.myLooper() == Looper.getMainLooper()) }
  fun commitProps(original: AdminSheetPortalRegistry) {
    assertMain(); if (invalidated) return
    val snapshot = pendingConfiguration?.snapshot()
    if (!layoutRoot || snapshot == null) { invalidate("invalid_configuration"); return }
    if (configuration != null) {
      if (configuration != snapshot || registry !== original) { invalidate("configuration_retargeted"); return }
    } else {
      if (!original.claim(snapshot.presentationTicket, this)) { invalidate("presentation_ticket_reused"); return }
      configuration = snapshot; registry = original; core = AdminSheetTransaction(snapshot.presentationTicket, snapshot.parentTicket)
    }
    tryPresent(); applyAcceptedClose(); updateInteraction()
  }
  fun logicalChildCount(): Int = if (child == null) 0 else 1
  fun logicalChildAt(index: Int): View? = if (index == 0) child else null
  fun mountOriginalChild(value: View, index: Int) {
    assertMain(); if (invalidated || child != null || index != 0 || value.parent != null) { invalidate("one_original_content_root_required"); return }
    child = value; value.addOnAttachStateChangeListener(contentAttachment); root?.addView(value); tryPresent()
  }
  fun removeOriginalChild(index: Int) {
    assertMain(); val original = child
    if (index != 0 || original == null) { invalidate("foreign_content_unmount"); return }
    original.removeOnAttachStateChangeListener(contentAttachment)
    (original.parent as? ViewGroup)?.removeView(original); child = null; invalidate("original_content_unmounted")
  }
  fun removeOriginalChild(value: View) { if (child === value) removeOriginalChild(0) else invalidate("foreign_content_unmount") }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); hadParent = true; tryPresent() }
  override fun onDetachedFromWindow() { super.onDetachedFromWindow(); if (hadParent) retireResources() }
  private fun descends(view: View, ancestor: View): Boolean {
    var current: View? = view
    val visited = mutableSetOf<View>()
    while (current != null && visited.add(current)) { if (current === ancestor) return true; current = current.parent as? View }
    return false
  }
  private fun readParent(): AdminSheetParent? {
    val config = configuration ?: return null
    val activity = appContext.currentActivity ?: return null
    if (activity.isFinishing || activity.isDestroyed || id <= 0 || originalFabricTag?.let { it != id } == true || appContext.findView<View>(id) !== this) return null
    val marker = appContext.findView<View>(config.parentViewTag) ?: return null
    val actualRoot = marker.rootView; val decor = activity.window.decorView
    val token = actualRoot.windowToken ?: return null; val application = actualRoot.applicationWindowToken ?: return null; val activityToken = decor.windowToken ?: return null
    val rootParams = actualRoot.layoutParams as? WindowManager.LayoutParams ?: return null
    val activityParams = decor.layoutParams as? WindowManager.LayoutParams ?: return null
    val rootLayoutToken = rootParams.token ?: return null; val activityLayoutToken = activityParams.token ?: return null
    val display = actualRoot.display?.displayId ?: return null; val activityDisplay = decor.display?.displayId ?: return null
    if (marker === this || !marker.isAttachedToWindow || !isAttachedToWindow || marker.windowToken !== token || windowToken !== token ||
      !actualRoot.isAttachedToWindow || !decor.isAttachedToWindow || marker.applicationWindowToken !== application || applicationWindowToken !== application ||
      marker.display?.displayId != display || this.display?.displayId != display ||
      !AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, activityParams.type, activityDisplay, rootLayoutToken, rootParams.type, display) ||
      !descends(this, marker) || marker.id != config.parentViewTag || ReactFindViewUtil.findView(marker, config.parentNativeID) !== marker) return null
    return AdminSheetParent(activity, marker, actualRoot, decor, token, application, activityToken, rootLayoutToken, activityLayoutToken, rootParams.type, activityParams.type, display)
  }
  private fun originalParentCurrent(): Boolean = originalParent?.let { original -> readParent()?.let(original::same) } == true
  private fun tryPresent() {
    assertMain(); if (invalidated || dialog != null || child == null || !isAttachedToWindow || stateWrapper == null) return
    val config = configuration ?: return
    val original = readParent() ?: run { invalidate("original_parent_unavailable"); return }
    val reactContext = context as? ThemedReactContext ?: run { invalidate("original_fabric_context_required"); return }
    if (UIManagerHelper.getSurfaceId(reactContext) <= 0 || child?.context !== context) { invalidate("foreign_fabric_surface"); return }
    val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id) ?: run { invalidate("original_dispatcher_unavailable"); return }
    if (registry?.claimParent(config.parentTicket, original) != true) { invalidate("parent_ticket_retargeted"); return }
    originalParent = original
    val density = resources.displayMetrics.density.toDouble()
    if (!density.isFinite() || density <= 0 || config.heightPoints * density > Int.MAX_VALUE || config.cornerRadius * density > Float.MAX_VALUE) { invalidate("invalid_native_density_or_height"); return }
    val nativeHeight = (config.heightPoints * density).roundToInt().coerceAtLeast(1)
    val ownedRoot = AdminSheetRootView(reactContext, dispatcher, { acknowledgeShown() }) { w, h -> actualSize(w, h) }; root = ownedRoot
    // Same public RNModal pattern: the physical root's fallback responder target is the actual
    // original registered Fabric portal tag, never a generated/new root tag or NO_ID.
    originalFabricTag = id; ownedRoot.id = id
    ownedRoot.addView(child!!)
    val activity = original.activity.get() ?: run { invalidate("original_activity_gone"); return }
    val actualParentRoot = original.root.get() ?: run { invalidate("original_parent_root_gone"); return }
    val owned = AdminSheetDialog(activity, actualParentRoot) { requestNativeCancellation() }; dialog = owned
    owned.setContentView(ownedRoot, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, nativeHeight))
    owned.behavior.apply { maxHeight = nativeHeight; peekHeight = nativeHeight; isFitToContents = true; skipCollapsed = true; setShouldRemoveExpandedCorners(false) }
    owned.findViewById<FrameLayout>(com.google.android.material.R.id.design_bottom_sheet)?.let { sheet ->
      (sheet.background as? MaterialShapeDrawable)?.let { shape ->
        val radius = (config.cornerRadius * density).toFloat()
        shape.shapeAppearanceModel = shape.shapeAppearanceModel.toBuilder().setTopLeftCornerSize(radius).setTopRightCornerSize(radius).setBottomLeftCornerSize(0f).setBottomRightCornerSize(0f).build()
      }
    }
    ownWindow = owned.window ?: run { invalidate("owned_window_unavailable"); return }
    ownWindow!!.setDimAmount(config.barrierOpacity.toFloat()); ownWindow!!.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
    if (activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0) ownWindow!!.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    ownDecor = ownWindow!!.decorView; ownDecor!!.addOnAttachStateChangeListener(nativeAttachment)
    owned.behavior.addBottomSheetCallback(object : BottomSheetBehavior.BottomSheetCallback() {
      private var originalDrag: String? = null
      override fun onSlide(bottomSheet: View, slideOffset: Float) {}
      override fun onStateChanged(bottomSheet: View, newState: Int) {
        if (invalidated || dialog !== owned) return
        if (newState == BottomSheetBehavior.STATE_DRAGGING && dismissalEnabled) {
          if (core?.mayInteract() == true) {
            val events = core!!.interactiveWillDismiss(); originalDrag = events.firstOrNull()?.transaction; emit(events); updateInteraction()
          } else if (core?.phase() == AdminSheetTransaction.Phase.DISMISSING && core?.acceptedClose() == null) {
            // A real new pan may interrupt Back/outside's hide animation. Capture that SAME native
            // transaction now; only its later actual stable state is a cancellation receipt.
            originalDrag = core?.transaction()
          }
        } else if (newState == BottomSheetBehavior.STATE_EXPANDED || newState == BottomSheetBehavior.STATE_COLLAPSED) {
          // A real native settled state after this exact drag is cancellation, never OnShow.
          originalDrag?.let { transaction -> emit(core?.interactiveCancelled(transaction) ?: emptyList()); originalDrag = null; updateInteraction() }
        }
        // HIDDEN/SETTLING are NOT native window removal or animation completion receipts.
      }
    })
    owned.setOnShowListener { actual ->
      if (invalidated || actual !== owned || dialog !== owned) return@setOnShowListener
      showObserved = true; acknowledgeShown()
    }
    owned.setOnDismissListener { actual ->
      if (actual !== owned || dialog !== owned) return@setOnDismissListener
      notifyWindowDestroyed()
      if (invalidated) { finishCleanup(); return@setOnDismissListener }
      if (!originalParentCurrent() || owned.window !== ownWindow || !actualDetach || ownDecor?.isAttachedToWindow != false || registry?.hasChild(config.presentationTicket) == true) {
        invalidate("dismissal_not_original_or_has_child"); return@setOnDismissListener
      }
      emit(core?.didDismiss(core?.transaction()) ?: emptyList()); updateInteraction()
    }
    if (core?.beginPresentation() != true) { invalidate("presentation_state_invalid"); return }
    applyAcceptedClose(); updateInteraction()
    if (!invalidated) {
      showIssued = true; showCallActive = true
      try { owned.show() } catch (_: RuntimeException) { invalidate("native_present_failed") }
      finally { showCallActive = false; if (invalidated) finishRetirement() }
    }
  }
  private fun acknowledgeShown() {
    if (invalidated || shownAcknowledged || !showObserved) return
    val owned = dialog ?: return; val original = originalParent ?: return
    val ownedRoot = root ?: return; val decor = ownDecor ?: return
    val originalChild = child ?: return
    // OnShow and native attachment may arrive in either order. Neither substitutes for the other.
    if (!decor.isAttachedToWindow || !ownedRoot.isAttachedToWindow || !originalChild.isAttachedToWindow) return
    val token = decor.windowToken
    val actualWindowParams = decor.layoutParams as? WindowManager.LayoutParams
    val actualDisplay = decor.display?.displayId
    if (!originalParentCurrent() || owned.window !== ownWindow || owned.window?.decorView !== decor || token == null ||
      decor === original.root.get() || decor === original.decor.get() || token === original.rootToken || token === original.activityToken || ownedRoot.rootView !== decor || ownedRoot.windowToken !== token ||
      originalChild.parent !== ownedRoot || originalChild.rootView !== decor || originalChild.windowToken !== token ||
      ownedRoot.display?.displayId != original.displayId || originalChild.display?.displayId != original.displayId || actualWindowParams == null || actualDisplay == null ||
      !AdminSheetWindowEvidence.ownedNormalDialog(original.activityLayoutToken, original.activityType, original.displayId, actualWindowParams.token, actualWindowParams.type, actualDisplay)) {
      invalidate("shown_not_original_owned_window"); return
    }
    val reactContext = context as? ThemedReactContext ?: run { invalidate("original_fabric_context_required"); return }
    shownAcknowledged = true; ownToken = token; extraWindowNotified = true
    reactContext.onExtraWindowCreate(ownWindow!!)
    if (invalidated) return
    emit(core?.presentationCompleted() ?: emptyList()); updateInteraction(); tryDismiss()
  }
  private fun requestNativeCancellation(): Boolean {
    if (invalidated || !originalParentCurrent() || !dismissalEnabled || registry?.hasChild(configuration?.presentationTicket) == true) { emit(core?.attemptedDismissal() ?: emptyList()); return false }
    if (core?.mayInteract() == true) { emit(core!!.interactiveWillDismiss()); updateInteraction(); return true }
    return core?.phase() == AdminSheetTransaction.Phase.DISMISSING && core?.acceptedClose() == null
  }
  private fun applyAcceptedClose() {
    if (invalidated || core?.phase() == AdminSheetTransaction.Phase.CREATED) return
    val close = pendingAcceptedClose ?: return
    if (!originalParentCurrent()) { invalidate("close_original_parent_changed"); return }
    val events = core?.acceptClose(close.presentationTicket, close.closeTicket, close.transaction) ?: run { invalidate("foreign_or_invalid_close"); return }
    emit(events); updateInteraction(); tryDismiss()
  }
  private fun tryDismiss() {
    if (invalidated || dismissStarted || core?.needsProgrammaticDismiss() != true || ownToken == null || registry?.hasChild(configuration?.presentationTicket) == true) return
    if (!originalParentCurrent()) { invalidate("dismissal_parent_changed"); return }
    dismissStarted = true; dialog?.closeAccepted()
  }
  private fun actualSize(w: Int, h: Int) {
    if (invalidated || w <= 0 || h <= 0 || w == lastWidth && h == lastHeight) return
    if (!originalParentCurrent()) { invalidate("layout_original_parent_changed"); return }
    val density = resources.displayMetrics.density.toDouble(); if (!density.isFinite() || density <= 0) return
    lastWidth = w; lastHeight = h
    shadowNodeProxy.setStyleSize(w / density, h / density)
    send("layout", mapOf("width" to w / density, "height" to h / density))
  }
  private fun updateInteraction() {
    val active = !invalidated && core?.mayInteract() == true
    val nativeGesture = !invalidated && dismissalEnabled && (active || core?.phase() == AdminSheetTransaction.Phase.DISMISSING && core?.acceptedClose() == null)
    root?.contentEnabled = active; root?.importantForAccessibility = if (active) IMPORTANT_FOR_ACCESSIBILITY_AUTO else IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    // Source command availability and an already-running native pan have different lifetimes.
    dialog?.setCancelable(nativeGesture)
    dialog?.setCanceledOnTouchOutside(nativeGesture)
    dialog?.behavior?.isDraggable = nativeGesture
  }
  fun ownsNativeParent(value: AdminSheetParent): Boolean = !invalidated && core?.mayInteract() == true && value.root.get() === ownDecor && value.rootToken === ownToken && value.activity.get() === originalParent?.activity?.get()
  fun hasNativeIntent(): Boolean = dialog != null && core?.physicalDismissed() != true && !cleanupFinished
  fun originalChildReleased() { if (invalidated) finishRetirement() else tryDismiss() }
  private fun emit(events: List<AdminSheetTransaction.Event>) {
    events.forEach { send(it.kind, mapOf("transaction" to it.transaction, "acceptedClose" to it.acceptedClose, "reason" to it.reason)) }
  }
  private fun send(kind: String, extra: Map<String, Any?> = emptyMap()) {
    sequence += 1; onSheetEvent(mapOf("protocol" to 1, "kind" to kind, "sequence" to sequence, "presentationTicket" to (configuration?.presentationTicket ?: ""), "parentTicket" to (configuration?.parentTicket ?: ""),
      "transaction" to null, "acceptedClose" to null, "reason" to null) + extra)
  }
  private fun invalidate(reason: String) {
    if (invalidated) return; val original = core
    if (original == null) send("failed", mapOf("reason" to reason)) else emit(original.fail(reason))
    retireResources()
  }
  fun retireResources() {
    assertMain(); if (invalidated) return; invalidated = true; emit(core?.retire() ?: emptyList()); updateInteraction(); finishRetirement()
  }
  private fun finishRetirement() {
    if (!invalidated || cleanupStarted || showCallActive || registry?.hasChild(configuration?.presentationTicket) == true) return
    cleanupStarted = true
    // Resource cleanup never emits didDismiss/closeJoined. Keep original parents until owned children release.
    val original = dialog
    if (original == null || !showIssued) finishCleanup()
    else {
      // show() can have registered the window before its first attachment/traversal. Always dismiss
      // that owned Dialog, even while attachment is unknown. No intent/snapshot becomes a public ACK.
      original.releaseResources()
      // Private resource release only: a failed/never-attached show may have no OnDismiss callback.
      if (!original.isShowing && ownDecor?.isAttachedToWindow != true) finishCleanup()
    }
  }
  private fun finishCleanup() {
    if (cleanupFinished) return; cleanupFinished = true
    child?.removeOnAttachStateChangeListener(contentAttachment)
    notifyWindowDestroyed()
    ownDecor?.removeOnAttachStateChangeListener(nativeAttachment)
    registry?.release(configuration?.presentationTicket, this)
  }
  private fun notifyWindowDestroyed() {
    if (extraWindowNotified) { extraWindowNotified = false; ownWindow?.let { (context as? ThemedReactContext)?.onExtraWindowDestroy(it) } }
  }
}
