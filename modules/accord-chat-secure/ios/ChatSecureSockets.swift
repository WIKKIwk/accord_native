import Foundation

private enum ChatSocketError: Error {
  case invalidOrigin, invalidTicket, duplicateSession, closed, idsExhausted
}

private final class ChatSocketIdSource: @unchecked Sendable {
  private let lock = NSLock()
  private var value: UInt64 = 0
  func next() throws -> String {
    lock.lock(); defer { lock.unlock() }
    guard value < UInt64.max else { throw ChatSocketError.idsExhausted }
    value += 1
    return String(value)
  }
}

/// Shared across Expo module instances in this process; IDs never wrap or repeat.
enum ChatSocketIds {
  private static let source = ChatSocketIdSource()
  static func next() throws -> String { try source.next() }
}

/// Construct only the Chat endpoint on the current authenticated server origin.
func chatSocketRequest(origin: String, ticket: String) throws -> URLRequest {
  guard var parts = URLComponents(string: origin), parts.scheme == "https",
        let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
        parts.path.isEmpty, parts.query == nil, parts.fragment == nil,
        parts.port.map({ (1...65535).contains($0) }) ?? true else {
    throw ChatSocketError.invalidOrigin
  }
  guard !ticket.isEmpty, ticket == ticket.trimmingCharacters(in: .whitespacesAndNewlines) else {
    throw ChatSocketError.invalidTicket
  }
  parts.scheme = "wss"
  parts.path = "/v1/mobile/chat/live"
  parts.queryItems = [URLQueryItem(name: "ticket", value: ticket)]
  guard let url = parts.url else { throw ChatSocketError.invalidOrigin }
  var request = URLRequest(url: url, timeoutInterval: 10)
  request.httpShouldHandleCookies = false
  return request
}

func chatSocketSessionConfiguration() -> URLSessionConfiguration {
  let config = URLSessionConfiguration.ephemeral
  config.httpCookieStorage = nil
  config.httpShouldSetCookies = false
  config.urlCredentialStorage = nil
  config.urlCache = nil
  config.requestCachePolicy = .reloadIgnoringLocalCacheData
  return config
}

/// The delegate refuses redirects and non-server-trust authentication challenges.
final class ChatSecureSockets: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
  private let lock = NSLock()
  private let emit: ([String: Any]) -> Void
  private var entries: [String: URLSessionWebSocketTask] = [:]
  private let pingQueue = DispatchQueue(label: "accord.chat.ping")
  private var pingTimers: [String: DispatchWorkItem] = [:]
  private var awaitingPong: Set<String> = []
  private var closed = false
  private lazy var session: URLSession = {
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: chatSocketSessionConfiguration(), delegate: self, delegateQueue: queue)
  }()

  init(emit: @escaping ([String: Any]) -> Void) { self.emit = emit }

  func open(id: String, origin: String, ticket: String) throws {
    let request = try chatSocketRequest(origin: origin, ticket: ticket)
    lock.lock()
    defer { lock.unlock() }
    guard !closed else { throw ChatSocketError.closed }
    guard entries[id] == nil else { throw ChatSocketError.duplicateSession }
    let task = session.webSocketTask(with: request)
    entries[id] = task
    task.resume()
  }

  func send(id: String, value: String) -> Bool {
    lock.lock()
    guard let task = entries[id] else { lock.unlock(); return false }
    // Enqueue while holding the same lock as stop: nothing can be sent after stop returns.
    task.send(.string(value)) { [weak self] error in
      if error != nil { self?.finish(task: task, error: true) }
    }
    lock.unlock()
    return true
  }

  func stop(id: String) {
    lock.lock()
    let task = entries.removeValue(forKey: id)
    pingTimers.removeValue(forKey: id)?.cancel()
    awaitingPong.remove(id)
    lock.unlock()
    task?.cancel()
  }

  func shutdown() {
    lock.lock()
    guard !closed else { lock.unlock(); return }
    closed = true
    let tasks = Array(entries.values)
    entries.removeAll()
    pingTimers.values.forEach { $0.cancel() }
    pingTimers.removeAll()
    awaitingPong.removeAll()
    lock.unlock()
    tasks.forEach { $0.cancel() }
    session.invalidateAndCancel()
  }

  private func id(for task: URLSessionTask) -> String? {
    entries.first { $0.value === task }?.key
  }

  private func event(task: URLSessionTask, type: String, value: String = "") {
    lock.lock()
    defer { lock.unlock() }
    if let id = id(for: task) { emit(["session": id, "type": type, "value": value]) }
  }

  private func finish(task: URLSessionTask, error: Bool) {
    lock.lock()
    defer { lock.unlock() }
    guard let id = id(for: task) else { return }
    entries.removeValue(forKey: id)
    pingTimers.removeValue(forKey: id)?.cancel()
    awaitingPong.remove(id)
    if error { emit(["session": id, "type": "error", "value": ""]) }
    emit(["session": id, "type": "close", "value": ""])
  }

  private func receive(_ task: URLSessionWebSocketTask) {
    task.receive { [weak self] result in
      guard let self else { return }
      switch result {
      case .success(.string(let value)):
        self.event(task: task, type: "message", value: value)
        self.lock.lock(); let active = self.id(for: task) != nil; self.lock.unlock()
        if active { self.receive(task) }
      case .success(.data):
        // V2 filters out binary frames and keeps listening for JSON text.
        self.lock.lock(); let active = self.id(for: task) != nil; self.lock.unlock()
        if active { self.receive(task) }
      case .failure:
        task.cancel()
        self.finish(task: task, error: true)
      @unknown default:
        task.cancel()
        self.finish(task: task, error: true)
      }
    }
  }

  func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocolName: String?) {
    event(task: webSocketTask, type: "open")
    lock.lock()
    let active = id(for: webSocketTask)
    if let id = active { schedulePingLocked(id: id) }
    lock.unlock()
    if active != nil { receive(webSocketTask) }
  }

  /// @v2 WebSocket.pingInterval: wait 25 seconds after open/pong, then allow
  /// one outstanding ping and 25 seconds for its pong before reconnecting.
  private func schedulePingLocked(id: String) {
    pingTimers.removeValue(forKey: id)?.cancel()
    let timer = DispatchWorkItem { [weak self] in self?.ping(id: id) }
    pingTimers[id] = timer
    pingQueue.asyncAfter(deadline: .now() + 25, execute: timer)
  }

  private func ping(id: String) {
    lock.lock()
    guard let task = entries[id] else { lock.unlock(); return }
    if awaitingPong.contains(id) {
      lock.unlock()
      task.cancel(with: .goingAway, reason: nil)
      finish(task: task, error: true)
      return
    }
    awaitingPong.insert(id)
    schedulePingLocked(id: id)
    lock.unlock()
    task.sendPing { [weak self] error in
      guard let self else { return }
      if error != nil {
        task.cancel()
        self.finish(task: task, error: true)
        return
      }
      self.lock.lock()
      if self.entries[id] === task {
        self.awaitingPong.remove(id)
        self.schedulePingLocked(id: id)
      }
      self.lock.unlock()
    }
  }

  func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                  didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
    finish(task: webSocketTask, error: false)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    finish(task: task, error: error != nil)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }

  private func authenticate(_ challenge: URLAuthenticationChallenge,
                            _ completionHandler: (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
      completionHandler(.performDefaultHandling, nil)
    } else {
      completionHandler(.cancelAuthenticationChallenge, nil)
    }
  }

  func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                  completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    authenticate(challenge, completionHandler)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                  completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    authenticate(challenge, completionHandler)
  }
}
