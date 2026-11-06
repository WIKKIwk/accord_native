const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const calls = [];
  const filename = path.resolve(__dirname, '../src/preparation/preparationOrderMetrics.ts'), loaded = new Module(filename, module);
  loaded.require = id => id === '../calculateApi' ? { calculate: async (_, input) => { calls.push(input); return { results: [{ rounded_length: 1500 }] }; } } : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls };
}
const map = { id: 'zakaz-12', code: '12', order_number: 'ORDER-12', title: 'Film', product_code: 'F', width_mm: 500,
  order_kg: 0, base_length: null, roll_count: 2, nodes: [] };
const template = { source_map_id: 'zakaz-12', order_number: '', code: '', product: 'Film', item_code: 'F', width_mm: 500,
  kg: 200, frame_product_size_mm: 485, frame_count: 1, products: [], customer: '', status: '', material_display: '', color: '',
  edge_allowance_mm: 15, waste_percent: 5, roll_count: 2, effective_layers: [], note: '' };

test('order metrics use the scoped template and V2 calculation request', async () => {
  const x = setup();
  assert.equal(x.api.preparationOrderTemplate(map, [template]), template);
  assert.deepEqual(await x.api.preparationOrderMetrics({}, map, [template]), { kg: 200, length: 1500 });
  assert.equal(x.calls[0].kg, 200);
  assert.equal(x.calls[0].frame_product_size_mm, 485);
  assert.equal(x.calls[0].roll_count, 2);
});

test('stored order metrics take precedence and avoid calculation', async () => {
  const x = setup();
  assert.deepEqual(await x.api.preparationOrderMetrics({}, { ...map, order_kg: 120, base_length: 900 }, [template]), { kg: 120, length: 900 });
  assert.equal(x.calls.length, 0);
  assert.equal(x.api.preparationOrderDisplayCode(map), '12');
});
