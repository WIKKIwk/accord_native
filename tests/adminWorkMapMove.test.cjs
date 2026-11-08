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
const dart = load('admin/dartJsonString.ts');
const audit = load('admin/adminWorkMapAuditModel.ts', { './dartJsonString': dart }), closed = load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart });
const window = load('admin/adminWorkMapController.ts', { './dartJsonString': dart, './adminWorkMapAuditModel': audit, './adminWorkMapClosedModel': closed });
const model = load('admin/adminWorkMapMoveModel.ts');
const Move = load('admin/adminWorkMapMoveController.ts', { './adminWorkMapController': window, './adminWorkMapMoveModel': model }).AdminWorkMapMoveController;
const a = { id: 'apparatus:default:asset-005', name: 'Pechat A', operation: 'print' }, b = { id: 'apparatus:default:asset-010', name: 'Pechat B', operation: 'print' },
  c = { id: 'apparatus:default:asset-011', name: 'Rezka', operation: 'cut' };
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function page(id = 'o', changes = {}) {
  return { projection: '', version: 'move-v', epoch: 'e', revision: 4, scope: 's', offset: 0, length: 1, total: 1, next_cursor: null,
    order_ids: [id], pending_ids: [], pending_orders: [], closed_orders: [], workflow_audit: null, order_rows: {}, pending_rows: {},
    snapshot: { maps: [{ map: { id, code: '1', title: '', product_code: 'P', customer_name: '', nodes: [{ kind: 'end', title: 'Film' }] } }] }, ...changes };
}
test('Move defaults follow exact print-first, fallback and retained-choice source branches', () => {
  assert.deepEqual(model.adminWorkMapMoveDefaults([]), { top: null, bottom: null });
  assert.deepEqual(model.adminWorkMapMoveDefaults([a]), { top: a, bottom: null });
  assert.deepEqual(model.adminWorkMapMoveDefaults([c, a, b]), { top: a, bottom: b });
  assert.deepEqual(model.adminWorkMapMoveDefaults([c, a]), { top: a, bottom: c });
  assert.deepEqual(model.adminWorkMapMoveDefaults([c, { ...a, operation: 'Print' }]).top, c);
  // Source retains currentTop before choosing candidates[1], even when that makes an unusual same-ID pair.
  assert.deepEqual(model.adminWorkMapMoveDefaults([a, b], b), { top: b, bottom: b });
});
test('Move summaries retain source display-code, end-product and subtitle precedence in server order', () => {
  const maps = [
    { id: 'z', code: ' 8 ', order_number: '9', title: ' Film ', customer_name: ' Buyer ', product_code: 'P',
      nodes: [{ kind: 'end', title: 'Film' }, { kind: 'end', title: ' Roll ' }] },
    { id: 'zakaz- 42 ', code: '', order_number: '', title: '\u0085', customer_name: '', product_code: ' P ',
      nodes: [{ kind: 'apparatus', title: 'Ignore' }, { kind: 'end', title: ' ' }, { kind: 'end', title: ' Roll ' }] },
    { id: 'x', order_number: ' 10 ', title: '', product_code: '', nodes: [{ kind: 'end', title: ' End ' }] },
    { id: 'plain', title: '', nodes: [] },
  ];
  const result = window.adminWorkMapRows([page('z', { order_ids: ['plain', 'x', 'zakaz- 42 ', 'z'],
    snapshot: { maps: maps.map(map => ({ map })) } })], 'move');
  assert.deepEqual(result.map(({ id, code, title, customer, position }) => ({ id, code, title, customer, position })), [
    { id: 'plain', code: '', title: '', customer: '', position: 1 },
    { id: 'x', code: '10', title: 'End', customer: 'End', position: 2 },
    { id: 'zakaz- 42 ', code: '42', title: 'Roll', customer: 'P', position: 3 },
    { id: 'z', code: '8', title: 'Film', customer: 'Buyer', position: 4 },
  ]);
});
test('Move makes no reads offscreen or without both real apparatus, then reads exact opposite scopes', async () => {
  const requests = [], move = new Move({ isCurrent: () => true, read: async request => { requests.push(request); return page(); } });
  move.start(); move.setCatalog([a, b]); await tick(); assert.equal(requests.length, 0);
  move.setActive(true); await tick();
  assert.deepEqual(requests, [{ view: 'move', apparatus: a.id, target: b.id, search: '' }, { view: 'move', apparatus: b.id, target: a.id, search: '' }]);
  assert.equal(move.getSnapshot().topWindow.rows[0].title, 'Film'); assert.equal(move.getSnapshot().topWindow.rows[0].customer, 'P');
  assert.equal(move.topWindow.detailTicket(move.getSnapshot().topWindow.rows[0]), null); move.dispose();
  const missing = new Move({ isCurrent: () => true, read: async () => { throw new Error('unexpected read'); } });
  missing.start(); missing.setCatalog([a]); missing.setActive(true); await tick(); assert.equal(missing.getSnapshot().bottom, null); missing.dispose();
});
test('deactivation/account loss retires both windows and late reads without transfer/detail authority', async () => {
  for (const invalidate of [false, true]) {
    let current = true; const pending = [], move = new Move({ isCurrent: () => current, read: () => { const result = deferred(); pending.push(result); return result.promise; } });
    move.start(); move.setCatalog([a, b]); move.setActive(true);
    if (invalidate) { current = false; move.invalidate(); } else move.setActive(false);
    pending.forEach(result => result.resolve(page())); await tick();
    assert.equal(move.getSnapshot().topWindow.rows.length, 0); assert.equal(move.getSnapshot().bottomWindow.rows.length, 0);
    assert.equal(Object.hasOwn(move, 'onMove'), false); move.dispose();
  }
});
test('opposite windows retain independent paging/errors and search, with no mixed action certification', async () => {
  const requests = []; let topCalls = 0;
  const move = new Move({ isCurrent: () => true, read: async request => {
    requests.push(request);
    if (request.apparatus === a.id && ++topCalls === 1) return page('one', { total: 2, next_cursor: 'next' });
    if (request.apparatus === a.id && topCalls === 2) return page('two', { offset: 1, total: 2 });
    if (request.apparatus === a.id) throw new Error('top failed');
    return page('bottom', { revision: 8 });
  } });
  move.start(); move.setCatalog([a, b]); move.setActive(true); await tick();
  await move.topWindow.next(); assert.equal(move.getSnapshot().topWindow.rows.length, 2); assert.equal(move.getSnapshot().bottomWindow.rows.length, 1);
  assert.equal(requests.at(-1).cursor, 'next'); await move.reload();
  assert.equal(move.getSnapshot().topWindow.error, 'top failed'); assert.equal(move.getSnapshot().bottomWindow.error, null);
  move.setQuery(' Film '); await Promise.all([move.topWindow.reload(), move.bottomWindow.reload()]); assert.equal(requests.at(-1).search, 'Film'); move.dispose();
});
test('changing only Move target invalidates old membership rather than reusing the old request', async () => {
  const requests = [], pending = [], controller = new window.AdminWorkMapController({ isCurrent: () => true, request: { view: 'move', apparatus: a.id, target: b.id },
    read: request => { requests.push(request); const result = deferred(); pending.push(result); return result.promise; } });
  controller.start(); controller.configure({ view: 'move', apparatus: a.id, target: c.id });
  pending[0].resolve(page('old')); await tick(); assert.equal(controller.getSnapshot().rows.length, 0);
  pending[1].resolve(page('new')); await tick(); assert.equal(controller.getSnapshot().rows[0].id, 'new'); assert.equal(requests[1].target, c.id); controller.dispose();
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} passive Move panes reuse native lists/summary rows with read-only refresh and pagination`, async () => {
  const calls = [], native = { Button: 'Button', Text: 'NativeText' };
  const component = load(`admin/AdminWorkMapMove.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    '@expo/ui/swift-ui/modifiers': { font: x => x }, 'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, '../components/BaseHost': { BaseHost: 'BaseHost' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, './AdminWorkMapClosedRow': { AdminWorkMapClosedRow: 'ReadOnlyRow' } }).AdminWorkMapMove;
  const pane = { id: 'top', name: 'Pechat A', rows: [{ id: 'o', position: '1', headline: '1 • Film', supporting: 'P' }],
    loading: false, loaded: true, error: null, hasMore: true, empty: 'empty', retryLabel: 'retry', moreLabel: 'more',
    onRefresh: async () => calls.push('refresh'), onMore: async () => calls.push('more') };
  const tree = component({ partial: 'partial', loading: false, error: null, empty: '', retryLabel: 'retry', onRetry() {}, panes: [pane] });
  const wrapped = nodes(tree).find(row => typeof row.type === 'function'), rendered = wrapped.type(wrapped.props), all = nodes(rendered);
  const list = all.find(row => row.type === 'OrdersList'); await list.props.onRefresh();
  assert.equal(all.find(row => row.type === 'ReadOnlyRow').props.row, pane.rows[0]);
  assert.equal(all.find(row => row.type === 'ReadOnlyRow').props.onPress, undefined);
  all.find(row => row.type === (platform === 'ios' ? 'Button' : 'ListItem')).props.onPress(); await tick();
  assert.deepEqual(calls, ['refresh', 'more']); assert.equal(all.some(row => row.props.onLongPress || row.props.onMove || row.props.onToggleSelect), false);
});
