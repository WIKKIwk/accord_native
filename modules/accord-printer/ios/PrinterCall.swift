import Foundation

typealias PrinterResult = (Any?) -> Void
typealias PrinterEventSink = (Any?) -> Void
struct PrinterMethodCall {
  let method: String
  let arguments: Any?
}
struct PrinterError {
  let code: String
  let message: String?
  let details: Any?
}
let PrinterMethodNotImplemented = PrinterError(code: "not_implemented", message: "Printer method is not implemented", details: nil)
