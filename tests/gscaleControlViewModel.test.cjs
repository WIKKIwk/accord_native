const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '../src/gscale', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === './gscaleControlLogic') return load('gscaleControlLogic.ts');
    if (name === './gscalePreparation') return { isTayyorlovSimpleWarehouse: (control, fresh, role, warehouse, list) =>
      control && !fresh && role === 'tayyorlov_masteri' && list.some(v => v.trim().toLowerCase() === warehouse.trim().toLowerCase()) };
    if (name === '../printing/printModels') return { UsbRpsPrintRequest: class {} };
    if (name === '../shared/mobileApiException') return { MobileApiException: class extends Error {} };
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { gscaleControlViewModel } = load('gscaleControlViewModel.ts');
const draft = { item_code: 'PET', item_name: 'PET', item_requires_dimensions: true, warehouse: 'W', warehouse_mode: 'manual',
  default_warehouse: '', quantity_source: 'manual', babina_enabled: false, babina_text: '', width_text: '500', micron_text: '12',
  length_text: '125', manual_qty_text: '5', manual_duplicate_text: '', printer: 'zebra' };
const input = { controlOnly: true, freshForm: false, role: 'material_taminotchi', linkedOrderWidthMm: 500,
  materialWarehouses: [], transport: 'wifi', hasServer: false, hasOfflinePrinter: false, hasBluetoothPrinter: false,
  batchResolved: true, batch: null, batchContextEditing: false, draftContextSaved: false, usesReceiptOrderContext: true,
  preparationPresetLoading: false, manualPrintLoading: false, batchActionLoading: false, simpleReceiptLoading: false,
  requestInFlight: false, draft, snapshot: { batchActive: false, scaleValue: '--' } };

test('valid context can be saved without a printer but cannot start a batch', () => {
  const state = gscaleControlViewModel(input);
  assert.equal(state.saveEnabled, true); assert.equal(state.manualStartEnabled, false);
  assert.equal(gscaleControlViewModel({ ...input, hasServer: true }).manualStartEnabled, true);
});

test('simple preparation warehouse forces manual intake and skips print setup', () => {
  const state = gscaleControlViewModel({ ...input, role: 'tayyorlov_masteri', materialWarehouses: ['w'],
    draft: { ...draft, quantity_source: 'scale' } });
  assert.equal(state.simpleReceiptMode, true); assert.equal(state.quantitySource, 'manual');
  assert.equal(state.simpleReady, true); assert.equal(state.hasPrintSelection, false);
});

test('active batch locks fields and displays width warning only outside preparation', () => {
  const state = gscaleControlViewModel({ ...input, linkedOrderWidthMm: 600, batch: { active: true, id: 'b', revision: 1,
    item_code: 'PET', item_name: 'PET', warehouse: 'W', quantity_source: 'manual', tare_enabled: false, width_mm: 500, micron: 12 },
    snapshot: { batchActive: true, scaleValue: '--' } });
  assert.equal(state.fieldsLocked, true); assert.equal(state.manualStopEnabled, true);
  assert.equal(state.widthRangeError, 'Diapazondan chiqdi (590–640 mm)');
  assert.equal(gscaleControlViewModel({ ...input, role: 'tayyorlov_masteri', linkedOrderWidthMm: 600 }).widthRangeError, null);
});
