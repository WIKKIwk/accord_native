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
test('inventory relocation validates and trims a scoped mutation', async () => {
  let sent;
  const api = load('inventoryRelocateApi', { './authorizedFetch': { authorizedFetch: async (_s, path, init) => { sent = { path, body: JSON.parse(init.body) }; return { status: 200, json: async () => ({ asset_ref: 'roll', kind: 'raw_material' }) }; } } });
  const base = { asset_kind: 'raw_material', asset_ref: ' roll ', physical_location_id: ' loc ', idempotency_key: ' key ', note: ' note ' };
  await assert.rejects(api.inventoryRelocate({}, { ...base, asset_ref: ' ' }), e => e.code === 'inventory_relocation_invalid');
  const result = await api.inventoryRelocate({}, base);
  assert.equal(sent.path, '/v1/mobile/admin/inventory/relocations');
  assert.deepEqual(sent.body, { asset_kind: 'raw_material', asset_ref: 'roll', physical_location_id: 'loc', idempotency_key: 'key', note: 'note' });
  assert.equal(result.asset_ref, 'roll');
});
