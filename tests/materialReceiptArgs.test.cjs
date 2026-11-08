const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${file}.ts`), module_ = new Module(filename, module);
  module_.filename = filename; module_.paths = module.paths;
  module_.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  module_._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return module_.exports;
}
const trim = load('shared/dartApparatus', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
const { materialReceiptArgs } = load('material/materialReceiptArgs', { '../shared/dartApparatus': trim });
const route = load('gscale/gscaleRouteArgs');
const order = changes => ({ map: { id: 'order-1', code: ' CODE ', order_number: 'fallback', title: 'Film', width_mm: 510,
  order_kg: 12, ...changes }, program: {} });
test('material full order maps to the existing GScale route model without performing a write', () => {
  const args = materialReceiptArgs(order());
  assert.deepEqual(args, { order: { id: 'order-1', code: ' CODE ', title: 'Film', width_mm: 510, order_kg: '12.0', saved: false } });
  assert.deepEqual(route.parseGScaleModeArgs(route.serializeGScaleModeArgs(args)), { ...args, warehouse: null,
    materialId: null, materialName: null, formulaVariantId: '', freshForm: false });
});
test('Dart-trimmed empty code chooses order number and nullable values retain source defaults', () => {
  assert.deepEqual(materialReceiptArgs(order({ code: '\u0085  ', order_number: 'N-2', width_mm: null, order_kg: null })),
    { order: { id: 'order-1', code: 'N-2', title: 'Film', width_mm: null, order_kg: '0', saved: false } });
  assert.equal(materialReceiptArgs(order({ order_kg: 12.5 })).order.order_kg, '12.5');
  assert.equal(materialReceiptArgs(order({ order_kg: -0 })).order.order_kg, '-0.0');
  assert.throws(() => materialReceiptArgs(order({ order_kg: Infinity })), /Invalid order weight/);
});
