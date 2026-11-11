package expo.modules.accordproductionlive

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccordProductionLiveModule : Module() {
    private val sockets = ProductionLiveSockets(emit = { event -> sendEvent("onProductionSocket", event) })

    override fun definition() = ModuleDefinition {
        Name("AccordProductionLive")
        Events("onProductionSocket")
        // Starting and cancelling enqueue native work synchronously so a stop cannot be
        // overtaken by a delayed bridge call. Actual network I/O remains asynchronous.
        Function("open") { origin: String, target: String ->
            val id = ProductionSocketIds.next()
            sockets.open(id, origin, target)
            id
        }
        Function("stop") { id: String -> sockets.stop(id) }
        OnDestroy { sockets.shutdown() }
    }
}
