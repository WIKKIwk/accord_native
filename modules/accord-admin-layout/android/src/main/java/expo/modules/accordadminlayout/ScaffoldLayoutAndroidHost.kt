package expo.modules.accordadminlayout

import android.os.Build
import android.os.Looper
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowInsets
import com.facebook.react.uimanager.util.ReactFindViewUtil
import expo.modules.kotlin.AppContext
import java.util.Collections
import java.util.IdentityHashMap
import kotlin.math.max

/** Samples actual original views on the UI thread. Never queries an Activity for substitute geometry. */
internal class ScaffoldLayoutAndroidHost(private val context: AppContext) : ScaffoldLayoutRegistry.Host {
  private val detached = Collections.newSetFromMap(IdentityHashMap<View, Boolean>())
  private class TransformNode(private val view: View) : ScaffoldLayoutTransforms.Node {
    override fun identity(): Any = view
    override fun untransformed(): Boolean = view.matrix.isIdentity
    override fun parent(): ScaffoldLayoutTransforms.Node? = (view.parent as? View)?.let(::TransformNode)
  }
  private inner class Node(val view: View) : ScaffoldLayoutRegistry.Node {
    override fun identity(): Any = view
    override fun attached(): Boolean = view.isAttachedToWindow && !detached.contains(view)
    override fun rootIdentity(): Any = view.rootView
    override fun windowIdentity(): Any = view.rootView
    override fun windowToken(): Any? = view.windowToken
  }
  override fun assertMainThread() { check(Looper.myLooper() == Looper.getMainLooper()) }
  override fun resolve(tag: Int, nativeID: String): ScaffoldLayoutRegistry.Node? {
    assertMainThread(); val view = context.findView<View>(tag) ?: return null
    return if (ReactFindViewUtil.findView(view, nativeID) === view) Node(view) else null
  }
  override fun matches(original: ScaffoldLayoutRegistry.Node, tag: Int, nativeID: String): Boolean {
    val view = (original as? Node)?.view ?: return false
    return context.findView<View>(tag) === view && view.id == tag && ReactFindViewUtil.findView(view, nativeID) === view
  }
  override fun contains(ancestor: ScaffoldLayoutRegistry.Node, descendant: ScaffoldLayoutRegistry.Node): Boolean {
    val target = (ancestor as? Node)?.view ?: return false; var cursor = (descendant as? Node)?.view?.parent
    while (cursor is View) { if (cursor === target) return true; cursor = cursor.parent }; return false
  }
  override fun observe(viewport: ScaffoldLayoutRegistry.Node, changed: ScaffoldLayoutRegistry.Changed): ScaffoldLayoutRegistry.Subscription {
    val view = (viewport as Node).view
    val observation = object : View.OnAttachStateChangeListener, View.OnLayoutChangeListener, ViewTreeObserver.OnPreDrawListener {
      var observer: ViewTreeObserver? = null; var closed = false
      fun disconnect() { observer?.takeIf { it.isAlive }?.removeOnPreDrawListener(this); observer = null }
      fun connect() { if (closed) return; disconnect(); if (view.isAttachedToWindow) observer = view.rootView.viewTreeObserver.also { it.addOnPreDrawListener(this) } }
      override fun onViewAttachedToWindow(value: View) { detached.remove(view); connect(); changed.run() }
      override fun onViewDetachedFromWindow(value: View) { detached.add(view); disconnect(); changed.run() }
      override fun onLayoutChange(v: View, l: Int, t: Int, r: Int, b: Int, ol: Int, ot: Int, or: Int, ob: Int) { changed.run() }
      override fun onPreDraw(): Boolean { if (!closed) changed.run(); return true }
    }
    view.addOnAttachStateChangeListener(observation); view.addOnLayoutChangeListener(observation); observation.connect()
    return ScaffoldLayoutRegistry.Subscription {
      observation.closed = true; observation.disconnect(); view.removeOnAttachStateChangeListener(observation); view.removeOnLayoutChangeListener(observation); detached.remove(view)
    }
  }
  private fun frame(view: View, density: Double): ScaffoldLayoutRegistry.Rect? {
    if (!view.isAttachedToWindow || view.width <= 0 || view.height <= 0 || view.isLayoutRequested || !ScaffoldLayoutTransforms.supported(TransformNode(view), view.rootView)) return null
    val origin = IntArray(2); view.getLocationInWindow(origin)
    return ScaffoldLayoutRegistry.Rect(origin[0] / density, origin[1] / density, view.width / density, view.height / density)
  }
  override fun readViewport(viewport: ScaffoldLayoutRegistry.Node): ScaffoldLayoutRegistry.Viewport? {
    assertMainThread(); if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
    val view = (viewport as Node).view; val root = view.rootView
    val density = view.resources.displayMetrics.density.toDouble(); if (!density.isFinite() || density <= 0 || root.isLayoutRequested) return null
    // Only an actual full Source-viewport ancestor is supported in this initial protocol.
    val rect = frame(view, density) ?: return null; val rootRect = frame(root, density) ?: return null
    if (rect.x != rootRect.x || rect.y != rootRect.y || rect.width != rootRect.width || rect.height != rootRect.height) return null
    val raw = root.rootWindowInsets ?: return null
    val bars = raw.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
    val ime = raw.getInsets(WindowInsets.Type.ime()); val gesture = raw.getInsets(WindowInsets.Type.systemGestures())
    val waterfall = raw.displayCutout?.waterfallInsets
    return ScaffoldLayoutRegistry.Viewport(rect, ime.bottom / density, max(bars.bottom, waterfall?.bottom ?: 0) / density, gesture.bottom / density, max(0, max(bars.top, waterfall?.top ?: 0) - ime.top) / density,
      max(0, max(bars.left, waterfall?.left ?: 0) - ime.left) / density, max(0, max(bars.right, waterfall?.right ?: 0) - ime.right) / density)
  }
  override fun readDock(viewport: ScaffoldLayoutRegistry.Node, dock: ScaffoldLayoutRegistry.Node): ScaffoldLayoutRegistry.Dock? {
    val original = readViewport(viewport) ?: return null
    val view = (viewport as Node).view; val density = view.resources.displayMetrics.density.toDouble()
    val dockView = (dock as Node).view; val dockFrame = frame(dockView, density) ?: return null
    // The genuine Source bottomBar host occupies the viewport's bottom, including its blank FAB extension.
    val viewportOrigin = IntArray(2); val dockOrigin = IntArray(2); view.getLocationInWindow(viewportOrigin); dockView.getLocationInWindow(dockOrigin)
    if (dockOrigin[0] != viewportOrigin[0] || dockView.width != view.width || dockOrigin[1] + dockView.height != viewportOrigin[1] + view.height) return null
    return ScaffoldLayoutRegistry.Dock(original, dockFrame.height)
  }
  override fun readPair(viewport: ScaffoldLayoutRegistry.Node, dock: ScaffoldLayoutRegistry.Node, fixed: ScaffoldLayoutRegistry.Node): ScaffoldLayoutRegistry.Pair? {
    val original = readDock(viewport, dock) ?: return null
    val density = (viewport as Node).view.resources.displayMetrics.density.toDouble(); val fixedFrame = frame((fixed as Node).view, density) ?: return null
    return ScaffoldLayoutRegistry.Pair(original.viewport, fixedFrame, original.dockHeight)
  }
}
