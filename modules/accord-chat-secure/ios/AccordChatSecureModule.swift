import ExpoModulesCore

public class AccordChatSecureModule: Module {
  private lazy var sockets = ChatSecureSockets { [weak self] event in
    self?.sendEvent("onChatSocket", event)
  }

  public func definition() -> ModuleDefinition {
    Name("AccordChatSecure")
    Events("onChatSocket")
    Function("open") { (id: Int, origin: String, ticket: String) in
      try self.sockets.open(id: id, origin: origin, ticket: ticket)
    }
    Function("send") { (id: Int, value: String) in self.sockets.send(id: id, value: value) }
    Function("stop") { (id: Int) in self.sockets.stop(id: id) }
    OnDestroy { self.sockets.shutdown() }
  }
}
