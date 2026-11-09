package expo.modules.accordchatsecure

import okhttp3.CookieJar
import java.io.Closeable
import java.net.CookieHandler
import java.net.SocketTimeoutException
import java.net.URI
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import kotlin.concurrent.thread

/** Host test only. The keystore and ticket contain synthetic test data. */
private class FixtureServer(
    context: SSLContext,
    private val respond: (String) -> String?,
) : Closeable {
    private val server = context.serverSocketFactory.createServerSocket(0) as SSLServerSocket
    val port: Int get() = server.localPort
    val requests = mutableListOf<String>()
    val arrived = CountDownLatch(1)
    private val runner = thread(isDaemon = true) {
        try {
            server.soTimeout = 2500
            server.accept().use { socket ->
                socket.soTimeout = 2500
                val reader = socket.getInputStream().bufferedReader(Charsets.US_ASCII)
                val lines = mutableListOf<String>()
                while (true) { val line = reader.readLine() ?: break; if (line.isEmpty()) break; lines.add(line) }
                val request = lines.joinToString("\n")
                synchronized(requests) { requests.add(request) }
                arrived.countDown()
                val response = respond(request)
                if (response != null) {
                    socket.getOutputStream().write(response.toByteArray(Charsets.US_ASCII))
                    socket.getOutputStream().flush()
                    Thread.sleep(200)
                }
            }
        } catch (_: SocketTimeoutException) {
        } catch (_: java.net.SocketException) {
        }
    }
    override fun close() { server.close(); runner.join(3000) }
}

private fun sslContexts(path: String): Pair<SSLContext, X509TrustManager> {
    val keyStore = KeyStore.getInstance("PKCS12")
    java.io.File(path).inputStream().use { keyStore.load(it, "synthetic".toCharArray()) }
    val keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
    keyManagers.init(keyStore, "synthetic".toCharArray())
    val trusts = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
    trusts.init(keyStore)
    val manager = trusts.trustManagers.filterIsInstance<X509TrustManager>().single()
    return SSLContext.getInstance("TLS").apply { init(keyManagers.keyManagers, arrayOf(manager), SecureRandom()) } to manager
}

private fun isRejected(origin: String) = runCatching { chatSocketRequest(origin, "synthetic-ticket") }.isFailure

fun main(args: Array<String>) {
    check(args.size == 1)
    val (tls, manager) = sslContexts(args[0])
    val first = ChatSocketIds.next()
    val second = ChatSocketIds.next()
    val third = ChatSocketIds.next()
    check(setOf(first, second, third).size == 3)
    val request = chatSocketRequest("https://example.test", "synthetic&ticket")
    check(request.url.toString() == "https://example.test/v1/mobile/chat/live?ticket=synthetic%26ticket")
    listOf("http://example.test", "wss://example.test", "https://user@example.test", "https://example.test/",
        "https://example.test/other", "https://example.test?x=1", "https://example.test#fragment",
        "https://example.test:443", "https://EXAMPLE.test", "https://example.test.evil/path").forEach {
        check(isRejected(it)) { "origin unexpectedly accepted: $it" }
    }
    check(runCatching { chatSocketRequest("https://example.test", " ") }.isFailure)
    val baseClient = newChatSocketClient()
    check(!baseClient.followRedirects && !baseClient.followSslRedirects && baseClient.cookieJar === CookieJar.NO_COOKIES)
    check(baseClient.pingIntervalMillis == 25_000) { "V2 uses 25-second protocol pings" }
    val client = baseClient.newBuilder().sslSocketFactory(tls.socketFactory, manager).build()
    val oldHandler = CookieHandler.getDefault()
    CookieHandler.setDefault(object : CookieHandler() {
        override fun get(uri: URI?, requestHeaders: MutableMap<String, MutableList<String>>?) = mapOf("Cookie" to listOf("synthetic=secret"))
        override fun put(uri: URI?, responseHeaders: MutableMap<String, MutableList<String>>?) {}
    })
    try {
        FixtureServer(tls) { null }.use { destination ->
            FixtureServer(tls) { "HTTP/1.1 302 Found\r\nLocation: https://localhost:${destination.port}/redirected\r\nContent-Length: 0\r\n\r\n" }.use { source ->
                val ended = CountDownLatch(1)
                val events = mutableListOf<Map<String, Any>>()
                val sockets = ChatSecureSockets({ event -> synchronized(events) { events.add(event) }; if (event["type"] == "close") ended.countDown() }, client)
                sockets.open(first, "https://localhost:${source.port}", "synthetic-ticket")
                check(source.arrived.await(3, TimeUnit.SECONDS))
                check(ended.await(3, TimeUnit.SECONDS))
                check(!destination.arrived.await(800, TimeUnit.MILLISECONDS)) { "redirect followed" }
                val seen = synchronized(source.requests) { source.requests.single() }
                check(seen.startsWith("GET /v1/mobile/chat/live?ticket=synthetic-ticket HTTP/1.1"))
                check(!seen.lines().any { it.startsWith("cookie:", true) || it.startsWith("authorization:", true) })
                check(synchronized(events) { events.map { it["type"] } } == listOf("error", "close"))
                sockets.stopAll()
            }
        }
        FixtureServer(tls) { requestText ->
            val key = requestText.lines().first { it.startsWith("Sec-WebSocket-Key:", true) }.substringAfter(':').trim()
            val accept = Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-1").digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").toByteArray()))
            "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: $accept\r\n\r\n"
        }.use { source ->
            val opened = CountDownLatch(1)
            val events = mutableListOf<Map<String, Any>>()
            val sockets = ChatSecureSockets({ event -> synchronized(events) { events.add(event) }; if (event["type"] == "open") opened.countDown() }, client)
            sockets.open(second, "https://localhost:${source.port}", "synthetic-ticket")
            check(opened.await(3, TimeUnit.SECONDS))
            check(sockets.send(second, "synthetic-ping"))
            sockets.stop(second)
            Thread.sleep(300)
            check(!sockets.send(second, "after-stop"))
            check(synchronized(events) { events.map { it["type"] } } == listOf("open"))
            sockets.stopAll()
        }
        FixtureServer(tls) { Thread.sleep(500); null }.use { source ->
            val events = mutableListOf<Map<String, Any>>()
            val sockets = ChatSecureSockets({ event -> synchronized(events) { events.add(event) } }, client)
            val otherClient = newChatSocketClient().newBuilder().sslSocketFactory(tls.socketFactory, manager).build()
            val otherSockets = ChatSecureSockets({}, otherClient)
            sockets.open(third, "https://localhost:${source.port}", "synthetic-ticket")
            check(source.arrived.await(3, TimeUnit.SECONDS))
            sockets.shutdown()
            Thread.sleep(700)
            check(synchronized(events) { events.isEmpty() }) { "cancelled socket emitted an event" }
            check(client.dispatcher.executorService.isShutdown)
            check(!otherClient.dispatcher.executorService.isShutdown) { "shutdown affected another module client" }
            check(runCatching { sockets.open(ChatSocketIds.next(), "https://localhost:${source.port}", "synthetic-ticket") }.isFailure)
            otherSockets.shutdown()
        }
    } finally {
        CookieHandler.setDefault(oldHandler)
        client.dispatcher.executorService.shutdownNow()
        client.connectionPool.evictAll()
    }
    println("Android OkHttp host tests passed: origin, synthetic cookies, redirect, open, send, and cancellation")
}
