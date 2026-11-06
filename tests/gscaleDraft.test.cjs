const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleDraft.ts');
const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
m.require = name => name === './gscaleControlLogic' ? {
  normalizePrinterChoice: value => ['godex', 'go-dex', 'g500'].includes(value.trim().toLowerCase()) ? 'godex' : 'zebra',
  normalizeQuantitySource: value => value.trim().toLowerCase() === 'manual' ? 'manual' : 'scale',
} : require(name);
m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const d = m.exports;

test('draft saves and restores V2 fields, normalizing printer and quantity source', async () => {
  let data = null;
  const storage = { async getItem() { return data; }, async setItem(k, v) { data = v; } };
  assert.equal((await d.loadOperatorControlDraft(storage)).printer, '');
  const input = { ...d.emptyOperatorControlDraft(), order_id: 'o1', item_code: 'PET', printer: 'G500', quantity_source: 'MANUAL',
    width_text: '500', micron_text: '12', length_text: '125', babina_enabled: true, babina_text: '0.5', context_saved: true };
  await d.saveOperatorControlDraft(storage, input);
  const restored = await d.loadOperatorControlDraft(storage);
  assert.equal(restored.printer, 'godex'); assert.equal(restored.quantity_source, 'manual');
  assert.equal(restored.order_id, 'o1'); assert.equal(restored.length_text, '125'); assert.equal(restored.context_saved, true);
  data = '{invalid';
  assert.deepEqual(await d.loadOperatorControlDraft(storage), d.emptyOperatorControlDraft());
});

test('explicit preparation destination overrides a saved warehouse and resets context', () => {
  const current = { ...d.emptyOperatorControlDraft(), printer: 'zebra', print_mode: 'rfid', quantity_source: 'scale' };
  const saved = { ...current, order_id: 'o1', item_code: 'PET', item_name: 'PET', warehouse: 'Old',
    warehouse_mode: 'default', default_warehouse: 'Old', context_saved: true };
  const restored = d.restoreOperatorDraft(current, saved, { materialReceipt: false, linkedOrderId: 'o1', linkedOrderWidthMm: null,
    initialWarehouse: 'New', activeBatch: false, freshForm: false });
  assert.equal(restored.warehouse, 'New'); assert.equal(restored.warehouse_mode, 'manual'); assert.equal(restored.context_saved, false);
});

test('material order changes do not restore another order’s product or dimensions', () => {
  const current = { ...d.emptyOperatorControlDraft(), printer: 'zebra', print_mode: 'rfid', quantity_source: 'scale' };
  const saved = { ...current, order_id: 'old', item_code: 'PET', warehouse: 'W', width_text: '400', micron_text: '12', length_text: '100' };
  const restored = d.restoreOperatorDraft(current, saved, { materialReceipt: true, linkedOrderId: 'new', linkedOrderWidthMm: 500,
    initialWarehouse: null, activeBatch: false, freshForm: false });
  assert.equal(restored.item_code, ''); assert.equal(restored.width_text, '500');
  assert.equal(restored.micron_text, ''); assert.equal(restored.length_text, '');
});
