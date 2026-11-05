import ExpoModulesCore

public class AccordPrinterModule: Module {
  private lazy var bluetooth = XPrinterBluetoothChannel()

  private func complete(_ promise: Promise) -> PrinterResult {
    return { value in
      if let error = value as? PrinterError {
        promise.resolve(["__accord_error__": true, "code": error.code,
                         "message": error.message as Any? ?? NSNull(), "details": error.details ?? NSNull()])
      } else {
        promise.resolve(value)
      }
    }
  }

  public func definition() -> ModuleDefinition {
    Name("AccordPrinter")
    Events("onDiscovery")

    // @v2 accord_bluetooth_printer
    AsyncFunction("pairedPrinters") { (promise: Promise) in
      self.bluetooth.handle(call: PrinterMethodCall(method: "pairedPrinters", arguments: nil), result: self.complete(promise))
    }.runOnQueue(.main)
    AsyncFunction("printLabel") { (arguments: [String: Any], promise: Promise) in
      self.bluetooth.handle(call: PrinterMethodCall(method: "printLabel", arguments: arguments), result: self.complete(promise))
    }.runOnQueue(.main)

    // @v2 accord_bluetooth_printer_discovery
    AsyncFunction("startDiscovery") { (session: Int) in
      _ = self.bluetooth.onListen(withArguments: session) { [weak self] value in
        if var event = value as? [String: Any] {
          event["_session"] = session
          self?.sendEvent("onDiscovery", event)
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("stopDiscovery") { (session: Int) in
      _ = self.bluetooth.onCancel(withArguments: session)
    }.runOnQueue(.main)
  }
}
