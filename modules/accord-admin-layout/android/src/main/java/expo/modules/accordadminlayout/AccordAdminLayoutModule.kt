package expo.modules.accordadminlayout

import android.os.Handler
import android.os.Build
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.ViewTreeObserver
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.max

class AccordAdminLayoutModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var destroyed = false
  private var observing = false
  private var root: View? = null
  private var observer: ViewTreeObserver? = null
  private var last: Map<String, Any>? = null
  private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener { emitChanged() }
  private val scaffoldLayouts = lazy { ScaffoldLayoutRegistry(ScaffoldLayoutAndroidHost(appContext)) { value -> sendEvent("onScaffoldLayoutChange", ScaffoldLayoutWire.event(value)) } }

  override fun definition() = ModuleDefinition {
    Name("AccordAdminLayout")
    Events("onInsetsChange", "onScaffoldLayoutChange")

    AsyncFunction("scaffoldLayoutCapability") {
      if (destroyed || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) null else mapOf("protocol" to ScaffoldLayoutRegistry.PROTOCOL,
        "guarantee" to ScaffoldLayoutRegistry.GUARANTEE, "platform" to "android", "rawIme" to true)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("bindScaffoldViewport") { tag: Double, id: String, ticket: String ->
      check(!destroyed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { "scaffold_layout_unavailable" }
      ScaffoldLayoutWire.receipt(scaffoldLayouts.value.bindViewport(scaffoldTag(tag), id, ticket))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("bindScaffoldParts") { handle: String, owner: String, dockTag: Double, dockID: String, fixedTag: Double, fixedID: String, ticket: String ->
      check(!destroyed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { "scaffold_layout_unavailable" }
      ScaffoldLayoutWire.receipt(scaffoldLayouts.value.bindParts(handle, owner, scaffoldTag(dockTag), dockID, scaffoldTag(fixedTag), fixedID, ticket))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("bindScaffoldDock") { handle: String, owner: String, tag: Double, id: String, ticket: String ->
      check(!destroyed && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { "scaffold_layout_unavailable" }
      ScaffoldLayoutWire.receipt(scaffoldLayouts.value.bindDock(handle, owner, scaffoldTag(tag), id, ticket))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("releaseScaffoldLayout") { handle: String, ticket: String -> if (destroyed || !scaffoldLayouts.isInitialized()) false else scaffoldLayouts.value.release(handle, ticket) }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancelScaffoldLayoutTicket") { ticket: String -> if (destroyed) false else scaffoldLayouts.value.cancelTicket(ticket) }.runOnQueue(Queues.MAIN)

    // @v2 accord_system_navigation
    AsyncFunction("isGestureNavigation") {
      val context = appContext.reactContext ?: throw IllegalStateException("Admin layout context unavailable")
      Settings.Secure.getInt(context.contentResolver, "navigation_mode", -1) == 2
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("readInsets") { snapshot() }.runOnQueue(Queues.MAIN)

    OnStartObserving("onInsetsChange") {
      main.post { if (!destroyed) { observing = true; attach(); emitChanged() } }
    }
    OnStopObserving("onInsetsChange") { main.post { observing = false; detach() } }
    OnActivityEntersForeground { main.post { if (observing && !destroyed) { attach(); emitChanged() } } }
    OnActivityDestroys { main.post { detach(); if (scaffoldLayouts.isInitialized()) scaffoldLayouts.value.invalidate() } }
    OnDestroy { destroyed = true; main.post { observing = false; detach(); if (scaffoldLayouts.isInitialized()) scaffoldLayouts.value.destroy() } }
  }

  private fun scaffoldTag(value: Double): Int { check(value.isFinite() && value > 0 && value <= Int.MAX_VALUE && value % 1.0 == 0.0) { "invalid_marker" }; return value.toInt() }

  private fun attach() {
    val current = appContext.currentActivity?.window?.decorView
    if (root === current && observer?.isAlive == true) return
    detach()
    root = current
    observer = current?.viewTreeObserver?.also { it.addOnGlobalLayoutListener(layoutListener) }
  }

  private fun detach() {
    observer?.takeIf { it.isAlive }?.removeOnGlobalLayoutListener(layoutListener)
    observer = null
    root = null
    last = null
  }

  private fun emitChanged() {
    if (!observing || destroyed) return
    val value = snapshot()
    if (value != last) {
      last = value
      sendEvent("onInsetsChange", mapOf("metrics" to value))
    }
  }

  private fun snapshot(): Map<String, Any>? {
    check(Looper.myLooper() == Looper.getMainLooper())
    val view = appContext.currentActivity?.window?.decorView ?: return null
    if (!view.isAttachedToWindow || view.width <= 0 || view.height <= 0) return null
    val raw = view.rootWindowInsets ?: return null
    val insets = WindowInsetsCompat.toWindowInsetsCompat(raw, view)
    val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
    val gesture = insets.getInsets(WindowInsetsCompat.Type.systemGestures())
    val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
    val waterfall = insets.displayCutout?.waterfallInsets?.bottom ?: 0
    val density = view.resources.displayMetrics.density.toDouble()
    if (!density.isFinite() || density <= 0) return null
    return mapOf(
      "platform" to "android",
      "width" to view.width / density,
      "height" to view.height / density,
      "viewPaddingBottom" to max(bars.bottom, waterfall) / density,
      "systemGestureInsetsBottom" to gesture.bottom / density,
      "viewInsetsBottom" to ime.bottom / density,
    )
  }
}
