const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleBluetoothDevices.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { watchGScaleBluetoothDevices } = mod.exports;

test('Android reads paired printers while iOS subscribes to discovery events', async () => {
  let listener, stopped = false, pairedCalls = 0, discoveryCalls = 0;
  const printer = { name: 'XP', address: 'AA' }, events = [];
  const native = { pairedPrinters: async () => { pairedCalls++; return [printer]; },
    discoverPrinters: async fn => { discoveryCalls++; listener = fn; return () => { stopped = true; }; } };
  await watchGScaleBluetoothDevices('android', native, value => events.push(value));
  assert.deepEqual(events, [{ paired: [printer], complete: true }]);
  assert.equal(pairedCalls, 1); assert.equal(discoveryCalls, 0);
  const close = await watchGScaleBluetoothDevices('ios', native, value => events.push(value));
  listener({ printer, completed: false }); listener({ printer: null, completed: true }); close();
  assert.deepEqual(events.slice(1), [{ printer }, { complete: true }]);
  assert.equal(discoveryCalls, 1); assert.equal(stopped, true);
});
