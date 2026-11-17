const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, ...(fs.existsSync('/Applications/Xcode-beta.app') ? { DEVELOPER_DIR: '/Applications/Xcode-beta.app/Contents/Developer' } : {}) } });
  assert.equal(result.status, 0, result.stderr || String(result.error)); return result.stdout.trim();
}
function cachedJar(group, artifact, version) {
  const base = path.join(os.homedir(), '.gradle/caches/modules-2/files-2.1', group, artifact, version);
  if (!fs.existsSync(base)) return null;
  for (const hash of fs.readdirSync(base)) { const jar = path.join(base, hash, `${artifact}-${version}.jar`); if (fs.existsSync(jar)) return jar; }
  return null;
}
const swiftHost = `import Foundation
@main struct InventoryLiveHost {
  static func main() throws {
    let origin = "https://example.test"
    let target = "wss://example.test/v1/mobile/admin/inventory/live?token=synthetic&subscriptions=%5B%5D"
    let request = try inventorySocketRequest(origin: origin, target: target)
    precondition(request.url?.absoluteString == target && request.timeoutInterval == 10 && !request.httpShouldHandleCookies)
    precondition(request.value(forHTTPHeaderField: "Cookie") == nil && request.value(forHTTPHeaderField: "Authorization") == nil)
    let config = productionSocketSessionConfiguration()
    precondition(config.httpCookieStorage == nil && config.urlCredentialStorage == nil && config.urlCache == nil && !config.httpShouldSetCookies)
    let bad = [target + "&other=1", target + "&token=again", target + "&subscriptions=again", target + "#fragment",
      target.replacingOccurrences(of: "wss:", with: "ws:"), target.replacingOccurrences(of: "example.test", with: "foreign.test"),
      target.replacingOccurrences(of: "wss://", with: "wss://user:password@"), target.replacingOccurrences(of: "/live?", with: "/live/?"),
      target.replacingOccurrences(of: "token=synthetic", with: "token="), target.replacingOccurrences(of: "token=synthetic", with: "token=%20synthetic")]
    for value in bad { do { _ = try inventorySocketRequest(origin: origin, target: value); preconditionFailure("Unexpected Inventory destination") } catch {} }
    for factory in [productionSocketRequest, warehouseSocketRequest, supplyTasksSocketRequest] {
      do { _ = try factory(origin, target); preconditionFailure("Existing native admission widened") } catch {}
    }
    print("Swift Inventory fixed-endpoint, no-cookie configuration and existing endpoint isolation passed")
  }
}`;
const kotlinHost = `package expo.modules.accordproductionlive
import okhttp3.Authenticator
import okhttp3.CookieJar
fun main() {
  val origin = "https://example.test"
  val target = "wss://example.test/v1/mobile/admin/inventory/live?token=synthetic&subscriptions=%5B%5D"
  val request = inventorySocketRequest(origin, target)
  check(request.url.toString() == target.replaceFirst("wss://", "https://"))
  check(request.header("Cookie") == null && request.header("Authorization") == null)
  val client = newProductionSocketClient()
  check(client.cookieJar === CookieJar.NO_COOKIES && client.authenticator === Authenticator.NONE && client.proxyAuthenticator === Authenticator.NONE)
  check(!client.followRedirects && !client.followSslRedirects && client.pingIntervalMillis == 25000 && client.connectTimeoutMillis == 10000 && client.readTimeoutMillis == 0)
  val inventory = newWarehouseSocketClient(client)
  check(inventory.callTimeoutMillis == 10000 && inventory.pingIntervalMillis == 25000 && inventory.cookieJar === CookieJar.NO_COOKIES)
  check(inventory.dispatcher === client.dispatcher && inventory.connectionPool === client.connectionPool)
  val bad = listOf(target + "&other=1", target + "&token=again", target + "&subscriptions=again", target + "#fragment",
    target.replace("wss:", "ws:"), target.replace("example.test", "foreign.test"), target.replace("wss://", "wss://user:password@"),
    target.replace("/live?", "/live/?"), target.replace("token=synthetic", "token="), target.replace("token=synthetic", "token=%20synthetic"))
  for (value in bad) check(runCatching { inventorySocketRequest(origin, value) }.isFailure)
  check(runCatching { productionSocketRequest(origin, target) }.isFailure)
  check(runCatching { warehouseSocketRequest(origin, target) }.isFailure)
  check(runCatching { supplyTasksSocketRequest(origin, target) }.isFailure)
  println("Kotlin Inventory fixed-endpoint, timeout/ping policy and existing endpoint isolation passed")
}`;

test('actual Swift Inventory request policy compiles and rejects malformed/cross-origin/foreign endpoint admission', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brigader-inventory-swift-'));
  try {
    const host = path.join(dir, 'Host.swift'), binary = path.join(dir, 'host'); fs.writeFileSync(host, swiftHost);
    run('xcrun', ['swiftc', 'modules/accord-production-live/ios/ProductionLiveSockets.swift', host, '-o', binary]);
    assert.match(run(binary, []), /Inventory fixed-endpoint/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('actual Kotlin Inventory policy compiles against cached platform libraries and preserves native isolation', t => {
  const kotlin = name => cachedJar('org.jetbrains.kotlin', name, '2.2.21');
  const compiler = [kotlin('kotlin-compiler-embeddable'), kotlin('kotlin-stdlib'), kotlin('kotlin-script-runtime'), kotlin('kotlin-daemon-embeddable'),
    cachedJar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'), cachedJar('org.jetbrains', 'annotations', '13.0'),
    cachedJar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0')];
  const libraries = [kotlin('kotlin-stdlib'), cachedJar('org.jetbrains', 'annotations', '13.0'),
    cachedJar('com.squareup.okhttp3', 'okhttp', '4.12.0'), cachedJar('com.squareup.okio', 'okio-jvm', '3.6.0')];
  const java = path.resolve(root, '../.tools/jdk-17/Contents/Home/bin/java');
  if ([...compiler, ...libraries].some(value => !value) || !fs.existsSync(java)) { t.skip('Project host compiler dependencies are unavailable'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brigader-inventory-kotlin-'));
  try {
    const host = path.join(dir, 'BrigaderInventoryLiveHost.kt'), classes = path.join(dir, 'classes'); fs.writeFileSync(host, kotlinHost);
    run(java, ['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect',
      '-classpath', libraries.join(path.delimiter), '-d', classes, 'modules/accord-production-live/android/src/main/java/expo/modules/accordproductionlive/ProductionLiveSockets.kt', host]);
    assert.match(run(java, ['-cp', [classes, ...libraries].join(path.delimiter), 'expo.modules.accordproductionlive.BrigaderInventoryLiveHostKt']), /Inventory fixed-endpoint/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
