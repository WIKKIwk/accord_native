import ExpoModulesCore

public class AccordProductionLiveModule: Module {
  private lazy var sockets = ProductionLiveSockets { [weak self] event in
    self?.sendEvent("onProductionSocket", event)
  }

  public func definition() -> ModuleDefinition {
    Name("AccordProductionLive")
    Events("onProductionSocket")
    Function("open") { (origin: String, target: String) -> String in
      let id = try ProductionSocketIds.next()
      try self.sockets.open(id: id, origin: origin, target: target)
      return id
    }
    Function("stop") { (id: String) in self.sockets.stop(id: id) }
    OnDestroy { self.sockets.shutdown() }
  }
}
