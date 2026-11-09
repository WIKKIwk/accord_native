const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === './adminWorkMapCurrent' ? load('admin/adminWorkMapCurrent') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), profileGuard = load('shared/profileSessionGuard'), exception = load('shared/mobileApiException');
const adminGuard = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
const metadata = load('admin/adminWorkMapMetadataModel', { './dartJsonString': load('admin/dartJsonString'),
  './adminWorkMapClosedModel': load('admin/adminWorkMapClosedModel', { './dartJsonString': load('admin/dartJsonString') }) });
const weight = load('admin/adminWorkMapOrderWeight', { './dartJsonString': load('admin/dartJsonString') });
function fixture() {
  const session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'me' }, capabilities: ['admin.access'] };
  let current = true, duringRead = () => {}, snapshot = { epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] };
  const calls = [];
  const apis = {
    '../auth': { activeSessionToken: value => value.token },
    '../apparatusApi': { adminApparatus: async (s, options) => { calls.push(['catalog', s, options]); options.beforeSend(); duringRead(); options.beforeSend(); return [{ id: 'apparatus:default:asset-005', name: 'Pechat' }]; } },
    '../productionOrderPageApi': { adminProductionOrderPage: async (s, q, guard) => { calls.push(['page', s, q]); guard(); duringRead(); guard(); return { epoch: 'e' }; } },
    '../productionOrderDetailApi': { adminProductionOrderDetail: async (s, q, guard) => { calls.push(['detail', s, q]); guard(); duringRead(); guard(); return snapshot; } },
    '../pendingOrderApi': { pendingOrderDetail: async (s, id, guard) => { calls.push(['pending', s, id]); guard(); duringRead(); guard(); return { id, template: { product: 'P' }, manager_name: 'Manager' }; } },
    '../sessionReadScope': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile, value.capabilities]) },
    '../shared/appRoutes': routes, '../shared/profileSessionGuard': profileGuard, '../shared/mobileApiException': exception, './adminProductionRequest': adminGuard,
    './adminWorkMapMetadataModel': metadata, './adminWorkMapOrderWeight': weight, './dartJsonString': load('admin/dartJsonString'),
    './adminClosedOrderDetailApi': { adminClosedOrderDetail: async (s, id, guard) => { calls.push(['closed-detail', s, id]); guard(); duringRead(); guard(); return { order_id: id }; } },
    './adminOrderSummaryApi': { adminProductionMapOrderSummary: async (s, id, guard) => { calls.push(['summary', s, id]); guard(); duringRead(); guard(); return { source_map_id: id }; } },
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
  const first = await read(ticket); assert.equal(first.map.id, 'o'); assert.equal(first.qolipInRework, false);
  assert.deepEqual(f.calls[0][2], { apparatus: '', order_id: 'o' });
  f.setSnapshot({ epoch: 'new', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
  f.setSnapshot({ epoch: 'e', revision: 3, scope: 's', maps: [{ map: { id: 'o' } }] }); await assert.rejects(read(ticket), /yangilandi/);
});
test('pending detail uses the existing API and never returns after witness invalidation', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness), ticket = { kind: 'pending', id: 'p', epoch: 'e', revision: 4 };
  const detail = await read(ticket); assert.equal(detail.template.product, 'P'); assert.equal(detail.managerName, 'Manager'); assert.equal(f.calls[0][2], 'p');
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
test('hydrated detail retains creation metadata without another request and fails malformed dates before publishing', async () => {
  const f = fixture(), read = f.api.adminWorkMapDetailReader(f.session, f.witness), ticket = { kind: 'order', id: 'o', epoch: 'e', revision: 4 };
  f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' }, created_at_unix: 1700000000,
    created_by: { role: '\u0085sales_manager\u0085', ref: 'Not displayed', display_name: ' Ana ' } }] });
  const detail = await read(ticket);
  assert.deepEqual(detail.metadata, { createdAtUnix: 1700000000, creator: { role: 'sales_manager', displayName: 'Ana' } });
  assert.equal(f.calls.length, 1);
  f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' }, created_at_unix: 8640000000001 }] });
  await assert.rejects(read(ticket), RangeError); assert.equal(f.calls.length, 2);
});
test('saved summary reader keeps the original detail witness, route capability and exact order ID', async () => {
  const f = fixture(), reader = f.api.adminWorkMapSummaryReader(f.session, f.witness);
  assert.equal((await reader('o')).source_map_id, 'o'); assert.deepEqual(f.calls[0], ['summary', f.session, 'o']);
  f.onRead(f.invalidate); await assert.rejects(reader('o'), /session changed/); assert.equal(f.calls.length, 2);
  await assert.rejects(reader('o'), /session changed/); assert.equal(f.calls.length, 2);
});
test('Closed detail reader retains its original session, route and raw ID while rejecting a changed witness', async () => {
  const f = fixture(), read = f.api.adminWorkMapClosedDetailReader(f.session, f.witness);
  assert.equal((await read(' a&b ')).order_id, ' a&b '); assert.deepEqual(f.calls[0], ['closed-detail', f.session, ' a&b ']);
  f.onRead(f.invalidate); await assert.rejects(read('o'), /session changed/); assert.equal(f.calls.length, 2);
  await assert.rejects(read('o'), /session changed/); assert.equal(f.calls.length, 2);
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
  f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o', order_kg: 0 } }],
    calculation_templates: { o: { source_map_id: 'o', kg: 77 } } });
  const result = await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4, apparatus });
  assert.equal(result.orderWeight, null);
  assert.deepEqual(f.calls[0][2], { apparatus, order_id: 'o' });
});
test('legacy full Orders detail does not use the compact summary template-metric flow', async () => {
  const f = fixture(); f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o', order_kg: 0 } }],
    calculation_templates: { o: { source_map_id: 'o', kg: 77 } } });
  const result = await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4 });
  assert.equal(result.orderWeight, null);
});
test('compact Orders retains only its own hydrated global control; other ticket kinds do not expose it', async () => {
  for (const state of ['active', 'frozen', 'freeze_requested', null]) {
    const f = fixture(); f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }],
      order_controls: state == null ? {} : { o: state } });
    const read = f.api.adminWorkMapDetailReader(f.session, f.witness), ticket = { kind: 'order', id: 'o', epoch: 'e', revision: 4 };
    assert.equal((await read({ ...ticket, ordersSummary: true })).orderControl, state);
    assert.equal((await read(ticket)).orderControl, null);
    assert.equal((await read({ ...ticket, apparatus: 'apparatus:default:asset-005' })).orderControl, null);
  }
  const f = fixture(); f.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: '__proto__' } }], order_controls: {} });
  assert.equal((await f.api.adminWorkMapDetailReader(f.session, f.witness)({ kind: 'order', id: '__proto__', epoch: 'e', revision: 4, ordersSummary: true })).orderControl, null);
  const unrelated = fixture(); unrelated.setSnapshot({ epoch: 'e', revision: 5, scope: 's', maps: [{ map: { id: 'o' } }], order_controls: { other: 'frozen' } });
  assert.equal((await unrelated.api.adminWorkMapDetailReader(unrelated.session, unrelated.witness)({ kind: 'order', id: 'o', epoch: 'e', revision: 4, ordersSummary: true })).orderControl, null);
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
test('actual pending detail decodes manager and template under the original witness', async () => {
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [], raw = { id: 'p', manager_name: 'Manager', template: { order_number: '17', customer: 'Ana', product: 'Film',
      status: 'Rulon', kg: 100, frame_product_size_mm: 60, frame_count: 2, layers: [{ material: 'PE', micron: '30' }] } };
    const pendingApi = loadRoot('pendingOrderApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../pendingOrderApi': pendingApi }).adminWorkMapDetailReader(f.session, f.witness);
    const pending = reader({ kind: 'pending', id: 'p', epoch: 'e', revision: 4 });
    if (invalidate) await assert.rejects(pending, /session changed/);
    else { const detail = await pending; assert.equal(detail.managerName, 'Manager'); assert.equal(detail.template.order_number, '17');
      assert.deepEqual(detail.template.effective_layers.map(({ material, micron }) => [material, micron]), [['PE', '30']]); }
    assert.equal(requests.length, 1); const query = new URL(requests[0], f.session.baseUrl);
    assert.equal(query.pathname, '/v1/mobile/admin/pending-orders'); assert.deepEqual(Object.fromEntries(query.searchParams), { id: 'p' });
  }
});
test('actual detail decoder supplies metadata, rework flag and template weight only while the opening scope is current', async () => {
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [], raw = { epoch: 'e', scope: 's', rev: 5, sequences: {}, visible_order_ids: {},
      queue_states: {}, queue_policies: [], order_controls: { o: { state: 'freeze_requested' } }, stage_states: {}, queue_action_controls: {}, frozen_orders_by_apparatus: {},
      maps: [{ map: { id: 'o', title: 'Film', order_kg: 0, width_mm: 100, nodes: [], edges: [] }, program: {}, qolip_in_rework: true, created_at_unix: 1700000000,
        created_by: { role: 'brigader', display_name: 'Ana', ref: 'ignored' } }],
      calculation_templates: { o: { source_map_id: 'o', kg: 42.5, width_mm: 100 } } };
    const detailApi = loadRoot('productionOrderDetailApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderDetailApi': detailApi }).adminWorkMapDetailReader(f.session, f.witness);
    const pending = reader({ kind: 'order', id: 'o', epoch: 'e', revision: 4, ordersSummary: true });
    if (invalidate) await assert.rejects(pending, /session changed/);
    else { const detail = await pending; assert.deepEqual(detail.metadata, { createdAtUnix: 1700000000, creator: { role: 'brigader', displayName: 'Ana' } });
      assert.equal(detail.qolipInRework, true); assert.equal(detail.orderWeight, 42.5); assert.equal(detail.orderControl, 'freeze_requested');
      const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
      const present = load('admin/adminWorkMapSummaryPresentation', { '../shared/localization': localization, './dartJsonString': load('admin/dartJsonString') }).adminWorkMapSummaryPresentation;
      const summary = present({ ...detail.map, order_kg: detail.orderWeight ?? detail.map.order_kg }, { expanded: true, canExpand: true, loading: true, failed: false }, 'en');
      assert.equal(summary.blocks.find(block => block.id === 'weight').value, '42.5 kg'); }
    assert.equal(requests.length, 1);
  }
});
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

test('real guarded Audit refresh re-reads its range and suppresses a changed account during either body', async () => {
  const dart = load('admin/dartJsonString'), audit = load('admin/adminWorkMapAuditModel', { './dartJsonString': dart });
  const closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
  const Controller = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed }).AdminWorkMapController;
  const tick = () => new Promise(resolve => setImmediate(resolve));
  for (const invalidateAt of [0, 3, 4]) {
    const f = fixture(), requests = [];
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); const call = requests.length, offset = call % 2 ? 0 : 20, version = call <= 2 ? 'old' : 'new';
      guard(); return { status: 200, json: async () => {
        if (call === invalidateAt) f.invalidate();
        return { version, epoch: 'server', rev: 1, offset, total: 40, next_cursor: offset ? null : 'next-20',
          workflow_audit: { ok: false, checked_order_count: version === 'old' ? 40 : 41, total_violations: 40,
            violations: Array.from({ length: 20 }, (_, index) => ({ code: 'unknown_order', order_id: `zakaz-${offset + index}`, subject: version })) } };
      } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const c = new Controller({ isCurrent: f.witness, request: { view: 'audit' }, read: reader });
    c.start(); await tick(); await c.next(); const before = c.getSnapshot().audit; assert.equal(before.violations.length, 40);
    await c.reload();
    if (invalidateAt) { assert.equal(requests.length, invalidateAt); assert.equal(c.getSnapshot().audit, before); c.invalidate(); assert.equal(c.getSnapshot().audit, null); }
    else { assert.equal(requests.length, 4); assert.equal(c.getSnapshot().audit.checked_order_count, 41); assert.equal(c.getSnapshot().audit.violations.length, 40); }
    assert.deepEqual(requests.map(url => Object.fromEntries(new URL(url, f.session.baseUrl).searchParams)),
      Array.from({ length: requests.length }, (_, index) => ({ view: 'audit', limit: '20', ...(index % 2 ? { cursor: 'next-20' } : {}) })));
    c.dispose();
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

test('real guarded Move page sends only its ordered source/target scope and rejects an account-changed body', async () => {
  for (const [apparatus, target] of [['apparatus:default:asset-005', 'apparatus:default:asset-010'], ['unassigned', 'apparatus:default:asset-010'], ['apparatus:default:asset-005', 'unassigned']]) for (const invalidate of [false, true]) {
    const f = fixture(), requests = [], machine = 'apparatus:default:asset-005';
    const raw = { version: 'move-1', epoch: 'server', scope: 'move-scope', rev: 4, offset: 0, total: 1, next_cursor: null, order_ids: ['o'],
      sequences: { [machine]: ['o'] }, visible_order_ids: { [machine]: ['o'] }, queue_states: { [machine]: { o: 'pending' } },
      queue_policies: [{ apparatus_id: machine, policy: 'strict_sequence' }], order_controls: {}, stage_states: {}, queue_action_controls: {}, frozen_orders_by_apparatus: {},
      maps: [{ map: { id: 'o', code: '1', title: 'Film', nodes: [], edges: [] }, program: {} }] };
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const result = reader({ view: 'move', apparatus, target, search: 'Film' });
    if (invalidate) await assert.rejects(result, /session changed/);
    else { const page = await result; assert.equal(page.snapshot.maps[0].map.id, 'o'); assert.equal(page.snapshot.maps[0].map.title, 'Film'); }
    assert.equal(requests.length, 1); const requested = new URL(requests[0], f.session.baseUrl);
    assert.equal(requested.pathname, '/v1/mobile/admin/production-maps/order-page');
    assert.deepEqual(Object.fromEntries(requested.searchParams), { view: 'move', limit: '20', apparatus, target, search: 'Film' });
  }
});

test('real guarded legacy Orders page supplies passive subtitle fields without surviving a body-time account change', async () => {
  const dart = load('admin/dartJsonString'), audit = load('admin/adminWorkMapAuditModel', { './dartJsonString': dart });
  const closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
  const project = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed }).adminWorkMapRows;
  const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const present = load('admin/adminWorkMapPresentation', { '../shared/localization': localization, '../workerOrderAppearance': { workerOrderTone: () => 'neutral' },
    './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) }, './adminDartDouble': load('admin/adminDartDouble'), './dartJsonString': dart }).adminWorkMapPresentation;
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [], machine = 'apparatus:default:asset-005';
    const raw = { version: 'v', epoch: 'e', scope: 's', rev: 5, offset: 0, total: 1, next_cursor: null, order_ids: ['o'],
      sequences: {}, visible_order_ids: {}, queue_states: {}, queue_policies: [], order_controls: {}, stage_states: {}, queue_action_controls: {}, frozen_orders_by_apparatus: {},
      order_customers: { o: ' Buyer ' }, maps: [{ map: { id: 'o', code: '17', title: '', product_code: 'P', customer_name: 'Old',
        nodes: [{ kind: 'end', title: ' Film ' }, { kind: 'apparatus', apparatus_id: machine }], edges: [] }, program: {} }] };
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const result = reader({ view: 'orders' });
    if (invalidate) await assert.rejects(result, /session changed/);
    else { const page = await result, card = present(project([page], 'orders')[0], 'en');
      assert.deepEqual(card, { headline: '17 • Film', supporting: 'Buyer • 1 machines', tone: 'neutral' }); }
    assert.equal(requests.length, 1);
  }
});

test('real guarded Sequence summary preserves its server rank and source row text', async () => {
  const dart = load('admin/dartJsonString'), audit = load('admin/adminWorkMapAuditModel', { './dartJsonString': dart });
  const closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
  const project = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed }).adminWorkMapRows;
  const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const present = load('admin/adminWorkMapPresentation', { '../shared/localization': localization, '../workerOrderAppearance': load('workerOrderAppearance'),
    './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) }, './adminDartDouble': load('admin/adminDartDouble'), './dartJsonString': dart }).adminWorkMapPresentation;
  for (const invalidate of [false, true]) {
    const f = fixture(), requests = [], machine = 'apparatus:default:asset-005', id = 'zakaz-17';
    const raw = { projection: 'sequence_list_v1', version: 'v', epoch: 'e', scope: 's', rev: 5, offset: 0, total: 1, next_cursor: null,
      order_ids: [id], sequence_positions: { [id]: 13 }, sequence_versions: { [machine]: 's1' }, sequence_revisions: { [machine]: 5 },
      queue_policies: [{ apparatus_id: machine, policy: 'strict_sequence' }], rows: { [id]: { id, code: '17', title: ' Film ', customer_name: ' Ana ',
        image_id: 'held-image', queue_state: 'pending', display_state: 'paused', can_reorder: true } } };
    const pageApi = loadRoot('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: async (_session, url, _init, guard) => {
      requests.push(url); guard(); return { status: 200, json: async () => { if (invalidate) f.invalidate(); return raw; } };
    } } });
    const reader = load('admin/adminWorkMapReader', { ...f.dependencies, '../productionOrderPageApi': pageApi }).adminWorkMapReader(f.session, f.witness);
    const result = reader({ view: 'sequence', apparatus: machine });
    if (invalidate) await assert.rejects(result, /session changed/);
    else { const row = project([await result], 'sequence')[0], card = present({ ...row, position: undefined }, 'en');
      assert.equal(row.position, 13); assert.deepEqual(card, { headline: '17 • Film', supporting: 'Ana', tone: 'paused' }); }
    assert.equal(requests.length, 1);
  }
});
