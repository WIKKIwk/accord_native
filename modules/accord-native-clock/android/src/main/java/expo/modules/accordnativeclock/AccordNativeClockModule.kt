package expo.modules.accordnativeclock

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

internal object NativeClock {
  init { System.loadLibrary("accord_native_clock") }
  external fun microsecondsSinceEpoch(): Long
}

class AccordNativeClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AccordNativeClock")
    Function("microsecondsSinceEpoch") { NativeClock.microsecondsSinceEpoch().toString() }
  }
}
