import Darwin
import Foundation

enum EpochMicroseconds {
  static func from(seconds: Int64, microseconds: Int64) -> Int64 {
    seconds * 1_000_000 + microseconds
  }

  static func now() throws -> String {
    var value = timeval()
    guard gettimeofday(&value, nil) == 0 else {
      throw NSError(domain: "AccordNativeClock", code: Int(errno))
    }
    return String(from(seconds: Int64(value.tv_sec), microseconds: Int64(value.tv_usec)))
  }
}
