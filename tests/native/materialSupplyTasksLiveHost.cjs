const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'accord-material-live-'));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
function jar(group, name, version) {
  const root = path.join(os.homedir(), '.gradle/caches/modules-2/files-2.1', group, name, version);
  for (const entry of fs.readdirSync(root)) { const file = path.join(root, entry, `${name}-${version}.jar`); if (fs.existsSync(file)) return file; }
  throw Error(`Missing cached dependency: ${name}-${version}`);
}
try {
  const swift = path.join(temporary, 'swift-host');
  run('swiftc', ['modules/accord-production-live/ios/ProductionLiveSockets.swift', 'tests/native/MaterialSupplyTasksLiveHost.swift', '-o', swift]); run(swift, []);
  const kotlin = name => jar('org.jetbrains.kotlin', name, '2.2.21');
  const compiler = [kotlin('kotlin-compiler-embeddable'), kotlin('kotlin-stdlib'), kotlin('kotlin-script-runtime'),
    jar('org.jetbrains.kotlin', 'kotlin-reflect', '1.6.10'),
    jar('org.jetbrains', 'annotations', '13.0'), jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0')];
  const dependencies = [kotlin('kotlin-stdlib'), jar('org.jetbrains', 'annotations', '13.0'),
    jar('com.squareup.okhttp3', 'okhttp', '4.12.0'), jar('com.squareup.okio', 'okio-jvm', '3.6.0')];
  const classes = path.join(temporary, 'classes'), java = '/Users/wikki/Desktop/Accord_project/.tools/jdk-17/Contents/Home/bin/java';
  run(java, ['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-classpath', dependencies.join(path.delimiter),
    '-d', classes, 'modules/accord-production-live/android/src/main/java/expo/modules/accordproductionlive/ProductionLiveSockets.kt', 'tests/native/MaterialSupplyTasksLiveHost.kt']);
  run(java, ['-cp', [classes, ...dependencies].join(path.delimiter), 'expo.modules.accordproductionlive.MaterialSupplyTasksLiveHostKt']);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
