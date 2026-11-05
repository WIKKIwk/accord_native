const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const calls = [];
let failBluetooth = false;
const mock = {
  async pairedPrinters() { return []; },
  async printLabel(args) { calls.push(['bluetooth', args]); if (failBluetooth) throw new Error('connection lost'); return { ok: true, bytes: 80 }; },
  async detectPrinter() { calls.push(['detect']); return { printer: 'zebra', productName: 'ZT411R' }; },
  async printRaw(args) { calls.push(['usb', args]); return { ok: true, bytes: args.bytes.length, printer_status: 'USB OK' }; },
};
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.resolve(__dirname, '../src/printing', name + '.ts');
  const m = new Module(filename, module);
  m.filename = filename;
  m.require = n => {
    if (n === '../../modules/accord-printer/src/AccordPrinterModule') return { AccordPrinter: mock };
    if (n === 'react-native') return { Platform: { OS: 'android' } };
    if (n === '../workerControlsApi') return { isCanonicalApparatusId: () => true };
    if (n.startsWith('./')) return load(n.slice(2));
    return require(n);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(name, m.exports);
  return m.exports;
}
const { UsbRpsPrintRequest } = load('printModels');
const { BluetoothPrinterProfile } = load('nativePrinter');
const { SessionBluetoothPrinter } = load('sessionBluetoothPrinter');
const { ZebraRpsRenderer } = load('zebraRpsRenderer');
const { PrintService } = load('printService');
function request(overrides = {}) {
  return new UsbRpsPrintRequest({ epc: '3031323334353637', itemCode: 'ITEM', itemName: 'Product',
    warehouse: 'ACCORD', printer: 'zebra', printMode: 'rfid', grossQty: 10, ...overrides });
}

test('Bluetooth printing returns V2 response fields and forwards selected printer', async () => {
  calls.length = 0;
  const printer = new BluetoothPrinterProfile('XP-P323B', 'AA:11');
  const response = await PrintService.printRps(request({ tareKg: 2, printCount: 2 }),
    { transport: 'bluetooth', bluetoothPrinter: printer });
  assert.equal(calls[0][0], 'bluetooth');
  assert.equal(calls[0][1].mac_address, 'AA:11');
  assert.equal(response.mode, 'label');
  assert.equal(response.netQty, 8);
  assert.equal(response.printCount, 2);
  assert.equal(response.bytes, 80);
  assert.equal(response.printerStatus, 'Bluetooth OK');
});

test('Bluetooth failure clears only the matching in-memory printer', async () => {
  const printer = new BluetoothPrinterProfile('XP', 'AA:11');
  SessionBluetoothPrinter.remember(printer);
  failBluetooth = true;
  await assert.rejects(PrintService.printRps(request(), { transport: 'bluetooth', bluetoothPrinter: printer }), /connection lost/);
  assert.equal(SessionBluetoothPrinter.cached, null);
  failBluetooth = false;
  await assert.rejects(PrintService.printRps(request(), { transport: 'bluetooth' }), /tanlanmagan/);
});

test('USB printing detects Zebra and sends the exact repeated ZPL bytes', async () => {
  calls.length = 0;
  const job = request({ printCount: 2 });
  const result = await PrintService.printRps(job);
  assert.equal(calls[0][0], 'detect');
  assert.equal(calls[1][0], 'usb');
  assert.deepEqual(calls[1][1].bytes, Array.from(ZebraRpsRenderer.renderRepeated(job)));
  assert.equal(calls[1][1].printer_kind, 'zebra');
  assert.equal(calls[1][1].label_count, 2);
  assert.equal(result.printerStatus, 'USB OK');
  assert.equal(result.printCount, 2);
});

test('material labels require one EPC per job', async () => {
  calls.length = 0;
  await assert.rejects(PrintService.printRps(request({ labelKind: 'material_product', printCount: 2 })), /alohida EPC/);
  assert.equal(calls.length, 0);
});
