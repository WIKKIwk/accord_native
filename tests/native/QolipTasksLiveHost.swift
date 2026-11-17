import Foundation
@main struct QolipTasksLiveHost {
  static func main() throws {
    let origin = "https://example.test"
    let target = "wss://example.test/v1/mobile/production-tasks/live?kind=qolip&apparatus=station&limit=10&search=&token=synthetic&epoch=e&rev=2&scope=s"
    let request = try supplyTasksSocketRequest(origin: origin, target: target)
    precondition(request.url?.absoluteString == target && request.timeoutInterval == 10 && !request.httpShouldHandleCookies)
    precondition(request.value(forHTTPHeaderField: "Cookie") == nil && request.value(forHTTPHeaderField: "Authorization") == nil)
    for invalid in [target + "&token=duplicate", target + "&other=1", target + "#fragment", target.replacingOccurrences(of: "wss:", with: "ws:"), target.replacingOccurrences(of: "example.test", with: "other.test"), target.replacingOccurrences(of: "/production-tasks/live", with: "/admin/production-maps/live")] {
      do { _ = try supplyTasksSocketRequest(origin: origin, target: invalid); preconditionFailure("Invalid task destination accepted") } catch {}
    }
    do { _ = try productionSocketRequest(origin: origin, target: target); preconditionFailure("Worker admission broadened") } catch {}
    do { _ = try warehouseSocketRequest(origin: origin, target: target); preconditionFailure("Warehouse admission broadened") } catch {}
    print("Swift Qolip tasks destination and isolated transport checks passed")
  }
}
