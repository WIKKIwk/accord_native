package expo.modules.accordproductionlive

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
internal object ProductionSocketIds {
    private val value = AtomicLong(0)
    fun next(): String {
        while (true) {
            val current = value.get()
            check(current < Long.MAX_VALUE) { "Production socket IDs exhausted" }
            if (value.compareAndSet(current, current + 1)) return (current + 1).toString()
        }
    }
}

/** A separate client: no RN cookie handler, credentials, or redirect following. */
internal fun newProductionSocketClient(): OkHttpClient = OkHttpClient.Builder()
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
internal fun productionSocketRequest(origin: String, target: String): Request {
    val base = origin.toHttpUrlOrNull() ?: throw IllegalArgumentException("Invalid production origin")
    require(base.isHttps && base.username.isEmpty() && base.password.isEmpty() &&
        base.encodedPath == "/" && base.query == null && base.fragment == null && base.toString() == "$origin/") {
        "Invalid production origin"
    }
    require(target.startsWith("wss://")) { "Invalid production destination" }
    val url = target.replaceFirst("wss://", "https://").toHttpUrlOrNull()
        ?: throw IllegalArgumentException("Invalid production destination")
    val allowed = setOf("token", "protocol", "worker_scope", "projection", "queue_limit", "queue_positions", "queue_search", "epoch", "scope", "rev")
    val token = url.queryParameter("token")
    require(url.host == base.host && url.port == base.port && url.username.isEmpty() && url.password.isEmpty() &&
        url.encodedPath == "/v1/mobile/admin/production-maps/live" && url.fragment == null &&
        url.queryParameterNames.all { it in allowed && url.queryParameterValues(it).size == 1 } &&
        !token.isNullOrEmpty() && token == token.trim()) { "Invalid production destination" }
    return Request.Builder().url(url).build()
}

/** Socket IDs belong to the JS adapter; replacing or stopping one cannot stop another. */
internal class ProductionLiveSockets(
    private val emit: (Map<String, Any>) -> Unit,
    private val client: OkHttpClient = newProductionSocketClient(),
) {
    private class Entry(val id: String) { var socket: WebSocket? = null }
    private val lock = Any()
    private val entries = mutableMapOf<String, Entry>()
    private var closed = false

    fun open(id: String, origin: String, target: String) {
        val request = productionSocketRequest(origin, target)
        val entry = Entry(id)
        synchronized(lock) {
            check(!closed) { "Production socket transport closed" }
            require(!entries.containsKey(id)) { "Production socket already exists" }
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

        private fun finish(error: Boolean, status: Int? = null) = synchronized(lock) {
            if (entries[entry.id] !== entry) return@synchronized
            entries.remove(entry.id)
            if (error) emit(buildMap<String, Any> {
                put("session", entry.id); put("type", "error"); put("value", "")
                if (status != null && status >= 400) put("statusCode", status)
            })
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
        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = finish(error = true, status = response?.code)
    }
}
