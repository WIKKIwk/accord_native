package expo.modules.accordchatsecure

import okhttp3.Authenticator
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/** Process-wide IDs never repeat, even when the Expo module is recreated. */
internal object ChatSocketIds {
    private val value = AtomicLong(0)
    fun next(): String {
        while (true) {
            val current = value.get()
            check(current < Long.MAX_VALUE) { "Chat socket IDs exhausted" }
            if (value.compareAndSet(current, current + 1)) return (current + 1).toString()
        }
    }
}

/** A separate client: no RN cookie handler, credentials, or redirect following. */
internal fun newChatSocketClient(): OkHttpClient = OkHttpClient.Builder()
    .cookieJar(CookieJar.NO_COOKIES)
    .authenticator(Authenticator.NONE)
    .proxyAuthenticator(Authenticator.NONE)
    .followRedirects(false)
    .followSslRedirects(false)
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(0, TimeUnit.MILLISECONDS)
    // @v2 connectWarehouseLivePlatform: WebSocket.pingInterval = 25 seconds.
    .pingInterval(25, TimeUnit.SECONDS)
    .build()

/** The only destination is the signed-in server's canonical HTTPS origin. */
internal fun chatSocketRequest(origin: String, ticket: String): Request {
    val base = origin.toHttpUrlOrNull() ?: throw IllegalArgumentException("Invalid chat origin")
    require(base.isHttps && base.username.isEmpty() && base.password.isEmpty() &&
        base.encodedPath == "/" && base.query == null && base.fragment == null && base.toString() == "$origin/") {
        "Invalid chat origin"
    }
    require(ticket.isNotEmpty() && ticket == ticket.trim()) { "Invalid chat ticket" }
    val target = base.newBuilder().addPathSegments("v1/mobile/chat/live")
        .addQueryParameter("ticket", ticket).build()
    return Request.Builder().url(target).build()
}

/** Socket IDs belong to the JS adapter; replacing or stopping one cannot stop another. */
internal class ChatSecureSockets(
    private val emit: (Map<String, Any>) -> Unit,
    private val client: OkHttpClient = newChatSocketClient(),
) {
    private class Entry(val id: String) { var socket: WebSocket? = null }
    private val lock = Any()
    private val entries = mutableMapOf<String, Entry>()
    private var closed = false

    fun open(id: String, origin: String, ticket: String) {
        val request = chatSocketRequest(origin, ticket)
        val entry = Entry(id)
        synchronized(lock) {
            check(!closed) { "Chat socket transport closed" }
            require(!entries.containsKey(id)) { "Chat socket already exists" }
            entries[id] = entry
        }
        try {
            val socket = client.newWebSocket(request, Listener(entry))
            val stillCurrent = synchronized(lock) {
                if (entries[id] === entry) { entry.socket = socket; true } else false
            }
            if (!stillCurrent) socket.cancel()
        } catch (error: Exception) {
            synchronized(lock) { if (entries[id] === entry) entries.remove(id) }
            throw error
        }
    }

    fun send(id: String, value: String): Boolean = synchronized(lock) {
        entries[id]?.socket?.send(value) ?: false
    }

    fun stop(id: String) {
        val socket = synchronized(lock) { entries.remove(id)?.socket }
        socket?.cancel()
    }

    fun stopAll() {
        val sockets = synchronized(lock) {
            val current = entries.values.mapNotNull { it.socket }
            entries.clear()
            current
        }
        sockets.forEach { it.cancel() }
    }

    /** This client is private to this module instance, including its dispatcher and pool. */
    fun shutdown() {
        val sockets = synchronized(lock) {
            if (closed) return
            closed = true
            val current = entries.values.mapNotNull { it.socket }
            entries.clear()
            current
        }
        sockets.forEach { it.cancel() }
        client.dispatcher.cancelAll()
        client.connectionPool.evictAll()
        client.dispatcher.executorService.shutdown()
    }

    private inner class Listener(private val entry: Entry) : WebSocketListener() {
        private fun event(type: String, value: String = "") = synchronized(lock) {
            if (entries[entry.id] === entry) emit(mapOf("session" to entry.id, "type" to type, "value" to value))
        }

        private fun finish(error: Boolean) = synchronized(lock) {
            if (entries[entry.id] !== entry) return@synchronized
            entries.remove(entry.id)
            if (error) emit(mapOf("session" to entry.id, "type" to "error", "value" to ""))
            emit(mapOf("session" to entry.id, "type" to "close", "value" to ""))
        }

        override fun onOpen(webSocket: WebSocket, response: Response) {
            val current = synchronized(lock) {
                if (entries[entry.id] === entry) { entry.socket = webSocket; true } else false
            }
            if (current) event("open") else webSocket.cancel()
        }

        override fun onMessage(webSocket: WebSocket, text: String) = event("message", text)

        // V2's stream filters out binary messages before decoding JSON.
        override fun onMessage(webSocket: WebSocket, bytes: ByteString) = Unit

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) { webSocket.close(code, null) }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = finish(error = false)
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = finish(error = true)
    }
}
