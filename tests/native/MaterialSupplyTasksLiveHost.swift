import Foundation

@main struct MaterialSupplyTasksLiveHost {
  static func main() throws {
    let origin = "https://example.test"
    let target = "wss://example.test/v1/mobile/production-tasks/live?token=synthetic&kind=material&apparatus=&limit=10&search=&epoch=e&scope=s&rev=7"
    let request = try supplyTasksSocketRequest(origin: origin, target: target)
    precondition(request.url?.absoluteString == target)
    precondition(request.timeoutInterval == 10 && !request.httpShouldHandleCookies)
    for bad in [target + "&token=again", target + "&other=1", target + "#fragment",
      target.replacingOccurrences(of: "wss:", with: "ws:"), target.replacingOccurrences(of: "example.test", with: "other.test"),
      target.replacingOccurrences(of: "/live?", with: "/live/?"), target.replacingOccurrences(of: "token=synthetic", with: "token="),
      target.replacingOccurrences(of: "wss://", with: "wss://user:secret@") ] {
      do { _ = try supplyTasksSocketRequest(origin: origin, target: bad); preconditionFailure("Unexpected task destination") } catch { }
    }
    do { _ = try productionSocketRequest(origin: origin, target: target); preconditionFailure("Worker admission broadened") } catch { }
    do { _ = try warehouseSocketRequest(origin: origin, target: target); preconditionFailure("Warehouse admission broadened") } catch { }
    print("Swift supply task admission and existing endpoint isolation passed")
  }
}
