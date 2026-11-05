package expo.modules.accordprinter

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.interfaces.permissions.PermissionsStatus
import net.posprinter.IDeviceConnection
import net.posprinter.POSConnect
import net.posprinter.TSPLConst
import net.posprinter.TSPLPrinter
import java.io.ByteArrayOutputStream
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

internal class BluetoothPrinterChannel(
    private val activity: Activity,
    private val permissionsManager: Permissions?,
) {
    companion object {
        private const val TAG = "BluetoothPrinter"
        private const val PRINT_TIMEOUT_MS = 25_000L
        private const val LABEL_WIDTH_MM = 56.0
        private const val LABEL_HEIGHT_MM = 60.0
        // XP-P323B is 203 dpi, so a 56 x 60 mm label is approximately
        // 448 x 480 dots. The printer's physical label origin is a few
        // dots left of the adhesive label, so compensate it at the TSPL
        // origin rather than moving individual objects independently.
        private const val LABEL_WIDTH_DOTS = 448
        private const val LABEL_HEIGHT_DOTS = 480
        private const val LABEL_REFERENCE_X_DOTS = 72
        private const val LABEL_LEFT_MARGIN_DOTS = 24
        private const val LABEL_RIGHT_MARGIN_DOTS = 24
        private const val DEFAULT_PRINT_DENSITY = 10
        private const val MATERIAL_PRINT_DENSITY = 12
        private const val MATERIAL_TEXT_BOLD_OFFSET_DOTS = 1
        private const val MATERIAL_TITLE_WIDTH_CHARS = 28
        private const val MATERIAL_TITLE_TOP_Y = 6
        private const val MATERIAL_TITLE_LINE_HEIGHT_DOTS = 26
        private const val MATERIAL_TITLE_FONT_HEIGHT_DOTS = 19
        private const val MATERIAL_TITLE_QR_GAP_DOTS = 8
        // Three copies at 60% of the former 174-dot receipt symbol.
        private const val MATERIAL_DATA_MATRIX_SIZE_DOTS = 104
        private const val MATERIAL_DATA_MATRIX_COUNT = 3
        private const val MATERIAL_DATA_MATRIX_GAP_DOTS = 16
        private const val PACK_QR_X = 278
        private const val PACK_QR_Y = 166
        private const val PACK_EPC_Y = 328
        private const val PROGRESS_PACK_QR_X = 250
        private const val PROGRESS_PACK_QR_Y = 285
        private const val PROGRESS_PACK_EPC_GAP_DOTS = 16
        private const val COMPACT_LABEL_WIDTH_MM = 70.0
        private const val COMPACT_LABEL_WIDTH_DOTS = 560
        private const val COMPACT_LABEL_HEIGHT_MM = 50.0
        private const val COMPACT_LABEL_HEIGHT_DOTS = 400
        private const val COMPACT_LABEL_MARGIN_DOTS = 8
        private const val COMPACT_LABEL_REFERENCE_X_DOTS = 32
        private const val COMPACT_LABEL_TEXT_X_DOTS = 8
        private const val PROGRESS_TEXT_LINE_HEIGHT_DOTS = 24
        private const val PROGRESS_TEXT_TOP_Y = 36
        private const val PROGRESS_FIELD_GAP_DOTS = 4
        private const val PROGRESS_BOLD_OFFSET_DOTS = 1
        private const val PROGRESS_FIELD_WIDTH_CHARS = 24
        // Homashyo split yorlig'i: kattaroq matn (FNT_24_32) va kattaroq QR.
        // 16 char/en = 400 dot ichiga sig'adi, qator balandligi 36 dot.
        private const val SPLIT_TEXT_CHAR_WIDTH_DOTS = 24
        private const val SPLIT_TEXT_LINE_HEIGHT_DOTS = 36
        private const val SPLIT_FIELD_WIDTH_CHARS = 16
        private const val SPLIT_QR_BASE_Y = 250
        // FNT_12_20 is rendered slightly wider by XP-P323B than its name
        // suggests. Use a conservative width estimate for wrapping. The
        // actual field line is emitted as one string so the printer itself
        // owns the single-space separation after the colon.
        private const val QOLIP_FIELD_CHAR_WIDTH_DOTS = 16
        private const val QOLIP_FIELD_LINE_HEIGHT_DOTS = 24
        private const val QOLIP_FIELD_TOP_Y = 24
        private const val QOLIP_FIELD_ROW_GAP_DOTS = 8
        private const val QOLIP_FIELD_QR_GAP_DOTS = 16
        private const val LARGE_QR_FOOTER_GAP_DOTS = 28
        private const val LARGE_QR_FOOTER_LEFT_SHIFT_DOTS = 16
        private const val LARGE_QR_FOOTER_HEIGHT_DOTS = 24
        private const val QR_ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
        private const val LABEL_CHARSET = "US-ASCII"
        private const val LABEL_CODE_PAGE = "0"
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val printBusy = AtomicBoolean(false)
    private var pendingPermissionAction: (() -> Unit)? = null
    private var pendingPermissionResult: MethodChannel.Result? = null
    private var activeConnection: IDeviceConnection? = null
    private var activeAddress = ""
    private var activePrintFailure: ((String, String) -> Unit)? = null

    init {
        POSConnect.init(activity.applicationContext)
    }

    fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "pairedPrinters" -> withBluetoothPermission(result) {
                pairedPrinters(result)
            }
            "printLabel" -> withBluetoothPermission(result) {
                printLabel(call, result)
            }
            else -> result.notImplemented()
        }
    }

    fun dispose() {
        activePrintFailure = null
        val connection = activeConnection
        activeConnection = null
        activeAddress = ""
        if (connection != null) {
            closeConnection(connection)
        }
    }

    private fun withBluetoothPermission(
        result: MethodChannel.Result,
        action: () -> Unit,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            action()
            return
        }
        val requiredPermissions = arrayOf(
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
        )
        if (requiredPermissions.all { permission ->
                ContextCompat.checkSelfPermission(
                    activity,
                    permission,
                ) == PackageManager.PERMISSION_GRANTED
            }
        ) {
            action()
            return
        }
        if (pendingPermissionAction != null) {
            result.error(
                "bluetooth_permission_busy",
                "Bluetooth permission request is already open",
                null,
            )
            return
        }
        pendingPermissionAction = action
        pendingPermissionResult = result
        val manager = permissionsManager
        if (manager == null) {
            pendingPermissionAction = null
            pendingPermissionResult = null
            result.error("bluetooth_permission_denied", "Bluetooth printer permission denied", requiredPermissions.toList())
            return
        }
        manager.askForPermissions({ permissions ->
            val pendingAction = pendingPermissionAction
            val pendingResult = pendingPermissionResult
            pendingPermissionAction = null
            pendingPermissionResult = null
            if (requiredPermissions.all { permissions[it]?.status == PermissionsStatus.GRANTED }) {
                pendingAction?.invoke()
            } else {
                pendingResult?.error("bluetooth_permission_denied", "Bluetooth printer permission denied", requiredPermissions.toList())
            }
        }, *requiredPermissions)
    }

    @Suppress("MissingPermission")
    private fun pairedPrinters(result: MethodChannel.Result) {
        val adapter = bluetoothAdapter(result) ?: return
        val printers = adapter.bondedDevices
            .filter { isXpP323b(it.name.orEmpty()) }
            .sortedBy { it.name.orEmpty() }
            .map { device ->
                mapOf(
                    "name" to device.name.orEmpty(),
                    "address" to device.address.orEmpty(),
                )
            }
        result.success(printers)
    }

    @Suppress("MissingPermission")
    private fun printLabel(call: MethodCall, result: MethodChannel.Result) {
        bluetoothAdapter(result) ?: return
        if (!printBusy.compareAndSet(false, true)) {
            result.error(
                "bluetooth_printer_busy",
                "XP-P323B print is already in progress",
                null,
            )
            return
        }
        val address = call.argument<String>("mac_address").orEmpty().trim()
        val label = BluetoothLabelRequest.from(call)
        if (label == null) {
            printBusy.set(false)
            result.error(
                "bluetooth_print_invalid_payload",
                "XP-P323B label payload is invalid",
                null,
            )
            return
        }
        if (address.isEmpty()) {
            printBusy.set(false)
            result.error("bluetooth_printer_not_selected", "XP-P323B printer is not selected", null)
            return
        }

        val completed = AtomicBoolean(false)
        val sendStarted = AtomicBoolean(false)
        val existing = activeConnection
        val connection = if (
            existing != null &&
            activeAddress == address &&
            existing.isConnect
        ) {
            existing
        } else {
            disconnectActiveConnection()
            POSConnect.createDevice(POSConnect.DEVICE_TYPE_BLUETOOTH).also {
                activeConnection = it
                activeAddress = address
            }
        }
        val timeout = Runnable {
            finishError(
                completed,
                connection,
                result,
                "bluetooth_print_timeout",
                "XP-P323B Bluetooth connection or write timed out",
            )
        }
        mainHandler.postDelayed(timeout, PRINT_TIMEOUT_MS)

        activePrintFailure = { code, message ->
            finishError(completed, connection, result, code, message)
        }

        fun sendWithSdk() {
            if (!sendStarted.compareAndSet(false, true) || completed.get()) {
                return
            }
            try {
                val printer = CapturingTsplPrinter(connection)
                buildSdkLabel(printer, label)
                printer.print(label.printCount)
                val payload = printer.payload()
                if (payload.isEmpty()) {
                    finishError(
                        completed,
                        connection,
                        result,
                        "bluetooth_print_failed",
                        "XP-P323B SDK produced an empty TSPL payload",
                    )
                    return
                }
                val sentBytes = connection.sendSync(payload)
                if (sentBytes > 0) {
                    finishSuccess(
                        completed,
                        connection,
                        result,
                        sentBytes,
                        address,
                        label.printCount,
                    )
                } else {
                    finishError(
                        completed,
                        connection,
                        result,
                        "bluetooth_send_failed",
                        "XP-P323B Bluetooth write failed (status=$sentBytes)",
                    )
                }
            } catch (error: Exception) {
                Log.e(TAG, "XP-P323B SDK print failed", error)
                finishError(
                    completed,
                    connection,
                    result,
                    "bluetooth_print_failed",
                    error.message?.takeIf { it.isNotBlank() }
                        ?: "XP-P323B SDK print failed",
                )
            }
        }

        if (connection.isConnect) {
            sendWithSdk()
            return
        }

        connection.connect(address) { code, _, message ->
            when (code) {
                POSConnect.CONNECT_SUCCESS -> sendWithSdk()
                POSConnect.CONNECT_FAIL -> handleConnectionFailure(
                    connection,
                    "bluetooth_connect_failed",
                    message.ifBlank { "XP-P323B Bluetooth connection failed" },
                )
                POSConnect.SEND_FAIL -> handleConnectionFailure(
                    connection,
                    "bluetooth_send_failed",
                    message.ifBlank { "XP-P323B Bluetooth send failed" },
                )
                POSConnect.CONNECT_INTERRUPT,
                POSConnect.BLUETOOTH_INTERRUPT,
                -> handleConnectionFailure(
                    connection,
                    "bluetooth_print_interrupted",
                    message.ifBlank { "XP-P323B Bluetooth connection interrupted" },
                )
            }
        }
    }

    private fun buildSdkLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        printer.setCharSet(LABEL_CHARSET)
        printer
            .sizeMm(
                if (label.usesCompactLabel) COMPACT_LABEL_WIDTH_MM else LABEL_WIDTH_MM,
                if (label.usesCompactLabel) COMPACT_LABEL_HEIGHT_MM else LABEL_HEIGHT_MM,
            )
            .speed(4.0)
            .density(
                if (label.isMaterialProduct) {
                    MATERIAL_PRINT_DENSITY
                } else {
                    DEFAULT_PRINT_DENSITY
                },
            )
            .direction(TSPLConst.DIRECTION_FORWARD)
            .reference(
                if (label.usesCompactLabel) COMPACT_LABEL_REFERENCE_X_DOTS else LABEL_REFERENCE_X_DOTS,
                0,
            )
            .cls()
            .codePage(LABEL_CODE_PAGE)

        when {
            label.isQolipCell -> printQolipCell(printer, label)
            label.labelKind == "paddon_code" -> printPaddonLabel(printer, label)
            label.isMaterialSplit -> printMaterialSplitLabel(printer, label)
            label.isQolipCode || label.isMaterialProduct -> printLargeQr(printer, label)
            else -> printPackLabel(printer, label)
        }
    }


    private fun printQolipCell(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        val name = cleanLabelText(label.itemName.ifBlank { label.itemCode })
        val payload = requiredPayload(label.epc)
        val title = fitLabelText(name, 33)
        sdkText(
            printer,
            (COMPACT_LABEL_WIDTH_DOTS - title.length * 16) / 2,
            COMPACT_LABEL_MARGIN_DOTS,
            TSPLConst.FNT_16_24,
            title,
        )
        if (label.materialDataMatrix) {
            sdkMaterialDataMatrixRow(
                printer,
                (COMPACT_LABEL_HEIGHT_DOTS - MATERIAL_DATA_MATRIX_SIZE_DOTS) / 2,
                label.materialDataMatrixBars,
                xOffset = (COMPACT_LABEL_WIDTH_DOTS - LABEL_WIDTH_DOTS) / 2,
            )
            return
        }
        val modules = qrModuleCount(payload)
        val cellSize = minOf(
            largeQrCellSize(payload),
            (COMPACT_LABEL_HEIGHT_DOTS - 2 * COMPACT_LABEL_MARGIN_DOTS - 40) / modules,
        ).coerceAtLeast(2)
        val qrSize = modules * cellSize
        sdkQr(
            printer,
            (COMPACT_LABEL_WIDTH_DOTS - qrSize) / 2,
            maxOf(48, (COMPACT_LABEL_HEIGHT_DOTS - qrSize) / 2),
            payload,
            cellSize = cellSize,
        )
    }

    private fun printPaddonLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        val payload = requiredPayload(label.epc)
        val titleLines = largeQrTitleLines(label, label.itemName.ifBlank { label.itemCode })
        var lines = titleLines.flatMap { wrapLabelText(it, PROGRESS_FIELD_WIDTH_CHARS) }
        val availableHeight = progressCodeY(label, payload) - 8 - PROGRESS_TEXT_TOP_Y
        var fontHeight = if (lines.size * 24 <= availableHeight) 24 else 20
        if (lines.size * fontHeight > availableHeight) {
            lines = titleLines.flatMap { wrapLabelText(it, 46) }
            fontHeight = 12
        }
        require(lines.size * fontHeight <= availableHeight) {
            "Paddon label text does not fit the 56 x 60 mm label"
        }
        val font = when (fontHeight) {
            24 -> TSPLConst.FNT_16_24
            20 -> TSPLConst.FNT_12_20
            else -> TSPLConst.FNT_8_12
        }
        val lineHeight = ((availableHeight - fontHeight) / (lines.size - 1).coerceAtLeast(1))
            .coerceAtMost(fontHeight + PROGRESS_FIELD_GAP_DOTS)
        lines.forEachIndexed { index, line ->
            sdkBoldText(
                printer,
                LABEL_LEFT_MARGIN_DOTS,
                PROGRESS_TEXT_TOP_Y + index * lineHeight,
                line,
                font,
            )
        }
        printProgressQr(printer, label)
    }


    private fun printLargeQr(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        val product = label.itemName.ifBlank { label.itemCode }
        val unit = cleanLabelText(label.unit.ifBlank { "kg" })
        val fields = if (label.isQolipProductCode) {
            listOf(
                "MIJOZ" to label.customerName,
                "MAHSULOT NOMI" to product,
                "QOLIP RANGI" to label.qolipColor,
            )
        } else {
            buildList {
                add("MAHSULOT" to product)
                if (label.tareEnabled) {
                    add("BRUTTO" to "${compactLabelQty(label.grossQty)} $unit")
                    add("NETTO" to "${compactLabelQty(label.netQty)} $unit")
                } else {
                    add("NET VAZNI" to "${compactLabelQty(label.netQty)} $unit")
                }
            }
        }
        printCompactFieldsLabel(printer, label, fields)
    }

    private fun printCompactFieldsLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
        fields: List<Pair<String, String>>,
        largeText: Boolean = false,
    ) {
        val payload = requiredPayload(label.epc)
        val footer = if (label.isQolipProductCode) "EPC: $payload" else payload
        val footerIsLarge = footer.length <= 32
        val footerCharWidth = if (footerIsLarge) 12 else 8
        val footerLineHeight = if (footerIsLarge) 24 else 16
        val footerFont = if (footerIsLarge) TSPLConst.FNT_12_20 else TSPLConst.FNT_8_12
        val footerLines = wrapLabelText(
            footer,
            (COMPACT_LABEL_WIDTH_DOTS - 2 * COMPACT_LABEL_MARGIN_DOTS) / footerCharWidth,
        )
        val useDataMatrix = (label.isMaterialProduct || label.isQolipProductCode) &&
            label.materialDataMatrix
        var cellSize = minOf(largeQrCellSize(payload), 174 / qrModuleCount(payload))
            .coerceAtLeast(2)
        val styles = buildList {
            if (largeText) add(Triple(TSPLConst.FNT_24_32, 24, 36))
            add(Triple(TSPLConst.FNT_16_24, 16, 28))
            add(Triple(TSPLConst.FNT_8_12, 8, 16))
        }
        var codeSize: Int
        var latestCodeY: Int
        var selected: Pair<Triple<String, Int, Int>, List<List<String>>>?
        while (true) {
            codeSize = if (useDataMatrix) MATERIAL_DATA_MATRIX_SIZE_DOTS
                else qrSymbolSizeDots(payload, cellSize)
            latestCodeY = COMPACT_LABEL_HEIGHT_DOTS - COMPACT_LABEL_MARGIN_DOTS -
                footerLines.size * footerLineHeight - PROGRESS_PACK_EPC_GAP_DOTS - codeSize
            val availableHeight = latestCodeY - COMPACT_LABEL_MARGIN_DOTS - QOLIP_FIELD_QR_GAP_DOTS
            selected = styles.asSequence().map { style ->
                val width = (COMPACT_LABEL_WIDTH_DOTS - COMPACT_LABEL_TEXT_X_DOTS -
                    COMPACT_LABEL_MARGIN_DOTS - PROGRESS_BOLD_OFFSET_DOTS) / style.second
                style to fields.map { (name, value) ->
                    wrapLabelText("$name: ${cleanLabelText(value).ifBlank { "-" }}", width)
                }
            }.firstOrNull { (style, lines) ->
                lines.sumOf { it.size } * style.third +
                    (fields.size - 1) * PROGRESS_FIELD_GAP_DOTS <= availableHeight
            }
            if (selected != null || useDataMatrix || cellSize <= 2) break
            cellSize--
        }
        val (style, wrappedFields) = selected
            ?: throw IllegalArgumentException("Label text does not fit the 70 x 50 mm label")
        val (font, charWidth, lineHeight) = style
        var y = COMPACT_LABEL_MARGIN_DOTS
        wrappedFields.forEachIndexed { fieldIndex, lines ->
            lines.forEachIndexed { index, line ->
                sdkProgressLine(printer, y + index * lineHeight, line, font, charWidth)
            }
            y += lines.size * lineHeight +
                if (fieldIndex == fields.lastIndex) 0 else PROGRESS_FIELD_GAP_DOTS
        }
        val codeY = maxOf(y + QOLIP_FIELD_QR_GAP_DOTS, latestCodeY - 16)
            .coerceAtMost(latestCodeY)
        if (useDataMatrix) {
            sdkMaterialDataMatrixRow(
                printer,
                codeY,
                label.materialDataMatrixBars,
                xOffset = (COMPACT_LABEL_WIDTH_DOTS - LABEL_WIDTH_DOTS) / 2,
            )
        } else {
            sdkQr(printer, (COMPACT_LABEL_WIDTH_DOTS - codeSize) / 2, codeY, payload, cellSize)
        }
        footerLines.forEachIndexed { index, line ->
            sdkText(
                printer,
                (COMPACT_LABEL_WIDTH_DOTS - line.length * footerCharWidth) / 2,
                codeY + codeSize + PROGRESS_PACK_EPC_GAP_DOTS + index * footerLineHeight,
                footerFont,
                line,
            )
        }
    }

    private fun printPackLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        if (label.isProgress) {
            printProgressPackLabel(printer, label)
            return
        }
        val payload = requiredPayload(label.epc)
        val product = cleanLabelText(label.itemName.ifBlank { label.itemCode })
        val productLines = wrapLabelText(product, 24).take(3)
        val quantityUnit = cleanLabelText(
            if (label.isProgress && label.progressUnit.isNotBlank()) {
                label.progressUnit
            } else {
                label.unit.ifBlank { "kg" }
            },
        )
        val grossUnit = cleanLabelText(label.unit.ifBlank { "kg" })
        val quantityLabel = if (label.isProgress) "METRAJ" else "NETTO"
        val quantity = if (label.isProgress) {
            label.progressQty ?: label.netQty
        } else {
            label.netQty
        }

        sdkText(
            printer,
            LABEL_LEFT_MARGIN_DOTS,
            4,
            TSPLConst.FNT_16_24,
            "ACCORD",
        )
        productLines.forEachIndexed { index, line ->
            sdkText(
                printer,
                LABEL_LEFT_MARGIN_DOTS,
                34 + index * 24,
                TSPLConst.FNT_12_20,
                line,
            )
        }
        sdkText(
            printer,
            LABEL_LEFT_MARGIN_DOTS,
            112,
            TSPLConst.FNT_12_20,
            "$quantityLabel: ${formatLabelQty(quantity)} $quantityUnit",
        )
        sdkText(
            printer,
            LABEL_LEFT_MARGIN_DOTS,
            138,
            TSPLConst.FNT_12_20,
            "BRUTTO: ${formatLabelQty(label.grossQty)} $grossUnit",
        )
        sdkQr(
            printer,
            PACK_QR_X,
            PACK_QR_Y,
            payload,
            cellSize = packQrCellSize(payload),
        )
        val epcFont = if (payload.length <= 32) {
            TSPLConst.FNT_12_20
        } else {
            TSPLConst.FNT_8_12
        }
        val epcText = fitLabelText(payload, if (epcFont == TSPLConst.FNT_12_20) 32 else 46)
        sdkText(
            printer,
            centeredLabelX(epcText, if (epcFont == TSPLConst.FNT_12_20) 12 else 8),
            PACK_EPC_Y,
            epcFont,
            epcText,
        )
    }

    private fun printMaterialSplitLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        val unit = cleanLabelText(label.unit.ifBlank { "kg" })
        val meterUnit = cleanLabelText(label.progressUnit.ifBlank { "m" })
        val fields = buildList {
            add("HOMASHYO" to label.itemName.ifBlank { label.itemCode })
            add("BRUTTO" to "${formatLabelQty(label.grossQty)} $unit")
            add("NETTO" to "${formatLabelQty(label.netQty)} $unit")
            label.progressQty?.takeIf { it.isFinite() && it > 0.0 }?.let {
                add("METRAJ" to "${formatLabelQty(it)} $meterUnit")
            }
            if (label.manufacturerName.isNotBlank()) {
                add("ISHLAB CHIQARUVCHI" to label.manufacturerName)
            }
        }
        printCompactFieldsLabel(printer, label, fields)
    }

    private fun splitQrCellWidth(value: String): Int {
        return (packQrCellSize(value) + 1).coerceAtMost(6)
    }

    private fun printSplitField(
        printer: TSPLPrinter,
        y: Int,
        fieldLabel: String,
        value: String,
        maxLines: Int = 1,
    ): Int {
        val lines = splitFieldLines(fieldLabel, value, maxLines)
        lines.forEachIndexed { index, line ->
            sdkSplitLine(printer, y + index * SPLIT_TEXT_LINE_HEIGHT_DOTS, line)
        }
        return y + lines.size * SPLIT_TEXT_LINE_HEIGHT_DOTS + PROGRESS_FIELD_GAP_DOTS
    }

    private fun splitFieldLines(
        fieldLabel: String,
        value: String,
        maxLines: Int,
    ): List<String> {
        return wrapLabelText(
            "$fieldLabel: ${value.trim().ifBlank { "-" }}",
            SPLIT_FIELD_WIDTH_CHARS,
        ).take(maxLines.coerceAtLeast(1))
    }

    private fun sdkSplitLine(
        printer: TSPLPrinter,
        y: Int,
        line: String,
    ) {
        val separator = line.indexOf(':')
        if (separator < 0) {
            sdkSplitBoldText(printer, LABEL_LEFT_MARGIN_DOTS, y, line)
            return
        }
        val labelPart = line.take(separator + 1)
        val valuePart = line.drop(separator + 1).trimStart()
        sdkText(
            printer,
            LABEL_LEFT_MARGIN_DOTS,
            y,
            TSPLConst.FNT_24_32,
            labelPart,
        )
        if (valuePart.isNotEmpty()) {
            sdkSplitBoldText(
                printer,
                LABEL_LEFT_MARGIN_DOTS +
                    (labelPart.length + 1) * SPLIT_TEXT_CHAR_WIDTH_DOTS,
                y,
                valuePart,
            )
        }
    }

    private fun sdkSplitBoldText(
        printer: TSPLPrinter,
        x: Int,
        y: Int,
        value: String,
    ) {
        sdkText(printer, x, y, TSPLConst.FNT_24_32, value)
        sdkText(
            printer,
            x + PROGRESS_BOLD_OFFSET_DOTS,
            y,
            TSPLConst.FNT_24_32,
            value,
        )
    }

    private fun printProgressPackLabel(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
    ) {
        label.progressLines.forEach { line ->
            val font = when (line.font) {
                "large" -> TSPLConst.FNT_16_24
                "medium" -> TSPLConst.FNT_12_20
                else -> TSPLConst.FNT_8_12
            }
            sdkProgressLine(printer, line.y, line.text, font, line.charWidth)
        }
        printProgressQr(printer, label, codeY = label.progressCodeY, epcGap = 8)
    }

    private fun progressEpcY(payload: String): Int {
        val qrSize = qrSymbolSizeDots(payload, packQrCellSize(payload))
        return (PROGRESS_PACK_QR_Y + qrSize + PROGRESS_PACK_EPC_GAP_DOTS)
            .coerceAtMost(LABEL_HEIGHT_DOTS - 24)
    }

    private fun progressLayoutPayload(label: BluetoothLabelRequest, payload: String): String {
        val prefix = "qolip-paddon:"
        return if (label.materialDataMatrix && label.labelKind == "paddon_code" &&
            payload.startsWith(prefix, ignoreCase = true)
        ) {
            val code = payload.substring(prefix.length)
            val digits = code.drop(3)
            // Position from the pallet number, while printing the complete typed payload.
            if (code.startsWith("QP-", ignoreCase = true) &&
                digits.isNotEmpty() && digits.all { it in '0'..'9' }
            ) digits else code.ifBlank { payload }
        } else {
            payload
        }
    }

    private fun progressCodeY(label: BluetoothLabelRequest, payload: String): Int {
        return if (label.materialDataMatrix) {
            progressEpcY(progressLayoutPayload(label, payload)) -
                PROGRESS_PACK_EPC_GAP_DOTS - MATERIAL_DATA_MATRIX_SIZE_DOTS
        } else {
            PROGRESS_PACK_QR_Y
        }
    }

    // WIP places its codes after the fields; pallet labels use the default position.
    private fun printProgressQr(
        printer: TSPLPrinter,
        label: BluetoothLabelRequest,
        codeY: Int? = null,
        epcGap: Int = PROGRESS_PACK_EPC_GAP_DOTS,
    ) {
        val payload = requiredPayload(label.epc)
        val qrCellSize = packQrCellSize(payload)
        val qrY = codeY ?: progressCodeY(label, payload)
        val matrixRowWidth = MATERIAL_DATA_MATRIX_COUNT * MATERIAL_DATA_MATRIX_SIZE_DOTS +
            (MATERIAL_DATA_MATRIX_COUNT - 1) * MATERIAL_DATA_MATRIX_GAP_DOTS
        val matrixStartX = (LABEL_WIDTH_DOTS - matrixRowWidth) / 2
        val xOffset = if (label.isProgress) {
            label.progressCodeX - matrixStartX
        } else {
            0
        }
        val epcY = if (codeY != null) {
            qrY + (if (label.materialDataMatrix) MATERIAL_DATA_MATRIX_SIZE_DOTS
                else qrSymbolSizeDots(payload, qrCellSize)) + epcGap
        } else {
            progressEpcY(progressLayoutPayload(label, payload))
        }
        if (label.materialDataMatrix) {
            sdkMaterialDataMatrixRow(
                printer,
                qrY,
                label.materialDataMatrixBars,
                xOffset = xOffset,
            )
        } else {
            sdkQr(
                printer,
                PROGRESS_PACK_QR_X + xOffset,
                qrY,
                payload,
                cellSize = qrCellSize,
            )
        }
        val epcFont = if (payload.length <= 32) {
            TSPLConst.FNT_12_20
        } else {
            TSPLConst.FNT_8_12
        }
        val epcText = fitLabelText(payload, if (epcFont == TSPLConst.FNT_12_20) 32 else 46)
        sdkText(
            printer,
            if (label.isProgress && label.materialDataMatrix) label.progressCodeX
            else centeredLabelX(epcText, if (epcFont == TSPLConst.FNT_12_20) 12 else 8) + xOffset,
            epcY,
            epcFont,
            epcText,
        )
    }

    private fun sdkProgressLine(
        printer: TSPLPrinter,
        y: Int,
        line: String,
        font: String,
        charWidth: Int,
    ) {
        val separator = line.indexOf(':')
        if (separator < 0) {
            sdkBoldText(printer, COMPACT_LABEL_TEXT_X_DOTS, y, line, font)
            return
        }
        val labelPart = line.take(separator + 1)
        val valuePart = line.drop(separator + 1).trimStart()
        sdkText(
            printer,
            COMPACT_LABEL_TEXT_X_DOTS,
            y,
            font,
            labelPart,
        )
        if (valuePart.isNotEmpty()) {
            sdkBoldText(
                printer,
                COMPACT_LABEL_TEXT_X_DOTS +
                    (labelPart.length + 1) * charWidth,
                y,
                valuePart,
                font,
            )
        }
    }

    private fun sdkBoldText(
        printer: TSPLPrinter,
        x: Int,
        y: Int,
        value: String,
        font: String = TSPLConst.FNT_16_24,
    ) {
        sdkText(printer, x, y, font, value)
        sdkText(
            printer,
            x + PROGRESS_BOLD_OFFSET_DOTS,
            y,
            font,
            value,
        )
    }

    private fun printQolipField(
        printer: TSPLPrinter,
        y: Int,
        fieldLabel: String,
        value: String,
    ): Int {
        val labelPart = "$fieldLabel: "
        val displayValue = cleanLabelText(value).ifBlank { "-" }
        val fullLineChars = ((LABEL_WIDTH_DOTS - LABEL_LEFT_MARGIN_DOTS -
            LABEL_RIGHT_MARGIN_DOTS) / QOLIP_FIELD_CHAR_WIDTH_DOTS).coerceAtLeast(1)
        val inlineFits = displayValue.length + labelPart.length <= fullLineChars
        val valueLines = wrapLabelText(displayValue, fullLineChars)
        if (inlineFits) {
            sdkText(
                printer,
                LABEL_LEFT_MARGIN_DOTS,
                y,
                TSPLConst.FNT_12_20,
                "$labelPart$displayValue",
            )
        } else {
            sdkText(
                printer,
                LABEL_LEFT_MARGIN_DOTS,
                y,
                TSPLConst.FNT_12_20,
                labelPart,
            )
            valueLines.forEachIndexed { index, line ->
                sdkBoldText(
                    printer,
                    LABEL_LEFT_MARGIN_DOTS,
                    y + QOLIP_FIELD_LINE_HEIGHT_DOTS * (index + 1),
                    line,
                    font = TSPLConst.FNT_12_20,
                )
            }
        }
        val lineCount = if (inlineFits) 1 else valueLines.size + 1
        return y + QOLIP_FIELD_LINE_HEIGHT_DOTS * lineCount +
            QOLIP_FIELD_ROW_GAP_DOTS
    }

    private fun qolipFieldsEndY(
        label: BluetoothLabelRequest,
        rawTitle: String,
    ): Int {
        var y = QOLIP_FIELD_TOP_Y
        y = qolipFieldNextY(y, "MIJOZ", label.customerName)
        y = qolipFieldNextY(y, "MAHSULOT NOMI", rawTitle)
        return qolipFieldNextY(y, "QOLIP RANGI", label.qolipColor)
    }

    private fun qolipFieldNextY(
        y: Int,
        fieldLabel: String,
        value: String,
    ): Int {
        val labelPart = "$fieldLabel: "
        val displayValue = cleanLabelText(value).ifBlank { "-" }
        val fullLineChars = ((LABEL_WIDTH_DOTS - LABEL_LEFT_MARGIN_DOTS -
            LABEL_RIGHT_MARGIN_DOTS) / QOLIP_FIELD_CHAR_WIDTH_DOTS).coerceAtLeast(1)
        val inlineFits = displayValue.length + labelPart.length <= fullLineChars
        val valueLineCount = if (inlineFits) {
            1
        } else {
            wrapLabelText(displayValue, fullLineChars).size + 1
        }
        return y + QOLIP_FIELD_LINE_HEIGHT_DOTS * valueLineCount +
            QOLIP_FIELD_ROW_GAP_DOTS
    }

    private fun sdkText(
        printer: TSPLPrinter,
        x: Int,
        y: Int,
        font: String,
        value: String,
    ) {
        printer.text(
            x,
            y,
            font,
            TSPLConst.ROTATION_0,
            1,
            1,
            cleanLabelText(value),
        )
    }

    private fun sdkQr(
        printer: TSPLPrinter,
        x: Int,
        y: Int,
        value: String,
        cellSize: Int,
    ) {
        printer.qrcode(
            x,
            y,
            TSPLConst.EC_LEVEL_H,
            cellSize,
            TSPLConst.QRCODE_MODE_AUTO,
            TSPLConst.ROTATION_0,
            TSPLConst.QRCODE_MODEL_M2,
            "S7",
            value,
        )
    }

    private fun sdkMaterialDataMatrixRow(
        printer: TSPLPrinter,
        y: Int,
        bars: List<List<Double>>,
        xOffset: Int = 0,
    ) {
        val rowWidth = MATERIAL_DATA_MATRIX_COUNT * MATERIAL_DATA_MATRIX_SIZE_DOTS +
            (MATERIAL_DATA_MATRIX_COUNT - 1) * MATERIAL_DATA_MATRIX_GAP_DOTS
        val startX = (LABEL_WIDTH_DOTS - rowWidth) / 2 + xOffset
        repeat(MATERIAL_DATA_MATRIX_COUNT) { index ->
            sdkDataMatrix(
                printer,
                startX + index * (MATERIAL_DATA_MATRIX_SIZE_DOTS + MATERIAL_DATA_MATRIX_GAP_DOTS),
                y,
                bars,
                MATERIAL_DATA_MATRIX_SIZE_DOTS,
            )
        }
    }

    private fun sdkDataMatrix(
        printer: TSPLPrinter,
        x: Int,
        y: Int,
        bars: List<List<Double>>,
        sizeDots: Int,
    ) {
        // Explicit dot bounds keep firmware from auto-sizing the ECC 200 symbol.
        val commands = buildString {
            for (bar in bars) {
                val left = (bar[0] * sizeDots).roundToInt()
                val top = (bar[1] * sizeDots).roundToInt()
                val right = (bar[2] * sizeDots).roundToInt()
                val bottom = (bar[3] * sizeDots).roundToInt()
                append("BAR ${x + left},${y + top},${right - left},${bottom - top}\r\n")
            }
        }
        printer.sendData(commands.toByteArray(Charsets.US_ASCII))
    }

    private fun requiredPayload(value: String): String {
        return cleanLabelText(value).takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("XP-P323B QR payload is empty")
    }

    private fun largeQrCellSize(value: String): Int {
        return when {
            value.length <= 32 -> 8
            value.length <= 46 -> 7
            else -> 6
        }
    }

    private fun materialQrCellSize(value: String): Int {
        return (largeQrCellSize(value) + 1).coerceAtMost(9)
    }

    private fun centeredQrX(value: String, cellSize: Int): Int {
        val qrSize = qrSymbolSizeDots(value, cellSize)
        return ((LABEL_WIDTH_DOTS - qrSize) / 2).coerceAtLeast(0)
    }

    private fun centeredQrY(value: String, cellSize: Int): Int {
        val qrSize = qrSymbolSizeDots(value, cellSize)
        return ((LABEL_HEIGHT_DOTS - qrSize) / 2).coerceAtLeast(0)
    }

    private fun qrSymbolSizeDots(value: String, cellSize: Int): Int {
        return qrModuleCount(value) * cellSize
    }

    private fun qrModuleCount(value: String): Int {
        val normalized = value.uppercase(Locale.US)
        val dataLength = normalized.toByteArray(Charsets.US_ASCII).size
        val capacities = when {
            normalized.all { it.isDigit() } ->
                intArrayOf(17, 34, 58, 82, 106, 139, 154, 202, 235, 288)
            normalized.all { QR_ALPHANUMERIC.contains(it) } ->
                intArrayOf(10, 20, 35, 50, 64, 84, 93, 122, 143, 174)
            else ->
                intArrayOf(7, 14, 24, 34, 44, 58, 64, 84, 98, 119)
        }
        val version = capacities.indexOfFirst { dataLength <= it }
            .let { if (it >= 0) it + 1 else capacities.size }
        return 17 + version * 4
    }

    private fun centeredQrFooterY(qrY: Int, qrSize: Int): Int {
        return (qrY + qrSize + LARGE_QR_FOOTER_GAP_DOTS).coerceAtMost(
            LABEL_HEIGHT_DOTS - LARGE_QR_FOOTER_HEIGHT_DOTS,
        )
    }

    private fun packQrCellSize(value: String): Int {
        return if (value.length <= 32) 5 else 4
    }

    private fun largeQrTitleLines(
        label: BluetoothLabelRequest,
        rawTitle: String,
    ): List<String> {
        if (label.labelKind == "paddon_code" && label.paddonLabelLines.isNotEmpty()) {
            return label.paddonLabelLines.map(::cleanLabelText)
        }
        if (label.isMaterialProduct) {
            val productName = cleanLabelText(
                label.itemName.ifBlank { label.itemCode },
            )
            val unit = cleanLabelText(label.unit.ifBlank { "kg" })
            val netWeight = compactLabelQty(label.netQty)
            val productLines = if (label.materialNameLines.isEmpty()) {
                wrapLabelText(
                    cleanLabelText("MAHSULOT: $productName"),
                    MATERIAL_TITLE_WIDTH_CHARS,
                )
            } else {
                label.materialNameLines.flatMap {
                    wrapLabelText(cleanLabelText(it), MATERIAL_TITLE_WIDTH_CHARS)
                }
            }
            val weights = if (label.tareEnabled) {
                listOf("BRUTTO: ${compactLabelQty(label.grossQty)} $unit", "NETTO: $netWeight $unit")
            } else {
                listOf("NET VAZNI: $netWeight $unit")
            }
            val meterUnit = cleanLabelText(label.progressUnit.ifBlank { "m" })
            val meterPart = if (label.progressQty != null && label.progressQty > 0) {
                listOf("METRI: ${compactLabelQty(label.progressQty)} $meterUnit")
            } else {
                emptyList()
            }
            val weightLines = (weights + meterPart).flatMap {
                wrapLabelText(cleanLabelText(it), MATERIAL_TITLE_WIDTH_CHARS)
            }
            if (label.materialDataMatrix) {
                // Reserve the complete code row and footer before placing the name.
                val maxTitleLines = 1 + (LABEL_HEIGHT_DOTS - MATERIAL_DATA_MATRIX_SIZE_DOTS -
                    LARGE_QR_FOOTER_GAP_DOTS - LARGE_QR_FOOTER_HEIGHT_DOTS -
                    MATERIAL_TITLE_QR_GAP_DOTS - MATERIAL_TITLE_TOP_Y -
                    MATERIAL_TITLE_FONT_HEIGHT_DOTS) / MATERIAL_TITLE_LINE_HEIGHT_DOTS
                return productLines.take((maxTitleLines - weightLines.size).coerceAtLeast(0)) +
                    weightLines
            }
            return productLines + weightLines
        }
        if (label.isQolipCode && label.customerName.isNotBlank()) {
            return listOf(
                fitLabelText(cleanLabelText(label.customerName), 25),
                fitLabelText(cleanLabelText(rawTitle), 25),
            ).filter { it.isNotBlank() }
        }
        return wrapLabelText(cleanLabelText(rawTitle), 25).take(2)
    }

    private fun largeQrFooter(
        label: BluetoothLabelRequest,
        payload: String,
    ): String {
        val value = when {
            label.isMaterialProduct -> payload
            label.isQolipProductCode -> "EPC: $payload"
            label.isQolipCode && payload.startsWith("RPS-BATCH:") ->
                "BATCH ID: ${payload.removePrefix("RPS-BATCH:")}"
            label.itemCode.isNotBlank() -> label.itemCode
            else -> payload
        }
        return cleanLabelText(value)
    }

    private fun centeredLabelX(value: String, charWidth: Int): Int {
        val availableWidth = LABEL_WIDTH_DOTS -
            LABEL_LEFT_MARGIN_DOTS - LABEL_RIGHT_MARGIN_DOTS
        val textWidth = (value.length * charWidth).coerceAtMost(availableWidth)
        val maxX = LABEL_WIDTH_DOTS - LABEL_RIGHT_MARGIN_DOTS - textWidth
        return ((LABEL_WIDTH_DOTS - textWidth) / 2)
            .coerceIn(LABEL_LEFT_MARGIN_DOTS, maxX)
    }

    private fun cleanLabelText(value: String): String {
        return value
            .replace('‘', '\'')
            .replace('’', '\'')
            .replace('`', '\'')
            .replace('"', '\'')
            .replace(Regex("[\\r\\n\\t]+"), " ")
            .trim()
            .uppercase(Locale.US)
            .replace(Regex("\\s+"), " ")
    }

    private fun fitLabelText(value: String, maxLength: Int): String {
        return if (value.length <= maxLength) value else value.take(maxLength)
    }

    private fun wrapLabelText(value: String, width: Int): List<String> {
        val lines = mutableListOf<String>()
        var current = ""
        value.split(Regex("\\s+")).filter { it.isNotEmpty() }.forEach { word ->
            var rest = word
            while (rest.length > width) {
                if (current.isNotEmpty()) {
                    lines += current
                    current = ""
                }
                lines += rest.take(width)
                rest = rest.drop(width)
            }
            val candidate = if (current.isEmpty()) rest else "$current $rest"
            if (candidate.length <= width) {
                current = candidate
            } else {
                lines += current
                current = rest
            }
        }
        if (current.isNotEmpty()) {
            lines += current
        }
        return lines
    }

    private fun formatLabelQty(value: Double): String {
        val rounded = (value * 100).roundToInt() / 100.0
        return String.format(Locale.US, "%.2f", rounded)
    }

    private fun compactLabelQty(value: Double): String {
        return String.format(Locale.US, "%.3f", value)
            .trimEnd('0')
            .trimEnd('.')
    }

    @Suppress("MissingPermission")
    private fun bluetoothAdapter(result: MethodChannel.Result) =
        (activity.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)
            ?.adapter
            ?.also { adapter ->
                if (!adapter.isEnabled) {
                    result.error(
                        "bluetooth_disabled",
                        "Android Bluetooth is turned off",
                        null,
                    )
                    return null
                }
            }
            ?: run {
                result.error(
                    "bluetooth_unavailable",
                    "Android Bluetooth is not available",
                    null,
                )
                null
            }

    private fun finishSuccess(
        completed: AtomicBoolean,
        connection: IDeviceConnection,
        result: MethodChannel.Result,
        bytes: Int,
        address: String,
        labelCount: Int,
    ) {
        if (!completed.compareAndSet(false, true)) {
            return
        }
        mainHandler.removeCallbacksAndMessages(null)
        if (activeConnection === connection) {
            activePrintFailure = null
        }
        val response = mapOf(
            "ok" to true,
            "status" to "done",
            "bytes" to bytes,
            "deviceName" to "XP-P323B",
            "address" to address,
            "label_count" to labelCount,
            "printer_status" to "Bluetooth OK",
        )
        activity.runOnUiThread {
            printBusy.set(false)
            result.success(response)
        }
    }

    private fun finishError(
        completed: AtomicBoolean,
        connection: IDeviceConnection,
        result: MethodChannel.Result,
        code: String,
        message: String,
    ) {
        if (!completed.compareAndSet(false, true)) {
            return
        }
        mainHandler.removeCallbacksAndMessages(null)
        if (activeConnection === connection) {
            activeConnection = null
            activeAddress = ""
            activePrintFailure = null
        }
        closeConnection(connection)
        printBusy.set(false)
        activity.runOnUiThread {
            result.error(code, message, null)
        }
    }

    private fun handleConnectionFailure(
        connection: IDeviceConnection,
        code: String,
        message: String,
    ) {
        if (activeConnection !== connection) {
            return
        }
        val failure = activePrintFailure
        if (failure != null) {
            failure(code, message)
            return
        }
        activeConnection = null
        activeAddress = ""
        closeConnection(connection)
    }

    private fun disconnectActiveConnection() {
        val connection = activeConnection
        activeConnection = null
        activeAddress = ""
        activePrintFailure = null
        if (connection != null) {
            closeConnection(connection)
        }
    }

    private fun closeConnection(connection: IDeviceConnection) {
        try {
            connection.close()
        } catch (error: Exception) {
            Log.w(TAG, "XP-P323B Bluetooth close failed", error)
        }
    }

    private fun isXpP323b(name: String): Boolean {
        return name.uppercase().replace("-", "").replace("_", "").replace(" ", "")
            .contains("XPP323B") || name.uppercase().contains("P323B")
    }
}

private class CapturingTsplPrinter(
    connection: IDeviceConnection,
) : TSPLPrinter(connection) {
    private val output = ByteArrayOutputStream()

    override fun sendData(data: ByteArray): TSPLPrinter {
        output.write(data)
        return this
    }

    override fun sendData(data: MutableList<ByteArray?>): TSPLPrinter {
        data.forEach { chunk ->
            if (chunk != null) {
                output.write(chunk)
            }
        }
        return this
    }

    fun payload(): ByteArray = output.toByteArray()
}

private data class BluetoothProgressLine(
    val text: String,
    val y: Int,
    val font: String,
    val charWidth: Int,
)

private data class BluetoothLabelRequest(
    val epc: String,
    val itemCode: String,
    val itemName: String,
    val apparatus: String,
    val apparatusDisplayName: String,
    val customerName: String,
    val manufacturerName: String,
    val qolipColor: String,
    val grossQty: Double,
    val unit: String,
    val tareEnabled: Boolean,
    val tareKg: Double,
    val printCount: Int,
    val labelKind: String,
    val materialDataMatrix: Boolean,
    val materialDataMatrixBars: List<List<Double>>,
    val materialNameLines: List<String>,
    val progressQty: Double?,
    val progressUnit: String,
    val completedAtLabel: String,
    val progressLines: List<BluetoothProgressLine>,
    val progressCodeY: Int,
    val progressCodeX: Int,
    val paddonLabelLines: List<String>,
) {
    val netQty: Double
        get() = (grossQty - tareKg).coerceAtLeast(0.0)

    val usesCompactLabel: Boolean
        get() = isProgress || isMaterialProduct || isQolipProductCode || isQolipCell

    val isProgress: Boolean
        get() = labelKind == "progress" || labelKind == "opening_wip"

    val isQolipCell: Boolean
        get() = labelKind == "qolip_cell" || labelKind == "qr_center"

    val isQolipCode: Boolean
        get() = labelKind == "qolip_code" || labelKind == "paddon_code"

    val isQolipProductCode: Boolean
        get() = labelKind == "qolip_code"

    val isMaterialProduct: Boolean
        get() = labelKind == "material_product"

    // Faqat homashyo rezkachisi split chiqishi (progressUnit='m' yoki
    // HOMASHYO sarlavha): yangi zich tartib + WIP dagi kichik o'ng-past QR.
    // Uzunliksiz generic material_product eski katta markaziy QR yo'lida
    // qoladi.
    val isMaterialSplit: Boolean
        get() = isMaterialProduct &&
            (progressUnit.equals("m", ignoreCase = true) ||
                materialNameLines.firstOrNull()?.startsWith("HOMASHYO") == true)

    companion object {
        fun from(call: MethodCall): BluetoothLabelRequest? {
            val epc = call.argument<String>("epc").orEmpty().trim()
            val grossQty = call.argument<Number>("gross_qty")?.toDouble() ?: 0.0
            val tareKg = call.argument<Number>("tare_kg")?.toDouble() ?: 0.0
            val printCount = call.argument<Number>("print_count")?.toInt() ?: 1
            val labelKind = call.argument<String>("label_kind").orEmpty().trim().lowercase(Locale.US)
            val lineMaps = call.argument<List<Map<String, Any?>>>("progress_lines").orEmpty()
            val lines = lineMaps.mapNotNull { line ->
                val text = line["text"] as? String ?: return@mapNotNull null
                val y = (line["y"] as? Number)?.toInt() ?: return@mapNotNull null
                val font = line["font"] as? String ?: return@mapNotNull null
                val width = (line["char_width"] as? Number)?.toInt() ?: return@mapNotNull null
                if (text.isBlank() || y !in 12..240 ||
                    (font to width) !in listOf("large" to 16, "medium" to 16, "small" to 8)
                ) return@mapNotNull null
                BluetoothProgressLine(text, y, font, width)
            }
            val codeY = call.argument<Number>("progress_code_y")?.toInt() ?: 0
            val codeX = call.argument<Number>("progress_code_x")?.toInt() ?: 0
            val materialDataMatrix = call.argument<Boolean>("material_data_matrix") == true
            val bars = call.argument<List<List<Number>>>("material_data_matrix_bars")
                .orEmpty().map { row -> row.map { it.toDouble() } }
            if (materialDataMatrix && (bars.isEmpty() || bars.any { bar ->
                    bar.size != 4 || bar.any { !it.isFinite() || it !in 0.0..1.0 } ||
                        bar[0] >= bar[2] || bar[1] >= bar[3]
                })) {
                return null
            }
            if (epc.isEmpty() || !grossQty.isFinite() || !tareKg.isFinite() ||
                printCount !in 1..100
            ) {
                return null
            }
            if (labelKind in listOf("progress", "opening_wip") &&
                (!materialDataMatrix || lines.isEmpty() || lines.size != lineMaps.size ||
                    codeY !in 236..252 || codeX !in 8..204)
            ) return null
            return BluetoothLabelRequest(
                epc = epc,
                itemCode = call.argument<String>("item_code").orEmpty().trim(),
                itemName = call.argument<String>("item_name").orEmpty().trim(),
                apparatus = call.argument<String>("apparatus").orEmpty().trim(),
                apparatusDisplayName = call.argument<String>("apparatus_display_name")
                    .orEmpty()
                    .trim(),
                customerName = call.argument<String>("customer_name").orEmpty().trim(),
                manufacturerName = call.argument<String>("manufacturer_name").orEmpty().trim(),
                qolipColor = call.argument<String>("qolip_color").orEmpty().trim(),
                grossQty = grossQty.coerceAtLeast(0.0),
                unit = call.argument<String>("unit").orEmpty().trim().ifBlank { "kg" },
                tareEnabled = call.argument<Boolean>("tare_enabled") == true || tareKg > 0,
                tareKg = tareKg.coerceAtLeast(0.0),
                printCount = printCount,
                labelKind = labelKind,
                materialDataMatrix = materialDataMatrix,
                materialDataMatrixBars = bars,
                materialNameLines = call.argument<List<Any?>>("material_name_lines")
                    .orEmpty()
                    .mapNotNull { value ->
                        value?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                    },
                progressQty = call.argument<Number>("progress_qty")?.toDouble()
                    ?.takeIf { it.isFinite() },
                progressUnit = call.argument<String>("progress_unit").orEmpty().trim(),
                completedAtLabel = call.argument<String>("completed_at_label").orEmpty().trim(),
                progressLines = lines,
                progressCodeY = codeY,
                progressCodeX = codeX,
                paddonLabelLines = call.argument<List<String>>("paddon_label_lines").orEmpty(),
            )
        }
    }
}
