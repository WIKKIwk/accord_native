const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { SearchActivityStore } = load('shared/searchActivityStore');
const session = (role, capabilities, ref = 'U') => ({ profile: { role, ref }, capabilities });
function fixture(fetch) {
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value) };
  const api = load('shared/catalogApi', { '../authorizedFetch': { authorizedFetch: fetch }, './mobileApiException': load('shared/mobileApiException'),
    '../appPreferences': { appPreferences: storage }, './searchActivityStore': { SearchActivityStore } });
  return { ...api, data };
}

test('gscale uses V2 filters, item parsing, and account-scoped search activity', async () => {
  let route;
  const api = fixture(async (s, p) => { route = p; return new Response(JSON.stringify([
    { code: 'Z', name: 'Alpha', order_microns: [12, 'x'], customer_names: [' C ', '', null] },
    { code: 'A', name: 'beta', requires_dimensions: true },
  ]), { status: 200 }); });
  const worker = session('material_taminotchi', ['gscale.print']);
  await api.searchActivityStore.recordItemSelections(worker, [' a ', 'A']);
  const items = await api.gscaleItemsPage(worker, { query: ' PET ', group: ' raw ', orderId: ' ID ', limit: 40, offset: 2 });
  assert.equal(route, '/v1/mobile/gscale/items?q=PET&group=raw&order_id=ID&limit=40&offset=2');
  assert.deepEqual(items.map(i => i.code), ['A', 'Z']);
  assert.deepEqual(items[1].order_microns, [12]);
  assert.deepEqual(items[1].customer_names, ['C', 'null']);
  assert.deepEqual((await api.gscaleItemsPage(session('customer', ['customer.access']), { limit: 0 })).map(i => i.code), ['Z', 'A']);
  assert.equal(route, '/v1/mobile/gscale/items');
  assert.ok(api.data.has('search_item_activity_v1:materialTaminotchi:u'));
});

test('warehouse assignments trim filters, parse role aliases, and reject unknown roles', async () => {
  let route; let body = [{ warehouse: 7, principal_role: ' OMBORCHI ', principal_ref: 12 }];
  const api = fixture(async (s, p) => { route = p; return new Response(JSON.stringify(body), { status: 200 }); });
  assert.deepEqual(await api.adminWarehouseAssignments({}, ' Main '), [{ warehouse: '7', principal_role: 'werka', principal_ref: '12', display_name: '' }]);
  assert.equal(route, '/v1/mobile/admin/warehouses/assignments?warehouse=Main');
  body = [{ principal_role: 'invalid' }];
  await assert.rejects(api.adminWarehouseAssignments({}), /Unsupported user role/);
});

test('catalog operations require status 200', async () => {
  const api = fixture(async () => new Response('', { status: 403 }));
  await assert.rejects(api.gscaleItemsPage(session('admin', [])), error => error.code === 'gscale_items_failed' && error.statusCode === 403);
  await assert.rejects(api.adminWarehouseAssignments({}), /Admin warehouse assignments failed/);
});
