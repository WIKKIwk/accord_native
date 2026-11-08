package expo.modules.accordchatsecure

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccordChatSecureModule : Module() {
    private val sockets = ChatSecureSockets { event -> sendEvent("onChatSocket", event) }

    override fun definition() = ModuleDefinition {
        Name("AccordChatSecure")
        Events("onChatSocket")
        // Starting and cancelling enqueue native work synchronously so a stop cannot be
        // overtaken by a delayed bridge call. Actual network I/O remains asynchronous.
        Function("open") { id: Int, origin: String, ticket: String -> sockets.open(id, origin, ticket) }
        Function("send") { id: Int, value: String -> sockets.send(id, value) }
        Function("stop") { id: Int -> sockets.stop(id) }
        OnDestroy { sockets.stopAll() }
    }
}
