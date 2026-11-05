const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const mocks = { './authorizedFetch': { authorizedFetch: async (_s, url, init) => ({ status: 200, json: async () => ({ ok: true, width_mm: '115', kg: 200, results: [{ base_length: '123.5' }], sent: JSON.parse(init.body), url }) }) } };
test('calculate builds legacy and multi-layer fields and parses response defaults', async () => {
  const client = load('calculateApi', mocks);
  const body = client.calculateRequestToJson({ kg: 200, frame_product_size_mm: 100, frame_count: 1, customer: ' Test ', layers: [{ material: ' PET ', micron: ' 12 ' }] });
  assert.deepEqual(body, { customer: 'Test', kg: 200, frame_product_size_mm: 100, frame_count: 1, edge_allowance_mm: 15, waste_percent: 5,
    layers: [{ material: 'PET', micron: '12' }], first_layer: { material: 'PET', micron: '12' }, second_layer: { material: '', micron: '' } });
  const result = await client.calculate({}, { kg: 200, frame_product_size_mm: 100, frame_count: 1 });
  assert.equal(result.frame_product_size_mm, 100); assert.equal(result.min_mold_size_mm, 150); assert.equal(result.results[0].base_length, 123.5);
});
test('calculate carries error details and HTTP status', async () => {
  const client = load('calculateApi', { './authorizedFetch': { authorizedFetch: async () => ({ status: 400, json: async () => ({ error: 'bad', detail: 'Details' }) }) } });
  await assert.rejects(client.calculate({}, { kg: 0, frame_product_size_mm: 0, frame_count: 0 }), e => e.code === 'bad' && e.statusCode === 400 && e.message === 'Details');
});
