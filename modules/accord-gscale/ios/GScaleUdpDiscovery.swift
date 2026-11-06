import Foundation
import Darwin

// @v2 gscale_udp_discovery
final class GScaleUdpDiscoveryBridge {
  func discover(port: Int, timeoutMs: Int) -> [[String: Any]] {
    let fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard fd >= 0 else {
      return []
    }
    defer {
      close(fd)
    }

    var yes: Int32 = 1
    setsockopt(fd, SOL_SOCKET, SO_BROADCAST, &yes, socklen_t(MemoryLayout<Int32>.size))
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

    var bindAddress = sockaddr_in()
    bindAddress.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    bindAddress.sin_family = sa_family_t(AF_INET)
    bindAddress.sin_port = in_port_t(0).bigEndian
    bindAddress.sin_addr = in_addr(s_addr: INADDR_ANY.bigEndian)
    let bindStatus = withUnsafePointer(to: &bindAddress) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
        Darwin.bind(fd, sockaddrPointer, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    guard bindStatus == 0 else {
      return []
    }

    let packet = Array("GSCALE_DISCOVER_V1".utf8)
    let targets = broadcastTargets()
    let startedAt = Date()
    for attempt in 0..<3 {
      for target in targets {
        send(packet, to: target, port: port, socket: fd)
      }
      if attempt != 2 {
        usleep(120_000)
      }
    }

    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0)
    var out: [String: [String: Any]] = [:]
    while Date() < deadline {
      var readSet = fd_set()
      fdZero(&readSet)
      fdSet(fd, &readSet)

      let remaining = max(0.0, deadline.timeIntervalSinceNow)
      var timeout = timeval(
        tv_sec: Int(remaining),
        tv_usec: Int32((remaining.truncatingRemainder(dividingBy: 1.0)) * 1_000_000)
      )
      let selected = select(fd + 1, &readSet, nil, nil, &timeout)
      if selected <= 0 {
        continue
      }

      var buffer = [UInt8](repeating: 0, count: 4096)
      var from = sockaddr_in()
      var fromLen = socklen_t(MemoryLayout<sockaddr_in>.size)
      let count = withUnsafeMutablePointer(to: &from) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
          recvfrom(fd, &buffer, buffer.count, 0, sockaddrPointer, &fromLen)
        }
      }
      if count <= 0 {
        continue
      }
      guard let item = discoveryItem(
        from: Array(buffer.prefix(count)),
        address: from,
        latencyMs: max(1, Int(Date().timeIntervalSince(startedAt) * 1000))
      ) else {
        continue
      }
      let key = "\(item["server_ref"] ?? "")|\(item["server_name"] ?? "")|\(item["host"] ?? "")"
      out[key] = item
    }

    return Array(out.values)
  }

  private func send(_ packet: [UInt8], to target: String, port: Int, socket fd: Int32) {
    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(port).bigEndian
    inet_pton(AF_INET, target, &address.sin_addr)
    packet.withUnsafeBytes { bytes in
      _ = withUnsafePointer(to: &address) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPointer in
          sendto(fd, bytes.baseAddress, bytes.count, 0, sockaddrPointer, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
      }
    }
  }

  private func discoveryItem(from data: [UInt8], address: sockaddr_in, latencyMs: Int) -> [String: Any]? {
    guard
      let json = try? JSONSerialization.jsonObject(with: Data(data)) as? [String: Any],
      (json["service"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) == "mobileapi"
    else {
      return nil
    }

    var addr = address.sin_addr
    var hostBuffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
    guard inet_ntop(AF_INET, &addr, &hostBuffer, socklen_t(hostBuffer.count)) != nil else {
      return nil
    }
    let host = String(cString: hostBuffer)
    let httpPort = intValue(json["http_port"]) ?? 39117
    return [
      "host": host,
      "http_port": httpPort,
      "server_name": textValue(json["server_name"], fallback: host),
      "server_ref": textValue(json["server_ref"], fallback: ""),
      "display_name": textValue(json["display_name"], fallback: "Operator"),
      "role": textValue(json["role"], fallback: "operator"),
      "latency_ms": latencyMs,
    ]
  }

  private func broadcastTargets() -> [String] {
    var targets = Set(["255.255.255.255"])
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0 else {
      return Array(targets)
    }
    defer {
      freeifaddrs(ifaddr)
    }

    var pointer = ifaddr
    while pointer != nil {
      guard let interface = pointer?.pointee else {
        break
      }
      pointer = interface.ifa_next
      let flags = Int32(interface.ifa_flags)
      guard
        flags & IFF_UP != 0,
        flags & IFF_BROADCAST != 0,
        let address = interface.ifa_addr,
        let netmask = interface.ifa_netmask,
        address.pointee.sa_family == sa_family_t(AF_INET)
      else {
        continue
      }
      let ip = address.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
        UInt32(bigEndian: $0.pointee.sin_addr.s_addr)
      }
      if !isPrivateIPv4(ip) {
        continue
      }
      let mask = netmask.withMemoryRebound(to: sockaddr_in.self, capacity: 1) {
        UInt32(bigEndian: $0.pointee.sin_addr.s_addr)
      }
      let broadcast = (ip & mask) | ~mask
      targets.insert(ipv4String(broadcast))
    }
    return Array(targets)
  }

  private func isPrivateIPv4(_ ip: UInt32) -> Bool {
    let first = (ip >> 24) & 0xff
    let second = (ip >> 16) & 0xff
    return first == 10 || (first == 172 && second >= 16 && second <= 31) || (first == 192 && second == 168)
  }

  private func ipv4String(_ ip: UInt32) -> String {
    return "\(ip >> 24 & 0xff).\(ip >> 16 & 0xff).\(ip >> 8 & 0xff).\(ip & 0xff)"
  }

  private func textValue(_ value: Any?, fallback: String) -> String {
    let text = (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return text.isEmpty ? fallback : text
  }

  private func intValue(_ value: Any?) -> Int? {
    if let value = value as? Int {
      return value
    }
    if let value = value as? String {
      return Int(value.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    return nil
  }

  private func fdZero(_ set: inout fd_set) {
    set.fds_bits = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  }

  private func fdSet(_ fd: Int32, _ set: inout fd_set) {
    let bitsPerElement = MemoryLayout<Int32>.size * 8
    let intOffset = Int(fd) / bitsPerElement
    let bitOffset = Int(fd) % bitsPerElement
    let mask = Int32(1 << bitOffset)
    switch intOffset {
    case 0: set.fds_bits.0 |= mask
    case 1: set.fds_bits.1 |= mask
    case 2: set.fds_bits.2 |= mask
    case 3: set.fds_bits.3 |= mask
    case 4: set.fds_bits.4 |= mask
    case 5: set.fds_bits.5 |= mask
    case 6: set.fds_bits.6 |= mask
    case 7: set.fds_bits.7 |= mask
    case 8: set.fds_bits.8 |= mask
    case 9: set.fds_bits.9 |= mask
    case 10: set.fds_bits.10 |= mask
    case 11: set.fds_bits.11 |= mask
    case 12: set.fds_bits.12 |= mask
    case 13: set.fds_bits.13 |= mask
    case 14: set.fds_bits.14 |= mask
    case 15: set.fds_bits.15 |= mask
    case 16: set.fds_bits.16 |= mask
    case 17: set.fds_bits.17 |= mask
    case 18: set.fds_bits.18 |= mask
    case 19: set.fds_bits.19 |= mask
    case 20: set.fds_bits.20 |= mask
    case 21: set.fds_bits.21 |= mask
    case 22: set.fds_bits.22 |= mask
    case 23: set.fds_bits.23 |= mask
    case 24: set.fds_bits.24 |= mask
    case 25: set.fds_bits.25 |= mask
    case 26: set.fds_bits.26 |= mask
    case 27: set.fds_bits.27 |= mask
    case 28: set.fds_bits.28 |= mask
    case 29: set.fds_bits.29 |= mask
    case 30: set.fds_bits.30 |= mask
    case 31: set.fds_bits.31 |= mask
    default: break
    }
  }
}

