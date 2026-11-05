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
test('inventory assets preserve query scope and unknown assignment metadata', async () => {
  let url;
  const api = load('inventoryReadApi', { './authorizedFetch': { authorizedFetch: async (_session, path) => { url = new URL(path, 'https://example.test'); return { status: 200, json: async () => [{ asset_ref: 'one', qty: 2 }, { asset_ref: 'two', order_assignment: null }] }; } } });
  const rows = await api.inventoryAssets({}, { warehouse_id: ' w ', query: ' roll ', asset_kind: 'qolip', current_user_states_only: true, include_order_assignment: true, limit: 25, offset: 2 });
  assert.deepEqual(Object.fromEntries(url.searchParams), { warehouse_id: 'w', query: 'roll', asset_kind: 'qolip', current_user_states_only: 'true', include_order_assignment: 'true', limit: '25', offset: '2' });
  assert.equal(rows[0].order_assignment_known, false); assert.equal(rows[1].order_assignment_known, true);
});
test('inventory errors keep the server code and mapped message', async () => {
  const api = load('inventoryReadApi', { './authorizedFetch': { authorizedFetch: async () => ({ status: 404, json: async () => ({ error: 'inventory_asset_not_found' }) }) } });
  await assert.rejects(api.inventoryAssets({}), e => e.code === 'inventory_asset_not_found' && e.message === 'Mahsulot topilmadi');
});

test('inventory locations parse canonical apparatus and reject invalid IDs', async () => {
  let path;
  const api = load('inventoryReadApi', { './authorizedFetch': { authorizedFetch: async (_session, url) => { path = url; return { status: 200, json: async () => [{ id: 'state', kind: 'state', apparatus: [{ id: 'apparatus:default:press', name: 'Print' }] }] }; } } });
  const locations = await api.inventoryLocations({});
  assert.equal(path, '/v1/mobile/admin/inventory/locations'); assert.equal(locations[0].apparatus[0].name, 'Print');
  const invalid = load('inventoryReadApi', { './authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => [{ apparatus: [{ id: 'wrong' }] }] }) } });
  await assert.rejects(invalid.inventoryLocations({}), /canonical apparatus ID/);
});
