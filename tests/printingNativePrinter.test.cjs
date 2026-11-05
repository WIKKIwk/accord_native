const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const calls = [];
let paired = [];
let failPair = false;
const mock = {
  async pairedPrinters() { if (failPair) throw new Error('Bluetooth unavailable'); return paired; },
  async printLabel(payload) { calls.push(['printLabel', payload]); return { ok: true, printer_status: 'Bluetooth OK' }; },
  async printRaw(payload) { calls.push(['printRaw', payload]); return { ok: true }; },
  async printTest(payload) { calls.push(['printTest', payload]); return { ok: true, bytes: 12 }; },
  async detectPrinter() { return { printer: 'zebra', productName: 'ZT411R' }; },
  async startDiscovery(session, listener) { calls.push(['discovery', session, listener]); return () => calls.push(['cancel', session]); },
};
const platform = { OS: 'android' };
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src/printing', file);
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => {
    if (name === '../../modules/accord-printer/src/AccordPrinterModule') return { AccordPrinter: mock };
    if (name === 'react-native') return { Platform: platform };
    if (name === '../workerControlsApi') return { isCanonicalApparatusId: value => value.startsWith('apparatus:') };
    if (name.startsWith('./')) return load(`${name.slice(2)}.ts`);
    return require(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}
const { UsbRpsPrintRequest } = load('printModels.ts');
const { NativeBluetoothPrinter, BluetoothPrinterProfile, NativeUsbPrinter } = load('nativePrinter.ts');
const { SessionBluetoothPrinter } = load('sessionBluetoothPrinter.ts');

// @v2-test test/native_bluetooth_printer_test.dart
test('Bluetooth payload preserves V2 request normalization, color, layout and Data Matrix', async () => {
  calls.length = 0;
  const request = UsbRpsPrintRequest.fromPrintJson({ epc: ' abc123 ', item_name: 'Қизил Ғишт',
    item_code: 'P1', customer_name: 'Customer One', qolip_color: '#B7BCC2', gross_qty: 10,
    tare_kg: 0.5, label_kind: 'progress', progress_qty: 125, progress_unit: 'm',
    apparatus: 'apparatus:default:bosma_7', apparatus_display_name: '7 ta rangli bosma' });
  const result = await NativeBluetoothPrinter.printLabel(request, new BluetoothPrinterProfile('', '00:11'));
  assert.equal(result.ok, true);
  const [method, payload] = calls[0];
  assert.equal(method, 'printLabel');
  assert.equal(payload.mac_address, '00:11');
  assert.equal(payload.epc, 'ABC123');
  assert.equal(payload.item_name, "QIZIL G'ISHT");
  assert.equal(payload.customer_name, 'CUSTOMER ONE');
  assert.equal(payload.qolip_color, 'MATLAK');
  assert.equal(payload.progress_unit, 'M');
  assert.equal(payload.material_data_matrix, true);
  assert.deepEqual(payload.material_data_matrix_bars, load('materialDataMatrix.ts').materialDataMatrixBars(' abc123 '));
  assert.equal(payload.progress_lines[0].text, 'APARAT: 7TALIK BOSMA');
  assert.equal(payload.progress_code_x, 84);
});

test('material split, paddon and ordinary labels retain their distinct V2 payloads', async () => {
  calls.length = 0;
  const printer = new BluetoothPrinterProfile('XP-P323B', 'a');
  await NativeBluetoothPrinter.printLabel(UsbRpsPrintRequest.fromPrintJson({ epc: 'e', item_name: 'BOPP 120/12',
    label_kind: 'material_product', progress_unit: 'm' }), printer);
  assert.deepEqual(calls[0][1].material_name_lines, ['HOMASHYO: BOPP 120/12']);
  await NativeBluetoothPrinter.printLabel(UsbRpsPrintRequest.fromPrintJson({ epc: ' qolip-paddon:AbC ',
    label_kind: 'paddon_code' }, { paddonLabelLines: ['Турли — бобина'] }), printer);
  assert.equal(calls[1][1].epc, 'qolip-paddon:AbC');
  assert.deepEqual(calls[1][1].paddon_label_lines, ['TURLI - BOBINA']);
  await NativeBluetoothPrinter.printLabel(UsbRpsPrintRequest.test('epc'), printer);
  assert.equal(Object.hasOwn(calls[2][1], 'material_data_matrix'), false);
});

test('USB calls retain raw bytes, count and detected Zebra profile', async () => {
  calls.length = 0;
  await NativeUsbPrinter.printRaw(Uint8Array.from([0, 128, 255]), 'zebra', 0);
  assert.deepEqual(calls[0], ['printRaw', { bytes: [0, 128, 255], print_count: 1, printer_kind: 'zebra', label_count: 1 }]);
  assert.equal((await NativeUsbPrinter.detectPrinter()).displayName, 'Zebra • ZT411R');
  assert.equal((await NativeUsbPrinter.printTest('title', 'payload')).bytes, 12);
});

// @v2-test test/session_bluetooth_printer_test.dart
test('session cache follows paired devices, errors and iOS optimistic validation', async () => {
  SessionBluetoothPrinter.forget();
  SessionBluetoothPrinter.remember(new BluetoothPrinterProfile('ignored', '  '));
  assert.equal(SessionBluetoothPrinter.cached, null);
  const saved = new BluetoothPrinterProfile('saved', '00:11:AA');
  SessionBluetoothPrinter.remember(saved);
  paired = [{ name: 'updated', address: '0011aa' }];
  assert.equal((await SessionBluetoothPrinter.resolveCached()).name, 'updated');
  failPair = true;
  assert.equal(await SessionBluetoothPrinter.resolveCached(), null);
  assert.equal(SessionBluetoothPrinter.cached, saved);
  failPair = false;
  platform.OS = 'ios';
  assert.equal(await SessionBluetoothPrinter.resolveCached(), saved);
  platform.OS = 'android';
  SessionBluetoothPrinter.forgetIfMatches('00-11-AA');
  assert.equal(SessionBluetoothPrinter.cached, null);
  SessionBluetoothPrinter.remember(saved);
  paired = [];
  assert.equal(await SessionBluetoothPrinter.resolveCached(), null);
  assert.equal(SessionBluetoothPrinter.cached, null);
});

test('each discovery has a new session and translates printer and completion events', async () => {
  calls.length = 0;
  const events = [];
  const cancel = await NativeBluetoothPrinter.discoverPrinters(event => events.push(event));
  await NativeBluetoothPrinter.discoverPrinters(() => {});
  assert.notEqual(calls[0][1], calls[1][1]);
  calls[0][2]({ type: 'printer', name: '', address: ' iOS-printer ' });
  calls[0][2]({ type: 'complete' });
  assert.equal(events[0].printer.displayName, 'XP-P323B');
  assert.equal(events[0].printer.address, 'iOS-printer');
  assert.equal(events[1].completed, true);
  cancel();
  assert.deepEqual(calls[2], ['cancel', calls[0][1]]);
});
