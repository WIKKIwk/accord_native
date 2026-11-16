import Foundation

@main
struct AdminWarehouseLiveHost {
  static func main() throws {
    let origin = "https://example.test"
    let warehouse = "wss://example.test/v1/mobile/admin/warehouses/live?token=synthetic"
    let production = "wss://example.test/v1/mobile/admin/production-maps/live?token=synthetic&protocol=state_delta_v2&worker_scope=true"
    let request = try warehouseSocketRequest(origin: origin, target: warehouse)
    precondition(request.url?.absoluteString == warehouse)
    precondition(request.timeoutInterval == 10 && !request.httpShouldHandleCookies)
    precondition(request.value(forHTTPHeaderField: "Cookie") == nil && request.value(forHTTPHeaderField: "Authorization") == nil)
    let config = productionSocketSessionConfiguration()
    precondition(config.httpCookieStorage == nil && config.urlCredentialStorage == nil && config.urlCache == nil && !config.httpShouldSetCookies)
    _ = try productionSocketRequest(origin: origin, target: production)
    let bad = [production, warehouse + "&token=again", warehouse + "&other=1", warehouse + "#fragment",
      warehouse.replacingOccurrences(of: "wss:", with: "ws:"), warehouse.replacingOccurrences(of: "example.test", with: "other.test"),
      warehouse.replacingOccurrences(of: "wss://", with: "wss://user:secret@"), warehouse.replacingOccurrences(of: "/live?", with: "/live/?"),
      warehouse.replacingOccurrences(of: "token=synthetic", with: "token="), warehouse.replacingOccurrences(of: "token=synthetic", with: "token=%20synthetic")]
    for target in bad {
      do { _ = try warehouseSocketRequest(origin: origin, target: target); preconditionFailure("Unexpected Warehouse destination") }
      catch { }
    }
    do { _ = try productionSocketRequest(origin: origin, target: warehouse); preconditionFailure("Worker admission broadened") }
    catch { }
    print("Swift Warehouse admission/policy and Worker admission regression passed")
  }
}
