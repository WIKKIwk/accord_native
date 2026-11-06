package expo.modules.accordgscale

import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/** SSE transport for the V2 /v1/mobile/monitor/stream endpoint. */
internal class GScaleMonitorStreams(private val emit: (Map<String, Any>) -> Unit) {
    private val streams = ConcurrentHashMap<Int, Stream>()

    fun start(id: Int, baseUrl: String) {
        stop(id)
        val stream = Stream(id, baseUrl)
        streams[id] = stream
        Thread { stream.run() }.start()
    }

    fun stop(id: Int) { streams.remove(id)?.stop() }
    fun stopAll() { streams.values.forEach { it.stop() }; streams.clear() }

    private inner class Stream(private val id: Int, private val baseUrl: String) {
        @Volatile private var stopped = false
        @Volatile private var connection: HttpURLConnection? = null
        fun stop() { stopped = true; connection?.disconnect() }
        private fun event(type: String, value: String = "") {
            if (!stopped) emit(mapOf("session" to id, "type" to type, "value" to value))
        }
        fun run() {
            try {
                val http = URL("${baseUrl.trimEnd('/')}/v1/mobile/monitor/stream").openConnection() as HttpURLConnection
                connection = http
                http.requestMethod = "GET"
                http.setRequestProperty("Accept", "text/event-stream")
                http.connectTimeout = 4000
                http.readTimeout = 4000
                val status = http.responseCode
                if (status < 200 || status > 299) throw IllegalStateException("stream $status")
                http.readTimeout = 0
                event("open")
                val data = mutableListOf<String>()
                var previous = ""
                http.inputStream.bufferedReader(Charsets.UTF_8).use { reader ->
                    while (!stopped) {
                        val line = reader.readLine() ?: break
                        if (line.isEmpty()) {
                            if (data.isNotEmpty()) {
                                val payload = data.joinToString("\n")
                                data.clear()
                                if (payload != previous) { previous = payload; event("data", payload) }
                            }
                        } else if (!line.startsWith(":") && line.startsWith("data:")) {
                            data.add(line.substring(5).trimStart())
                        }
                    }
                }
                event("end")
            } catch (error: Exception) {
                event("error", error.message ?: error.toString())
            } finally {
                connection?.disconnect()
            }
        }
    }
}
