const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup(scan, paired = async () => [{ displayName: 'BT', address: 'AB' }]) {
  const filename = path.resolve(__dirname, '../src/preparation/preparationDevicePicker.android.ts'), loaded = new Module(filename, module);
  const mocks = {
    '../gscale/gscaleDiscovery': { driverUrlForRs: server => server.driver, printTargetLabel: server => server.name },
    '../gscale/gscaleDiscoveryRuntime': { scanGscaleServers: scan },
    '../printing/nativePrinter': { NativeBluetoothPrinter: { pairedPrinters: paired } },
    '../printing/printService': { PrintService: { detectOfflinePrinter: async () => ({ name: 'USB' }) } },
    './preparationPrinter': { preparationManualPrinterServer: async address => ({ transport: 'wifi', serverBaseUrl: address }) },
  };
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}

test('user-disabled Wi-Fi and USB cannot trigger discovery or selection', async () => {
  let scans = 0;
  const api = setup(async () => { scans++; return { servers: [] }; });
  for (const mode of ['wifi', 'usb', null]) {
    const shown = [], dialogs = { choose: async (_title, options) => { shown.push(options); return mode; } };
    assert.equal(await api.selectPreparationDevice(dialogs, () => true), null);
    assert.equal(await api.selectPreparationInventoryDevice(dialogs, () => true), null);
    assert.deepEqual(shown[0], [{ label: 'Bluetooth printer', value: 'bluetooth' }]);
  }
  assert.equal(scans, 0);
});

test('empty Bluetooth discovery offers the V2 retry before selecting a paired printer', async () => {
  let scans = 0;
  const { selectPreparationDevice: select } = setup(async () => ({ servers: [] }), async () => ++scans === 1 ? [] : [{ displayName: 'BT', address: 'AB' }]);
  const choices = ['bluetooth', 'retry', 'AB'], shown = [];
  const dialogs = { choose: async (title, options, message) => { shown.push({ title, options, message }); return choices.shift(); } };
  assert.deepEqual(await select(dialogs, () => true), { transport: 'bluetooth', printer: { displayName: 'BT', address: 'AB' } });
  assert.equal(shown[1].title, 'Bluetooth printer topilmadi');
  assert.equal(shown[1].options[0].label, 'Qayta qidirish');
  assert.equal(shown[1].message, 'Printerni Android Bluetooth sozlamalarida avval bog‘lang (pair).');
});

test('printer picker cancels if the scope changes while reading paired devices', async () => {
  let active = true;
  const { selectPreparationDevice: changed } = setup(async () => ({ servers: [] }), async () => { active = false; return [{ address: 'AB' }]; });
  let choices = 0;
  assert.equal(await changed({ choose: async () => { choices++; return 'bluetooth'; } }, () => active), null);
  assert.equal(choices, 1);
});
