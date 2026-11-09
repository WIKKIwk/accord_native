const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const policy = compile('gscale/gscaleMaterialPolicy'), safe = new policy.MaterialGScalePolicy(() => true);
let restored;
const { GScaleDeviceStore } = compile('gscale/gscaleDeviceState', { './gscaleDiscovery': {},
  './gscalePreferences': { restoreLastPrintDevice: async () => restored } });
const usb = { transport: 'offline', offlinePrinter: { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f, productId: 1,
  deviceName: '/dev/usb/1', manufacturerName: 'Zebra', productName: 'ZD' } };
const godex = { transport: 'offline', offlinePrinter: { ...usb.offlinePrinter, kind: 'godex', printer: 'godex' } };
const wifi = { transport: 'wifi', server: { endpoint: { baseUrl: 'http://scale:39117' } } };

test('restricted restore and manual selection reject unsupported choices without saving or remembering them', async () => {
  const writes = [], deps = { preferences: { async saveLastPrintDevice(value) { writes.push(value); }, async loadLastPrintDevice() { return { transport: 'offline' }; } },
    resolver: {}, async resolveSessionBluetooth() { return { name: 'Unknown', address: 'x', printer: 'xp-p323b' }; },
    rememberSessionBluetooth(value) { writes.push(value); }, async scan() { return { servers: [], candidateCount: 0 }; } };
  restored = godex; const store = new GScaleDeviceStore(deps, value => safe.allowSelection(value));
  await store.restore(); assert.equal(store.getSnapshot().selection, null); assert.equal(store.getSnapshot().needsAttention, true);
  await assert.rejects(store.select(wifi), /Printer ulanmagan/); await assert.rejects(store.select(godex), /Printer ulanmagan/);
  assert.deepEqual(writes, []); await store.select(usb); assert.equal(writes.length, 1); assert.equal(store.getSnapshot().selection, usb); store.dispose();
});


test('a rejected new choice leaves old selection visible but blocks every restricted write until a valid reselection', async () => {
  const writes = [], deps = { preferences: { async saveLastPrintDevice() {}, async loadLastPrintDevice() { return null; } },
    resolver: {}, async resolveSessionBluetooth() { return null; }, rememberSessionBluetooth() {}, async scan() { return { servers: [], candidateCount: 0 }; } };
  const store = new GScaleDeviceStore(deps, value => safe.allowSelection(value));
  await store.select(usb); assert.equal(store.getSnapshot().needsAttention, false);
  await assert.rejects(store.select(godex), /Printer ulanmagan/);
  assert.equal(store.getSnapshot().selection, usb); assert.equal(store.getSnapshot().needsAttention, true);
  const active = { id: 'b', revision: 1, active: true, printer: 'zebra', driver_url: 'usb://local' };
  for (const operation of ['start', 'stop', 'print', 'archive', 'reprint']) {
    const batch = operation === 'stop' || operation === 'print' ? active : null;
    const state = { device: store.getSnapshot(), draft: { printer: 'zebra' }, batch: { resolved: true, batch } };
    try { safe.assertOperation(operation, state); writes.push(operation); } catch {}
  }
  assert.deepEqual(writes, []);
  await store.select(usb); assert.equal(store.getSnapshot().needsAttention, false);
  assert.doesNotThrow(() => safe.assertOperation('start', { device: store.getSnapshot(), draft: { printer: 'zebra' }, batch: { resolved: true, batch: null } }));
  store.dispose();
});
