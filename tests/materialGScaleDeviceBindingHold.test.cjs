// Characterizes a known native-bridge limitation. Do not expose Material GScale while this test describes the bridge.
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
const { MaterialGScalePolicy } = compile('gscale/gscaleMaterialPolicy');

test('KNOWN HOLD: a stale selected USB profile does not bind native print to that physical device', async () => {
  const selected = { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f, productId: 1, deviceName: '/dev/usb/A',
    manufacturerName: 'Zebra', productName: 'A' };
  // Device A has disappeared and device B is now the native bridge's current candidate.
  const physical = { kind: 'zebra', deviceName: '/dev/usb/B', vendorId: 0x0a5f, productId: 2 };
  const state = { device: { selection: { transport: 'offline', offlinePrinter: selected }, transport: 'offline', needsAttention: false },
    draft: { printer: 'zebra' }, batch: { resolved: true, batch: null } };
  const policy = new MaterialGScalePolicy(() => true), posts = [];
  assert.doesNotThrow(() => policy.assertOperation('start', state));
  posts.push('mock start or prepare'); // The JS snapshot alone does not see the physical hot swap.
  state.batch.batch = { id: 'b', revision: 1, active: true, printer: 'zebra', driver_url: 'usb://local' };
  assert.doesNotThrow(() => policy.assertOperation('print', state));
  let rawArgs;
  const printService = compile('printing/printService', {
    './nativePrinter': { NativeBluetoothPrinter: {}, NativeUsbPrinter: { printRaw: async (...args) => {
      rawArgs = args; return { ok: true, status: 'done', ...physical };
    } } }, './printTransport': {}, './sessionBluetoothPrinter': { SessionBluetoothPrinter: {} },
    './zebraRpsRenderer': { ZebraRpsRenderer: { renderRepeated: () => new Uint8Array([1, 2]) } },
    './printModels': { UsbPrinterProfile: class {}, UsbRpsPrintRequest: class {},
      UsbRpsPrintResponse: { fromMap: value => value } },
  });
  const request = { isMaterialProductLabel: false, printCount: 1, forPrinter: () => ({ printCount: 1,
    toJson: () => ({}), printMode: 'rfid', netQty: 1, grossQty: 1 }) };
  const result = await printService.PrintService.printRps(request, { transport: 'offline', printerProfile: selected });
  assert.deepEqual(posts, ['mock start or prepare']);
  assert.equal(rawArgs.length, 3); assert.equal(rawArgs[1], 'zebra');
  assert.equal(result.deviceName, '/dev/usb/B'); assert.notEqual(result.deviceName, selected.deviceName);
});
