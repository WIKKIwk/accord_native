import Foundation
import Darwin
import ExpoModulesCore

// @v2 gscale_bonjour
final class GScaleBonjourDiscoveryBridge: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private var browsers: [NetServiceBrowser] = []
  private var pendingResult: Promise?
  private var timeoutTimer: Timer?
  private var startedAt = Date()
  private var services: [NetService] = []
  private var resolvedServices: [[String: Any]] = []

  func discover(args: [String: Any], result: Promise) {
    finishDiscovery()
    pendingResult = result
    startedAt = Date()
    services = []
    resolvedServices = []

    let timeoutMs = max(300, args["timeout_ms"] as? Int ?? 900)
    for serviceType in discoveryServiceTypes(from: args) {
      let browser = NetServiceBrowser()
      browser.delegate = self
      browsers.append(browser)
      browser.searchForServices(ofType: serviceType, inDomain: "local.")
    }

    timeoutTimer = Timer.scheduledTimer(withTimeInterval: Double(timeoutMs) / 1000.0, repeats: false) { [weak self] _ in
      self?.finishDiscovery()
    }
  }

  private func finishDiscovery(error: Bool = false) {
    timeoutTimer?.invalidate()
    timeoutTimer = nil
    browsers.forEach {
      $0.stop()
      $0.delegate = nil
    }
    browsers = []
    services.forEach { $0.delegate = nil }
    services = []

    guard let result = pendingResult else {
      return
    }
    pendingResult = nil
    if error {
      result.reject("bonjour_search_failed", "Bonjour search failed")
      return
    }
    result.resolve(resolvedServices)
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didFind service: NetService,
    moreComing: Bool
  ) {
    service.delegate = self
    services.append(service)
    service.resolve(withTimeout: 1.2)
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didNotSearch errorDict: [String: NSNumber]
  ) {
    finishDiscovery(error: true)
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard let item = discoveryItem(from: sender) else {
      return
    }
    resolvedServices.append(item)
  }

  private func discoveryItem(from service: NetService) -> [String: Any]? {
    guard service.port > 0 else {
      return nil
    }
    guard let host = firstIPAddress(from: service.addresses) else {
      return nil
    }

    let txt = decodeTXTRecord(service.txtRecordData())
    let httpPort = Int(txt["http_port"] ?? "") ?? service.port
    return [
      "host": host,
      "hosts": ipAddresses(from: service.addresses),
      "http_port": httpPort,
      "server_name": nonEmpty(txt["server_name"], fallback: service.name),
      "server_ref": nonEmpty(txt["server_ref"], fallback: ""),
      "display_name": nonEmpty(txt["display_name"], fallback: "Operator"),
      "role": nonEmpty(txt["role"], fallback: "operator"),
      "latency_ms": max(1, Int(Date().timeIntervalSince(startedAt) * 1000)),
    ]
  }

  private func firstIPAddress(from addresses: [Data]?) -> String? {
    ipAddresses(from: addresses).first
  }

  private func ipAddresses(from addresses: [Data]?) -> [String] {
    guard let addresses else {
      return []
    }
    var result: [String] = []
    for family in [AF_INET, AF_INET6] {
      for address in addresses {
        let host = address.withUnsafeBytes { buffer -> String? in
          guard let sockaddr = buffer.baseAddress?.assumingMemoryBound(to: sockaddr.self) else {
            return nil
          }
          guard Int32(sockaddr.pointee.sa_family) == family else {
            return nil
          }

          var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
          let status = getnameinfo(
            sockaddr,
            socklen_t(sockaddr.pointee.sa_len),
            &hostBuffer,
            socklen_t(hostBuffer.count),
            nil,
            0,
            NI_NUMERICHOST
          )
          guard status == 0 else {
            return nil
          }
          return String(cString: hostBuffer)
        }
        if let host, !host.isEmpty {
          result.append(host)
        }
      }
    }

    return result
  }

  private func decodeTXTRecord(_ data: Data?) -> [String: String] {
    guard let data else {
      return [:]
    }
    let raw = NetService.dictionary(fromTXTRecord: data)
    var out: [String: String] = [:]
    for (key, value) in raw {
      out[key] = String(data: value, encoding: .utf8) ?? ""
    }
    return out
  }

  private func discoveryServiceTypes(from args: [String: Any]?) -> [String] {
    let raw = args?["service_types"] as? [Any] ?? []
    let serviceTypes = raw.compactMap { item -> String? in
      guard var value = item as? String else {
        return nil
      }
      value = value.trimmingCharacters(in: .whitespacesAndNewlines)
      if value.isEmpty {
        return nil
      }
      return value.hasSuffix(".") ? value : "\(value)."
    }
    if serviceTypes.isEmpty {
      return ["_gscale-mobileapi._tcp."]
    }
    var seen = Set<String>()
    return serviceTypes.filter { seen.insert($0).inserted }
  }

  private func nonEmpty(_ value: String?, fallback: String) -> String {
    guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return fallback
    }
    return value
  }
}
