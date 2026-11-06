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
  m.require = name => name === './gscaleDiscovery' ? load('gscaleDiscovery.ts') : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const p = load('gscalePreferences.ts');
function memory() {
  const data = new Map();
  return { data, async getItem(k) { return data.get(k) ?? null; }, async setItem(k, v) { data.set(k, v); }, async removeItem(k) { data.delete(k); } };
}

// @v2-test test/gscale_discovery_result_test.dart
test('last Bluetooth printer persists and restores using its normalized address', async () => {
  const storage = memory(), prefs = new p.GScalePreferences(storage);
  await prefs.saveLastPrintDevice({ transport: 'bluetooth', bluetoothPrinter: { name: 'XP-P323B', address: '00:11:22:AA' } });
  const saved = await prefs.loadLastPrintDevice();
  assert.equal(saved.bluetooth_address, '00:11:22:AA');
  const paired = { name: 'updated', address: '001122aa' };
  const restored = await p.restoreLastPrintDevice(saved, { pairedPrinters: async () => [paired] });
  assert.equal(restored.bluetoothPrinter, paired);
  assert.equal(await p.restoreLastPrintDevice(saved, { pairedPrinters: async () => [] }), null);
});

test('last server and cached discoveries survive reload, invalid loopback is discarded', async () => {
  const storage = memory(), prefs = new p.GScalePreferences(storage);
  const endpoint = { host: '192.168.1.20', port: 39117, baseUrl: 'http://192.168.1.20:39117' };
  await prefs.saveLastUsedServer(endpoint);
  assert.equal((await prefs.loadCachedDiscoveredServers())[0].handshake.displayName, 'Recent server');
  const servers = (await prefs.loadCachedDiscoveredServers()).map(server => ({ ...server, handshake: { ...server.handshake, serverRef: 'new' } }));
  await prefs.saveCachedDiscoveredServers(servers);
  assert.equal((await prefs.loadCachedDiscoveredServers())[0].handshake.serverRef, 'new');
  await prefs.clearCachedDiscoveredServers();
  await prefs.saveLastUsedServer({ host: '127.0.0.1', port: 39117, baseUrl: 'http://127.0.0.1:39117' });
  assert.equal(await prefs.loadLastUsedServer(), null);
});

test('saved USB printer requires the same nonzero hardware identifiers', async () => {
  const device = { kind: 'zebra', vendorId: 1, productId: 2, deviceName: '/dev/usb', manufacturerName: '', productName: '' };
  const saved = p.savedPrintDevice({ transport: 'offline', offlinePrinter: device });
  assert.equal((await p.restoreLastPrintDevice(saved, { detectOfflinePrinter: async () => device })).offlinePrinter, device);
  assert.equal(await p.restoreLastPrintDevice(saved, { detectOfflinePrinter: async () => ({ ...device, productId: 3 }) }), null);
});

// @v2-test test/material_receipt_defaults_test.dart
test('preferred material warehouse uses usage frequency, recency and account scope', async () => {
  const storage = memory(), first = new p.MaterialWarehousePreferences(storage, 'server/user-1');
  const other = new p.MaterialWarehousePreferences(storage, 'server/user-2');
  assert.equal(await first.preferred(['A', 'B']), null);
  assert.equal(await first.preferred(['A']), 'A');
  await first.record(' A '); await first.record('B');
  assert.equal(await first.preferred(['A', 'B']), 'B');
  await first.record('a');
  assert.equal(await first.preferred(['A', 'B']), 'A');
  assert.equal(await other.preferred(['A', 'B']), null);
  assert.equal(await first.preferred(['B']), 'B');
});
