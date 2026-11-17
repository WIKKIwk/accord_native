package expo.modules.accordadminpresentation

import android.app.Activity
import android.os.Build
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import com.google.android.material.bottomsheet.BottomSheetDialog

/** An owned Dialog: no late listener replacement and no isShowing-as-OnShow inference. */
internal class AdminSheetDialog(activity: Activity, private val originalParentRoot: View, private val requestCancellation: () -> Boolean) : BottomSheetDialog(activity, R.style.AccordAdminPresentationSheet) {
  private var acceptedClosing = false
  private var cleanup = false
  init {
    setDismissWithAnimation(true)
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() { cancel() }
    })
    setOnKeyListener { _, keyCode, event ->
      if (event.action == KeyEvent.ACTION_UP && (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE)) { cancel(); true } else false
    }
  }
  override fun cancel() { if (cleanup || acceptedClosing || requestCancellation()) super.cancel() }
  fun closeAccepted() { acceptedClosing = true; behavior.isHideable = true; super.cancel() }
  fun releaseResources() { cleanup = true; super.dismiss() }
  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Source Android config is edge-to-edge + adjustResize. Change only this OWNED window.
    window?.let { owned ->
      WindowCompat.setDecorFitsSystemWindows(owned, false)
      owned.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
      // Copy actual original parent-window icon appearance, without substituting Activity geometry.
      if (Build.VERSION.SDK_INT >= 30) {
        val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        originalParentRoot.windowInsetsController?.let { parent -> owned.insetsController?.setSystemBarsAppearance(parent.systemBarsAppearance and mask, mask) }
      } else {
        @Suppress("DEPRECATION")
        val mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        @Suppress("DEPRECATION")
        owned.decorView.systemUiVisibility = (owned.decorView.systemUiVisibility and mask.inv()) or (originalParentRoot.systemUiVisibility and mask)
      }
    }
  }
}
