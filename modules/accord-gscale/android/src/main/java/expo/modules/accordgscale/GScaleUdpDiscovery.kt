package expo.modules.accordgscale

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.SocketTimeoutException
import org.json.JSONObject

/** Android counterpart of network_candidates_io.dart's broadcast discovery. */
internal object GScaleUdpDiscovery {
    fun discover(port: Int, timeoutMs: Int): List<Map<String, Any>> {
        val socket = try {
            DatagramSocket(null).apply {
                reuseAddress = true
                try { bind(InetSocketAddress(port)) }
                catch (_: Exception) { close(); throw IllegalStateException("port unavailable") }
            }
        } catch (_: Exception) {
            DatagramSocket(null).apply { reuseAddress = true; bind(InetSocketAddress(0)) }
        }
        socket.use {
            it.broadcast = true
            val started = System.currentTimeMillis()
            val deadline = started + timeoutMs
            val targets = broadcastTargets()
            val packet = "GSCALE_DISCOVER_V1".toByteArray(Charsets.UTF_8)
            Thread {
                repeat(3) { attempt ->
                    targets.forEach { target ->
                        try { socket.send(DatagramPacket(packet, packet.size, target, port)) } catch (_: Exception) { }
                    }
                    if (attempt < 2) Thread.sleep(120)
                }
            }.start()
            val results = linkedMapOf<String, Map<String, Any>>()
            var settleAt = deadline
            while (true) {
                val remaining = minOf(deadline, settleAt) - System.currentTimeMillis()
                if (remaining <= 0) break
                it.soTimeout = remaining.coerceAtMost(Int.MAX_VALUE.toLong()).toInt().coerceAtLeast(1)
                val incoming = DatagramPacket(ByteArray(4096), 4096)
                try { it.receive(incoming) } catch (_: SocketTimeoutException) { break }
                val json = try { JSONObject(String(incoming.data, 0, incoming.length, Charsets.UTF_8)) } catch (_: Exception) { continue }
                if (json.optString("service").trim() != "mobileapi") continue
                val host = incoming.address.hostAddress?.trim().orEmpty()
                if (host.isEmpty()) continue
                fun text(key: String, fallback: String): String =
                    if (!json.has(key) || json.isNull(key)) fallback else json.get(key).toString().trim()
                val record: Map<String, Any> = mapOf(
                    "host" to host,
                    "http_port" to (text("http_port", "").toIntOrNull() ?: 39117),
                    "server_name" to text("server_name", host),
                    "server_ref" to text("server_ref", ""),
                    "display_name" to text("display_name", "Operator"),
                    "role" to text("role", "operator"),
                    "latency_ms" to (System.currentTimeMillis() - started),
                )
                results["${record["server_ref"]}|${record["server_name"]}|$host"] = record
                settleAt = System.currentTimeMillis() + 45
            }
            return results.values.toList()
        }
    }

    private fun broadcastTargets(): Set<InetAddress> {
        val targets = linkedSetOf(InetAddress.getByName("255.255.255.255"))
        val interfaces = NetworkInterface.getNetworkInterfaces() ?: return targets
        for (iface in interfaces.toList()) {
            if (!iface.isUp || iface.isLoopback) continue
            for (address in iface.inetAddresses.toList()) {
                if (address !is Inet4Address || address.isLinkLocalAddress) continue
                val bytes = address.address.map { it.toInt() and 0xff }
                val isPrivate = bytes[0] == 10 || (bytes[0] == 172 && bytes[1] in 16..31) || (bytes[0] == 192 && bytes[1] == 168)
                if (isPrivate) targets.add(InetAddress.getByName("${bytes[0]}.${bytes[1]}.${bytes[2]}.255"))
            }
        }
        return targets
    }
}
