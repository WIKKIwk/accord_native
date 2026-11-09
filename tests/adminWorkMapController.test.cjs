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
const dart = load('admin/dartJsonString');
const { AdminWorkMapController: Controller, adminWorkMapRows: rows, adminWorkMapSearch: search } = load('admin/adminWorkMapController', { './dartJsonString': dart, './adminWorkMapAuditModel': load('admin/adminWorkMapAuditModel', { './dartJsonString': dart }), './adminWorkMapClosedModel': load('admin/adminWorkMapClosedModel', { './dartJsonString': dart }) });
const summary = (overrides = {}) => ({ projection: 'orders_list_v1', version: 'v', epoch: 'e', scope: 's', revision: 4, offset: 0, length: 2,
  next_cursor: 'next', order_ids: ['zakaz-1'], pending_ids: ['p1'], order_rows: { 'zakaz-1': { id: 'zakaz-1', code: '', title: 'Product', customer_name: 'Customer', image_id: 'i', display_state: 'paused' } },
  pending_rows: { p1: { id: 'p1', code: 'P', title: 'Pending', customer_name: 'P customer', image_id: '', kg: 10 } }, pending_orders: [], closed_orders: [], workflow_audit: null, snapshot: null, ...overrides });
const next = () => summary({ offset: 2, length: 1, next_cursor: null, pending_ids: ['p2'], pending_rows: { p2: { id: 'p2', code: 'P2', title: 'Second', customer_name: '', kg: 4 } }, order_ids: [], order_rows: {} });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
test('summary pages show pending items before open orders across pages and derive V2 code', () => {
  const actual = rows([summary(), next()]);
  assert.deepEqual(actual.map(row => [row.kind, row.id, row.code]), [['pending', 'p1', 'P'], ['pending', 'p2', 'P2'], ['order', 'zakaz-1', '1']]);
  assert.equal(actual[2].displayState, 'paused'); assert.equal(actual[0].kg, 10);
});
test('legacy full page uses existing parsed pending templates and snapshot maps', () => {
  const page = summary({ projection: '', length: 2, next_cursor: null, order_ids: ['o'], pending_ids: [], order_rows: {}, pending_rows: {},
    pending_orders: [{ id: 'p', template: { order_number: '11', product: 'P', customer: 'C', image_id: 'i', kg: 7 } }],
    snapshot: { maps: [{ map: { id: 'o', code: '12', title: 'Product', customer_name: 'Cust', image_id: 'img' } }] } });
  assert.deepEqual(rows([page]).map(value => [value.kind, value.id, value.code, value.customer]), [['pending', 'p', '11', 'C'], ['order', 'o', '12', 'Cust']]);
});
test('unexpected or duplicate authority is not represented as an empty/successful list', () => {
  assert.throws(() => rows([summary(), next(), next()]));
  assert.throws(() => rows([summary({ projection: 'future' })]));
  assert.throws(() => rows([summary({ closed_orders: [{}] })]));
});
test('search trims Dart whitespace and limits by 120 Unicode scalar values', () => {
  assert.equal(search('\u0085 abc \u0085'), 'abc'); assert.equal(Array.from(search('😀'.repeat(121))).length, 120);
});
test('refresh, search and cursor pages call real reader arguments and show only matching generations', async () => {
  const requests = [], pending = [];
  const c = new Controller({ isCurrent: () => true, read: request => { requests.push(request); const d = deferred(); pending.push(d); return d.promise; } });
  c.start(); assert.deepEqual(requests[0], { view: 'orders', search: '' });
  pending[0].resolve(summary()); await tick(); assert.equal(c.getSnapshot().rows.length, 2); assert.equal(c.getSnapshot().hasMore, true);
  const more = c.next(); assert.equal(requests[1].cursor, 'next'); pending[1].resolve(next()); await more;
  assert.deepEqual(c.getSnapshot().rows.map(r => r.id), ['p1', 'p2', 'zakaz-1']); assert.equal(c.getSnapshot().hasMore, false);
  c.setQuery('  ABC  '); assert.equal(c.getSnapshot().query, 'ABC'); assert.deepEqual(c.getSnapshot().rows, []);
  await new Promise(resolve => setTimeout(resolve, 370)); assert.equal(requests.at(-1).search, 'ABC');
  pending.at(-1).resolve(summary({ length: 0, order_ids: [], pending_ids: [], order_rows: {}, pending_rows: {}, next_cursor: null })); await tick();
  assert.equal(c.getSnapshot().loaded, true); assert.equal(c.getSnapshot().rows.length, 0); c.dispose();
});
test('old search, refresh and account results cannot overwrite newer state', async () => {
  const pending = []; let current = true;
  const c = new Controller({ isCurrent: () => current, read: () => { const d = deferred(); pending.push(d); return d.promise; } });
  c.start(); c.setQuery('new'); pending[0].resolve(summary()); await tick(); assert.deepEqual(c.getSnapshot().rows, []);
  const newer = c.reload(); pending[1].resolve(summary()); await newer; assert.equal(c.getSnapshot().rows.length, 2);
  const stale = c.reload(); current = false; c.invalidate(); pending[2].resolve(summary()); await stale;
  assert.equal(c.getSnapshot().loaded, false); assert.deepEqual(c.getSnapshot().rows, []); c.dispose();
});
test('append detects changed version, epoch, scope and duplicate IDs; existing rows stay visible with error', async () => {
  for (const mutation of [p => { p.version = 'new'; }, p => { p.epoch = 'new'; }, p => { p.scope = 'new'; }, p => { p.offset = 0; },
    p => { p.pending_ids = ['p1']; p.pending_rows = { p1: { id: 'p1' } }; }]) {
    let calls = 0; const candidate = next(); mutation(candidate);
    const c = new Controller({ isCurrent: () => true, read: async () => calls++ ? candidate : summary() });
    c.start(); await tick(); await c.next(); assert.equal(c.getSnapshot().rows.length, 2); assert.ok(c.getSnapshot().error); c.dispose();
  }
});
test('failed refresh retains a previously loaded window; an initial failure remains unloaded', async () => {
  let calls = 0; const c = new Controller({ isCurrent: () => true, read: async () => { if (++calls === 1) return summary(); throw Error('failed'); } });
  c.start(); await tick(); const rows = c.getSnapshot().rows; await c.reload();
  assert.equal(c.getSnapshot().loaded, true); assert.equal(c.getSnapshot().rows, rows); assert.equal(c.getSnapshot().error, 'failed'); c.dispose();
  const initial = new Controller({ isCurrent: () => true, read: async () => { throw Error('initial'); } }); initial.start(); await tick();
  assert.equal(initial.getSnapshot().loaded, false); assert.equal(initial.getSnapshot().error, 'initial'); initial.dispose();
});
test('detail tickets bind a visible row to the current page generation', async () => {
  let current = true; const c = new Controller({ isCurrent: () => current, read: async () => summary() });
  c.start(); await tick(); const row = c.getSnapshot().rows[0], ticket = c.detailTicket(row);
  assert.equal(ticket.id, row.id); assert.equal(c.detailIsCurrent(ticket), true);
  assert.equal(ticket.ordersSummary, undefined); assert.equal(c.detailTicket(c.getSnapshot().rows[1]).ordersSummary, true);
  assert.equal(c.detailTicket({ ...row, id: 'unknown' }), null);
  c.setQuery('new'); assert.equal(c.detailIsCurrent(ticket), false); assert.equal(c.detailTicket(row), null);
  current = false; c.invalidate(); assert.equal(c.detailIsCurrent(ticket), false); c.dispose();
});
test('legacy full Orders detail ticket does not claim compact-summary metrics', async () => {
  const page = summary({ projection: '', length: 1, next_cursor: null, order_ids: ['o'], pending_ids: [], order_rows: {}, pending_rows: {}, pending_orders: [],
    snapshot: { maps: [{ map: { id: 'o', title: 'Film', nodes: [] } }] } });
  const c = new Controller({ isCurrent: () => true, read: async () => page }); c.start(); await tick();
  assert.equal(c.detailTicket(c.getSnapshot().rows[0]).ordersSummary, undefined); c.dispose();
});
test('card formatting retains V2 pending label and a Dart-like decimal for ordinary integer kg', () => {
  const localization = { productionText: () => 'Order' };
  const tone = { workerOrderTone: state => state || 'neutral' };
  const presentation = load('admin/adminWorkMapPresentation', { '../shared/localization': localization, '../workerOrderAppearance': tone,
    './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) },
    './adminDartDouble': load('admin/adminDartDouble'), './dartJsonString': dart }).adminWorkMapPresentation;
  assert.deepEqual(presentation({ kind: 'pending', code: 'P', title: 'Product', customer: 'Client', kg: 10, displayState: 'pending' }, 'uz'),
    { headline: 'P • Product', supporting: 'Client · 10.0 kg · Chala buyurtma', tone: 'pending' });
  assert.equal(presentation({ kind: 'order', code: '1', title: '', customer: 'Client', kg: null, displayState: '' }, 'en').headline, '1 • Order');
  const projected = rows([summary({ pending_rows: { p1: { id: 'p1', code: ' 17 ', title: ' Film ', customer_name: ' Ana ', image_id: '', kg: -0 } } })])[0];
  assert.deepEqual(presentation(projected, 'ru'), { headline: ' 17  •  Film ', supporting: ' Ana  · -0.0 kg · Chala buyurtma', tone: 'pending' });
  const legacy = rows([summary({ projection: '', length: 1, next_cursor: null, order_ids: [], pending_ids: [], order_rows: {}, pending_rows: {},
    pending_orders: [{ id: 'p', template: { order_number: '', product: '', customer: '', image_id: '', kg: 4 } }], snapshot: { maps: [] } })])[0];
  assert.deepEqual(presentation(legacy, 'en'), { headline: ' • ', supporting: ' · 4.0 kg · Chala buyurtma', tone: 'pending' });
});

test('opened summary and full cards use source title, customer, product and apparatus-count fallbacks', () => {
  const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const presentation = load('admin/adminWorkMapPresentation', { '../shared/localization': localization,
    '../workerOrderAppearance': { workerOrderTone: () => 'neutral' }, './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) },
    './adminDartDouble': load('admin/adminDartDouble'), './dartJsonString': dart }).adminWorkMapPresentation;
  const compact = rows([summary({ pending_ids: [], pending_rows: {}, order_rows: { 'zakaz-1': { id: 'zakaz-1', code: '',
    title: '\u0085 Film \u0085', customer_name: '\u0085 Ana \u0085', image_id: '', display_state: 'pending' } } })])[0];
  assert.deepEqual(presentation(compact, 'en'), { headline: '1 • Film', supporting: 'Ana', tone: 'neutral' });
  const full = (map, orderCustomers = {}) => summary({ projection: '', length: 1, next_cursor: null, order_ids: ['o'], pending_ids: [], order_rows: {}, pending_rows: {}, pending_orders: [],
    snapshot: { revision: 4, order_customers: orderCustomers, maps: [{ map: { id: 'o', code: '17', title: '', customer_name: '', product_code: '', nodes: [], ...map } }] } });
  const base = { title: ' ', product_code: ' Product code ', customer_name: ' Map customer ', nodes: [
    { kind: 'end', title: ' ' }, { kind: 'apparatus', title: 'A' }, { kind: 'end', title: ' Film ' }, { kind: 'apparatus', title: 'B' }] };
  const projected = rows([full(base, { o: ' Canonical ' })])[0];
  assert.equal(projected.customer, 'Canonical'); assert.equal(projected.title, 'Film');
  assert.deepEqual(presentation(projected, 'en'), { headline: '17 • Film', supporting: 'Canonical • 2 machines', tone: 'neutral' });
  assert.equal(presentation(projected, 'uz').supporting, 'Canonical • 2 ta aparat');
  assert.equal(presentation(projected, 'ru').supporting, 'Canonical • 2 аппарата');
  assert.equal(presentation(projected, 'ur').supporting, 'Canonical • 2 مشینیں');
  assert.equal(presentation(rows([full(base, { o: ' ' })])[0], 'en').supporting, 'Map customer • 2 machines');
  assert.equal(presentation(rows([full({ ...base, customer_name: '' })])[0], 'en').supporting, 'Product code • 2 machines');
  assert.equal(presentation(rows([full({ ...base, customer_name: '', product_code: '' })])[0], 'en').supporting, 'Film • 2 machines');
  assert.equal(presentation(rows([full({ title: '', customer_name: '', product_code: '', nodes: [] })])[0], 'en').supporting, '');
  assert.equal(presentation(rows([full({ title: '', customer_name: '', product_code: '', nodes: [] })])[0], 'en').headline, '17 • Order');
  const equalTitle = rows([full({ title: 'Film', nodes: [{ kind: 'end', title: ' Film ' }, { kind: 'end', title: 'Roll' }] })])[0];
  assert.equal(presentation(equalTitle, 'en').supporting, 'Roll');
});

test('legacy order customers from available snapshots follow revision order', () => {
  const page = (id, revision, customers) => summary({ projection: '', length: 1, next_cursor: null, order_ids: [id], pending_ids: [], order_rows: {}, pending_rows: {}, pending_orders: [],
    snapshot: { revision, order_customers: customers, maps: [{ map: { id, title: '', customer_name: 'Fallback', nodes: [] } }] } });
  const values = rows([page('o', 9, { o: 'Newest' }), page('p', 2, { o: 'Older' })]);
  assert.equal(values[0].customer, 'Newest'); assert.equal(values[1].customer, 'Fallback');
  const proto = JSON.parse('{"__proto__":"Stored"}');
  assert.equal(rows([page('__proto__', 1, proto)])[0].customer, 'Stored');
});

test('Sequence summaries preserve server order, absolute positions, display states and count', async () => {
  const page = summary({ projection: 'sequence_list_v1', pending_ids: [], pending_rows: {}, length: 1, total: 27,
    sequence_rows: { 'zakaz-1': { id: 'zakaz-1', code: '1', title: 'P', customer_name: 'C', display_state: 'frozen' } },
    sequence_positions: { 'zakaz-1': 13 }, order_rows: {}, next_cursor: 'next' });
  const actual = rows([page], 'sequence'); assert.equal(actual[0].position, 13); assert.equal(actual[0].displayState, 'frozen');
  assert.throws(() => rows([page], 'orders')); assert.throws(() => rows([summary()], 'sequence'));
  assert.throws(() => rows([{ ...page, sequence_positions: {} }], 'sequence'));
  const calls = [], c = new Controller({ isCurrent: () => true, request: { view: 'sequence', apparatus: 'apparatus:a' }, read: async request => { calls.push(request); return page; } });
  c.start(); await tick(); assert.equal(c.getSnapshot().total, 27); assert.deepEqual(calls[0], { view: 'sequence', apparatus: 'apparatus:a', search: '' });
  assert.equal(c.detailTicket(c.getSnapshot().rows[0]).apparatus, 'apparatus:a'); c.dispose();
});
test('Sequence compact and full rows use source title and subtitle fallbacks without an apparatus count', () => {
  const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const presentation = load('admin/adminWorkMapPresentation', { '../shared/localization': localization,
    '../workerOrderAppearance': { workerOrderTone: () => 'neutral' }, './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) },
    './adminDartDouble': load('admin/adminDartDouble'), './dartJsonString': dart }).adminWorkMapPresentation;
  const compact = summary({ projection: 'sequence_list_v1', pending_ids: [], pending_rows: {}, length: 1, order_rows: {}, next_cursor: null,
    sequence_rows: { 'zakaz-1': { id: 'zakaz-1', code: ' 17 ', title: '\u0085 Film \u0085', customer_name: '\u0085 Ana \u0085', display_state: 'pending' } },
    sequence_positions: { 'zakaz-1': 13 } });
  const item = rows([compact], 'sequence')[0];
  assert.deepEqual(presentation({ ...item, position: undefined }, 'en'), { headline: '17 • Film', supporting: 'Ana', tone: 'neutral' });
  const full = summary({ projection: '', length: 1, next_cursor: null, pending_ids: [], pending_rows: {}, order_rows: {}, pending_orders: [], order_ids: ['o'],
    sequence_positions: { o: 9 }, snapshot: { revision: 4, order_customers: { o: ' Canonical ' }, maps: [{ map: { id: 'o', code: '7', title: '', product_code: 'P', customer_name: 'Old',
      nodes: [{ kind: 'end', title: ' Roll ' }, { kind: 'apparatus', title: 'A' }, { kind: 'apparatus', title: 'B' }] } }] } });
  const legacy = rows([full], 'sequence')[0]; assert.equal(legacy.position, 9);
  assert.deepEqual(presentation({ ...legacy, position: undefined }, 'en'), { headline: '7 • Roll', supporting: 'Canonical', tone: 'neutral' });
  full.snapshot.order_customers = {}; full.snapshot.maps[0].map.customer_name = '';
  assert.equal(presentation({ ...rows([full], 'sequence')[0], position: undefined }, 'en').supporting, 'P');
  full.snapshot.maps[0].map.product_code = '';
  assert.equal(presentation({ ...rows([full], 'sequence')[0], position: undefined }, 'en').supporting, 'Roll');
});
test('configuring another module/apparatus invalidates rows, old reads and old detail tickets', async () => {
  const pending = [], calls = [], c = new Controller({ isCurrent: () => true, request: null, read: request => { calls.push(request); const d = deferred(); pending.push(d); return d.promise; } });
  c.start(); await tick(); assert.equal(calls.length, 0);
  c.configure({ view: 'orders' }); pending[0].resolve(summary()); await tick(); const ticket = c.detailTicket(c.getSnapshot().rows[0]);
  c.configure({ view: 'sequence', apparatus: 'apparatus:a' }); assert.equal(c.detailIsCurrent(ticket), false); assert.equal(c.getSnapshot().rows.length, 0);
  c.configure({ view: 'orders' }); pending[1].resolve(summary()); await tick(); assert.equal(c.getSnapshot().rows.length, 0);
  pending[2].resolve(summary()); await tick(); assert.equal(c.getSnapshot().rows.length, 2);
  c.configure(null); await c.reload(); assert.equal(calls.length, 3); assert.equal(c.getSnapshot().rows.length, 0); c.dispose();
});
test('window hands its original generation witness to each read and retires it on module change', () => {
  const reads = [], c = new Controller({ isCurrent: () => true, request: { view: 'orders' }, read: (_request, witness) => {
    reads.push(witness); return new Promise(() => {});
  } });
  c.start(); assert.equal(typeof reads[0], 'function'); assert.equal(reads[0](), true);
  c.configure({ view: 'audit' }); assert.equal(reads[0](), false); assert.equal(typeof reads[1], 'function'); assert.equal(reads[1](), true);
  c.dispose(); assert.equal(reads[1](), false);
});
test('disposing a window cannot synchronously start another read through a subscriber', () => {
  let sends = 0, attempted = false;
  const c = new Controller({ isCurrent: () => true, request: { view: 'orders' }, read: () => { sends++; return new Promise(() => {}); } });
  c.subscribe(() => { if (!attempted) { attempted = true; void c.reload(); } }); c.dispose();
  assert.equal(attempted, true); assert.equal(sends, 0);
});
test('invalidating a window blocks synchronous reload and permits an explicit later reload', () => {
  let sends = 0, attempted = false;
  const c = new Controller({ isCurrent: () => true, request: { view: 'orders' }, read: () => { sends++; return new Promise(() => {}); } });
  c.subscribe(() => { if (!attempted) { attempted = true; void c.reload(); } }); c.invalidate();
  assert.equal(attempted, true); assert.equal(sends, 0); void c.reload(); assert.equal(sends, 1); c.dispose();
});
test('window loading notification cannot start a read after synchronous invalidation', () => {
  let sends = 0, attempted = false;
  const c = new Controller({ isCurrent: () => true, request: { view: 'orders' }, read: () => { sends++; return new Promise(() => {}); } });
  c.subscribe(() => { if (!attempted && c.getSnapshot().loading) { attempted = true; c.invalidate(); } }); c.start();
  assert.equal(attempted, true); assert.equal(sends, 0); c.dispose();
});
test('malformed or asynchronously rejected account witnesses do not authorize a window read', async () => {
  for (const witness of [() => Promise.resolve(true), () => Promise.reject(Error('bad')), () => { throw Error('bad'); }, () => 1]) {
    let sends = 0; const c = new Controller({ isCurrent: witness, request: { view: 'orders' }, read: () => { sends++; return new Promise(() => {}); } });
    c.start(); assert.equal(sends, 0); c.dispose();
  }
  await tick();
});
test('a reentrant account witness cannot start either inner or outer window read', () => {
  let c, sends = 0, attempted = false;
  c = new Controller({ isCurrent: () => { if (!attempted) { attempted = true; void c.reload(); } return true; },
    request: { view: 'orders' }, read: () => { sends++; return new Promise(() => {}); } });
  c.start(); assert.equal(attempted, true); assert.equal(sends, 0); c.dispose();
});
