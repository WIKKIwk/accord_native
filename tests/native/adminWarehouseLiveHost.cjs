/* Run on macOS with Swift/JDK17, cached Kotlin2.2.20, and the module's OkHttp4.9.2/Okio2.8.0 jars in .expo/admin-live-host. */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-warehouse-live-'));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  return result.stdout.trim();
}
function cachedJar(group, artifact, version) {
  const directory = path.join(os.homedir(), '.gradle/caches/modules-2/files-2.1', group, artifact, version);
  for (const hash of fs.readdirSync(directory)) {
    const file = path.join(directory, hash, `${artifact}-${version}.jar`);
    if (fs.existsSync(file)) return file;
  }
  throw Error(`Missing cached compiler dependency: ${artifact}-${version}`);
}
try {
  const executable = path.join(temporary, 'swift-host');
  run('swiftc', ['modules/accord-production-live/ios/ProductionLiveSockets.swift', 'tests/native/AdminWarehouseLiveHost.swift', '-o', executable]);
  run(executable, []);
  const kotlin = name => cachedJar('org.jetbrains.kotlin', name, '2.2.20');
  const compiler = [kotlin('kotlin-compiler-embeddable'), kotlin('kotlin-stdlib'), kotlin('kotlin-script-runtime'),
    cachedJar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'), cachedJar('org.jetbrains.intellij.deps', 'trove4j', '1.0.20200330'),
    cachedJar('org.jetbrains', 'annotations', '13.0'), cachedJar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0')];
  const compile = [kotlin('kotlin-stdlib'), cachedJar('org.jetbrains', 'annotations', '13.0'),
    path.resolve('.expo/admin-live-host/okhttp-4.9.2.jar'), path.resolve('.expo/admin-live-host/okio-2.8.0.jar')];
  const classes = path.join(temporary, 'classes');
  const java = path.join(run('/usr/libexec/java_home', []), 'bin/java');
  run(java, ['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', compile.join(path.delimiter), '-d', classes,
    'modules/accord-production-live/android/src/main/java/expo/modules/accordproductionlive/ProductionLiveSockets.kt', 'tests/native/AdminWarehouseLiveHost.kt']);
  run(java, ['-cp', [classes, ...compile].join(path.delimiter), 'expo.modules.accordproductionlive.AdminWarehouseLiveHostKt']);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
