const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/preparation/PreparationRoutes.ios.ts');
const loaded = new Module(filename, module), paths = [];
loaded.require = id => id === 'expo-router' ? { router: { push: value => paths.push(value) } } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);

test('scale navigation preserves warehouse and production arguments', () => {
  const { openPreparationScale } = loaded.exports;
  openPreparationScale({ warehouse: 'Ombor A' });
  const warehouse = new URL(paths.pop(), 'https://example.test');
  assert.equal(warehouse.pathname, '/ios-gscale');
  assert.equal(warehouse.searchParams.get('warehouse'), 'Ombor A');
  const order = { id: 'o1', code: 'A-1', title: 'Buyurtma', order_kg: '0', saved: false };
  openPreparationScale({ order, materialId: 'm1', materialName: 'PE', formulaVariantId: 'v1', freshForm: true });
  const production = new URL(paths.pop(), 'https://example.test');
  assert.equal(production.pathname, '/ios-gscale');
  assert.deepEqual(JSON.parse(production.searchParams.get('order')), order);
  assert.equal(production.searchParams.get('materialId'), 'm1');
  assert.equal(production.searchParams.get('materialName'), 'PE');
  assert.equal(production.searchParams.get('formulaVariantId'), 'v1');
  assert.equal(production.searchParams.get('freshForm'), 'true');
});
