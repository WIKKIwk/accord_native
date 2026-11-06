const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/gscale', name);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => name === './gscaleDiscovery' ? load('gscaleDiscovery.ts') : name === './gscalePreferences' ? load('gscalePreferences.ts') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { GScaleDeviceStore } = load('gscaleDeviceState.ts');
const saved = [];
const deps = () => ({ preferences: { async saveLastPrintDevice(value) { saved.push(value); }, async loadLastPrintDevice() { return null; } },
  resolver: {}, async resolveSessionBluetooth() { return null; }, rememberSessionBluetooth() {},
  async scan() { return { servers: [], candidateCount: 5 }; }, async probe() { return null; } });

test('picker begins with connection choices and scans only after selecting Wi-Fi', async () => {
  const store = new GScaleDeviceStore(deps());
  assert.equal(store.getSnapshot().connection, null); assert.equal(store.getSnapshot().scanResult, null);
  store.selectConnection('wifi');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.getSnapshot().scanResult.candidateCount, 5);
  store.selectConnection(null); assert.equal(store.getSnapshot().connection, null);
  store.dispose();
});

test('cached session Bluetooth wins and selection is persisted', async () => {
  saved.length = 0;
  const dependency = deps(), printer = { name: 'XP', address: 'A1' };
  dependency.resolveSessionBluetooth = async () => printer;
  const store = new GScaleDeviceStore(dependency);
  await store.restore();
  assert.equal(store.getSnapshot().selection.bluetoothPrinter, printer);
  assert.equal(saved[0].transport, 'bluetooth'); assert.equal(store.getSnapshot().needsAttention, false);
  store.dispose();
});

test('manual Wi-Fi address rejects invalid and localhost values and reports probe failure', async () => {
  const store = new GScaleDeviceStore(deps());
  await store.checkAddress(''); assert.match(store.getSnapshot().addressError, /formati/);
  await store.checkAddress('127.0.0.1'); assert.match(store.getSnapshot().addressError, /Localhost/);
  await store.checkAddress('192.168.1.10'); assert.match(store.getSnapshot().addressError, /muvaffaqiyatsiz/);
  store.dispose();
});
