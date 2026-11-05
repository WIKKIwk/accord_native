package expo.modules.accordprinter

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

internal class UsbPrinterChannel(
    private val activity: Activity,
) {
    private val usbManager = activity.getSystemService(Context.USB_SERVICE) as UsbManager
    private val actionUsbPermission = "${activity.packageName}.USB_PRINTER_PERMISSION"
    private val printExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "accord-usb-printer").apply { isDaemon = true }
    }
    private var pendingPrint: PendingUsbPrint? = null
    private var permissionReceiver: BroadcastReceiver? = null

    fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "printTest" -> printTest(call, result)
            "detectPrinter" -> detectPrinter(result)
            "printRaw" -> printRaw(call, result)
            else -> result.notImplemented()
        }
    }

    private fun detectPrinter(result: MethodChannel.Result) {
        val printer = findPrinterCandidate()
        if (printer == null) {
            result.error("usb_printer_not_found", "USB printer not found", null)
            return
        }
        if (printer.profile.kind == UsbPrinterKind.UNKNOWN) {
            result.error(
                "usb_printer_unsupported",
                "USB printer is not Zebra",
                printer.profile.response(printer.device),
            )
            return
        }
        result.success(printer.profile.response(printer.device))
    }

    private fun printTest(call: MethodCall, result: MethodChannel.Result) {
        if (pendingPrint != null) {
            result.error("usb_printer_busy", "Printer permission request is already open", null)
            return
        }
        val printer = findPrinterCandidate()
        if (printer == null) {
            result.error("usb_printer_not_found", "USB printer not found", null)
            return
        }
        val title = call.argument<String>("title").orEmpty().ifBlank { "ACCORD USB TEST" }
        val payload = call.argument<String>("payload").orEmpty().ifBlank { "ACCORD-USB-TEST" }
        val bytes = buildEscPosTestLabel(title, payload)
        val request = PendingUsbPrint(printer.device, bytes, result) { device, write ->
            mapOf(
                "ok" to true,
                "bytes" to write.bytes,
                "deviceName" to device.deviceName,
                "vendorId" to device.vendorId,
                "productId" to device.productId,
            )
        }
        startPrint(request)
    }

    private fun printRaw(call: MethodCall, result: MethodChannel.Result) {
        if (pendingPrint != null) {
            result.error("usb_printer_busy", "Printer permission request is already open", null)
            return
        }
        val printer = findPrinterCandidate()
        if (printer == null) {
            result.error("usb_printer_not_found", "USB printer not found", null)
            return
        }
        val bytes = rawBytes(call)
        if (bytes == null || bytes.isEmpty()) {
            result.error("usb_printer_invalid_payload", "Raw USB payload is empty", null)
            return
        }
        val expectedValue = call.argument<String>("printer_kind").orEmpty()
        val expectedPrinter = UsbPrinterKind.fromValue(expectedValue)
        if (expectedValue.isNotBlank() && expectedPrinter == UsbPrinterKind.UNKNOWN) {
            result.error("usb_printer_unsupported", "USB printer is not Zebra", printer.profile.response(printer.device))
            return
        }
        if (printer.profile.kind == UsbPrinterKind.UNKNOWN) {
            result.error(
                "usb_printer_unsupported",
                "USB printer is not Zebra",
                printer.profile.response(printer.device),
            )
            return
        }
        if (expectedPrinter != UsbPrinterKind.UNKNOWN &&
            expectedPrinter != printer.profile.kind
        ) {
            result.error(
                "usb_printer_changed",
                "Connected USB printer changed before print",
                printer.profile.response(printer.device),
            )
            return
        }
        val printCount = call.argument<Number>("print_count")?.toInt()
            ?.takeIf { it > 0 }
            ?: 1
        val payload = repeatBytes(bytes, printCount)
        val request = PendingUsbPrint(
            device = printer.device,
            bytes = payload,
            result = result,
        ) { device, write ->
            mapOf(
                "ok" to true,
                "status" to "done",
                "printer_status" to write.printerStatus,
                "print_count" to printCount,
                "bytes" to write.bytes,
                "deviceName" to device.deviceName,
                "vendorId" to device.vendorId,
                "productId" to device.productId,
                "printer" to printer.profile.kind.value,
                "manufacturerName" to printer.profile.manufacturerName,
                "productName" to printer.profile.productName,
            )
        }
        startPrint(request)
    }

    private fun rawBytes(call: MethodCall): ByteArray? {
        val value = call.argument<Any>("bytes")
        return when (value) {
            is ByteArray -> value
            is List<*> -> value.mapNotNull { (it as? Number)?.toInt()?.toByte() }.toByteArray()
            else -> null
        }
    }

    private fun startPrint(request: PendingUsbPrint) {
        if (usbManager.hasPermission(request.device)) {
            finishPrint(request)
            return
        }
        pendingPrint = request
        registerPermissionReceiver()
        usbManager.requestPermission(request.device, permissionIntent())
    }

    private fun findPrinterCandidate(): UsbPrinterCandidate? {
        val devices = usbManager.deviceList.values.toList()
        val candidates = devices.mapNotNull { device ->
            printerCandidate(device, requirePrinterClass = true)
                ?: printerCandidate(device, requirePrinterClass = false)
        }
        return candidates.maxByOrNull { candidate ->
            if (candidate.profile.kind == UsbPrinterKind.UNKNOWN) 0 else 1
        }
    }

    private fun printerCandidate(
        device: UsbDevice,
        requirePrinterClass: Boolean,
    ): UsbPrinterCandidate? {
        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            if (requirePrinterClass && usbInterface.interfaceClass != UsbConstants.USB_CLASS_PRINTER) {
                continue
            }
            val endpoint = bulkOutEndpoint(usbInterface) ?: continue
            return UsbPrinterCandidate(
                device,
                usbInterface,
                endpoint,
                bulkInEndpoint(usbInterface),
                UsbPrinterProfile.fromDevice(device),
            )
        }
        return null
    }

    private fun bulkOutEndpoint(usbInterface: UsbInterface): UsbEndpoint? {
        for (index in 0 until usbInterface.endpointCount) {
            val endpoint = usbInterface.getEndpoint(index)
            val isBulk = endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK
            val isOut = endpoint.direction == UsbConstants.USB_DIR_OUT
            if (isBulk && isOut) {
                return endpoint
            }
        }
        return null
    }

    private fun bulkInEndpoint(usbInterface: UsbInterface): UsbEndpoint? {
        for (index in 0 until usbInterface.endpointCount) {
            val endpoint = usbInterface.getEndpoint(index)
            val isBulk = endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK
            val isIn = endpoint.direction == UsbConstants.USB_DIR_IN
            if (isBulk && isIn) {
                return endpoint
            }
        }
        return null
    }

    private fun registerPermissionReceiver() {
        if (permissionReceiver != null) {
            return
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != actionUsbPermission) {
                    return
                }
                val request = pendingPrint ?: return
                pendingPrint = null
                unregisterPermissionReceiver()
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                if (!granted) {
                    request.result.error("usb_printer_permission_denied", "USB printer permission denied", null)
                    return
                }
                finishPrint(request)
            }
        }
        permissionReceiver = receiver
        val filter = IntentFilter(actionUsbPermission)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            activity.registerReceiver(receiver, filter)
        }
    }

    private fun unregisterPermissionReceiver() {
        val receiver = permissionReceiver ?: return
        permissionReceiver = null
        runCatching { activity.unregisterReceiver(receiver) }
    }

    private fun permissionIntent(): PendingIntent {
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE
            } else {
                0
            }
        return PendingIntent.getBroadcast(
            activity,
            0,
            Intent(actionUsbPermission).setPackage(activity.packageName),
            flags,
        )
    }

    private fun finishPrint(request: PendingUsbPrint) {
        printExecutor.execute {
            try {
                val candidate = printerCandidate(request.device, requirePrinterClass = false)
                    ?: throw IllegalStateException("USB printer endpoint not found")
                val write = writeBytes(candidate, request.bytes)
                val response = request.response(request.device, write)
                activity.runOnUiThread {
                    request.result.success(response)
                }
            } catch (error: Throwable) {
                activity.runOnUiThread {
                    request.result.error(
                        "usb_printer_write_failed",
                        error.message ?: "USB printer write failed",
                        null,
                    )
                }
            }
        }
    }

    private fun writeBytes(
        candidate: UsbPrinterCandidate,
        bytes: ByteArray,
    ): UsbPrintWriteResult {
        val connection = usbManager.openDevice(candidate.device)
            ?: throw IllegalStateException("USB device open failed")
        var claimed = false
        try {
            if (!connection.claimInterface(candidate.usbInterface, true)) {
                throw IllegalStateException("USB interface claim failed")
            }
            claimed = true
            val sent = writeUsbPayload(connection, candidate.endpoint, bytes)
            return UsbPrintWriteResult(sent, "USB OK")
        } finally {
            if (claimed) {
                connection.releaseInterface(candidate.usbInterface)
            }
            connection.close()
        }
    }

    private fun writeUsbPayload(
        connection: UsbDeviceConnection,
        endpoint: UsbEndpoint,
        bytes: ByteArray,
    ): Int {
        var offset = 0
        while (offset < bytes.size) {
            val chunkSize = minOf(
                endpoint.maxPacketSize.coerceAtLeast(64),
                bytes.size - offset,
            )
            val sent = connection.bulkTransfer(
                endpoint,
                bytes,
                offset,
                chunkSize,
                5000,
            )
            if (sent <= 0) {
                throw IllegalStateException("USB bulk transfer failed at byte $offset")
            }
            offset += sent
        }
        return offset
    }

    private fun buildEscPosTestLabel(title: String, payload: String): ByteArray {
        val ascii = Charset.forName("US-ASCII")
        val now = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        val data = payload.take(180).toByteArray(ascii)
        val storeLength = data.size + 3
        val pL = storeLength % 256
        val pH = storeLength / 256
        val output = ArrayList<Byte>()
        fun write(vararg values: Int) {
            values.forEach { output.add(it.toByte()) }
        }
        fun writeText(value: String) {
            output.addAll(value.toByteArray(ascii).toList())
        }
        write(0x1B, 0x40)
        write(0x1B, 0x61, 0x01)
        write(0x1B, 0x45, 0x01)
        writeText("${title.take(32)}\n")
        write(0x1B, 0x45, 0x00)
        writeText("USB DIRECT PRINT\n")
        writeText("$now\n\n")
        write(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
        write(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06)
        write(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)
        write(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30)
        output.addAll(data.toList())
        write(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
        writeText("\n$payload\n\n\n")
        return output.toByteArray()
    }

    private fun repeatBytes(bytes: ByteArray, count: Int): ByteArray {
        val safeCount = count.coerceAtLeast(1)
        if (safeCount == 1) {
            return bytes
        }
        val output = ByteArray(bytes.size * safeCount)
        for (index in 0 until safeCount) {
            System.arraycopy(bytes, 0, output, index * bytes.size, bytes.size)
        }
        return output
    }
}

private data class UsbPrinterCandidate(
    val device: UsbDevice,
    val usbInterface: UsbInterface,
    val endpoint: UsbEndpoint,
    val statusEndpoint: UsbEndpoint?,
    val profile: UsbPrinterProfile,
)

internal data class UsbPrintWriteResult(
    val bytes: Int,
    val printerStatus: String,
)

internal enum class UsbPrinterKind(val value: String) {
    ZEBRA("zebra"),
    UNKNOWN("unknown");

    companion object {
        fun fromValue(value: String): UsbPrinterKind {
            return when (value.trim().lowercase(Locale.US)) {
                "zebra", "zpl", "rfid" -> ZEBRA
                else -> UNKNOWN
            }
        }
    }
}

internal data class UsbPrinterProfile(
    val kind: UsbPrinterKind,
    val manufacturerName: String,
    val productName: String,
) {
    fun response(device: UsbDevice): Map<String, Any> {
        return mapOf(
            "ok" to (kind != UsbPrinterKind.UNKNOWN),
            "printer" to kind.value,
            "print_mode" to if (kind == UsbPrinterKind.ZEBRA) "rfid" else "label",
            "rfid_epc_write" to (kind == UsbPrinterKind.ZEBRA),
            "deviceName" to device.deviceName,
            "vendorId" to device.vendorId,
            "productId" to device.productId,
            "manufacturerName" to manufacturerName,
            "productName" to productName,
        )
    }

    companion object {
        fun fromDevice(device: UsbDevice): UsbPrinterProfile {
            val manufacturer = runCatching { device.manufacturerName.orEmpty() }.getOrDefault("")
            val product = runCatching { device.productName.orEmpty() }.getOrDefault("")
            return UsbPrinterProfile(
                kind = classifyUsbPrinter(
                    vendorId = device.vendorId,
                    productId = device.productId,
                    manufacturerName = manufacturer,
                    productName = product,
                ),
                manufacturerName = manufacturer,
                productName = product,
            )
        }
    }
}

internal fun classifyUsbPrinter(
    vendorId: Int,
    productId: Int,
    manufacturerName: String,
    productName: String,
): UsbPrinterKind {
    val descriptor = "$manufacturerName $productName".lowercase(Locale.US)
    if (vendorId == 0x0a5f || descriptor.contains("zebra")) {
        return UsbPrinterKind.ZEBRA
    }
    return UsbPrinterKind.UNKNOWN
}

private data class PendingUsbPrint(
    val device: UsbDevice,
    val bytes: ByteArray,
    val result: MethodChannel.Result,
    val response: (UsbDevice, UsbPrintWriteResult) -> Map<String, Any>,
)

