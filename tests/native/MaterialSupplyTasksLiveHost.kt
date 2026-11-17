package expo.modules.accordproductionlive

fun main() {
    val origin = "https://example.test"
    val target = "wss://example.test/v1/mobile/production-tasks/live?token=synthetic&kind=material&apparatus=&limit=10&search=&epoch=e&scope=s&rev=7"
    val request = supplyTasksSocketRequest(origin, target)
    check(request.url.toString() == target.replaceFirst("wss://", "https://"))
    check(request.header("Cookie") == null && request.header("Authorization") == null)
    for (bad in listOf("$target&token=again", "$target&other=1", "$target#fragment", target.replace("wss:", "ws:"),
        target.replace("example.test", "other.test"), target.replace("/live?", "/live/?"),
        target.replace("token=synthetic", "token="), target.replace("wss://", "wss://user:secret@"))) {
        check(runCatching { supplyTasksSocketRequest(origin, bad) }.isFailure)
    }
    check(runCatching { productionSocketRequest(origin, target) }.isFailure)
    check(runCatching { warehouseSocketRequest(origin, target) }.isFailure)
    val client = newProductionSocketClient()
    check(client.pingIntervalMillis == 25000 && !client.followRedirects && !client.followSslRedirects)
    println("Kotlin supply task admission, ping and endpoint isolation passed")
}
