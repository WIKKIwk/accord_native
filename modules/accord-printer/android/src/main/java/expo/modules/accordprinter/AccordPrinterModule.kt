package expo.modules.accordprinter

import android.app.Activity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccordPrinterModule : Module() {
    private var owner: Activity? = null
    private var bluetooth: BluetoothPrinterChannel? = null
    private var usb: UsbPrinterChannel? = null

    private fun withChannels(promise: Promise, action: (BluetoothPrinterChannel, UsbPrinterChannel) -> Unit) {
        val activity = appContext.currentActivity
        if (activity == null) {
            ExpoPrinterResult(promise).error("printer_activity_unavailable", "Printer activity is unavailable", null)
            return
        }
        if (owner !== activity || bluetooth == null || usb == null) {
            bluetooth?.dispose()
            owner = activity
            bluetooth = BluetoothPrinterChannel(activity, appContext.permissions)
            usb = UsbPrinterChannel(activity)
        }
        action(bluetooth!!, usb!!)
    }

    override fun definition() = ModuleDefinition {
        Name("AccordPrinter")

        // @v2 accord_bluetooth_printer
        AsyncFunction("pairedPrinters") { promise: Promise ->
            withChannels(promise) { bt, _ -> bt.handleMethodCall(MethodCall("pairedPrinters"), ExpoPrinterResult(promise)) }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("printLabel") { arguments: Map<String, Any?>, promise: Promise ->
            withChannels(promise) { bt, _ -> bt.handleMethodCall(MethodCall("printLabel", arguments), ExpoPrinterResult(promise)) }
        }.runOnQueue(Queues.MAIN)

        // @v2 accord_usb_printer
        AsyncFunction("printTest") { arguments: Map<String, Any?>, promise: Promise ->
            withChannels(promise) { _, printer -> printer.handleMethodCall(MethodCall("printTest", arguments), ExpoPrinterResult(promise)) }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("detectPrinter") { promise: Promise ->
            withChannels(promise) { _, printer -> printer.handleMethodCall(MethodCall("detectPrinter"), ExpoPrinterResult(promise)) }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("printRaw") { arguments: Map<String, Any?>, promise: Promise ->
            withChannels(promise) { _, printer -> printer.handleMethodCall(MethodCall("printRaw", arguments), ExpoPrinterResult(promise)) }
        }.runOnQueue(Queues.MAIN)
        OnDestroy {
            bluetooth?.dispose()
            bluetooth = null
            usb = null
            owner = null
        }
    }
}
