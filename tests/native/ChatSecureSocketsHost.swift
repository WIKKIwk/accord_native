import Foundation

private func require(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}

@main struct ChatSecureSocketsHost {
  static func main() throws {
    let port = CommandLine.arguments[1]
    let request = try chatSocketRequest(origin: "https://example.test", ticket: "synthetic&ticket")
    require(request.url?.absoluteString == "wss://example.test/v1/mobile/chat/live?ticket=synthetic%26ticket", "endpoint")
    require(!request.httpShouldHandleCookies, "request cookies must be off")
    require(request.value(forHTTPHeaderField: "Cookie") == nil, "no cookie header")
    require(request.value(forHTTPHeaderField: "Authorization") == nil, "no authorization header")
    for origin in ["http://example.test", "wss://example.test", "https://user@example.test", "https://example.test/",
                   "https://example.test/other", "https://example.test?x=1", "https://example.test#fragment"] {
      require((try? chatSocketRequest(origin: origin, ticket: "synthetic-ticket")) == nil, "origin unexpectedly accepted")
    }
    require((try? chatSocketRequest(origin: "https://example.test", ticket: " ")) == nil, "empty ticket")
    let config = chatSocketSessionConfiguration()
    require(config.httpCookieStorage == nil && !config.httpShouldSetCookies, "session cookies must be off")
    require(config.urlCredentialStorage == nil && config.urlCache == nil, "credential storage and cache must be off")

    // Host-only loopback exercises the real production configuration and redirect delegate.
    // The temporary ws:// requests are constructed in this test, never accepted by chatSocketRequest.
    let delegate = ChatSecureSockets { _ in }
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    for path in ["redirect", "probe"] {
      let url = URL(string: "ws://127.0.0.1:\(port)/\(path)?ticket=synthetic-ticket")!
      let task = session.webSocketTask(with: url)
      task.resume()
      let deadline = Date().addingTimeInterval(4)
      while task.state != .completed && Date() < deadline { Thread.sleep(forTimeInterval: 0.02) }
      require(task.state == .completed, "loopback task did not complete")
    }
    session.invalidateAndCancel()
    delegate.shutdown()
    print("macOS Foundation host tests passed: request, configuration, redirect delegate, and loopback")
  }
}
