package expo.modules.accordadminpresentation

import android.annotation.SuppressLint
import android.view.MotionEvent
import android.view.View
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.uimanager.JSPointerDispatcher
import com.facebook.react.uimanager.JSTouchDispatcher
import com.facebook.react.uimanager.RootView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.views.view.ReactViewGroup

/** Separate Dialog touch root in the ORIGINAL Fabric surface's ThemedReactContext. */
@SuppressLint("ViewConstructor")
internal class AdminSheetRootView(private val reactContext: ThemedReactContext, private val dispatcher: EventDispatcher,
  private val actualAttached: () -> Unit, private val actualSize: (Int, Int) -> Unit) : ReactViewGroup(reactContext), RootView {
  private val touches = JSTouchDispatcher(this)
  private val pointers = if (ReactFeatureFlags.dispatchPointerEvents) JSPointerDispatcher(this) else null
  private var streaming = false
  var contentEnabled = false
  override fun onAttachedToWindow() { super.onAttachedToWindow(); actualAttached() }
  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) { super.onSizeChanged(w, h, oldw, oldh); actualSize(w, h) }
  override fun handleException(t: Throwable) { reactContext.reactApplicationContext.handleException(RuntimeException(t)) }
  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    if (!contentEnabled) {
      if (streaming && event.actionMasked == MotionEvent.ACTION_CANCEL) { touches.handleTouchEvent(event, dispatcher, reactContext); pointers?.handleMotionEvent(event, dispatcher, true); streaming = false }
      return true
    }
    if (event.actionMasked == MotionEvent.ACTION_DOWN) streaming = true
    if (event.actionMasked == MotionEvent.ACTION_CANCEL || event.actionMasked == MotionEvent.ACTION_UP) streaming = false
    touches.handleTouchEvent(event, dispatcher, reactContext); pointers?.handleMotionEvent(event, dispatcher, true)
    return super.onInterceptTouchEvent(event)
  }
  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (contentEnabled || streaming && event.actionMasked == MotionEvent.ACTION_CANCEL) { touches.handleTouchEvent(event, dispatcher, reactContext); pointers?.handleMotionEvent(event, dispatcher, false) }
    if (event.actionMasked == MotionEvent.ACTION_CANCEL || event.actionMasked == MotionEvent.ACTION_UP) streaming = false
    super.onTouchEvent(event); return true
  }
  override fun onInterceptHoverEvent(event: MotionEvent): Boolean {
    if (contentEnabled) pointers?.handleMotionEvent(event, dispatcher, true)
    return super.onInterceptHoverEvent(event)
  }
  override fun onHoverEvent(event: MotionEvent): Boolean {
    if (contentEnabled) pointers?.handleMotionEvent(event, dispatcher, false)
    return super.onHoverEvent(event)
  }
  @OptIn(UnstableReactNativeAPI::class)
  override fun onChildStartedNativeGesture(childView: View?, ev: MotionEvent) {
    touches.onChildStartedNativeGesture(ev, dispatcher, reactContext); pointers?.onChildStartedNativeGesture(childView, ev, dispatcher)
  }
  override fun onChildEndedNativeGesture(childView: View, ev: MotionEvent) { touches.onChildEndedNativeGesture(ev, dispatcher); pointers?.onChildEndedNativeGesture() }
  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) { /* Own root must continue observing native gesture cancellation. */ }
}
