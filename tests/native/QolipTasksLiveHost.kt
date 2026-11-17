package expo.modules.accordproductionlive
fun main() {
  val origin = "https://example.test"
  val target = "wss://example.test/v1/mobile/production-tasks/live?kind=qolip&apparatus=station&limit=10&search=&token=synthetic&epoch=e&rev=2&scope=s"
  val request = supplyTasksSocketRequest(origin, target)
  check(request.url.toString() == target.replaceFirst("wss://", "https://"))
  check(request.header("Cookie") == null && request.header("Authorization") == null)
  for (invalid in listOf("$target&token=duplicate", "$target&other=1", "$target#fragment", target.replace("wss:", "ws:"), target.replace("example.test", "other.test"), target.replace("/production-tasks/live", "/admin/production-maps/live"))) {
    check(runCatching { supplyTasksSocketRequest(origin, invalid) }.isFailure)
  }
  check(runCatching { productionSocketRequest(origin, target) }.isFailure)
  check(runCatching { warehouseSocketRequest(origin, target) }.isFailure)
  val client = newProductionSocketClient()
  check(client.pingIntervalMillis == 25000 && !client.followRedirects && !client.followSslRedirects)
  println("Kotlin Qolip tasks destination and ping policy checks passed")
}
