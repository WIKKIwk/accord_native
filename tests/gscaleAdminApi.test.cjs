const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/gscale/gscaleAdminApi.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
const calls = [];
let status = 200, data = [];
loaded.require = name => {
  if (name === '../authorizedFetch') return { authorizedFetch: async (session, url) => {
    calls.push({ session, url }); return { status, json: async () => data };
  } };
  if (name === '../workerControlsApi') return { productionMapResponseError: (status, payload, fallback) =>
    Object.assign(new Error(fallback), { status, payload, fallback }) };
  if (name === '../workerProductionMapSaved') return { productionMapSavedFromJson: value => ({ parsed: value }) };
  return require(name);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const api = loaded.exports, session = { token: 'test' };

// No V2 HTTP recordings were found for these methods. The requests and model assertions follow the baseline source.
test('admin item pages preserve V2 query, ordering and SupplierItem defaults', async () => {
  calls.length = 0; status = 200;
  data = [{ code: 'B', name: 'Item', warehouse: 'W', requires_dimensions: true, order_microns: [12, '14', 16],
    order_apparatus_options: { a: 4 }, customer_names: [' A ', ''] }, { code: 'A' }];
  const items = await api.adminItemsPage(session, { query: ' some item ', group: ' PET ', limit: 10, offset: 20 });
  assert.equal(calls[0].url, '/v1/mobile/admin/items?q=some+item&group=PET&limit=10&offset=20');
  assert.deepEqual(items[0], { code: 'B', name: 'Item', uom: '', warehouse: 'W', item_group: '', requires_dimensions: true,
    order_apparatus_options: { a: '4' }, order_microns: [12, 16], customer_names: ['A'] });
  assert.deepEqual(items.map(item => item.code), ['B', 'A']);
  await api.adminItemsPage(session, { limit: 0, offset: -1 });
  assert.equal(calls[1].url, '/v1/mobile/admin/items');
  status = 500; await assert.rejects(api.adminItemsPage(session), /Admin items failed/);
});

test('admin warehouses preserve optional parameters and parent fallback', async () => {
  calls.length = 0; status = 200;
  data = [{ warehouse: 'W', company: 'C', parent: 'P', is_group: true }, {}];
  const warehouses = await api.adminWarehouses(session, { query: ' name ', parent: ' root ', limit: 30 });
  assert.equal(calls[0].url, '/v1/mobile/admin/warehouses?q=name&parent=root&limit=30');
  assert.deepEqual(warehouses, [{ warehouse: 'W', company: 'C', parent_warehouse: 'P', is_group: true },
    { warehouse: '', company: '', parent_warehouse: '', is_group: false }]);
  status = 403; await assert.rejects(api.adminWarehouses(session), /Admin warehouses failed/);
});

test('assignment orders use the production-map parser and backend error mapping', async () => {
  calls.length = 0; status = 200; data = [{ map: { id: 'zakaz-1' } }];
  assert.deepEqual(await api.adminRawMaterialAssignmentOrders(session), [{ parsed: data[0] }]);
  assert.equal(calls[0].url, '/v1/mobile/admin/raw-material-assignments/orders');
  status = 409; data = { error: 'failure' };
  await assert.rejects(api.adminRawMaterialAssignmentOrders(session), error => error.status === 409 &&
    error.fallback === 'raw_material_assignment_orders' && error.payload.error === 'failure');
});
