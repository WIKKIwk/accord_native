package expo.modules.accordadminlayout

internal object ScaffoldLayoutWire {
  private fun rect(value: ScaffoldLayoutRegistry.Rect) = mapOf("x" to value.x, "y" to value.y, "width" to value.width, "height" to value.height)
  private fun viewport(value: ScaffoldLayoutRegistry.Viewport) = mapOf("rect" to rect(value.rect), "rawImeBottom" to value.rawImeBottom,
    "viewPaddingBottom" to value.viewPaddingBottom, "systemGestureBottom" to value.systemGestureBottom, "safeTop" to value.safeTop, "safeLeft" to value.safeLeft, "safeRight" to value.safeRight)
  fun event(value: ScaffoldLayoutRegistry.Event): Map<String, Any?> = mapOf("protocol" to ScaffoldLayoutRegistry.PROTOCOL, "guarantee" to ScaffoldLayoutRegistry.GUARANTEE,
    "platform" to "android", "kind" to value.kind, "handle" to value.handle, "ticket" to value.ticket, "windowID" to value.windowID,
    "viewportHandle" to value.viewportHandle, "revision" to value.revision, "frame" to value.frame, "retired" to value.retired, "viewport" to value.viewport?.let(::viewport),
    "dock" to value.dock?.let { mapOf("viewport" to viewport(it.viewport), "dockHeight" to it.dockHeight) },
    "pair" to value.pair?.let { mapOf("viewport" to viewport(it.viewport), "fixed" to rect(it.fixed), "dockHeight" to it.dockHeight) })
  fun receipt(value: ScaffoldLayoutRegistry.Receipt) = mapOf("handle" to value.handle, "ticket" to value.ticket, "windowID" to value.windowID, "initial" to event(value.initial))
}
