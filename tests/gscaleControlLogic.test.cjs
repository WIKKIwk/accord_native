const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
function load(filename) {
  filename = path.resolve(__dirname, '../src', filename);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printModels') return load('printing/printModels.ts');
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === '../workerControlsApi') return { isCanonicalApparatusId: () => true };
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const logic = load('gscale/gscaleControlLogic.ts');
const model = load('gscale/gscaleBatchModel.ts');

// @v2-test test/gscale_material_receipt_print_test.dart
// @v2-test test/gscale_material_receipt_print_test_cases_resplit_part_05.dart
test('manual quantities and duplicate counts retain V2 validation', () => {
  assert.equal(logic.parsePositiveKg('Infinity'), null); assert.equal(logic.parsePositiveKg('NaN'), null);
  assert.equal(logic.parsePositiveKg('125,5'), 125.5); assert.equal(logic.parsePositiveKg('1kg'), null);
  assert.equal(logic.parseManualDuplicateCount(''), 1); assert.equal(logic.parseManualDuplicateCount(' 5 '), 5);
  for (const input of ['0', '1.5', '101']) assert.equal(logic.parseManualDuplicateCount(input), null);
  assert.equal(logic.canTriggerGrossPrint(1, true, '0,95'), false);
  assert.equal(logic.canTriggerGrossPrint(1, true, '0,8'), true);
});

test('stable scale readings trigger a print once per changed weight', () => {
  const key = logic.autoBatchPrintKey(2.5, true, false, '');
  assert.equal(key, '2.500');
  assert.equal(logic.autoBatchPrintKey(2.5, false, false, ''), '');
  assert.equal(logic.shouldTriggerAutoBatchPrint(true, false, key, ''), true);
  assert.equal(logic.shouldTriggerAutoBatchPrint(true, false, key, key), false);
  assert.equal(logic.shouldTriggerAutoBatchPrint(true, true, key, ''), false);
});

test('receipt converts to a material product label with net weight and meters', () => {
  const receipt = model.materialReceiptPrintResponseFromJson({ ok: true, epc: '303132333435363738394142',
    item_code: 'CPP 1030/25', item_name: 'CPP 1030/25', warehouse: 'Kalidor', net_qty: 23, gross_qty: 25,
    length_m: 125, unit: 'kg', print_count: 1 });
  const request = logic.receiptToUsbPrintRequest(receipt, 'material_product');
  assert.equal(request.epc, receipt.epc);
  assert.equal(request.materialProductLabelTitle, 'CPP 1030/25  B:25 kg N:23 kg Metri: 125 m');
  assert.equal(request.largeQrLabelFooter(request.epc), 'EPC: 303132333435363738394142');
});

test('reprint preserves EPC, one label and historical gross only when net matches stock', () => {
  const prepared = { stock: { barcode: 'EPC', item_code: 'CPP', item_name: 'CPP', warehouse: 'Kalidor', qty: 23, length_m: 125, uom: 'kg' } };
  const history = { qty: 23, net_qty: 23, gross_qty: 25, unit: 'kg', print_mode: 'rfid' };
  const request = logic.buildMaterialReceiptReprintRequest(prepared, history, 'zebra');
  assert.equal(request.epc, 'EPC'); assert.equal(request.printCount, 1); assert.equal(request.netQty, 23);
  assert.equal(request.grossQty, 25); assert.equal(request.progressQty, 125); assert.equal(request.printMode, 'rfid');
  const stale = logic.buildMaterialReceiptReprintRequest({ stock: { ...prepared.stock, qty: 12 } }, history, 'godex');
  assert.equal(stale.grossQty, 12); assert.equal(stale.tareEnabled, false); assert.equal(stale.printMode, 'label');
});

test('print success copy includes target and duplicate count', () => {
  const receipt = model.materialReceiptPrintResponseFromJson({ status: 'printed', net_qty: 2.5, unit: 'kg', print_count: 5 });
  assert.equal(logic.buildPrintSuccessMessage(receipt, 'rp-scale @ 41257'), 'Printerga yuborildi • rp-scale @ 41257 • 5 ta • netto 2.5 kg');
});
