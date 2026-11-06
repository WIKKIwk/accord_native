const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
const filename = path.resolve(__dirname, '../src/gscale/gscalePreparation.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded.require = name => {
  if (name === '../shared/mobileApiException') return { MobileApiException };
  if (name === './gscaleControlLogic') return { parsePositiveKg: value => {
    const normalized = value.trim().replaceAll(',', '.');
    return /^\d+(?:\.\d+)?$/.test(normalized) && +normalized > 0 ? +normalized : null;
  } };
  return require(name);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const p = loaded.exports;

test('preparation preset resolves a single exact order-scoped material and rejects ambiguous matches', async () => {
  const calls = [];
  const base = { orderId: 'o1', materialId: 'PET', materialName: 'Polymer', current: () => true,
    loadPage: async (query, order, offset, limit) => { calls.push({ query, order, offset, limit }); return [{ code: 'PET', name: 'Polymer' }]; } };
  assert.equal((await p.loadPreparationReceiptPreset(base)).code, 'PET');
  assert.deepEqual(calls.map(c => c.query), ['pet', 'polymer']);
  assert.ok(calls.every(c => c.order === 'o1' && c.limit === 200));
  await assert.rejects(p.loadPreparationReceiptPreset({ ...base, loadPage: async () => [{ code: 'PET', name: 'Polymer' }, { code: 'PET2', name: 'Polymer' }] }), /bir nechta/);
  await assert.rejects(p.loadPreparationReceiptPreset({ ...base, loadPage: async () => [] }), /topilmadi/);
  assert.equal(await p.loadPreparationReceiptPreset({ ...base, current: () => false }), null);
});

test('active batch must match order, material and formula before preparation printing', () => {
  const options = { freshForm: true, controlOnly: true, orderId: 'o1', materialId: 'm1', variantId: 'v1', itemCode: 'PET', applied: true,
    batch: { active: true, order_id: 'o1', item_code: 'PET', preparation_formula: { material_id: 'm1', variant_id: 'v1' } } };
  assert.equal(p.preparationPresetConflict(options), '');
  assert.match(p.preparationPresetConflict({ ...options, orderId: 'other' }), /Boshqa homashyo/);
  assert.match(p.preparationPresetConflict({ ...options, variantId: 'other' }), /formulasiga/);
  assert.match(p.preparationPresetConflict({ ...options, applied: false, itemCode: null }), /tekshirilmaguncha/);
});

test('simple receipt rechecks the material warehouse scope before posting kilograms', async () => {
  const calls = [];
  const options = { itemCode: 'I', warehouse: ' A ', quantityText: '12,5', role: 'tayyorlov_masteri', controlOnly: true,
    freshForm: false, materialWarehouses: [], refreshMaterialWarehouses: async () => ['a'], submit: async value => { calls.push(value); } };
  await p.submitSimpleGScaleReceipt(options);
  assert.deepEqual(calls, [{ item_code: 'I', warehouse: 'A', kg: '12.5' }]);
  await assert.rejects(p.submitSimpleGScaleReceipt({ ...options, refreshMaterialWarehouses: async () => ['B'] }), /QR kirimi/);
  await assert.rejects(p.submitSimpleGScaleReceipt({ ...options, quantityText: '0' }), /miqdorini/);
  assert.equal(calls.length, 1);
});
