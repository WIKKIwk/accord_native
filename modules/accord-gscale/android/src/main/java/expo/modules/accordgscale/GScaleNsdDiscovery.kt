package expo.modules.accordgscale

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import expo.modules.kotlin.Promise

internal class GScaleNsdDiscovery(context: Context) {
    private val manager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val handler = Handler(Looper.getMainLooper())
    private var active: Session? = null

    fun discover(args: Map<String, Any?>, promise: Promise) {
        finish()
        val timeout = ((args["timeout_ms"] as? Number)?.toLong() ?: 900L).coerceIn(300L, 5000L)
        val types = (args["service_types"] as? List<*>)
            ?.mapNotNull { it?.toString()?.trim() }
            ?.filter { it.isNotEmpty() }?.distinct()
            ?: listOf("_gscale-mobileapi._tcp.")
        val session = Session(promise)
        active = session
        for (type in types) {
            val listener = listener(session)
            session.listeners.add(listener)
            try { manager.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener) }
            catch (error: RuntimeException) { Log.w("GScaleNSD", "NSD discovery start failed: ${error.message}") }
        }
        handler.postDelayed({
            if (active === session) active = null
            session.finish()
        }, timeout)
    }

    fun finish() {
        active?.finish()
        active = null
    }

    private fun listener(session: Session) = object : NsdManager.DiscoveryListener {
        override fun onDiscoveryStarted(serviceType: String) = Unit
        override fun onDiscoveryStopped(serviceType: String) = Unit
        override fun onServiceLost(service: NsdServiceInfo) = Unit
        override fun onServiceFound(service: NsdServiceInfo) {
            try {
                manager.resolveService(service, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(service: NsdServiceInfo, errorCode: Int) {
                        Log.w("GScaleNSD", "NSD resolve failed for ${service.serviceName}: $errorCode")
                    }
                    override fun onServiceResolved(service: NsdServiceInfo) { session.add(service) }
                })
            } catch (error: RuntimeException) {
                Log.w("GScaleNSD", "NSD resolve start failed: ${error.message}")
            }
        }
        override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) { stop(this) }
        override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
    }

    private fun stop(listener: NsdManager.DiscoveryListener) {
        try { manager.stopServiceDiscovery(listener) } catch (_: RuntimeException) { }
    }

    private inner class Session(private val promise: Promise) {
        val listeners = mutableListOf<NsdManager.DiscoveryListener>()
        private val started = System.currentTimeMillis()
        private val services = linkedMapOf<String, Map<String, Any>>()
        private var finished = false

        @Synchronized fun add(service: NsdServiceInfo) {
            if (finished) return
            val host = service.host?.hostAddress?.trim().orEmpty()
            val port = service.port
            if (host.isEmpty() || port <= 0) return
            val txt = service.attributes.mapValues { it.value?.toString(Charsets.UTF_8).orEmpty() }
            fun value(key: String, fallback: String) = txt[key]?.trim().orEmpty().ifEmpty { fallback }
            val key = "${txt["server_ref"].orEmpty()}|${service.serviceName}|$host|$port"
            services[key] = mapOf(
                "host" to host,
                "hosts" to if (Build.VERSION.SDK_INT >= 34) service.hostAddresses.mapNotNull { it.hostAddress } else listOf(host),
                "http_port" to port,
                "server_name" to value("server_name", service.serviceName),
                "server_ref" to value("server_ref", ""),
                "display_name" to value("display_name", "Operator"),
                "role" to value("role", "operator"),
                "latency_ms" to maxOf(1L, System.currentTimeMillis() - started),
                "service_type" to service.serviceType.orEmpty(),
            )
        }

        @Synchronized fun finish() {
            if (finished) return
            finished = true
            listeners.forEach { stop(it) }
            promise.resolve(services.values.toList())
        }
    }
}
