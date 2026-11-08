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
const controller = load('admin/adminWorkMapController', { './dartJsonString': load('admin/dartJsonString'), './adminWorkMapAuditModel': load('admin/adminWorkMapAuditModel', { './dartJsonString': load('admin/dartJsonString') }), './adminWorkMapClosedModel': load('admin/adminWorkMapClosedModel', { './dartJsonString': load('admin/dartJsonString') }) });
const moveController = load('admin/adminWorkMapMoveController', { './adminWorkMapController': controller, './adminWorkMapMoveModel': load('admin/adminWorkMapMoveModel') });
const Workspace = load('admin/adminWorkMapWorkspace', { './adminWorkMapController': controller, './adminWorkMapMoveController': moveController }).AdminWorkMapWorkspace;
const Store = load('shared/adminSequenceApparatusStore', { '../auth': {}, '../appPreferences': {} }).AdminSequenceApparatusStore;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const a = { id: 'apparatus:default:asset-005', name: 'Pechat' }, b = { id: 'apparatus:default:asset-010', name: 'Rezka' };
function page(view, id = 'o') {
  return { projection: view === 'sequence' ? 'sequence_list_v1' : 'orders_list_v1', version: 'v', epoch: 'e', scope: 's', revision: 4,
    offset: 0, length: 1, total: 1, next_cursor: null, order_ids: [id], pending_ids: [], pending_orders: [], closed_orders: [], workflow_audit: null,
    snapshot: null, order_rows: { [id]: { id, code: id, title: 'Product' } }, pending_rows: {},
    sequence_rows: { [id]: { id, code: id, title: 'Product', display_state: 'paused' } }, sequence_positions: { [id]: 7 } };
}
function fixture(savedId = '', savedName = '') {
  let current = true; const catalog = deferred(), reads = [], events = [];
  const selection = new Store({ getItem: async key => key.endsWith('_name') ? savedName : savedId, setItem: async () => { throw new Error('unexpected preference write'); } }, () => 'me');
  const workspace = new Workspace({ isCurrent: () => current, selection,
    readCatalog: async () => { events.push('catalog'); return catalog.promise; },
    read: request => { events.push(request.view); const response = deferred(); reads.push({ request, response }); return response.promise; } });
  return { workspace, catalog, reads, events, invalidate: () => { current = false; workspace.invalidate(); } };
}
test('default Sequence waits for catalog, restores saved selection and only reads its apparatus', async () => {
  const f = fixture(b.id); assert.equal(f.workspace.getSnapshot().module, 'sequence'); f.workspace.start(); await tick();
  assert.deepEqual(f.events, ['catalog']); assert.equal(f.reads.length, 0);
  f.catalog.resolve([a, b]); await tick(); assert.equal(f.workspace.getSnapshot().selected.id, b.id);
  assert.deepEqual(f.reads[0].request, { view: 'sequence', apparatus: b.id, search: '' });
  f.reads[0].response.resolve(page('sequence')); await tick();
  assert.equal(f.workspace.getSnapshot().list.rows[0].position, 7); assert.equal(f.workspace.getSnapshot().list.total, 1); f.workspace.dispose();
});
test('remembered name fallback and first server catalog item follow the shared resolver', async () => {
  for (const [id, name, expected] of [['missing', ' rezka ', b.id], ['', '', a.id]]) {
    const f = fixture(id, name); f.workspace.start(); f.catalog.resolve([a, b]); await tick();
    assert.equal(f.workspace.getSnapshot().selected.id, expected); f.workspace.dispose();
  }
});
test('empty catalog never fabricates apparatus or sends an unscoped sequence read', async () => {
  const f = fixture(); f.workspace.start(); f.catalog.resolve([]); await tick();
  assert.equal(f.workspace.getSnapshot().catalogLoaded, true); assert.equal(f.workspace.getSnapshot().selected, null); assert.equal(f.reads.length, 0);
  f.workspace.selectApparatus('missing'); await f.workspace.reload(); assert.equal(f.reads.length, 0); f.workspace.dispose();
});
test('Orders can open while catalog is loading and late catalog cannot replace its window', async () => {
  const f = fixture(); f.workspace.start(); f.workspace.selectModule('orders'); assert.equal(f.reads[0].request.view, 'orders');
  f.reads[0].response.resolve(page('orders')); await tick(); f.catalog.resolve([a, b]); await tick();
  assert.equal(f.workspace.getSnapshot().module, 'orders'); assert.equal(f.workspace.getSnapshot().list.rows[0].id, 'o'); assert.equal(f.reads.length, 1);
  f.workspace.selectModule('sequence'); assert.equal(f.reads[1].request.apparatus, a.id); f.workspace.dispose();
});
test('apparatus/module switch retires old reads and detail tickets without publishing mismatched rows', async () => {
  const f = fixture(); f.workspace.start(); f.catalog.resolve([a, b]); await tick();
  f.workspace.selectApparatus(b.id); assert.equal(f.reads[1].request.apparatus, b.id);
  f.reads[0].response.resolve(page('sequence', 'old')); await tick(); assert.equal(f.workspace.getSnapshot().list.rows.length, 0);
  f.reads[1].response.resolve(page('sequence', 'new')); await tick();
  const ticket = f.workspace.window.detailTicket(f.workspace.getSnapshot().list.rows[0]); assert.equal(ticket.apparatus, b.id);
  const observed = []; f.workspace.subscribe(() => { const s = f.workspace.getSnapshot(); if (s.module === 'orders') observed.push(s.list.rows.map(r => r.id)); });
  f.workspace.selectModule('orders'); assert.equal(f.workspace.window.detailIsCurrent(ticket), false); assert.ok(observed.every(rows => !rows.includes('new')));
  assert.deepEqual(f.reads[2].request, { view: 'orders', search: '' }); f.workspace.dispose();
});
test('catalog failure permits a real retry and does not become a fake empty catalog', async () => {
  let attempts = 0; const workspace = new Workspace({ isCurrent: () => true,
    selection: new Store({ getItem: async () => null }, () => 'me'), readCatalog: async () => { if (++attempts === 1) throw new Error('server failed'); return [a]; },
    read: async request => page(request.view) });
  workspace.start(); await tick(); assert.equal(workspace.getSnapshot().catalogError, 'server failed'); assert.equal(workspace.getSnapshot().catalogLoaded, false);
  await workspace.reload(); await tick(); assert.equal(attempts, 2); assert.equal(workspace.getSnapshot().catalogError, null); assert.equal(workspace.getSnapshot().list.rows.length, 1); workspace.dispose();
});
test('session invalidation or dispose suppresses late catalog and page results', async () => {
  for (const stop of ['invalidate', 'dispose']) {
    const f = fixture(); f.workspace.start(); await tick();
    if (stop === 'invalidate') f.invalidate(); else f.workspace.dispose();
    f.catalog.resolve([a]); await tick(); assert.equal(f.reads.length, 0); assert.equal(f.workspace.getSnapshot().catalog.length, 0);
    const ready = fixture(); ready.workspace.start(); ready.catalog.resolve([a]); await tick();
    if (stop === 'invalidate') ready.invalidate(); else ready.workspace.dispose();
    ready.reads[0].response.resolve(page('sequence')); await tick(); assert.equal(ready.workspace.getSnapshot().list.rows.length, 0); ready.workspace.dispose();
  }
});

test('Audit opens independently of catalog, retains report state and never admits an unimplemented module', async () => {
  const f = fixture(); f.workspace.start(); f.workspace.selectModule('audit');
  assert.deepEqual(f.reads[0].request, { view: 'audit', search: '' });
  const auditPage = { ...page('orders'), projection: '', order_ids: [], order_rows: {},
    workflow_audit: { ok: false, checked_order_count: 12, checked_batch_count: 34, checked_session_count: 56, total_violations: 1,
      violations: [{ code: 'invalid_queue_state', order_id: 'o', subject: 'queue', detail: '' }] } };
  f.reads[0].response.resolve(auditPage); await tick(); f.catalog.resolve([a, b]); await tick();
  assert.equal(f.workspace.getSnapshot().module, 'audit'); assert.equal(f.workspace.getSnapshot().list.audit.checked_order_count, 12); assert.equal(f.reads.length, 1);
  f.workspace.selectModule('not-implemented'); f.workspace.selectApparatus(b.id); assert.equal(f.workspace.getSnapshot().module, 'audit'); assert.equal(f.reads.length, 1);
  f.workspace.selectModule('sequence'); assert.equal(f.workspace.getSnapshot().list.audit, null); assert.equal(f.reads[1].request.apparatus, a.id); f.workspace.dispose();
});

test('Closed reads without waiting for catalog and cannot install live order or Audit authority', async () => {
  const f = fixture(); f.workspace.start(); f.workspace.selectModule('closed');
  assert.deepEqual(f.reads[0].request, { view: 'closed', search: '' });
  const closedPage = { ...page('orders'), projection: '', order_ids: [], order_rows: {},
    closed_orders: [{ order_id: 'zakaz-1', order_number: '', title: 'Film', product_code: '', history_version: 'h1', completed_at_unix: 0,
      closed_by_display_name: '', closed_by_ref: '', closed_by_role: '', logs: [], progress_batches: [] }] };
  f.reads[0].response.resolve(closedPage); await tick(); f.catalog.resolve([a]); await tick();
  assert.equal(f.workspace.getSnapshot().module, 'closed'); assert.equal(f.workspace.getSnapshot().list.closed[0].history_version, 'h1');
  assert.deepEqual(f.workspace.getSnapshot().list.rows, []); assert.equal(f.workspace.getSnapshot().list.audit, null); assert.equal(f.reads.length, 1);
  f.workspace.selectModule('not-implemented'); assert.equal(f.reads.length, 1);
  f.workspace.selectModule('orders'); assert.equal(f.workspace.getSnapshot().list.closed.length, 0); f.workspace.dispose();
});

test('Move waits for catalog, opens opposite scopes only, propagates search and retires both panes on module return', async () => {
  const f = fixture(); f.workspace.start(); f.workspace.selectModule('move'); await tick(); assert.equal(f.reads.length, 0);
  f.catalog.resolve([a, b]); await tick();
  assert.deepEqual(f.reads.map(read => read.request), [{ view: 'move', apparatus: a.id, target: b.id, search: '' }, { view: 'move', apparatus: b.id, target: a.id, search: '' }]);
  const full = id => ({ ...page('orders', id), projection: '', order_rows: {}, snapshot: { maps: [{ map: { id, code: id, title: 'Film', nodes: [] } }] } });
  f.reads[0].response.resolve(full('top')); f.reads[1].response.resolve(full('bottom')); await tick();
  assert.equal(f.workspace.getSnapshot().move.topWindow.rows[0].id, 'top'); assert.equal(f.workspace.getSnapshot().move.bottomWindow.rows[0].id, 'bottom');
  f.workspace.setQuery(' Film '); const refresh = f.workspace.reload();
  assert.equal(f.reads[2].request.search, 'Film'); assert.equal(f.reads[3].request.search, 'Film');
  f.reads[2].response.resolve(full('new-top')); f.reads[3].response.resolve(full('new-bottom')); await refresh;
  f.workspace.selectModule('orders'); assert.equal(f.workspace.getSnapshot().move.topWindow.rows.length, 0); assert.equal(f.workspace.getSnapshot().move.bottomWindow.rows.length, 0);
  const before = f.reads.length; await f.workspace.move.topWindow.reload(); assert.equal(f.reads.length, before); f.workspace.dispose();
});
