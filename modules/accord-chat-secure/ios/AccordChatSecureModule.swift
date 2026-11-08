import ExpoModulesCore

public class AccordChatSecureModule: Module {
  private lazy var sockets = ChatSecureSockets { [weak self] event in
    self?.sendEvent("onChatSocket", event)
  }

  public func definition() -> ModuleDefinition {
    Name("AccordChatSecure")
    Events("onChatSocket")
    Function("open") { (origin: String, ticket: String) -> String in
      let id = try ChatSocketIds.next()
      try self.sockets.open(id: id, origin: origin, ticket: ticket)
      return id
    }
    Function("send") { (id: String, value: String) in self.sockets.send(id: id, value: value) }
    Function("stop") { (id: String) in self.sockets.stop(id: id) }
    OnDestroy { self.sockets.shutdown() }
  }
}
