import Foundation

private enum ChatSocketError: Error {
  case invalidOrigin, invalidTicket, duplicateSession, closed
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
  var request = URLRequest(url: url)
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
  private var entries: [Int: URLSessionWebSocketTask] = [:]
  private var closed = false
  private lazy var session: URLSession = {
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: chatSocketSessionConfiguration(), delegate: self, delegateQueue: queue)
  }()

  init(emit: @escaping ([String: Any]) -> Void) { self.emit = emit }

  func open(id: Int, origin: String, ticket: String) throws {
    let request = try chatSocketRequest(origin: origin, ticket: ticket)
    lock.lock()
    defer { lock.unlock() }
    guard !closed else { throw ChatSocketError.closed }
    guard entries[id] == nil else { throw ChatSocketError.duplicateSession }
    let task = session.webSocketTask(with: request)
    entries[id] = task
    task.resume()
  }

  func send(id: Int, value: String) -> Bool {
    lock.lock()
    let task = entries[id]
    lock.unlock()
    guard let task else { return false }
    task.send(.string(value)) { [weak self] error in
      if error != nil { self?.finish(task: task, error: true) }
    }
    return true
  }

  func stop(id: Int) {
    lock.lock()
    let task = entries.removeValue(forKey: id)
    lock.unlock()
    task?.cancel()
  }

  func shutdown() {
    lock.lock()
    guard !closed else { lock.unlock(); return }
    closed = true
    let tasks = Array(entries.values)
    entries.removeAll()
    lock.unlock()
    tasks.forEach { $0.cancel() }
    session.invalidateAndCancel()
  }

  private func id(for task: URLSessionTask) -> Int? {
    entries.first { $0.value === task }?.key
  }

  private func event(task: URLSessionTask, type: String, value: String = "") {
    lock.lock()
    let id = id(for: task)
    lock.unlock()
    if let id { emit(["session": id, "type": type, "value": value]) }
  }

  private func finish(task: URLSessionTask, error: Bool) {
    lock.lock()
    let id = id(for: task)
    if let id { entries.removeValue(forKey: id) }
    lock.unlock()
    guard let id else { return }
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
      case .success(.data), .failure:
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
    lock.lock(); let active = id(for: webSocketTask) != nil; lock.unlock()
    if active { receive(webSocketTask) }
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
