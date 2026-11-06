package expo.modules.accordgscale

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AccordGscaleModule : Module() {
    private var nsd: GScaleNsdDiscovery? = null

    override fun definition() = ModuleDefinition {
        Name("AccordGscale")

        // @v2 gscale_nsd
        AsyncFunction("discoverServices") { args: Map<String, Any?>, promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("gscale_context_unavailable", "GScale context is unavailable", null)
            } else {
                if (nsd == null) nsd = GScaleNsdDiscovery(context.applicationContext as Context)
                nsd!!.discover(args, promise)
            }
        }.runOnQueue(Queues.MAIN)

        // @v2 gscale_udp_discovery
        AsyncFunction("discoverAnnouncements") { args: Map<String, Any?>, promise: Promise ->
            Thread {
                val port = (args["port"] as? Number)?.toInt() ?: 18081
                val timeout = (args["timeout_ms"] as? Number)?.toInt() ?: 900
                try {
                    promise.resolve(GScaleUdpDiscovery.discover(port, timeout))
                } catch (error: Exception) {
                    promise.reject("gscale_udp_failed", error.message, error)
                }
            }.start()
        }

        OnDestroy {
            nsd?.finish()
            nsd = null
        }
    }
}
