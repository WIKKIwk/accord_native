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
const model = load('admin/adminWorkMapMoveModel.ts', { './dartJsonString': dart });
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
test('Move picker options exclude the opposite apparatus and place unassigned first when allowed', () => {
  const unassigned = model.adminWorkMapMoveUnassigned;
  assert.deepEqual(model.adminWorkMapMovePickerOptions([a, b, c], b), [unassigned, a, c]);
  assert.deepEqual(model.adminWorkMapMovePickerOptions([a, b, c], unassigned), [a, b, c]);
  assert.deepEqual(model.adminWorkMapMovePickerOptions([a, b], null), [a, b]);
  assert.equal(model.adminWorkMapMoveScope(unassigned), 'unassigned');
  assert.equal(model.adminWorkMapMoveScope({ ...a, id: '\u0085apparatus:default:asset-005\u0085' }), a.id);
});
test('picker changes the two opposite read scopes and immediately retires the old pair', async () => {
  const requests = [], pending = [], move = new Move({ isCurrent: () => true, read: request => {
    requests.push(request); const result = deferred(); pending.push(result); return result.promise;
  } });
  move.start(); move.setCatalog([a, b, c]); move.setActive(true);
  const picker = move.picker('top'); assert.deepEqual(picker.options, [model.adminWorkMapMoveUnassigned, a, c]);
  assert.equal(move.choose(picker, model.adminWorkMapMoveUnassigned), true);
  assert.deepEqual(requests.map(({ apparatus, target }) => [apparatus, target]), [[a.id, b.id], [b.id, a.id], ['unassigned', b.id], [b.id, 'unassigned']]);
  pending[0].resolve(page('old-top')); pending[1].resolve(page('old-bottom')); await tick();
  assert.equal(move.getSnapshot().topWindow.rows.length, 0); assert.equal(move.getSnapshot().bottomWindow.rows.length, 0);
  pending[2].resolve(page('new-top')); pending[3].resolve(page('new-bottom')); await tick();
  assert.equal(move.getSnapshot().topWindow.rows[0].id, 'new-top'); assert.equal(move.getSnapshot().bottomWindow.rows[0].id, 'new-bottom');
  assert.deepEqual(move.picker('bottom').options, [a, b, c]); move.dispose();
});
test('a stale picker, wrong option, inactive module or lost session cannot change scopes or send', async () => {
  let current = true; const requests = [], move = new Move({ isCurrent: () => current, read: async request => { requests.push(request); return page(); } });
  move.start(); move.setCatalog([a, b, c]); move.setActive(true); await tick();
  const old = move.picker('top'); assert.equal(move.choose(old, b), false); assert.equal(move.choose(old, { ...c, id: 'unknown' }), false);
  assert.equal(requests.length, 2); assert.equal(move.choose(old, c), true); await tick(); assert.equal(requests.length, 4);
  assert.equal(move.choose(old, a), false); const second = move.picker('bottom'); move.setActive(false);
  assert.equal(move.choose(second, a), false); move.setActive(true); await tick();
  const third = move.picker('top'), count = requests.length; current = false; assert.equal(move.choose(third, a), false); assert.equal(requests.length, count);
  move.invalidate(); move.dispose();
});
test('catalog refresh invalidates an open picker before an option can be used', async () => {
  const requests = [], move = new Move({ isCurrent: () => true, read: async request => { requests.push(request); return page(); } });
  move.start(); move.setCatalog([a, b, c]); move.setActive(true); await tick(); const picker = move.picker('top'), before = requests.length;
  move.setCatalog([a, b]); assert.equal(move.choose(picker, c), false); assert.equal(requests.length, before); move.dispose();
});
test('reselecting a current Move apparatus refreshes both scopes without changing the pair', async () => {
  const requests = [], move = new Move({ isCurrent: () => true, read: async request => { requests.push(request); return page(); } });
  move.start(); move.setCatalog([a, b]); move.setActive(true); await tick(); const picker = move.picker('top');
  assert.equal(move.choose(picker, a), true); await tick(); assert.equal(requests.length, 4);
  assert.equal(move.getSnapshot().top, a); assert.equal(move.getSnapshot().bottom, b); move.dispose();
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
test('Move divider uses source delta/height, 24–76% bounds and rounded thousandths without transfer authority', () => {
  const Split = load('admin/adminWorkMapMoveSplitState.ts').AdminWorkMapMoveSplit, split = new Split(); let changes = 0;
  const unsubscribe = split.subscribe(() => changes++); assert.deepEqual(split.flex(), { top: 500, bottom: 500 });
  split.start([{ identifier: 1, pageY: 100 }]); split.move([{ identifier: 1, pageY: 200 }]); assert.equal(split.getSnapshot(), 0.5);
  split.setHeight(1000); split.move([{ identifier: 1, pageY: 300 }]); assert.equal(split.getSnapshot(), 0.6); assert.deepEqual(split.flex(), { top: 600, bottom: 400 });
  split.move([{ identifier: 1, pageY: 700 }]); assert.equal(split.getSnapshot(), 0.76);
  split.move([{ identifier: 1, pageY: 690 }]); assert.equal(split.getSnapshot(), 0.75); // Incremental reverse moves immediately after a clamp.
  split.move([{ identifier: 1, pageY: -1000 }]); assert.equal(split.getSnapshot(), 0.24); assert.deepEqual(split.flex(), { top: 240, bottom: 760 });
  split.start([{ identifier: 2, pageY: 0 }]); split.move([{ identifier: 2, pageY: 111.4 }]); assert.equal(split.flex().top, 351);
  split.end([{ identifier: 2, pageY: 111.4 }]); const before = split.getSnapshot(); split.move([{ identifier: 2, pageY: 800 }]); assert.equal(split.getSnapshot(), before);
  split.move([{ identifier: 1, pageY: -950 }]); assert.ok(Math.abs(split.getSnapshot() - (before + 0.05)) < 1e-12);
  split.end([{ identifier: 1, pageY: -950 }]); unsubscribe(); const observed = changes; split.setHeight(Infinity); split.start([{ identifier: 3, pageY: 0 }]); split.move([{ identifier: 3, pageY: 100 }]);
  assert.equal(changes, observed); assert.equal(Object.hasOwn(split, 'onMove'), false);
});
test('Move divider forwards boundary touch deltas without claiming taps and lays out both bodies', () => {
  const Split = load('admin/adminWorkMapMoveSplitState.ts').AdminWorkMapMoveSplit; let instance;
  const View = load('admin/AdminWorkMapMoveSplit.tsx', { react: { useMemo: fn => instance ??= fn(), useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-native': { View: 'View', StyleSheet: { create: value => value } }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { outlineVariant: 'outline' }, direction: 'rightToLeft' }) },
    './adminWorkMapMoveSplitState': { AdminWorkMapMoveSplit: Split } }).AdminWorkMapMoveSplit;
  const props = { topHeader: 'top header', topBody: 'top body', bottomHeader: 'bottom header', bottomBody: 'bottom body' };
  let tree = nodes(View(props)), boundary = tree.find(row => row.props.testID === 'admin-move-divider'); assert.equal(tree[0].props.style[1].direction, 'rtl');
  tree.find(row => row.props.onLayout).props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  const event = (id, pageY) => ({ nativeEvent: { changedTouches: [{ identifier: id, pageY }] } });
  boundary.props.onTouchStart(event(1, 100)); boundary.props.onTouchMove(event(1, 150));
  assert.equal(instance.getSnapshot(), 0.6); boundary.props.onTouchCancel(event(1, 150)); boundary.props.onTouchMove(event(1, 300)); assert.equal(instance.getSnapshot(), 0.6);
  tree = nodes(View(props)); boundary = tree.find(row => row.props.testID === 'admin-move-divider');
  assert.equal(tree.some(row => row.props.style?.flex === 600), true); assert.equal(tree.some(row => row.props.style?.flex === 400), true);
  assert.deepEqual(boundary.props.children.map(row => row.props.children).filter(Boolean), ['bottom header']);
  assert.equal(boundary.props.onStartShouldSetResponder, undefined); assert.equal(boundary.props.onMoveShouldSetResponder, undefined);
});
test('Move picker headers retain source apparatus icon, text, accessibility and their supplied callbacks', () => {
  const Header = load('admin/AdminWorkMapMoveHeader.tsx', { 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', StyleSheet: { create: value => value } },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { primaryContainer: 'bg', onPrimaryContainer: 'fg' }, direction: 'rightToLeft' }) } }).AdminWorkMapMoveHeader;
  let picked = 0; const pane = { id: 'bottom', name: 'Pechat B', onPick: () => picked++ }, tree = nodes(Header({ pane })), button = tree[0];
  assert.equal(button.props.testID, 'admin-move-bottom-picker'); assert.equal(button.props.accessibilityRole, 'button'); assert.equal(button.props.accessibilityLabel, pane.name); assert.equal(button.props.style[1].direction, 'rtl');
  assert.deepEqual(tree.filter(row => row.type === 'SymbolView').map(row => row.props.name), [
    { ios: 'gearshape.2', android: 'precision_manufacturing' }, { ios: 'chevron.down', android: 'expand_more' }]);
  assert.equal(tree.find(row => row.type === 'Text').props.numberOfLines, 1); button.props.onPress(); assert.equal(picked, 1);
});
for (const platform of ['ios', 'android']) test(`${platform} passive Move panes reuse native lists/summary rows with read-only refresh and pagination`, async () => {
  const calls = [], native = { Button: 'Button', Text: 'NativeText', Image: 'Image', RNHostView: 'RNHostView' };
  const component = load(`admin/AdminWorkMapMove.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    '@expo/ui/swift-ui/modifiers': { font: x => x, accessibilityHidden: () => ({}) }, 'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, '../components/BaseHost': { BaseHost: 'BaseHost' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, './AdminWorkMapClosedRow': { AdminWorkMapClosedRow: 'ReadOnlyRow' },
    './AdminWorkMapMoveSplit': { AdminWorkMapMoveSplit: 'Split' }, './AdminWorkMapMoveHeader': { AdminWorkMapMoveHeader: 'Header' } }).AdminWorkMapMove;
  const pane = { id: 'top', name: 'Pechat A', rows: [{ id: 'o', position: '1', headline: '1 • Film', supporting: 'P' }],
    loading: false, loaded: true, error: null, hasMore: true, empty: 'empty', retryLabel: 'retry', moreLabel: 'more',
    onRefresh: async () => calls.push('refresh'), onMore: async () => calls.push('more'), onPick: () => calls.push('pick') };
  const bottom = { ...pane, id: 'bottom', name: 'Pechat B' }, tree = component({ loading: false, error: null, empty: '', retryLabel: 'retry', onRetry() {}, panes: [pane, bottom] });
  assert.equal(nodes(tree).some(row => row.type === 'NativeText' && row.props.children === 'partial'), false);
  const split = nodes(tree).find(row => row.type === 'Split'); assert.equal(split.props.topHeader.props.pane, pane); assert.equal(split.props.bottomHeader.props.pane, bottom);
  const wrapped = split.props.topBody, rendered = wrapped.type(wrapped.props), all = nodes(rendered);
  const list = all.find(row => row.type === 'OrdersList'); await list.props.onRefresh();
  assert.equal(all.find(row => row.type === 'ReadOnlyRow').props.row, pane.rows[0]);
  assert.equal(all.find(row => row.type === 'ReadOnlyRow').props.onPress, undefined);
  split.props.topHeader.props.pane.onPick();
  all.find(row => row.type === (platform === 'ios' ? 'Button' : 'ListItem') && (platform === 'ios' ? row.props.label === 'more' : row.props.children === 'more')).props.onPress(); await tick();
  assert.deepEqual(calls, ['refresh', 'pick', 'more']); assert.equal(all.some(row => row.props.onLongPress || row.props.onMove || row.props.onToggleSelect), false);
});

for (const platform of ['ios', 'android']) test(`${platform} Move picker renders source order, selected state and exact choice callbacks`, () => {
  const native = { Text: 'NativeText', VStack: 'VStack', Column: 'Column' }, calls = [];
  const View = load(`admin/AdminWorkMapMovePicker.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: native,
    '@expo/ui/swift-ui/modifiers': { font: x => x, background: x => ({ background: x }), accessibilityAddTraits: x => ({ traits: x }) },
    '../components/BaseHost': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: { primaryContainer: 'selected' } }) },
  }).AdminWorkMapMovePicker;
  const rows = [{ selection: model.adminWorkMapMoveUnassigned, key: 'unassigned', name: 'Tanlanmagan', selected: false },
    { selection: a, key: 'apparatus:a', name: 'Pechat A', selected: true }];
  const tree = nodes(View({ title: 'Select', rows, onChoose: value => calls.push(value) }));
  assert.deepEqual(tree.filter(node => node.type === 'ListItem').map(node => node.props.children), ['Tanlanmagan', 'Pechat A']);
  const selected = tree.find(node => node.props.testID === 'admin-move-picker-apparatus:a'); selected.props.onPress();
  assert.deepEqual(calls, [a]); assert.ok(platform === 'ios' ? selected.props.modifiers.some(x => x.background === 'selected') : selected.props.colors.containerColor === 'selected');
});
