const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString.ts'), closed = load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart });
const audit = load('admin/adminWorkMapAuditModel.ts', { './dartJsonString': dart });
const Controller = load('admin/adminWorkMapController.ts', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed }).AdminWorkMapController;
const order = (overrides = {}) => ({ order_id: 'zakaz-42', order_number: '', title: ' Film ', product_code: ' C ', history_version: 'h1',
  completed_at_unix: 0, closed_by_display_name: ' Ana ', closed_by_ref: 'ref', closed_by_role: 'admin', logs: [], progress_batches: [], ...overrides });
const page = (offset = 0, overrides = {}) => ({ projection: '', version: 'closed-1', epoch: 'e', revision: 4, scope: '', offset, length: 1, total: 2,
  next_cursor: offset ? null : 'next', order_ids: [], pending_ids: [], pending_orders: [], workflow_audit: null, snapshot: null,
  order_rows: {}, pending_rows: {}, closed_orders: [order({ order_id: `zakaz-${offset + 1}`, history_version: `h${offset + 1}` })], ...overrides });
const tick = () => new Promise(resolve => setImmediate(resolve));
test('source Closed code/title and actor fallbacks retain Dart whitespace and literal Uzbek wording', () => {
  for (const [value, expected] of [[order({ order_number: '\u0085 17 \u0085' }), '17'], [order(), '42'],
    [order({ order_id: ' zakaz- ' }), 'zakaz-'], [order({ order_id: ' opaque ' }), 'opaque']]) assert.equal(closed.adminWorkMapClosedCode(value), expected);
  for (const [value, expected] of [[order(), 'Ana'], [order({ closed_by_display_name: '' }), 'ref'],
    [order({ closed_by_display_name: '', closed_by_ref: '' }), 'admin'], [order({ closed_by_display_name: '', closed_by_ref: '', closed_by_role: '' }), 'Noma’lum ijrochi']]) {
    assert.equal(closed.adminWorkMapClosedActor(value), expected);
  }
  const [row] = closed.adminWorkMapClosedRows([order({ order_number: '17', title: '\u0085', logs: [{ action: 'close_early' }] })]);
  assert.deepEqual(row, { id: 'zakaz-42', historyVersion: 'h1', position: '1', headline: '17 • Zakaz', supporting: 'Erta yopilgan • C • Yopdi: Ana' });
});
test('local Closed timestamp matches V2 dd.MM.yyyy HH:mm in UTC, Tashkent and New York', () => {
  const previous = process.env.TZ;
  try {
    for (const [zone, expected] of [['Etc/UTC', '14.11.2023 22:13'], ['Asia/Tashkent', '15.11.2023 03:13'], ['America/New_York', '14.11.2023 17:13']]) {
      process.env.TZ = zone; assert.equal(closed.adminWorkMapClosedTime(1700000000), expected);
      assert.equal(closed.adminWorkMapClosedTime(0), ''); assert.equal(closed.adminWorkMapClosedTime(-1), '');
    }
    assert.throws(() => closed.adminWorkMapClosedTime(Infinity), RangeError);
    assert.throws(() => closed.adminWorkMapClosedTime(8640000000001), RangeError);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('Closed pages concatenate server order/history versions and reject duplicates or mixed live authority', () => {
  assert.deepEqual(closed.adminWorkMapClosedPages([page(), page(1)]).map(row => [row.order_id, row.history_version]), [['zakaz-1', 'h1'], ['zakaz-2', 'h2']]);
  assert.throws(() => closed.adminWorkMapClosedPages([page(), page(1, { closed_orders: [order({ order_id: 'zakaz-1' })] })]));
  for (const changes of [{ order_ids: ['live'] }, { pending_ids: ['p'] }, { workflow_audit: {} }, { projection: 'orders_list_v1' }]) assert.throws(() => closed.adminWorkMapClosedPages([page(0, changes)]));
});
test('Closed window pages and server search use view=closed without giving live detail authority', async () => {
  const requests = [], c = new Controller({ isCurrent: () => true, request: { view: 'closed' }, read: async request => {
    requests.push(request); return page(request.cursor ? 1 : 0);
  } });
  c.start(); await tick(); await c.next(); const state = c.getSnapshot();
  assert.deepEqual(requests, [{ view: 'closed', search: '' }, { view: 'closed', search: '', cursor: 'next' }]);
  assert.equal(state.closed.length, 2); assert.deepEqual(state.rows, []); assert.equal(state.audit, null); assert.equal(state.hasMore, false);
  assert.equal(c.detailTicket({ id: 'zakaz-1', kind: 'order' }), null);
  c.setQuery('  Ana  '); await c.reload(); assert.equal(requests.at(-1).search, 'Ana'); c.dispose();
});
test('Closed membership tickets bind ID, history version and the exact window generation', async () => {
  const c = new Controller({ isCurrent: () => true, request: { view: 'closed' }, read: async request => page(request.cursor ? 1 : 0) });
  c.start(); await tick(); const first = c.getSnapshot().closed[0], ticket = c.closedHistoryTicket(first);
  assert.equal(ticket.id, first.order_id); assert.equal(ticket.historyVersion, first.history_version); assert.equal(c.closedHistoryIsCurrent(ticket), true);
  assert.equal(c.closedHistoryTicket({ ...first, history_version: 'other' }), null);
  await c.next(); assert.equal(c.closedHistoryIsCurrent(ticket), false);
  const later = c.closedHistoryTicket(c.getSnapshot().closed[0]); assert.notEqual(later.windowGeneration, ticket.windowGeneration); assert.equal(c.closedHistoryIsCurrent(later), true);
  await c.reload(); assert.equal(c.closedHistoryIsCurrent(later), false); c.configure({ view: 'orders' });
  assert.equal(c.closedHistoryTicket(first), null); c.dispose();
});
test('Closed history owner retires a pending read as soon as the underlying window changes', async () => {
  const profile = load('shared/profileSessionGuard.ts'), mobile = load('shared/mobileApiException.ts');
  const History = load('admin/adminClosedHistoryController.ts', { '../shared/profileSessionGuard': profile, '../shared/mobileApiException': mobile,
    './adminWorkMapClosedModel': closed }).AdminClosedHistoryController;
  const c = new Controller({ isCurrent: () => true, request: { view: 'closed' }, read: async request => page(request.cursor ? 1 : 0) });
  c.start(); await tick(); const ticket = c.closedHistoryTicket(c.getSnapshot().closed[0]), reads = [];
  const h = new History(ticket, { isCurrent: () => true, rowIsCurrent: value => c.closedHistoryIsCurrent(value),
    read: (id, witness) => new Promise(resolve => reads.push({ id, witness, resolve })) });
  h.toggle(); assert.equal(reads[0].witness(), true); const append = c.next(); assert.equal(reads[0].witness(), false);
  assert.equal(c.closedHistoryTicket(c.getSnapshot().closed[0]), null);
  assert.equal(h.getSnapshot().expanded, false); await append; const newer = c.closedHistoryTicket(c.getSnapshot().closed[0]); h.configure(newer);
  reads[0].resolve({ order_id: ticket.id, logs: [] }); await tick(); assert.equal(reads.length, 2);
  reads[1].resolve({ order_id: newer.id, logs: [] }); await tick(); assert.equal(h.getSnapshot().detail.order_id, newer.id); h.dispose(); c.dispose();
});
test('stale responses, changed page versions and malformed dates cannot replace Closed summaries', async () => {
  let calls = 0; const c = new Controller({ isCurrent: () => true, request: { view: 'closed' }, read: async () => {
    if (++calls === 1) return page(); if (calls === 2) return page(1, { version: 'changed' }); return page(0, { closed_orders: [order({ completed_at_unix: Infinity })] });
  } });
  c.start(); await tick(); const before = c.getSnapshot().closed;
  await c.next(); assert.equal(c.getSnapshot().closed, before); assert.ok(c.getSnapshot().error);
  await c.reload(); assert.equal(c.getSnapshot().closed, before); assert.ok(c.getSnapshot().error); c.dispose();
  let resolve, current = true; const pending = new Controller({ isCurrent: () => current, request: { view: 'closed' }, read: () => new Promise(yes => { resolve = yes; }) });
  pending.start(); current = false; pending.invalidate(); resolve(page()); await tick(); assert.equal(pending.getSnapshot().closed.length, 0); pending.dispose();
});
test('an empty Closed page remains loaded when a later refresh fails', async () => {
  let calls = 0; const c = new Controller({ isCurrent: () => true, request: { view: 'closed' }, read: async () => {
    if (++calls === 1) return page(0, { length: 0, total: 0, next_cursor: null, closed_orders: [] }); throw Error('failed');
  } });
  c.start(); await tick(); assert.equal(c.getSnapshot().loaded, true); await c.reload();
  assert.equal(c.getSnapshot().loaded, true); assert.deepEqual(c.getSnapshot().closed, []); assert.equal(c.getSnapshot().error, 'failed'); c.dispose();
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} native Closed row preserves summary/rank and has no history, image or action callback`, () => {
  const modifiers = new Proxy({}, { get: (_target, key) => value => ({ key, value }) });
  const View = load(`admin/AdminWorkMapClosedRow.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: { HStack: 'HStack', VStack: 'VStack', Spacer: 'Spacer', Text: 'NativeText', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { PlatformColor: value => value }, './AdminClosedHistoryAccessories': { AdminClosedRank: 'Rank' } }).AdminWorkMapClosedRow;
  const row = closed.adminWorkMapClosedRows([order()])[0], tree = View({ row }); assert.equal(tree.type, platform === 'ios' ? 'HStack' : 'ListItem');
  if (platform === 'android') assert.equal(tree.props.supportingText, 'C • Yopdi: Ana'); else assert.ok(nodes(tree).some(value => value.type === 'NativeText' && value.props.children === 'C • Yopdi: Ana'));
  assert.equal(tree.props.onPress, undefined); assert.equal(tree.props.onLongPress, undefined);
  const badge = platform === 'ios' ? nodes(tree).find(value => value.type === 'Rank') : tree.props.leading.props.children;
  assert.equal(badge.type, 'Rank'); assert.equal(badge.props.position, '1'); assert.equal(badge.props.onPress, undefined);
  assert.equal(nodes(tree).find(value => value.type === 'NativeText').props.children, '42 • Film');
});
