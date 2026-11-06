import ExpoModulesCore
import Foundation

public class AccordGscaleModule: Module {
  private let bonjour = GScaleBonjourDiscoveryBridge()
  private let udp = GScaleUdpDiscoveryBridge()
  private let udpQueue = DispatchQueue(label: "gscale.udp.discovery", qos: .userInitiated)

  public func definition() -> ModuleDefinition {
    Name("AccordGscale")

    AsyncFunction("discoverBonjourServices") { (args: [String: Any], promise: Promise) in
      self.bonjour.discover(args: args, result: promise)
    }.runOnQueue(.main)

    AsyncFunction("discoverAnnouncements") { (args: [String: Any], promise: Promise) in
      let port = args["port"] as? Int ?? 18081
      let timeout = max(300, args["timeout_ms"] as? Int ?? 900)
      self.udpQueue.async {
        promise.resolve(self.udp.discover(port: port, timeoutMs: timeout))
      }
    }
  }
}
