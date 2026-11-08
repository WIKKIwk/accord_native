const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), profileGuard = load('shared/profileSessionGuard'), exception = load('shared/mobileApiException');
const adminGuard = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
function fixture() {
  const session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  let current = true, duringRead = () => {}, snapshot = { epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] };
  const calls = [];
  const apis = {
    '../auth': { activeSessionToken: value => value.token },
    '../apparatusApi': { adminApparatus: async (s, options) => { calls.push(['catalog', s, options]); options.beforeSend(); duringRead(); options.beforeSend(); return [{ id: 'apparatus:default:asset-005', name: 'Pechat' }]; } },
    '../productionOrderPageApi': { adminProductionOrderPage: async (s, q, guard) => { calls.push(['page', s, q]); guard(); duringRead(); guard(); return { epoch: 'e' }; } },
    '../productionOrderDetailApi': { adminProductionOrderDetail: async (s, q, guard) => { calls.push(['detail', s, q]); guard(); duringRead(); guard(); return snapshot; } },
    '../pendingOrderApi': { pendingOrderDetail: async (s, id, guard) => { calls.push(['pending', s, id]); guard(); duringRead(); guard(); return { id, template: { product: 'P' } }; } },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile, value.capabilities]) },
    '../shared/appRoutes': routes, '../shared/profileSessionGuard': profileGuard, '../shared/mobileApiException': exception, './adminProductionRequest': adminGuard,
  };
  const api = load('admin/adminWorkMapReader', apis);
  return { session, calls, api, dependencies: apis, witness: () => current, invalidate: () => { current = false; }, onRead: fn => { duringRead = fn; }, setSnapshot: value => { snapshot = value; } };
}
test('page reader uses captured witness, scope, route permission and guarded existing API', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, f.witness);
  assert.equal((await read({ view: 'orders', search: 'x' })).epoch, 'e');
  assert.deepEqual(f.calls[0][2], { view: 'orders', search: 'x' });
  f.session.capabilities = []; await assert.rejects(read({ view: 'orders' }), /session changed/); assert.equal(f.calls.length, 1);
});
test('witness transition during page read cannot publish a result', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, f.witness); f.onRead(f.invalidate);
  await assert.rejects(read({ view: 'orders' }), /session changed/);
});
test('order detail hydrates the exact ID and rejects stale epoch or revision', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness);
  const ticket = { kind: 'order', id: 'o', epoch: 'e', revision: 4 };
  assert.equal((await read(ticket)).map.id, 'o'); assert.deepEqual(f.calls[0][2], { apparatus: '', order_id: 'o' });
  f.setSnapshot({ epoch: 'new', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
  f.setSnapshot({ epoch: 'e', revision: 3, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
});
test('pending detail uses the existing API and never returns after witness invalidation', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness), ticket = { kind: 'pending', id: 'p', epoch: 'e', revision: 4 };
  assert.equal((await read(ticket)).template.product, 'P'); assert.equal(f.calls[0][2], 'p');
  f.onRead(f.invalidate); await assert.rejects(read(ticket), /session changed/);
});
test('async or malformed session witness fails closed before request', async () => {
  const f = fixture(), read = f.api.adminWorkMapReader(f.session, async () => false);
  await assert.rejects(read({ view: 'orders' }), /session changed/); assert.equal(f.calls.length, 0);
});

test('stale detail retries once and accepts a new matching snapshot without changing the requested ID', async () => {
  const f = fixture(), stale = { epoch: 'old', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] };
  let attempt = 0;
  f.onRead(() => f.setSnapshot(attempt++ ? { ...stale, epoch: 'e', order_customers: { o: 'Canonical' } } : stale));
  const detail = await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4 });
  assert.equal(f.calls.length, 2); assert.equal(detail.customer, 'Canonical');
  assert.deepEqual(f.calls.map(call => call[2]), [{ apparatus: '', order_id: 'o' }, { apparatus: '', order_id: 'o' }]);
});
test('two stale snapshots stop with V2 order_page_changed code and message', async () => {
  const f = fixture(); f.setSnapshot({ epoch: 'old', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] });
  await assert.rejects(f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4 }),
    error => error.code === 'order_page_changed' && error.message === 'Buyurtma yangilandi. Qayta oching.');
  assert.equal(f.calls.length, 2);
});
test('failed HTTP/detail read is not retried as though it were a stale snapshot', async () => {
  const f = fixture(), failure = new Error('server error'); f.onRead(() => { throw failure; });
  await assert.rejects(f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4 }), error => error === failure);
  assert.equal(f.calls.length, 1);
});
test('list-ticket invalidation blocks a stale detail retry before any second send', async () => {
  const f = fixture(); let ticketCurrent = true;
  f.setSnapshot({ epoch: 'old', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] });
  f.onRead(() => { ticketCurrent = false; });
  const read = f.api.adminWorkMapDetailReader(f.session, () => f.witness() && ticketCurrent);
  await assert.rejects(read({ kind: 'order', id: 'o', epoch: 'e', revision: 4 }), /session changed/);
  assert.equal(f.calls.length, 1);
});
test('detail customer uses own snapshot entry, including empty text, then map fallback', async () => {
  for (const [id, customers, expected] of [['o', { o: 'Canonical' }, 'Canonical'], ['o', { o: '' }, ''],
    ['o', {}, 'Fallback'], ['__proto__', {}, 'Fallback']]) {
    const f = fixture(); f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', order_customers: customers,
      maps: [{ map: { id, customer_name: 'Fallback' } }] });
    const result = await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id, epoch: 'e', revision: 4 });
    assert.equal(result.customer, expected);
  }
});

test('Sequence catalog uses the existing guarded limit-200 reader and original witness', async () => {
  const f = fixture(), read = f.api.adminWorkMapCatalogReader(f.session, f.witness);
  assert.equal((await read())[0].name, 'Pechat'); assert.equal(f.calls[0][2].limit, 200);
  assert.equal(f.calls[0][2].retryTransient, undefined); assert.equal(typeof f.calls[0][2].beforeSend, 'function');
  f.invalidate(); await assert.rejects(read(), /session changed/); assert.equal(f.calls.length, 1);
});
test('Sequence catalog cannot return after its witness changes during a read', async () => {
  const f = fixture(), read = f.api.adminWorkMapCatalogReader(f.session, f.witness); f.onRead(f.invalidate);
  await assert.rejects(read(), /session changed/); assert.equal(f.calls.length, 1);
});
test('Sequence detail keeps the apparatus from its original visible list ticket', async () => {
  const f = fixture(), apparatus = 'apparatus:default:asset-005';
  await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4, apparatus });
  assert.deepEqual(f.calls[0][2], { apparatus, order_id: 'o' });
});

test('real catalog callback wrapper accepts the checked Admin guard and rejects a body-time witness transition', async () => {
  for (const invalidate of [false, true]) {
    const f = fixture();
    const shared = load('apparatusApi', { './authorizedFetch': { authorizedFetch: async (_session, _path, _init, beforeSend) => {
      beforeSend(); return { status: 200, text: async () => { if (invalidate) f.invalidate(); return '[]'; } }; } },
      './workerControlsApi': { isCanonicalApparatusId: id => id.startsWith('apparatus:'), WorkerControlException: class extends Error {} } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../apparatusApi': shared }).adminWorkMapCatalogReader(f.session, f.witness);
    if (invalidate) await assert.rejects(reader(), /session changed/); else assert.deepEqual(await reader(), []);
  }
});

function loadRoot(name, mocks) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? loadRoot(id.slice(2), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
test('real paged Audit reader keeps complete counts for twenty findings and rechecks a body-time account change', async () => {
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [];
    const raw = { version: 'audit-1', epoch: 'server', rev: 1, offset: 0, total: 45, next_cursor: 'next',
      workflow_audit: { ok: false, checked_order_count: 1000, total_violations: 45,
        violations: Array.from({ length: 20 }, (_, index) => ({ code: 'unknown_order', order_id: `zakaz-${index}`, subject: 'queue' })) } };
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const result = reader({ view: 'audit', search: 'query' });
    if (invalidate) await assert.rejects(result, /session changed/);
    else { const page = await result; assert.equal(page.length, 20); assert.equal(page.workflow_audit.checked_order_count, 1000); assert.equal(page.workflow_audit.total_violations, 45); }
    assert.equal(requests.length, 1);
    assert.deepEqual(Object.fromEntries(new URL(requests[0], f.session.baseUrl).searchParams), { view: 'audit', limit: '20', search: 'query' });
  }
});

test('real guarded Closed page decodes summary/history metadata without using the unguarded detail endpoint', async () => {
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [];
    const raw = { version: 'closed-1', epoch: 'server', rev: 1, offset: 0, total: 2, next_cursor: null,
      closed_orders: [{ order_id: 'zakaz-42', history_version: 'h1', title: 'Film', completed_at_unix: 1700000000,
        closed_by_display_name: 'Ana', early_close: { closed_at_unix: 1700000000, comment: 'early' } }, { order_id: 'opaque', history_version: 'h2' }] };
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const result = reader({ view: 'closed', search: 'Ana' });
    if (invalidate) await assert.rejects(result, /session changed/);
    else { const page = await result; assert.equal(page.length, 2); assert.equal(page.closed_orders[0].history_version, 'h1');
      assert.equal(page.closed_orders[0].logs[0].action, 'close_early'); }
    assert.equal(requests.length, 1); const requested = new URL(requests[0], f.session.baseUrl);
    assert.equal(requested.pathname, '/v1/mobile/admin/production-maps/order-page');
    assert.deepEqual(Object.fromEntries(requested.searchParams), { view: 'closed', limit: '20', search: 'Ana' });
  }
});
