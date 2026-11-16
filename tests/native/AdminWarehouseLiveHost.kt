package expo.modules.accordproductionlive

import okhttp3.Authenticator
import okhttp3.CookieJar

fun main() {
    val origin = "https://example.test"
    val warehouse = "wss://example.test/v1/mobile/admin/warehouses/live?token=synthetic"
    val production = "wss://example.test/v1/mobile/admin/production-maps/live?token=synthetic&protocol=state_delta_v2&worker_scope=true"
    val request = warehouseSocketRequest(origin, warehouse)
    check(request.url.toString() == warehouse.replaceFirst("wss://", "https://"))
    check(request.header("Cookie") == null && request.header("Authorization") == null)
    val client = newProductionSocketClient()
    check(client.cookieJar === CookieJar.NO_COOKIES && client.authenticator === Authenticator.NONE && client.proxyAuthenticator === Authenticator.NONE)
    check(!client.followRedirects && !client.followSslRedirects && client.pingIntervalMillis == 25000 && client.connectTimeoutMillis == 10000 && client.readTimeoutMillis == 0)
    check(client.callTimeoutMillis == 0)
    val warehouseClient = newWarehouseSocketClient(client)
    check(warehouseClient.callTimeoutMillis == 10000 && warehouseClient.pingIntervalMillis == 25000)
    check(warehouseClient.cookieJar === CookieJar.NO_COOKIES && !warehouseClient.followRedirects && !warehouseClient.followSslRedirects)
    check(warehouseClient.dispatcher === client.dispatcher && warehouseClient.connectionPool === client.connectionPool)
    productionSocketRequest(origin, production)
    val bad = listOf(production, "$warehouse&token=again", "$warehouse&other=1", "$warehouse#fragment",
        warehouse.replace("wss:", "ws:"), warehouse.replace("example.test", "other.test"),
        warehouse.replace("wss://", "wss://user:secret@"), warehouse.replace("/live?", "/live/?"),
        warehouse.replace("token=synthetic", "token="), warehouse.replace("token=synthetic", "token=%20synthetic"))
    for (target in bad) check(runCatching { warehouseSocketRequest(origin, target) }.isFailure)
    check(runCatching { productionSocketRequest(origin, warehouse) }.isFailure)
    println("Kotlin Warehouse admission/policy and Worker admission regression passed")
}
