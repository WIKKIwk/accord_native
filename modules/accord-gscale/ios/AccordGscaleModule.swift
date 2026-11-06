import ExpoModulesCore
import Foundation

public class AccordGscaleModule: Module {
  private let bonjour = GScaleBonjourDiscoveryBridge()
  private let udp = GScaleUdpDiscoveryBridge()
  private let udpQueue = DispatchQueue(label: "gscale.udp.discovery", qos: .userInitiated)
  private var streams: [Int: GScaleMonitorStream] = [:]

  public func definition() -> ModuleDefinition {
    Name("AccordGscale")
    Events("onMonitorStream")

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

    AsyncFunction("startMonitorStream") { (session: Int, baseUrl: String) in
      self.streams.removeValue(forKey: session)?.stop()
      let stream = GScaleMonitorStream(id: session, baseUrl: baseUrl) { [weak self] event in
        self?.sendEvent("onMonitorStream", event)
      }
      self.streams[session] = stream
      stream.start()
    }.runOnQueue(.main)

    AsyncFunction("stopMonitorStream") { (session: Int) in
      self.streams.removeValue(forKey: session)?.stop()
    }.runOnQueue(.main)

    OnDestroy {
      self.streams.values.forEach { $0.stop() }
      self.streams.removeAll()
    }
  }
}
