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

test('printer picker discovers Wi-Fi servers and returns the selected server and driver', async () => {
  const server = { name: 'Printer', endpoint: { baseUrl: 'http://192.168.1.2:39117' }, driver: 'http://driver:39117' };
  const { selectPreparationDevice: select, selectPreparationInventoryDevice: selectInventory } = setup(async () => ({ servers: [server] }));
  const choices = ['wifi', 'server:0'], shown = [];
  const dialogs = { choose: async (_title, options) => { shown.push(options); return choices.shift(); } };
  assert.deepEqual(await select(dialogs, () => true), { transport: 'wifi', serverBaseUrl: server.endpoint.baseUrl, driverBaseUrl: server.driver });
  assert.equal(shown[1][0].label, 'Printer');
  assert.ok(shown[1].some(option => option.value === 'manual'));
  choices.push('wifi', 'server:0');
  assert.deepEqual(await selectInventory(dialogs, () => true), { transport: 'wifi', serverBaseUrl: server.endpoint.baseUrl });
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

test('printer picker retains manual entry after discovery failure and cancels after scope change', async () => {
  const { selectPreparationDevice: select } = setup(async () => { throw Error('network unavailable'); });
  const choices = ['wifi', 'manual'], dialogs = { choose: async () => choices.shift(), input: async () => 'http://printer:39117' };
  assert.deepEqual(await select(dialogs, () => true), { transport: 'wifi', serverBaseUrl: 'http://printer:39117' });
  let active = true;
  const { selectPreparationDevice: changed } = setup(async () => { active = false; return { servers: [] }; });
  assert.equal(await changed({ choose: async () => 'wifi' }, () => active), null);
});
