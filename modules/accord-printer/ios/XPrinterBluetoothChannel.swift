import CoreBluetooth
import Foundation

final class XPrinterBluetoothChannel: NSObject, XBLEManagerDelegate {
  private static let channelName = "accord/bluetooth_printer"
  private static let discoveryChannelName = "accord/bluetooth_printer/discovery"
  private static let printTimeout: TimeInterval = 25
  // BLE completion confirms that TSPL bytes were transferred, not that the
  // XP-P323B finished feeding the label. Hold the channel busy for one
  // label's mechanical print time before the next batch item starts.
  private static let printSettlePerLabel: TimeInterval = 1.2
  private static let scanTimeout: TimeInterval = 6
  private static let writeCharacteristicTimeout: TimeInterval = 8
  private static let writeCharacteristicPollInterval: TimeInterval = 0.1
  private static let labelWidthMm: Double = 56.0
  private static let labelHeightMm: Double = 60.0
  // XP-P323B is 203 dpi, so a 56 x 60 mm label is approximately
  // 448 x 480 dots. The printer's physical label origin is a few
  // dots left of the adhesive label, so compensate it at the TSPL
  // origin rather than moving individual objects independently.
  private static let labelWidthDots = 448
  private static let labelHeightDots = 480
  private static let labelReferenceXDots: Int32 = 72
  private static let labelLeftMarginDots = 24
  private static let labelRightMarginDots = 24
  private static let defaultPrintDensity: Int32 = 10
  private static let materialPrintDensity: Int32 = 12
  private static let materialTextBoldOffsetDots = 1
  private static let materialTitleWidthChars = 28
  private static let materialTitleTopY = 6
  private static let materialTitleLineHeightDots = 26
  private static let materialTitleFontHeightDots = 19
  private static let materialTitleQrGapDots = 8
  // Three copies at 60% of the former 174-dot receipt symbol.
  private static let materialDataMatrixSizeDots = 104
  private static let materialDataMatrixCount = 3
  private static let materialDataMatrixGapDots = 16
  private static let packQrX = 278
  private static let packQrY = 166
  private static let packEpcY = 328
  private static let progressPackQrX = 250
  private static let progressPackQrY = 285
  private static let progressPackEpcGapDots = 16
  private static let compactLabelWidthMm: Double = 70.0
  private static let compactLabelWidthDots = 560
  private static let compactLabelHeightMm: Double = 50.0
  private static let compactLabelHeightDots = 400
  private static let compactLabelMarginDots = 8
  private static let compactLabelReferenceXDots: Int32 = 32
  private static let compactLabelTextXDots = 8
  private static let progressTextLineHeightDots = 24
  private static let progressTextTopY = 36
  private static let progressFieldGapDots = 4
  private static let progressBoldOffsetDots = 1
  private static let progressFieldWidthChars = 24
  // Homashyo split yorlig'i: kattaroq matn (kFNT_24_32) va kattaroq QR.
  // 16 char/en = 400 dot ichiga sig'adi, qator balandligi 36 dot.
  private static let splitTextCharWidthDots = 24
  private static let splitTextLineHeightDots = 36
  private static let splitFieldWidthChars = 16
  private static let splitQrBaseY = 250
  // FNT_12_20 is rendered slightly wider by XP-P323B than its name
  // suggests. Use a conservative width estimate for wrapping. The
  // actual field line is emitted as one string so the printer itself
  // owns the single-space separation after the colon.
  private static let qolipFieldCharWidthDots = 16
  private static let qolipFieldLineHeightDots = 24
  private static let qolipFieldTopY = 24
  private static let qolipFieldRowGapDots = 8
  private static let qolipFieldQrGapDots = 16
  private static let largeQrFooterGapDots = 28
  private static let largeQrFooterLeftShiftDots = 16
  private static let largeQrFooterHeightDots = 24
  private static let qrAlphanumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
  private static let labelCodePage = "0"

  private let bleManager: XBLEManager

  private var discoveredPeripherals: [String: CBPeripheral] = [:]
  private var scanResult: PrinterResult?
  private var scanWorkItem: DispatchWorkItem?
  private var discoveryEventSink: PrinterEventSink?
  private var discoveryWorkItem: DispatchWorkItem?
  private var activeDiscoverySession: Int64?

  private var printJob: PrintJob?
  private var printWorkItem: DispatchWorkItem?
  private var writeReadyWorkItem: DispatchWorkItem?
  private var writeReadyDeadline: Date?
  private var nextPeripheral: CBPeripheral?
  private var printBusy = false
  private var sendStarted = false

  override init() {
    bleManager = XBLEManager.sharedInstance()
    super.init()
    bleManager.delegate = self
  }

  deinit {
    scanWorkItem?.cancel()
    printWorkItem?.cancel()
    writeReadyWorkItem?.cancel()
    discoveryWorkItem?.cancel()
    bleManager.stopScan()
    bleManager.removeDelegate(self)
  }

  func onListen(
    withArguments arguments: Any?,
    eventSink events: @escaping PrinterEventSink
  ) -> PrinterError? {
    let session = discoverySession(from: arguments)
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }
      self.activeDiscoverySession = session
      self.discoveryEventSink = events
      self.discoveredPeripherals.removeAll(keepingCapacity: true)
      self.discoveryWorkItem?.cancel()

      if self.bleManager.isConnected,
         let connectedPeripheral = self.bleManager.writePeripheral,
         self.isXpP323b(self.printerName(connectedPeripheral)) {
        self.handleDiscoveredPrinter(connectedPeripheral)
      }

      if self.printJob == nil {
        self.bleManager.stopScan()
        self.bleManager.startScan()
      }

      let workItem = DispatchWorkItem { [weak self] in
        self?.finishDiscoveryStream(session: session)
      }
      self.discoveryWorkItem = workItem
      DispatchQueue.main.asyncAfter(
        deadline: .now() + Self.scanTimeout,
        execute: workItem
      )
    }
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> PrinterError? {
    let session = discoverySession(from: arguments)
    DispatchQueue.main.async { [weak self] in
      guard let self, self.activeDiscoverySession == session else {
        return
      }
      self.activeDiscoverySession = nil
      self.discoveryEventSink = nil
      self.discoveryWorkItem?.cancel()
      self.discoveryWorkItem = nil
      if self.printJob == nil {
        self.bleManager.stopScan()
      }
    }
    return nil
  }

  func handle(call: PrinterMethodCall, result: @escaping PrinterResult) {
    switch call.method {
    case "pairedPrinters":
      pairedPrinters(result: result)
    case "printLabel":
      guard let arguments = call.arguments as? [String: Any] else {
        result(PrinterError(
          code: "bluetooth_print_invalid_payload",
          message: "XP-P323B label payload is invalid",
          details: nil
        ))
        return
      }
      printLabel(arguments: arguments, result: result)
    default:
      result(PrinterMethodNotImplemented)
    }
  }

  private func pairedPrinters(result: @escaping PrinterResult) {
    guard scanResult == nil else {
      result(PrinterError(
        code: "bluetooth_scan_busy",
        message: "Bluetooth printer scan is already in progress",
        details: nil
      ))
      return
    }

    discoveredPeripherals.removeAll(keepingCapacity: true)
    scanResult = result
    scanWorkItem?.cancel()

    let workItem = DispatchWorkItem { [weak self] in
      self?.finishScan()
    }
    scanWorkItem = workItem
    bleManager.startScan()
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.scanTimeout, execute: workItem)
  }

  private func finishScan() {
    guard let result = scanResult else {
      return
    }
    scanResult = nil
    scanWorkItem?.cancel()
    scanWorkItem = nil
    bleManager.stopScan()

    let printers = discoveredPeripherals.values
      .sorted { printerName($0) < printerName($1) }
      .map { peripheral in
        [
          "name": printerName(peripheral),
          "address": peripheral.identifier.uuidString,
        ]
      }
    result(printers)
  }

  private func finishDiscoveryStream(session: Int64) {
    guard activeDiscoverySession == session,
          let eventSink = discoveryEventSink else {
      return
    }
    discoveryWorkItem = nil
    if printJob == nil {
      bleManager.stopScan()
    }
    eventSink(["type": "complete"])
  }

  private func printLabel(arguments: [String: Any], result: @escaping PrinterResult) {
    guard !printBusy else {
      result(PrinterError(
        code: "bluetooth_printer_busy",
        message: "XP-P323B print is already in progress",
        details: nil
      ))
      return
    }

    let address = string(arguments["mac_address"])
    guard !address.isEmpty else {
      result(PrinterError(
        code: "bluetooth_printer_not_selected",
        message: "XP-P323B printer is not selected",
        details: nil
      ))
      return
    }
    guard let label = BluetoothLabelRequest(arguments: arguments) else {
      result(PrinterError(
        code: "bluetooth_print_invalid_payload",
        message: "XP-P323B label payload is invalid",
        details: nil
      ))
      return
    }

    printBusy = true
    printJob = PrintJob(address: normalize(address), label: label, result: result)
    sendStarted = false
    writeReadyDeadline = Date().addingTimeInterval(Self.writeCharacteristicTimeout)
    printWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      self?.finishPrintError(
        code: "bluetooth_print_timeout",
        message: "XP-P323B Bluetooth connection or write timed out"
      )
    }
    printWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.printTimeout, execute: workItem)

    if let peripheral = discoveredPeripherals[normalize(address)] {
      connect(to: peripheral)
      return
    }

    if let peripheral = bleManager.writePeripheral,
       normalize(peripheral.identifier.uuidString) == normalize(address),
       bleManager.isConnected {
      waitForWriteCharacteristic()
      return
    }

    // iOS does not expose Android-style bonded-device MAC addresses. The
    // Flutter profile carries the CoreBluetooth UUID returned by this scan.
    bleManager.startScan()
  }

  private func connect(to peripheral: CBPeripheral) {
    guard let job = printJob else {
      return
    }

    if bleManager.isConnected,
       let connected = bleManager.writePeripheral,
       connected.identifier == peripheral.identifier {
      waitForWriteCharacteristic()
      return
    }

    if bleManager.isConnected {
      nextPeripheral = peripheral
      bleManager.disconnectRootPeripheral()
      return
    }

    if normalize(peripheral.identifier.uuidString) == job.address {
      bleManager.connectDevice(peripheral)
    } else {
      finishPrintError(
        code: "bluetooth_printer_not_found",
        message: "Selected XP-P323B printer was not found"
      )
    }
  }

  private func sendPendingPrint() {
    guard let job = printJob, !sendStarted else {
      return
    }
    guard hasWriteCharacteristic else {
      waitForWriteCharacteristic()
      return
    }
    guard let peripheral = bleManager.writePeripheral else {
      finishPrintError(
        code: "bluetooth_connect_failed",
        message: "XP-P323B Bluetooth peripheral is not connected"
      )
      return
    }

    sendStarted = true

    do {
      let data = try buildLabelCommand(job.label)
      let packageSize = max(
        peripheral.maximumWriteValueLength(for: .withoutResponse),
        20
      )

      bleManager.send(data, withPackageSize: UInt(packageSize)) { [weak self] success, _, _, progress, error in
        DispatchQueue.main.async {
          guard let self, self.printJob != nil else {
            return
          }
          if success && progress >= 1 {
            self.finishPrintSuccess(bytes: data.count, peripheral: peripheral)
          } else if !success {
            self.finishPrintError(
              code: "bluetooth_send_failed",
              message: error?.localizedDescription ?? "XP-P323B Bluetooth write failed"
            )
          }
        }
      }
    } catch {
      finishPrintError(code: "bluetooth_print_failed", message: error.localizedDescription)
    }
  }

  private var hasWriteCharacteristic: Bool {
    guard bleManager.isConnected,
          bleManager.writePeripheral != nil,
          let characteristic = bleManager.write_characteristic else {
      return false
    }
    return characteristic.properties.contains(.write) ||
      characteristic.properties.contains(.writeWithoutResponse)
  }

  private func waitForWriteCharacteristic() {
    guard printJob != nil, !sendStarted else {
      return
    }

    writeReadyWorkItem?.cancel()
    writeReadyWorkItem = nil

    if hasWriteCharacteristic {
      sendPendingPrint()
      return
    }

    guard let deadline = writeReadyDeadline, Date() < deadline else {
      finishPrintError(
        code: "bluetooth_connect_failed",
        message: "XP-P323B Bluetooth write characteristic was not ready"
      )
      return
    }

    let workItem = DispatchWorkItem { [weak self] in
      self?.waitForWriteCharacteristic()
    }
    writeReadyWorkItem = workItem
    DispatchQueue.main.asyncAfter(
      deadline: .now() + Self.writeCharacteristicPollInterval,
      execute: workItem
    )
  }

  private func finishPrintSuccess(bytes: Int, peripheral: CBPeripheral) {
    guard let job = printJob else {
      return
    }
    printWorkItem?.cancel()
    printWorkItem = nil
    writeReadyWorkItem?.cancel()
    writeReadyWorkItem = nil
    writeReadyDeadline = nil
    printJob = nil
    sendStarted = false
    let response: [String: Any] = [
      "ok": true,
      "status": "done",
      "bytes": bytes,
      "deviceName": printerName(peripheral),
      "address": peripheral.identifier.uuidString,
      "label_count": job.label.printCount,
      "printer_status": "Bluetooth OK",
    ]
    let settleDelay = Self.printSettlePerLabel * Double(max(1, job.label.printCount))
    DispatchQueue.main.asyncAfter(deadline: .now() + settleDelay) { [weak self] in
      self?.printBusy = false
      job.result(response)
    }
  }

  private func finishPrintError(code: String, message: String) {
    guard let job = printJob else {
      return
    }
    printWorkItem?.cancel()
    printWorkItem = nil
    writeReadyWorkItem?.cancel()
    writeReadyWorkItem = nil
    writeReadyDeadline = nil
    printJob = nil
    nextPeripheral = nil
    printBusy = false
    sendStarted = false
    if bleManager.isConnected {
      bleManager.disconnectRootPeripheral()
    }
    job.result(PrinterError(code: code, message: message, details: nil))
  }

  private func buildLabelCommand(_ label: BluetoothLabelRequest) throws -> Data {
    var command: XTSPLCommand? = XTSPLCommand()
    command = command?.setCharEncoding(String.Encoding.ascii.rawValue)
    command = command?.sizeMm(
      label.usesCompactLabel ? Self.compactLabelWidthMm : Self.labelWidthMm,
      height: label.usesCompactLabel ? Self.compactLabelHeightMm : Self.labelHeightMm
    )
    command = command?.speed(4.0)
    let printDensity = label.labelKind == "material_product"
      ? Self.materialPrintDensity
      : Self.defaultPrintDensity
    command = command?.density(printDensity)
    command = command?.referenceAt(
      x: label.usesCompactLabel ? Self.compactLabelReferenceXDots : Self.labelReferenceXDots,
      y: Int32(0)
    )
    command = command?.cls()
    command = command?.codePage(Self.labelCodePage)

    switch label.labelKind {
    case "qolip_cell", "qr_center":
      command = appendQolipCell(command, label: label)
    case "paddon_code":
      command = appendPaddonLabel(command, label: label)
    case "qolip_code", "material_product":
      // Homashyo rezkachisi split chiqishi WIP uslubida (kichik o'ng-past
      // QR). Uzunliksiz generic material_product eski katta markaziy QR da.
      if label.isMaterialSplit {
        command = try appendMaterialSplitLabel(command, label: label)
      } else {
        command = try appendLargeQr(command, label: label)
      }
    default:
      command = appendPackLabel(command, label: label)
    }

    command = command?.print(Int32(label.printCount), n: 1, taskId: UUID().uuidString)
    guard let data = command?.getCommand(), !data.isEmpty else {
      throw PrintError.commandGenerationFailed
    }
    return data
  }


  private func appendQolipCell(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) -> XTSPLCommand? {
    let name = cleanLabelText(label.itemName.isEmpty ? label.itemCode : label.itemName)
    let payload = requiredPayload(label.epc)
    let title = fitLabelText(name, maxLength: 33)
    var result = text(
      command, x: (Self.compactLabelWidthDots - title.count * 16) / 2,
      y: Self.compactLabelMarginDots, font: kFNT_16_24, value: title
    )
    if label.materialDataMatrix {
      return materialDataMatrixRow(
        result, y: (Self.compactLabelHeightDots - Self.materialDataMatrixSizeDots) / 2,
        bars: label.materialDataMatrixBars,
        xOffset: (Self.compactLabelWidthDots - Self.labelWidthDots) / 2
      )
    }
    let modules = qrModuleCount(payload)
    let cellWidth = max(2, min(
      largeQrCellWidth(payload),
      (Self.compactLabelHeightDots - 2 * Self.compactLabelMarginDots - 40) / modules
    ))
    let qrSize = modules * cellWidth
    result = qr(
      result, x: (Self.compactLabelWidthDots - qrSize) / 2,
      y: max(48, (Self.compactLabelHeightDots - qrSize) / 2),
      value: payload, cellWidth: cellWidth
    )
    return result
  }


  private func appendLargeQr(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) throws -> XTSPLCommand? {
    let product = label.itemName.isEmpty ? label.itemCode : label.itemName
    let unit = cleanLabelText(label.unit.isEmpty ? "kg" : label.unit)
    var fields: [(String, String)]
    if label.labelKind == "qolip_code" {
      fields = [("MIJOZ", label.customerName), ("MAHSULOT NOMI", product),
                ("QOLIP RANGI", label.qolipColor)]
    } else {
      fields = [("MAHSULOT", product)]
      if label.tareEnabled {
        fields += [("BRUTTO", "\(compactLabelQty(label.grossQty)) \(unit)"),
                   ("NETTO", "\(compactLabelQty(label.netQty)) \(unit)")]
      } else {
        fields.append(("NET VAZNI", "\(compactLabelQty(label.netQty)) \(unit)"))
      }
    }
    return try appendCompactFieldsLabel(command, label: label, fields: fields)
  }

  private func appendCompactFieldsLabel(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest,
    fields: [(String, String)],
    largeText: Bool = false
  ) throws -> XTSPLCommand? {
    let payload = requiredPayload(label.epc)
    let footer = label.labelKind == "qolip_code" ? "EPC: \(payload)" : payload
    let footerIsLarge = footer.count <= 32
    let footerCharWidth = footerIsLarge ? 12 : 8
    let footerLineHeight = footerIsLarge ? 24 : 16
    let footerFont = footerIsLarge ? kFNT_12_20 : kFNT_8_12
    let footerLines = wrapLabelText(
      footer, width: (Self.compactLabelWidthDots - 2 * Self.compactLabelMarginDots) / footerCharWidth
    )
    let useDataMatrix = ["material_product", "qolip_code"].contains(label.labelKind) &&
      label.materialDataMatrix
    var cellWidth = max(2, min(largeQrCellWidth(payload), 174 / qrModuleCount(payload)))
    var styles: [(font: String, charWidth: Int, lineHeight: Int)] = []
    if largeText { styles.append((kFNT_24_32, 24, 36)) }
    styles += [(kFNT_16_24, 16, 28), (kFNT_8_12, 8, 16)]
    var selected: (style: (font: String, charWidth: Int, lineHeight: Int), lines: [[String]])?
    var codeSize = 0
    var latestCodeY = 0
    while selected == nil {
      codeSize = useDataMatrix ? Self.materialDataMatrixSizeDots
        : qrSymbolSizeDots(payload, cellWidth: cellWidth)
      latestCodeY = Self.compactLabelHeightDots - Self.compactLabelMarginDots -
        footerLines.count * footerLineHeight - Self.progressPackEpcGapDots - codeSize
      let availableHeight = latestCodeY - Self.compactLabelMarginDots - Self.qolipFieldQrGapDots
      for style in styles {
        let width = (Self.compactLabelWidthDots - Self.compactLabelTextXDots -
          Self.compactLabelMarginDots - Self.progressBoldOffsetDots) / style.charWidth
        let lines = fields.map { name, value in
          let cleaned = cleanLabelText(value)
          return wrapLabelText("\(name): \(cleaned.isEmpty ? "-" : cleaned)", width: width)
        }
        if lines.reduce(0, { $0 + $1.count }) * style.lineHeight +
            (fields.count - 1) * Self.progressFieldGapDots <= availableHeight {
          selected = (style, lines)
          break
        }
      }
      if selected != nil || useDataMatrix || cellWidth <= 2 { break }
      cellWidth -= 1
    }
    guard let selected else { throw PrintError.labelTextDoesNotFit }
    var result = command
    var y = Self.compactLabelMarginDots
    for (fieldIndex, lines) in selected.lines.enumerated() {
      result = appendProgressLines(
        result, lines: lines, y: y, lineHeight: selected.style.lineHeight,
        font: selected.style.font, charWidth: selected.style.charWidth
      )
      y += lines.count * selected.style.lineHeight +
        (fieldIndex == fields.count - 1 ? 0 : Self.progressFieldGapDots)
    }
    let codeY = min(latestCodeY, max(y + Self.qolipFieldQrGapDots, latestCodeY - 16))
    if useDataMatrix {
      result = materialDataMatrixRow(
        result, y: codeY, bars: label.materialDataMatrixBars,
        xOffset: (Self.compactLabelWidthDots - Self.labelWidthDots) / 2
      )
    } else {
      result = qr(
        result, x: (Self.compactLabelWidthDots - codeSize) / 2,
        y: codeY, value: payload, cellWidth: cellWidth
      )
    }
    for (index, line) in footerLines.enumerated() {
      result = text(
        result, x: (Self.compactLabelWidthDots - line.count * footerCharWidth) / 2,
        y: codeY + codeSize + Self.progressPackEpcGapDots + index * footerLineHeight,
        font: footerFont, value: line
      )
    }
    return result
  }

  private func appendPackLabel(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) -> XTSPLCommand? {
    if label.isProgress {
      return appendProgressPackLabel(command, label: label)
    }
    let payload = requiredPayload(label.epc)
    let product = cleanLabelText(label.itemName.isEmpty ? label.itemCode : label.itemName)
    let productLines = wrapLabelText(product, width: 24).prefix(3)
    let quantityUnit = cleanLabelText(
      label.isProgress && !label.progressUnit.isEmpty
        ? label.progressUnit
        : (label.unit.isEmpty ? "kg" : label.unit)
    )
    let grossUnit = cleanLabelText(label.unit.isEmpty ? "kg" : label.unit)
    let quantityLabel = label.isProgress ? "METRAJ" : "NETTO"
    let quantity = label.isProgress ? (label.progressQty ?? label.netQty) : label.netQty

    var result = text(
      command,
      x: Self.labelLeftMarginDots,
      y: 4,
      font: kFNT_16_24,
      value: "ACCORD"
    )
    for (index, line) in productLines.enumerated() {
      result = text(
        result,
        x: Self.labelLeftMarginDots,
        y: 34 + index * 24,
        font: kFNT_12_20,
        value: line
      )
    }
    result = text(
      result,
      x: Self.labelLeftMarginDots,
      y: 112,
      font: kFNT_12_20,
      value: "\(quantityLabel): \(formatLabelQty(quantity)) \(quantityUnit)"
    )
    result = text(
      result,
      x: Self.labelLeftMarginDots,
      y: 138,
      font: kFNT_12_20,
      value: "BRUTTO: \(formatLabelQty(label.grossQty)) \(grossUnit)"
    )
    result = qr(
      result,
      x: Self.packQrX,
      y: Self.packQrY,
      value: payload,
      cellWidth: packQrCellWidth(payload)
    )
    let epcIsLarge = payload.count <= 32
    let epcFont = epcIsLarge ? kFNT_12_20 : kFNT_8_12
    let epcText = fitLabelText(payload, maxLength: epcIsLarge ? 32 : 46)
    result = text(
      result,
      x: centeredLabelX(
        epcText,
        charWidth: epcIsLarge ? 12 : 8
      ),
      y: Self.packEpcY,
      font: epcFont,
      value: epcText
    )
    return result
  }

  private func appendMaterialSplitLabel(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) throws -> XTSPLCommand? {
    let unit = cleanLabelText(label.unit.isEmpty ? "kg" : label.unit)
    let meterUnit = cleanLabelText(label.progressUnit.isEmpty ? "m" : label.progressUnit)
    var fields = [
      ("HOMASHYO", label.itemName.isEmpty ? label.itemCode : label.itemName),
      ("BRUTTO", "\(formatLabelQty(label.grossQty)) \(unit)"),
      ("NETTO", "\(formatLabelQty(label.netQty)) \(unit)")
    ]
    if let length = label.progressQty, length.isFinite && length > 0 {
      fields.append(("METRAJ", "\(formatLabelQty(length)) \(meterUnit)"))
    }
    if !label.manufacturerName.isEmpty {
      fields.append(("ISHLAB CHIQARUVCHI", label.manufacturerName))
    }
    return try appendCompactFieldsLabel(command, label: label, fields: fields)
  }

  private func splitQrCellWidth(_ value: String) -> Int {
    min(packQrCellWidth(value) + 1, 6)
  }

  private func splitFieldLines(
    _ fieldLabel: String,
    value: String,
    maxLines: Int
  ) -> [String] {
    Array(
      wrapLabelText(
        "\(fieldLabel): \(value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "-" : value)",
        width: Self.splitFieldWidthChars
      ).prefix(max(1, maxLines))
    )
  }

  private func appendSplitLines(
    _ command: XTSPLCommand?,
    lines: [String],
    y: Int
  ) -> XTSPLCommand? {
    var result = command
    for (index, line) in lines.enumerated() {
      result = appendSplitStyledLine(
        result,
        line: line,
        y: y + index * Self.splitTextLineHeightDots
      )
    }
    return result
  }

  private func appendSplitStyledLine(
    _ command: XTSPLCommand?,
    line: String,
    y: Int
  ) -> XTSPLCommand? {
    guard let separator = line.firstIndex(of: ":") else {
      return appendBoldText(
        command,
        x: Self.labelLeftMarginDots,
        y: y,
        value: line,
        font: kFNT_24_32
      )
    }
    let labelEnd = line.index(after: separator)
    let labelPart = String(line[..<labelEnd])
    let valuePart = String(line[line.index(after: separator)...])
      .trimmingCharacters(in: .whitespacesAndNewlines)
    var result = text(
      command,
      x: Self.labelLeftMarginDots,
      y: y,
      font: kFNT_24_32,
      value: labelPart
    )
    if !valuePart.isEmpty {
      result = appendBoldText(
        result,
        x: Self.labelLeftMarginDots +
          (labelPart.count + 1) * Self.splitTextCharWidthDots,
        y: y,
        value: valuePart,
        font: kFNT_24_32
      )
    }
    return result
  }

  private func appendPaddonLabel(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) -> XTSPLCommand? {
    let payload = requiredPayload(label.epc)
    let titleLines = largeQrTitleLines(
      label,
      rawTitle: label.itemName.isEmpty ? label.itemCode : label.itemName
    )
    var lines = titleLines.flatMap { wrapLabelText($0, width: Self.progressFieldWidthChars) }
    let availableHeight = progressCodeY(label, payload: payload) - 8 - Self.progressTextTopY
    var fontHeight = lines.count * 24 <= availableHeight ? 24 : 20
    if lines.count * fontHeight > availableHeight {
      lines = titleLines.flatMap { wrapLabelText($0, width: 46) }
      fontHeight = 12
    }
    guard lines.count * fontHeight <= availableHeight else {
      return nil
    }
    let font = fontHeight == 24 ? kFNT_16_24 : (fontHeight == 20 ? kFNT_12_20 : kFNT_8_12)
    let lineHeight = min(
      (availableHeight - fontHeight) / max(1, lines.count - 1),
      fontHeight + Self.progressFieldGapDots
    )
    var result = command
    for (index, line) in lines.enumerated() {
      result = appendBoldText(
        result,
        x: Self.labelLeftMarginDots,
        y: Self.progressTextTopY + index * lineHeight,
        value: line,
        font: font
      )
    }
    return appendProgressQr(result, label: label)
  }

  private func appendProgressPackLabel(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest
  ) -> XTSPLCommand? {
    var result = command
    for line in label.progressLines {
      let font = line.font == "large" ? kFNT_16_24 : (line.font == "medium" ? kFNT_12_20 : kFNT_8_12)
      result = appendProgressStyledLine(
        result, line: line.text, y: line.y, font: font, charWidth: line.charWidth
      )
    }
    return appendProgressQr(result, label: label, codeY: label.progressCodeY, epcGap: 8)
  }

  private func progressEpcY(_ payload: String) -> Int {
    let qrSize = qrSymbolSizeDots(payload, cellWidth: packQrCellWidth(payload))
    return min(
      Self.labelHeightDots - 24,
      Self.progressPackQrY + qrSize + Self.progressPackEpcGapDots
    )
  }

  private func progressLayoutPayload(_ label: BluetoothLabelRequest, payload: String) -> String {
    let prefix = "qolip-paddon:"
    guard label.materialDataMatrix, label.labelKind == "paddon_code",
      payload.lowercased().hasPrefix(prefix) else {
      return payload
    }
    let code = String(payload.dropFirst(prefix.count))
    let digits = code.dropFirst(3)
    // Position from the pallet number, while printing the complete typed payload.
    if code.uppercased().hasPrefix("QP-"), !digits.isEmpty,
      digits.allSatisfy({ $0 >= "0" && $0 <= "9" }) {
      return String(digits)
    }
    return code.isEmpty ? payload : code
  }

  private func progressCodeY(_ label: BluetoothLabelRequest, payload: String) -> Int {
    label.materialDataMatrix
      ? progressEpcY(progressLayoutPayload(label, payload: payload)) -
        Self.progressPackEpcGapDots - Self.materialDataMatrixSizeDots
      : Self.progressPackQrY
  }

  // WIP places its codes after the fields; pallet labels use the default position.
  private func appendProgressQr(
    _ command: XTSPLCommand?,
    label: BluetoothLabelRequest,
    codeY: Int? = nil,
    epcGap: Int = 16
  ) -> XTSPLCommand? {
    var result = command
    let payload = requiredPayload(label.epc)
    let qrCellWidth = packQrCellWidth(payload)
    let qrY = codeY ?? progressCodeY(label, payload: payload)
    let matrixRowWidth = Self.materialDataMatrixCount * Self.materialDataMatrixSizeDots +
      (Self.materialDataMatrixCount - 1) * Self.materialDataMatrixGapDots
    let matrixStartX = (Self.labelWidthDots - matrixRowWidth) / 2
    let xOffset = label.isProgress
      ? label.progressCodeX - matrixStartX
      : 0
    let codeSize = label.materialDataMatrix
      ? Self.materialDataMatrixSizeDots
      : qrSymbolSizeDots(payload, cellWidth: qrCellWidth)
    let epcY = codeY == nil
      ? progressEpcY(progressLayoutPayload(label, payload: payload))
      : qrY + codeSize + epcGap
    if label.materialDataMatrix {
      result = materialDataMatrixRow(
        result,
        y: qrY,
        bars: label.materialDataMatrixBars,
        xOffset: xOffset
      )
    } else {
      result = qr(
        result,
        x: Self.progressPackQrX + xOffset,
        y: qrY,
        value: payload,
        cellWidth: qrCellWidth
      )
    }
    let epcIsLarge = payload.count <= 32
    let epcFont = epcIsLarge ? kFNT_12_20 : kFNT_8_12
    let epcText = fitLabelText(payload, maxLength: epcIsLarge ? 32 : 46)
    result = text(
      result,
      x: label.isProgress && label.materialDataMatrix
        ? label.progressCodeX
        : centeredLabelX(epcText, charWidth: epcIsLarge ? 12 : 8) + xOffset,
      y: epcY,
      font: epcFont,
      value: epcText
    )
    return result
  }

  private func appendProgressLines(
    _ command: XTSPLCommand?,
    lines: [String],
    y: Int,
    lineHeight: Int,
    font: String,
    charWidth: Int
  ) -> XTSPLCommand? {
    var result = command
    for (index, line) in lines.enumerated() {
      result = appendProgressStyledLine(
        result,
        line: line,
        y: y + index * lineHeight,
        font: font,
        charWidth: charWidth
      )
    }
    return result
  }

  private func appendProgressStyledLine(
    _ command: XTSPLCommand?,
    line: String,
    y: Int,
    font: String,
    charWidth: Int
  ) -> XTSPLCommand? {
    guard let separator = line.firstIndex(of: ":") else {
      return appendBoldText(
        command,
        x: Self.compactLabelTextXDots,
        y: y,
        value: line,
        font: font
      )
    }
    let labelEnd = line.index(after: separator)
    let labelPart = String(line[..<labelEnd])
    let valuePart = String(line[line.index(after: separator)...])
      .trimmingCharacters(in: .whitespacesAndNewlines)
    var result = text(
      command,
      x: Self.compactLabelTextXDots,
      y: y,
      font: font,
      value: labelPart
    )
    if !valuePart.isEmpty {
      result = appendBoldText(
        result,
        x: Self.compactLabelTextXDots +
          (labelPart.count + 1) * charWidth,
        y: y,
        value: valuePart,
        font: font
      )
    }
    return result
  }

  private func appendBoldText(
    _ command: XTSPLCommand?,
    x: Int,
    y: Int,
    value: String,
    font: String = kFNT_16_24
  ) -> XTSPLCommand? {
    var result = text(command, x: x, y: y, font: font, value: value)
    result = text(
      result,
      x: x + Self.progressBoldOffsetDots,
      y: y,
      font: font,
      value: value
    )
    return result
  }

  private func appendQolipField(
    _ command: XTSPLCommand?,
    y: Int,
    fieldLabel: String,
    value: String
  ) -> (command: XTSPLCommand?, nextY: Int) {
    let labelPart = "\(fieldLabel): "
    let normalizedValue = cleanLabelText(value)
    let displayValue = normalizedValue.isEmpty ? "-" : normalizedValue
    let fullLineChars = max(
      1,
      (Self.labelWidthDots - Self.labelLeftMarginDots - Self.labelRightMarginDots) /
        Self.qolipFieldCharWidthDots
    )
    let inlineFits = displayValue.count + labelPart.count <= fullLineChars
    let valueLines = wrapLabelText(displayValue, width: fullLineChars)
    var result = command
    if inlineFits {
      result = text(
        result,
        x: Self.labelLeftMarginDots,
        y: y,
        font: kFNT_12_20,
        value: "\(labelPart)\(displayValue)"
      )
    } else {
      result = text(
        result,
        x: Self.labelLeftMarginDots,
        y: y,
        font: kFNT_12_20,
        value: labelPart
      )
      for (index, line) in valueLines.enumerated() {
        result = appendBoldText(
          result,
          x: Self.labelLeftMarginDots,
          y: y + Self.qolipFieldLineHeightDots * (index + 1),
          value: line,
          font: kFNT_12_20
        )
      }
    }
    let lineCount = inlineFits ? 1 : valueLines.count + 1
    return (
      command: result,
      nextY: y + Self.qolipFieldLineHeightDots * lineCount +
        Self.qolipFieldRowGapDots
    )
  }

  private func qolipFieldsEndY(
    _ label: BluetoothLabelRequest,
    rawTitle: String
  ) -> Int {
    var y = Self.qolipFieldTopY
    y = qolipFieldNextY(y, fieldLabel: "MIJOZ", value: label.customerName)
    y = qolipFieldNextY(y, fieldLabel: "MAHSULOT NOMI", value: rawTitle)
    return qolipFieldNextY(y, fieldLabel: "QOLIP RANGI", value: label.qolipColor)
  }

  private func qolipFieldNextY(
    _ y: Int,
    fieldLabel: String,
    value: String
  ) -> Int {
    let labelPart = "\(fieldLabel): "
    let normalizedValue = cleanLabelText(value)
    let displayValue = normalizedValue.isEmpty ? "-" : normalizedValue
    let fullLineChars = max(
      1,
      (Self.labelWidthDots - Self.labelLeftMarginDots - Self.labelRightMarginDots) /
        Self.qolipFieldCharWidthDots
    )
    let inlineFits = displayValue.count + labelPart.count <= fullLineChars
    let valueLineCount = inlineFits
      ? 1
      : wrapLabelText(displayValue, width: fullLineChars).count + 1
    return y + Self.qolipFieldLineHeightDots * valueLineCount +
      Self.qolipFieldRowGapDots
  }

  private func text(
    _ command: XTSPLCommand?,
    x: Int,
    y: Int,
    font: String,
    value: String
  ) -> XTSPLCommand? {
    command?.textAt(
      x: Int32(x),
      y: Int32(y),
      font: font,
      rotation: .rotation0,
      xRatio: 1,
      yRatio: 1,
      content: cleanLabelText(value)
    )
  }

  private func qr(
    _ command: XTSPLCommand?,
    x: Int,
    y: Int,
    value: String,
    cellWidth: Int
  ) -> XTSPLCommand? {
    command?.qrCodeAt(
      x: Int32(x),
      andY: Int32(y),
      ecLevel: kECLevelH,
      cellWidth: Int32(cellWidth),
      mode: kQRCodeModeAuto,
      rotation: .rotation0,
      content: value
    )
  }

  private func materialDataMatrixRow(
    _ command: XTSPLCommand?,
    y: Int,
    bars: [[Double]],
    xOffset: Int = 0
  ) -> XTSPLCommand? {
    let rowWidth = Self.materialDataMatrixCount * Self.materialDataMatrixSizeDots +
      (Self.materialDataMatrixCount - 1) * Self.materialDataMatrixGapDots
    let startX = (Self.labelWidthDots - rowWidth) / 2 + xOffset
    var result = command
    for index in 0..<Self.materialDataMatrixCount {
      result = dataMatrix(
        result,
        x: startX + index * (Self.materialDataMatrixSizeDots + Self.materialDataMatrixGapDots),
        y: y,
        bars: bars,
        sizeDots: Self.materialDataMatrixSizeDots
      )
    }
    return result
  }

  private func dataMatrix(
    _ command: XTSPLCommand?,
    x: Int,
    y: Int,
    bars: [[Double]],
    sizeDots: Int
  ) -> XTSPLCommand? {
    // Explicit dot bounds keep firmware from auto-sizing the ECC 200 symbol.
    var result = command
    for bar in bars {
      let left = Int((bar[0] * Double(sizeDots)).rounded())
      let top = Int((bar[1] * Double(sizeDots)).rounded())
      let right = Int((bar[2] * Double(sizeDots)).rounded())
      let bottom = Int((bar[3] * Double(sizeDots)).rounded())
      result = result?.barAt(
        x: Int32(x + left), andY: Int32(y + top),
        width: Int32(right - left), height: Int32(bottom - top)
      )
    }
    return result
  }

  private func requiredPayload(_ value: String) -> String {
    let payload = cleanLabelText(value)
    return payload.isEmpty ? "?" : payload
  }

  private func largeQrCellWidth(_ value: String) -> Int {
    if value.count <= 32 {
      return 8
    }
    if value.count <= 46 {
      return 7
    }
    return 6
  }

  private func materialQrCellWidth(_ value: String) -> Int {
    min(largeQrCellWidth(value) + 1, 9)
  }

  private func centeredQrX(_ value: String, cellWidth: Int) -> Int {
    let qrSize = qrSymbolSizeDots(value, cellWidth: cellWidth)
    return max(0, (Self.labelWidthDots - qrSize) / 2)
  }

  private func centeredQrY(_ value: String, cellWidth: Int) -> Int {
    let qrSize = qrSymbolSizeDots(value, cellWidth: cellWidth)
    return max(0, (Self.labelHeightDots - qrSize) / 2)
  }

  private func qrSymbolSizeDots(_ value: String, cellWidth: Int) -> Int {
    qrModuleCount(value) * cellWidth
  }

  private func qrModuleCount(_ value: String) -> Int {
    let normalized = value.uppercased()
    let dataLength = normalized.utf8.count
    let isNumeric = normalized.unicodeScalars.allSatisfy { scalar in
      scalar.value >= 48 && scalar.value <= 57
    }
    let isAlphanumeric = normalized.allSatisfy {
      Self.qrAlphanumeric.contains($0)
    }
    let capacities: [Int]
    if isNumeric {
      capacities = [17, 34, 58, 82, 106, 139, 154, 202, 235, 288]
    } else if isAlphanumeric {
      capacities = [10, 20, 35, 50, 64, 84, 93, 122, 143, 174]
    } else {
      capacities = [7, 14, 24, 34, 44, 58, 64, 84, 98, 119]
    }
    let versionIndex = capacities.firstIndex(where: { dataLength <= $0 }) ??
      (capacities.count - 1)
    return 21 + versionIndex * 4
  }

  private func centeredQrFooterY(qrY: Int, qrSize: Int) -> Int {
    min(
      qrY + qrSize + Self.largeQrFooterGapDots,
      Self.labelHeightDots - Self.largeQrFooterHeightDots
    )
  }

  private func packQrCellWidth(_ value: String) -> Int {
    value.count <= 32 ? 5 : 4
  }

  private func largeQrTitleLines(
    _ label: BluetoothLabelRequest,
    rawTitle: String
  ) -> [String] {
    if label.labelKind == "paddon_code" && !label.paddonLabelLines.isEmpty {
      return label.paddonLabelLines.map { cleanLabelText($0) }
    }
    if label.labelKind == "material_product" {
      let productName = cleanLabelText(label.itemName.isEmpty ? label.itemCode : label.itemName)
      let unit = cleanLabelText(label.unit.isEmpty ? "kg" : label.unit)
      let netWeight = compactLabelQty(label.netQty)
      let productLines = label.materialNameLines.isEmpty
        ? wrapLabelText(
            cleanLabelText("MAHSULOT: \(productName)"),
            width: Self.materialTitleWidthChars
          )
        : label.materialNameLines.flatMap {
            wrapLabelText(cleanLabelText($0), width: Self.materialTitleWidthChars)
          }
      let weights = label.tareEnabled
        ? ["BRUTTO: \(compactLabelQty(label.grossQty)) \(unit)",
           "NETTO: \(netWeight) \(unit)"]
        : ["NET VAZNI: \(netWeight) \(unit)"]
      let weightLines = weights.flatMap {
        wrapLabelText(cleanLabelText($0), width: Self.materialTitleWidthChars)
      }
      if label.materialDataMatrix {
        // Reserve the complete code row and footer before placing the name.
        let maxTitleLines = 1 + (Self.labelHeightDots - Self.materialDataMatrixSizeDots -
          Self.largeQrFooterGapDots - Self.largeQrFooterHeightDots -
          Self.materialTitleQrGapDots - Self.materialTitleTopY -
          Self.materialTitleFontHeightDots) / Self.materialTitleLineHeightDots
        return Array(productLines.prefix(max(0, maxTitleLines - weightLines.count))) + weightLines
      }
      return productLines + weightLines
    }
    if label.labelKind == "qolip_code" && !label.customerName.isEmpty {
      return [
        fitLabelText(cleanLabelText(label.customerName), maxLength: 25),
        fitLabelText(cleanLabelText(rawTitle), maxLength: 25)
      ].filter { !$0.isEmpty }
    }
    return Array(wrapLabelText(cleanLabelText(rawTitle), width: 25).prefix(2))
  }

  private func largeQrFooter(_ label: BluetoothLabelRequest, payload: String) -> String {
    if label.labelKind == "material_product" {
      return payload
    }
    if label.labelKind == "qolip_code" {
      return "EPC: \(payload)"
    }
    if label.labelKind == "qolip_code", payload.hasPrefix("RPS-BATCH:") {
      return "BATCH ID: \(payload.dropFirst("RPS-BATCH:".count))"
    }
    return label.itemCode.isEmpty ? payload : label.itemCode
  }

  private func centeredLabelX(_ value: String, charWidth: Int) -> Int {
    let availableWidth = Self.labelWidthDots -
      Self.labelLeftMarginDots - Self.labelRightMarginDots
    let textWidth = min(value.count * charWidth, availableWidth)
    let maxX = Self.labelWidthDots - Self.labelRightMarginDots - textWidth
    return max(
      Self.labelLeftMarginDots,
      min((Self.labelWidthDots - textWidth) / 2, maxX)
    )
  }

  private func cleanLabelText(_ value: String) -> String {
    let replacements = value
      .replacingOccurrences(of: "‘", with: "'")
      .replacingOccurrences(of: "’", with: "'")
      .replacingOccurrences(of: "`", with: "'")
      .replacingOccurrences(of: "\"", with: "'")
      .replacingOccurrences(of: "\n", with: " ")
      .replacingOccurrences(of: "\r", with: " ")
      .replacingOccurrences(of: "\t", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .uppercased(with: Locale(identifier: "en_US_POSIX"))

    return replacements.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }

  private func fitLabelText(_ value: String, maxLength: Int) -> String {
    String(value.prefix(maxLength))
  }

  private func wrapLabelText(_ value: String, width: Int) -> [String] {
    var lines: [String] = []
    var current = ""

    for wordSubstring in value.split(whereSeparator: { $0.isWhitespace }) {
      var rest = String(wordSubstring)
      while rest.count > width {
        if !current.isEmpty {
          lines.append(current)
          current = ""
        }
        lines.append(String(rest.prefix(width)))
        rest = String(rest.dropFirst(width))
      }

      let candidate = current.isEmpty ? rest : "\(current) \(rest)"
      if candidate.count <= width {
        current = candidate
      } else {
        if !current.isEmpty {
          lines.append(current)
        }
        current = rest
      }
    }
    if !current.isEmpty {
      lines.append(current)
    }
    return lines
  }

  private func formatLabelQty(_ value: Double) -> String {
    let rounded = (value * 100).rounded() / 100
    return String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), rounded)
  }

  private func compactLabelQty(_ value: Double) -> String {
    var text = String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), value)
    while text.last == "0" {
      text.removeLast()
    }
    if text.last == "." {
      text.removeLast()
    }
    return text
  }

  private func printerName(_ peripheral: CBPeripheral) -> String {
    let name = peripheral.name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return name.isEmpty ? "XP-P323B" : name
  }

  private func isXpP323b(_ name: String) -> Bool {
    let normalized = name.uppercased().replacingOccurrences(of: "-", with: "")
      .replacingOccurrences(of: "_", with: "").replacingOccurrences(of: " ", with: "")
    return normalized.contains("XPP323B") || normalized.contains("P323B")
  }

  private func normalize(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private func discoverySession(from arguments: Any?) -> Int64 {
    (arguments as? NSNumber)?.int64Value ?? 0
  }

  private func string(_ value: Any?) -> String {
    (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  // MARK: - XBLEManagerDelegate

  func xbleDiscover(
    _ peripheral: CBPeripheral!,
    advertisementData: [AnyHashable: Any]!,
    rssi RSSI: NSNumber!
  ) {
    guard let peripheral else {
      return
    }
    let advertisedName = advertisementData?[CBAdvertisementDataLocalNameKey] as? String
    let peripheralName = printerName(peripheral)
    let isKnownPrinter = isXpP323b(peripheralName) ||
      (advertisedName.map(isXpP323b) ?? false)
    guard isKnownPrinter else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.handleDiscoveredPrinter(peripheral)
    }
  }

  private func handleDiscoveredPrinter(_ peripheral: CBPeripheral) {
    let key = normalize(peripheral.identifier.uuidString)
    let isNew = discoveredPeripherals.updateValue(peripheral, forKey: key) == nil
    if isNew {
      discoveryEventSink?([
        "type": "printer",
        "name": printerName(peripheral),
        "address": peripheral.identifier.uuidString,
      ])
    }
    if let job = printJob,
       job.address == key {
      bleManager.stopScan()
      connect(to: peripheral)
    }
  }

  func xbleConnect(_ peripheral: CBPeripheral!) {
    guard peripheral != nil else {
      finishPrintError(code: "bluetooth_connect_failed", message: "XP-P323B connection returned no peripheral")
      return
    }
    waitForWriteCharacteristic()
  }

  func xbleFail(toConnect peripheral: CBPeripheral!, error: Error!) {
    finishPrintError(
      code: "bluetooth_connect_failed",
      message: error?.localizedDescription ?? "XP-P323B Bluetooth connection failed"
    )
  }

  func xbleDisconnectPeripheral(_ peripheral: CBPeripheral!, error: Error!) {
    if let nextPeripheral {
      self.nextPeripheral = nil
      bleManager.connectDevice(nextPeripheral)
      return
    }
    if printJob != nil {
      finishPrintError(
        code: "bluetooth_print_interrupted",
        message: error?.localizedDescription ?? "XP-P323B Bluetooth connection interrupted"
      )
    }
  }

  func xbleWriteValue(for characteristic: CBCharacteristic!, error: Error!) {
    if let error, printJob != nil {
      finishPrintError(code: "bluetooth_send_failed", message: error.localizedDescription)
    }
  }

  func xbleReceiveValue(for characteristic: CBCharacteristic!, error: Error!) {}

  func xbleCentralManagerDidUpdateState(_ state: Int) {
    switch state {
    case 2:
      failBluetoothOperation(code: "bluetooth_unavailable", message: "iOS Bluetooth is unsupported")
    case 3:
      failBluetoothOperation(code: "bluetooth_permission_denied", message: "Bluetooth permission denied")
    case 4:
      failBluetoothOperation(code: "bluetooth_disabled", message: "iOS Bluetooth is turned off")
    default:
      break
    }
  }

  func xbleTaskState(_ taskID: String!, state: Int32, message: String!, error: Error!) {}

  func xblePrinterState(_ state: Int32, message: String!, error: Error!) {
    if let error, printJob != nil {
      finishPrintError(code: "bluetooth_print_failed", message: error.localizedDescription)
    }
  }

  private func failBluetoothOperation(code: String, message: String) {
    if scanResult != nil {
      let result = scanResult
      scanResult = nil
      scanWorkItem?.cancel()
      scanWorkItem = nil
      result?(PrinterError(code: code, message: message, details: nil))
    }
    if printJob != nil {
      finishPrintError(code: code, message: message)
    }
  }
}

private struct PrintJob {
  let address: String
  let label: BluetoothLabelRequest
  let result: PrinterResult
}

private enum PrintError: LocalizedError {
  case commandGenerationFailed
  case labelTextDoesNotFit

  var errorDescription: String? {
    switch self {
    case .labelTextDoesNotFit:
      return "Label text does not fit the 70 x 50 mm label"
    case .commandGenerationFailed:
      return "XP-P323B TSPL command generation failed"
    }
  }
}

private struct BluetoothProgressLine {
  let text: String
  let y: Int
  let font: String
  let charWidth: Int
}

private struct BluetoothLabelRequest {
  let epc: String
  let itemCode: String
  let itemName: String
  let apparatus: String
  let apparatusDisplayName: String
  let customerName: String
  let manufacturerName: String
  let qolipColor: String
  let grossQty: Double
  let unit: String
  let tareEnabled: Bool
  let tareKg: Double
  let printCount: Int
  let labelKind: String
  let materialDataMatrix: Bool
  let materialDataMatrixBars: [[Double]]
  let materialNameLines: [String]
  let progressQty: Double?
  let progressUnit: String
  let completedAtLabel: String
  let progressLines: [BluetoothProgressLine]
  let progressCodeY: Int
  let progressCodeX: Int
  let paddonLabelLines: [String]

  init?(arguments: [String: Any]) {
    let epc = (arguments["epc"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let grossQty = (arguments["gross_qty"] as? NSNumber)?.doubleValue ?? 0
    let tareKg = (arguments["tare_kg"] as? NSNumber)?.doubleValue ?? 0
    let printCount = (arguments["print_count"] as? NSNumber)?.intValue ?? 1
    guard !epc.isEmpty, grossQty.isFinite, tareKg.isFinite, (1...100).contains(printCount) else {
      return nil
    }

    self.epc = epc
    itemCode = (arguments["item_code"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    itemName = (arguments["item_name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    apparatus = (arguments["apparatus"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    apparatusDisplayName = (arguments["apparatus_display_name"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    customerName = (arguments["customer_name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    manufacturerName = (arguments["manufacturer_name"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    qolipColor = (arguments["qolip_color"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    self.grossQty = max(0, grossQty)
    unit = (arguments["unit"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
      ? (arguments["unit"] as? String)!.trimmingCharacters(in: .whitespacesAndNewlines)
      : "kg"
    self.tareKg = max(0, tareKg)
    tareEnabled = (arguments["tare_enabled"] as? NSNumber)?.boolValue == true || tareKg > 0
    self.printCount = printCount
    labelKind = ((arguments["label_kind"] as? String) ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    materialDataMatrix = (arguments["material_data_matrix"] as? NSNumber)?.boolValue == true
    materialDataMatrixBars = ((arguments["material_data_matrix_bars"] as? [[NSNumber]]) ?? [])
      .map { row in row.map { $0.doubleValue } }
    if materialDataMatrix && (materialDataMatrixBars.isEmpty || materialDataMatrixBars.contains {
      $0.count != 4 || $0.contains { !$0.isFinite || $0 < 0 || $0 > 1 } ||
        $0[0] >= $0[2] || $0[1] >= $0[3]
    }) {
      return nil
    }
    materialNameLines = ((arguments["material_name_lines"] as? [Any]) ?? [])
      .compactMap { value in
        guard let line = value as? String else { return nil }
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
      }
    let progressQty = (arguments["progress_qty"] as? NSNumber)?.doubleValue
    self.progressQty = progressQty?.isFinite == true ? progressQty : nil
    progressUnit = (arguments["progress_unit"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    completedAtLabel = (arguments["completed_at_label"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let lineMaps = (arguments["progress_lines"] as? [[String: Any]]) ?? []
    progressLines = lineMaps.compactMap { line in
      guard let text = line["text"] as? String, !text.isEmpty,
        let y = (line["y"] as? NSNumber)?.intValue, (12...240).contains(y),
        let font = line["font"] as? String,
        let width = (line["char_width"] as? NSNumber)?.intValue,
        (font == "large" && width == 16) || (font == "medium" && width == 16) ||
          (font == "small" && width == 8)
      else { return nil }
      return BluetoothProgressLine(text: text, y: y, font: font, charWidth: width)
    }
    progressCodeY = (arguments["progress_code_y"] as? NSNumber)?.intValue ?? 0
    progressCodeX = (arguments["progress_code_x"] as? NSNumber)?.intValue ?? 0
    if ["progress", "opening_wip"].contains(labelKind) &&
      (!materialDataMatrix || progressLines.isEmpty || progressLines.count != lineMaps.count ||
        !(236...252).contains(progressCodeY) || !(8...204).contains(progressCodeX)) {
      return nil
    }
    paddonLabelLines = (arguments["paddon_label_lines"] as? [String]) ?? []
  }

  var netQty: Double {
    max(0, grossQty - tareKg)
  }

  var usesCompactLabel: Bool {
    isProgress || ["material_product", "qolip_code", "qolip_cell", "qr_center"].contains(labelKind)
  }

  var isProgress: Bool {
    labelKind == "progress" || labelKind == "opening_wip"
  }

  // Faqat homashyo rezkachisi split chiqishi (progressUnit='m' yoki HOMASHYO
  // sarlavha): yangi zich tartib + WIP dagi kichik o'ng-past QR.
  // Uzunliksiz generic material_product eski katta markaziy QR yo'lida qoladi.
  var isMaterialSplit: Bool {
    guard labelKind == "material_product" else {
      return false
    }
    if progressUnit.lowercased() == "m" {
      return true
    }
    return materialNameLines.first?.hasPrefix("HOMASHYO") == true
  }
}
