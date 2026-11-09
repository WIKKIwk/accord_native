package expo.modules.accordchatsecure

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccordChatSecureModule : Module() {
    private val sockets = ChatSecureSockets(emit = { event -> sendEvent("onChatSocket", event) })

    override fun definition() = ModuleDefinition {
        Name("AccordChatSecure")
        Events("onChatSocket")
        // Starting and cancelling enqueue native work synchronously so a stop cannot be
        // overtaken by a delayed bridge call. Actual network I/O remains asynchronous.
        Function("open") { origin: String, ticket: String ->
            val id = ChatSocketIds.next()
            sockets.open(id, origin, ticket)
            id
        }
        Function("send") { id: String, value: String -> sockets.send(id, value) }
        Function("stop") { id: String -> sockets.stop(id) }
        OnDestroy { sockets.shutdown() }
    }
}
