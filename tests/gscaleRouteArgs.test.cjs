const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/gscale/gscaleRouteArgs.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { serializeGScaleModeArgs, parseGScaleModeArgs } = loaded.exports;

test('GScale route arguments preserve preparation order and fresh-form context', () => {
  const args = { order: { id: 'o1', code: 'A', title: 'Order', order_kg: '0', saved: false, width_mm: 500 },
    warehouse: 'Ombor A', materialId: 'm1', materialName: 'PET', formulaVariantId: 'v1', freshForm: true };
  assert.deepEqual(parseGScaleModeArgs(serializeGScaleModeArgs(args)), args);
});

test('missing arguments use V2 defaults and malformed orders do not silently become another order', () => {
  assert.deepEqual(parseGScaleModeArgs({}), { order: null, warehouse: null, materialId: null, materialName: null, formulaVariantId: '', freshForm: false });
  assert.throws(() => parseGScaleModeArgs({ order: JSON.stringify({ id: 'o1' }) }), /Invalid GScale order/);
});

test('Android preparation data and iOS flattened parameters yield identical GScale arguments', () => {
  const args = { order: { id: 'o1', code: 'A', title: 'Order', order_kg: '12', saved: false },
    warehouse: 'W', materialId: 'm', materialName: 'PET', formulaVariantId: 'v', freshForm: true };
  assert.deepEqual(parseGScaleModeArgs({ data: JSON.stringify(args) }), parseGScaleModeArgs(serializeGScaleModeArgs(args)));
  assert.throws(() => parseGScaleModeArgs({ data: JSON.stringify({ freshForm: 'true' }) }), /Invalid GScale arguments/);
});
