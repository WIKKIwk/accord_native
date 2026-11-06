import Foundation

// SSE transport for the V2 /v1/mobile/monitor/stream endpoint.
final class GScaleMonitorStream: NSObject, URLSessionDataDelegate {
  private let id: Int
  private let baseUrl: String
  private let emit: ([String: Any]) -> Void
  private let lock = NSLock()
  private var stopped = false
  private var session: URLSession?
  private var task: URLSessionDataTask?
  private var headerTimer: DispatchSourceTimer?
  private var buffer = Data()
  private var dataLines: [String] = []
  private var previous = ""

  init(id: Int, baseUrl: String, emit: @escaping ([String: Any]) -> Void) {
    self.id = id
    self.baseUrl = baseUrl
    self.emit = emit
    super.init()
  }

  func start() {
    guard let url = URL(string: "\(baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/v1/mobile/monitor/stream") else {
      event("error", "Invalid monitor URL")
      return
    }
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: .default, delegate: self, delegateQueue: queue)
    self.session = session
    var request = URLRequest(url: url)
    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
    let task = session.dataTask(with: request)
    self.task = task
    let timer = DispatchSource.makeTimerSource(queue: .global(qos: .userInitiated))
    headerTimer = timer
    timer.schedule(deadline: .now() + 4)
    timer.setEventHandler { [weak self] in
      self?.event("error", "stream timeout")
      self?.stop()
    }
    timer.resume()
    task.resume()
  }

  func stop() {
    lock.lock()
    if stopped { lock.unlock(); return }
    stopped = true
    lock.unlock()
    headerTimer?.cancel()
    headerTimer = nil
    task?.cancel()
    session?.invalidateAndCancel()
    task = nil
    session = nil
  }

  private func event(_ type: String, _ value: String = "") {
    lock.lock()
    let allowed = !stopped
    lock.unlock()
    if allowed { emit(["session": id, "type": type, "value": value]) }
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                  completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    headerTimer?.cancel()
    headerTimer = nil
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200...299).contains(status) else {
      event("error", "stream \(status)")
      completionHandler(.cancel)
      stop()
      return
    }
    event("open")
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    buffer.append(data)
    while let newline = buffer.firstIndex(of: 10) {
      var line = Data(buffer[..<newline])
      buffer.removeSubrange(...newline)
      if line.last == 13 { line.removeLast() }
      guard let value = String(data: line, encoding: .utf8) else {
        event("error", "Invalid UTF-8 in monitor stream")
        stop()
        return
      }
      if value.isEmpty {
        if !dataLines.isEmpty {
          let payload = dataLines.joined(separator: "\n")
          dataLines.removeAll()
          if payload != previous { previous = payload; event("data", payload) }
        }
      } else if !value.hasPrefix(":"), value.hasPrefix("data:") {
        let raw = value.dropFirst(5)
        dataLines.append(String(raw.drop(while: { $0.isWhitespace })))
      }
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    headerTimer?.cancel()
    headerTimer = nil
    if let error { event("error", error.localizedDescription) } else { event("end") }
  }
}
