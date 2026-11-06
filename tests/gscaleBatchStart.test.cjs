const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printTransport') return { offlineUsbDriverUrl: 'usb://local' };
    if (name === '../printing/printModels') return { UsbRpsPrintRequest: class {} };
    if (name === '../shared/mobileApiException') return { MobileApiException: class extends Error {} };
    if (name === './gscaleControlLogic') return load('gscale/gscaleControlLogic.ts');
    if (name === './gscaleDiscovery') return load('gscale/gscaleDiscovery.ts');
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { startGScaleBatch } = load('gscale/gscaleBatchStart.ts');
const context = { batchResolved: true, batch: null, linkedOrderId: 'order-1', draftOrderId: 'order-1', usesReceiptOrderContext: true,
  preparationFormulaReceipt: true, initialMaterialId: 'm1', formulaVariantId: 'v1', transport: 'bluetooth', server: null,
  item: { code: 'PET', name: 'PET', requiresDimensions: true }, warehouse: 'W', widthText: '500', micronText: '12', lengthText: '125',
  babinaEnabled: true, babinaText: '0,5', offlinePrinter: null, bluetoothPrinter: { printer: 'xp-p323b', printMode: 'label' },
  batchPrinter: 'zebra', batchPrintMode: 'rfid', quantitySource: 'manual', grossQtyKg: 2 };
function dependencies() {
  const calls = [];
  return { calls, warehouseAllowed: async () => true, itemPage: async (...args) => { calls.push(['items', ...args]);
    return [{ code: 'PET', order_apparatus_options: { 'apparatus:1': 'First', 'apparatus:2': 'Second' } }]; },
  chooseApparatus: async options => { calls.push(['choose', options]); return 'apparatus:2'; },
  current: () => ({ mounted: true, linkedOrderId: 'order-1', draftOrderId: 'order-1', batchResolved: true, batchActive: false }),
  start: async request => { calls.push(['start', request]); return { ok: true, batch: {} }; } };
}

test('batch start refreshes order apparatus choices and retains formula and dimensions', async () => {
  const deps = dependencies(); await startGScaleBatch(context, deps);
  assert.deepEqual(deps.calls[0], ['items', 'PET', 'order-1', true]);
  const request = deps.calls[2][1];
  assert.equal(request.apparatus, 'apparatus:2'); assert.equal(request.preparation_formula_material_id, 'm1');
  assert.equal(request.preparation_formula_variant_id, 'v1'); assert.equal(request.width_mm, 500); assert.equal(request.micron, 12);
  assert.equal(request.length_m, 125); assert.equal(request.tare_kg, 0.5); assert.equal(request.driver_url, 'usb://local');
  assert.equal(request.printer, 'zebra'); assert.equal(request.print_mode, 'label');
});

test('batch start refuses changed order or active batch after asynchronous apparatus selection', async () => {
  const deps = dependencies();
  deps.current = () => ({ mounted: true, linkedOrderId: 'different', draftOrderId: 'order-1', batchResolved: true, batchActive: false });
  await assert.rejects(startGScaleBatch(context, deps), /Order o‘zgardi/);
  assert.equal(deps.calls.some(call => call[0] === 'start'), false);
  deps.current = () => ({ mounted: true, linkedOrderId: 'order-1', draftOrderId: 'order-1', batchResolved: true, batchActive: true });
  await assert.rejects(startGScaleBatch(context, deps), /faol batchni/);
});

test('batch start validates material dimensions and warehouse scope before any server mutation', async () => {
  const deps = dependencies();
  await assert.rejects(startGScaleBatch({ ...context, widthText: '' }, deps), /enini/);
  await assert.rejects(startGScaleBatch({ ...context, micronText: '0' }, deps), /mikronini/);
  await assert.rejects(startGScaleBatch({ ...context, lengthText: '' }, deps), /metrajini/);
  deps.warehouseAllowed = async () => false;
  await assert.rejects(startGScaleBatch(context, deps), /biriktirilmagan/);
  assert.equal(deps.calls.length, 0);
});
