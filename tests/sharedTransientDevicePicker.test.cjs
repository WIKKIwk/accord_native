const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const cache = new Map();
function load(file) { const filename = path.resolve(__dirname, '../src', file); if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = id => id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${id}.ts`))) : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports; }
const { createTransientDevicePicker } = load('shared/printing/transientDevicePicker.ts');
const { driverUrlForRs } = load('gscale/gscaleDiscovery.ts');
const { GScaleDeviceStore } = load('gscale/gscaleDeviceState.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const server = { endpoint: { host: '192.168.1.10', port: 39117, baseUrl: 'http://192.168.1.10:39117' },
  handshake: { serverName: 'Scale', displayName: 'Operator', role: 'operator', serverRef: '5070', printActivity: {} }, latencyMs: 3 };
function setup(overrides = {}) { const calls = []; let valid = true; const request = createTransientDevicePicker({ isCurrent: () => valid,
  scan: async () => { calls.push('scan'); return { servers: [server], candidateCount: 1 }; },
  probe: async endpoint => { calls.push(['probe', endpoint]); return server; }, ...overrides });
  return { ...request, calls, invalidate: () => { valid = false; } }; }

test('picker is transient and returns the complete Wi-Fi server without discovery or storage on creation', async () => {
  const h = setup(); assert.deepEqual(h.calls, []); assert.equal(h.adapter.getSnapshot().device.connection, null);
  const selection = { transport: 'wifi', server }; await h.adapter.selectDevice(selection);
  assert.equal(await h.result, selection); assert.equal((await h.result).server, server);
  assert.equal(driverUrlForRs((await h.result).server), 'http://100.117.62.18:39117'); assert.deepEqual(h.calls, []);
});
for (const selection of [{ transport: 'bluetooth', bluetoothPrinter: { name: 'printer', address: 'AA' } },
  { transport: 'offline', offlinePrinter: { kind: 'zebra', deviceName: 'USB' } }]) {
  test(`${selection.transport} selection is returned once without persistence/session dependencies`, async () => {
    const h = setup(); await h.adapter.selectDevice(selection); await h.adapter.selectDevice({ transport: 'wifi', server });
    h.cancel(); assert.equal(await h.result, selection); assert.deepEqual(h.calls, []);
  });
}
test('Wi-Fi scan and manual probe use the existing endpoint validation and preserve full response', async () => {
  const h = setup(); h.adapter.selectConnection('wifi'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls, ['scan']); assert.equal(h.adapter.getSnapshot().device.scanResult.servers[0], server);
  assert.equal(await h.adapter.checkDeviceAddress(''), null); assert.match(h.adapter.getSnapshot().device.addressError, /formati/);
  assert.equal(await h.adapter.checkDeviceAddress('localhost'), null); assert.match(h.adapter.getSnapshot().device.addressError, /Localhost/);
  assert.equal(await h.adapter.checkDeviceAddress('192.168.1.10'), server);
  assert.equal(h.calls[1][1].baseUrl, 'http://192.168.1.10:39117'); h.cancel(); assert.equal(await h.result, null);
});
test('back invalidates a Wi-Fi discovery and probe, and a new scan can start', async () => {
  const scans = [deferred(), deferred()], probe = deferred(); let index = 0;
  const h = setup({ scan: () => scans[index++].promise, probe: () => probe.promise });
  h.adapter.selectConnection('wifi'); const check = h.adapter.checkDeviceAddress('192.168.1.10');
  h.adapter.selectConnection(null); h.adapter.selectConnection('wifi');
  scans[0].resolve({ servers: [server], candidateCount: 7 }); probe.resolve(server);
  assert.equal(await check, null); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.adapter.getSnapshot().device.scanResult, null); assert.equal(h.adapter.getSnapshot().device.scanning, true);
  scans[1].resolve({ servers: [], candidateCount: 2 }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.adapter.getSnapshot().device.scanResult.candidateCount, 2); h.dispose(); assert.equal(await h.result, null);
});
test('cancel or unmount resolves null once and suppresses late scan, probe, and selection', async () => {
  for (const action of ['cancel', 'dispose']) {
    const scan = deferred(), probe = deferred(); const h = setup({ scan: () => scan.promise, probe: () => probe.promise }); let notifications = 0;
    h.adapter.subscribe(() => notifications++); h.adapter.selectConnection('wifi'); const check = h.adapter.checkDeviceAddress('192.168.1.10');
    h[action](); const count = notifications; h.cancel(); await h.adapter.selectDevice({ transport: 'wifi', server });
    scan.resolve({ servers: [server], candidateCount: 1 }); probe.resolve(server); assert.equal(await check, null);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(await h.result, null); assert.equal(notifications, count);
  }
});
test('a changed account/session makes a late result resolve null', async () => {
  const scan = deferred(), h = setup({ scan: () => scan.promise }); h.adapter.selectConnection('wifi'); h.invalidate();
  scan.resolve({ servers: [server], candidateCount: 1 }); assert.equal(await h.result, null);
  await h.adapter.selectDevice({ transport: 'wifi', server }); assert.equal(await h.result, null);
});
test('GScale default store continues to remember and persist Bluetooth and Wi-Fi selections', async () => {
  const saved = [], remembered = [], bluetooth = { name: 'XP', address: 'AA' };
  const store = new GScaleDeviceStore({ preferences: { saveLastPrintDevice: async x => saved.push(x), loadLastPrintDevice: async () => null },
    resolver: {}, resolveSessionBluetooth: async () => null, rememberSessionBluetooth: x => remembered.push(x),
    scan: async () => ({ servers: [], candidateCount: 0 }), probe: async () => null });
  const bt = { transport: 'bluetooth', bluetoothPrinter: bluetooth }, wifi = { transport: 'wifi', server };
  await store.select(bt); await store.select(wifi); assert.deepEqual(saved, [bt, wifi]); assert.deepEqual(remembered, [bluetooth]); store.dispose();
});
