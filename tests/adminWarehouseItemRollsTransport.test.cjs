const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), exception = load('shared/mobileApiException'), uri = load('admin/dartUri');
const originalFetch = global.fetch;
function fixture(t) {
  t.after(() => { global.fetch = originalFetch; }); let current = true, callback = () => true, handler = async () => new Response('[]'), refresh = async () => true;
  const session = { baseUrl: 'https://server.example', token: 'token' }, requests = [];
  const auth = { activeSessionToken: () => session.token, refreshSession: async () => refresh(), joinRefreshForGuardedRead: async () => refresh() };
  const transport = load('authorizedFetch', { './auth': auth });
  const controls = load('workerControlsApi', { './authorizedFetch': transport, './sessionReadScope': {} });
  const request = load('admin/adminProductionRequest', { '../authorizedFetch': transport, '../shared/mobileApiException': exception, '../workerControlsApi': controls });
  const stock = load('admin/warehouseStockApi', { '../authorizedFetch': transport, './dartJsonString': strings });
  const saved = load('workerProductionMapSaved', { './workerControlsApi': controls });
  const api = load('admin/adminWarehouseItemRollsApi', { '../authorizedFetch': transport, '../shared/camera/synchronousGuard': sync, '../workerProductionMapSaved': saved, '../workerControlsApi': controls,
    './adminProductionRequest': request, './dartJsonString': strings, './dartUri': uri, './warehouseStockApi': stock });
  global.fetch = async (url, init) => { requests.push({ url: new URL(url), init }); return handler(requests.at(-1)); };
  return { session, api, requests, guard: () => { if (!current) throw Error('original expired'); }, witness: () => current ? callback() : false, retire: () => { current = false; },
    handler: value => { handler = value; }, refresh: value => { refresh = value; }, callback: value => { callback = value; } };
}
const item = { warehouse: '\u0085 A+B \u0085', code: ' C/D ', order_id: ' Order & ' };
test('guarded roll read matches source trim/encoding/default500 and full original model without changing legacy adapter', async t => {
  const f = fixture(t); f.handler(async () => new Response(JSON.stringify([{ stock_id: 'Stock', barcode: ' BAR ', qty: 2.5, accepted_at_unix: 3.8 }])));
  const result = await f.api.readAdminWarehouseItemRolls(f.session, item, f.guard, f.witness);
  assert.equal(f.requests[0].url.pathname, '/v1/mobile/admin/warehouses/items/rolls'); assert.deepEqual(Object.fromEntries(f.requests[0].url.searchParams), { warehouse: 'A+B', item_code: 'C/D', order_id: 'Order &', limit: '500' });
  assert.equal(result[0].stock_id, 'Stock'); assert.equal(result[0].barcode, ' BAR '); assert.equal(result[0].qty, 2.5); assert.equal(result[0].accepted_at_unix, 3);
  assert.deepEqual(await f.api.readAdminWarehouseItemRolls(f.session, { ...item, code: ' ' }, f.guard, f.witness), []); assert.equal(f.requests.length, 1);
});
for (const status of [302, 401]) test(`roll read original witness stops stale${status} continuation before another request`, async t => {
  const f = fixture(t); f.handler(async () => status === 302 ? { status, headers: new Headers({ location: '/v1/mobile/next' }), body: {}, arrayBuffer: async () => { f.retire(); return new ArrayBuffer(0); } } : new Response('{}', { status }));
  f.refresh(async () => { f.retire(); f.session.token = 'new'; return true; }); await assert.rejects(f.api.readAdminWarehouseItemRolls(f.session, item, f.guard, f.witness)); assert.equal(f.requests.length, 1);
});
test('successful/rejected/model bodies recheck original roll lifetime, including rejected asynchronous witnesses', async t => {
  for (const rejected of [false, true]) {
    const f = fixture(t), body = deferred(); f.handler(async () => ({ status: 200, json: () => body.promise })); const pending = f.api.readAdminWarehouseItemRolls(f.session, item, f.guard, f.witness); await tick(); f.retire(); if (rejected) body.reject(Error('parse')); else body.resolve([{ barcode: 'stale' }]); await assert.rejects(pending, /expired|original/);
  }
  const f = fixture(t); f.callback(() => Promise.reject(Error('async authority'))); await assert.rejects(f.api.readAdminWarehouseItemRolls(f.session, item, f.guard, f.witness)); await tick(); assert.equal(f.requests.length, 0);
});
test('genuine reserved-order read uses the original guarded full DTO and preserves source production-map query', async t => {
  const f = fixture(t); f.handler(async () => new Response(JSON.stringify({ map: { id: 'ID', title: ' Name ', customer_name: ' Customer ' }, program: {} })));
  const result = await f.api.readAdminWarehouseItemRollsOrder(f.session, ' ID / ', f.guard, f.witness); assert.equal(f.requests[0].url.pathname, '/v1/mobile/admin/production-maps'); assert.equal(f.requests[0].url.searchParams.get('id'), 'ID /'); assert.equal(result.map.title, ' Name '); assert.equal(result.map.customer_name, ' Customer ');
});
