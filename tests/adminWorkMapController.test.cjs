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
const dart = load('admin/dartJsonString');
const { AdminWorkMapController: Controller, adminWorkMapRows: rows, adminWorkMapSearch: search } = load('admin/adminWorkMapController', { './dartJsonString': dart });
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
test('detail tickets bind a visible row to the current page generation', async () => {
  let current = true; const c = new Controller({ isCurrent: () => current, read: async () => summary() });
  c.start(); await tick(); const row = c.getSnapshot().rows[0], ticket = c.detailTicket(row);
  assert.equal(ticket.id, row.id); assert.equal(c.detailIsCurrent(ticket), true);
  assert.equal(c.detailTicket({ ...row, id: 'unknown' }), null);
  c.setQuery('new'); assert.equal(c.detailIsCurrent(ticket), false); assert.equal(c.detailTicket(row), null);
  current = false; c.invalidate(); assert.equal(c.detailIsCurrent(ticket), false); c.dispose();
});
test('card formatting retains V2 pending label and a Dart-like decimal for ordinary integer kg', () => {
  const localization = { productionText: () => 'Order' };
  const tone = { workerOrderTone: state => state || 'neutral' };
  const presentation = load('admin/adminWorkMapPresentation', { '../shared/localization': localization, '../workerOrderAppearance': tone,
    './adminWorkMapText': { adminWorkMapText: () => ({ pending: 'Chala buyurtma' }) } }).adminWorkMapPresentation;
  assert.deepEqual(presentation({ kind: 'pending', code: 'P', title: 'Product', customer: 'Client', kg: 10, displayState: 'pending' }, 'uz'),
    { headline: 'P • Product', supporting: 'Client · 10.0 kg · Chala buyurtma', tone: 'pending' });
  assert.equal(presentation({ kind: 'order', code: '1', title: '', customer: 'Client', kg: null, displayState: '' }, 'en').headline, '1 • Order');
});
