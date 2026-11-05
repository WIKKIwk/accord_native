package expo.modules.accordprinter

import expo.modules.kotlin.Promise

internal class MethodCall(val method: String, private val arguments: Map<String, Any?> = emptyMap()) {
    @Suppress("UNCHECKED_CAST")
    fun <T> argument(key: String): T? = arguments[key] as? T
}

internal object MethodChannel {
    interface Result {
        fun success(value: Any?)
        fun error(code: String, message: String?, details: Any?)
        fun notImplemented()
    }
}

internal class ExpoPrinterResult(private val promise: Promise) : MethodChannel.Result {
    override fun success(value: Any?) = promise.resolve(value)
    override fun error(code: String, message: String?, details: Any?) {
        promise.resolve(mapOf("__accord_error__" to true, "code" to code, "message" to message, "details" to details))
    }
    override fun notImplemented() = error("not_implemented", "Printer method is not implemented", null)
}
