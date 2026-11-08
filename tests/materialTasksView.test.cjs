const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function compile(relative, mocks = {}, extension = '.ts') {
  const filename = path.resolve(__dirname, `../src/${relative}${extension}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const translations = require('../src/shared/localization/catalog.json').production;
const productionText = (key, locale, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), translations[key]?.[locale] ?? key);
const dart = compile('shared/dartApparatus', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
const presentation = compile('shared/supplyTasks/supplyTasksPresentation', { '../dartApparatus': dart, '../localization': { productionText } });
const row = (changes = {}) => ({ id: 'zakaz-17', code: '', order_number: '', title: '  Film  ', product_code: 'P1', customer_name: 'Customer',
  position: 0, apparatus_count: 2, task_state: 'partial', image_id: '', ...changes });
const windowFor = (changes = {}) => ({ kind: 'material', limit: 10, search: '', epoch: 'e', scope: 's', version: 'v', revision: 1,
  apparatus_id: 'apparatus:a:one', apparatus: [{ id: 'apparatus:a:one', name: 'Bosma' }], checked_count: 3, missing_count: 2,
  rows: [row(), row({ id: 'order-2', code: 'C2', title: 'Other', position: 2, task_state: 'missing' })], ...changes });

test('compact row text follows f119 source priorities and localized apparatus count', () => {
  assert.deepEqual(presentation.materialTaskRowPresentation(row(), 'uz'), { code: '17', title: 'Film', subtitle: 'Customer • 2 ta aparat', position: 1, status: 'Qisman' });
  assert.deepEqual(presentation.materialTaskRowPresentation(row({ id: 'not-prefixed', code: '', order_number: ' NUM ', title: ' ', customer_name: '',
    product_code: ' P1 ', apparatus_count: 0, position: 4, task_state: 'missing' }), 'en'),
  { code: 'NUM', title: 'Order', subtitle: 'P1', position: 5, status: '' });
  assert.equal(presentation.materialTaskRowPresentation(row({ code: ' X ', order_number: 'Y' }), 'uz').code, 'X');
});

test('summary and empty states preserve source branches and localized strings', () => {
  assert.equal(presentation.materialTaskSummary(windowFor()), 'Tekshirilgan: 3 • Homashyo kutilmoqda: 2');
  assert.equal(presentation.materialTaskEmptyMessage(windowFor({ checked_count: 0, missing_count: 0, rows: [] }), 'uz'), 'Bu apparat navbatida order yo‘q.');
  assert.equal(presentation.materialTaskEmptyMessage(windowFor({ checked_count: 2, missing_count: 0, rows: [] }), 'uz'),
    'Tanlangan orderlarda sizning materiallaringiz bo‘yicha kutilayotgan homashyo yo‘q.');
  assert.equal(presentation.materialTaskEmptyMessage(windowFor({ checked_count: 2, missing_count: 1, rows: [] }), 'uz'), 'Qidiruvda topilmadi');
});

function hookSetup(handlers) {
  const w = windowFor(), calls = []; let current = true, reset;
  const state = { window: w, loading: false, error: null, searchInput: '' };
  const controller = { subscribe: () => () => {}, getSnapshot: () => state, canInteract: () => current,
    invalidate: () => { calls.push('invalidate'); current = false; state.window = null; } };
  const sheet = { open: (content, options) => calls.push(['open', content, options]), close: () => calls.push('close'), isOpen: () => false };
  const hook = compile('material/useMaterialTasksView', { 'react/jsx-runtime': jsx,
    react: { useEffect(fn) { fn(); }, useRef: initial => ({ current: initial }), useSyncExternalStore: (_subscribe, get) => get() },
    'react-native': { View: 'View' }, '../auth': { registerSessionResetHook: fn => { reset = fn; return () => {}; } },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../nativeSheet': { useNativeSheet: () => sheet } }, '.tsx');
  const view = hook.useMaterialTasksView(controller, handlers);
  return { w, calls, state, controller, view, reset, setCurrent: value => { current = value; } };
}

test('detail opens only for the current window and supplies a reusable scope/lifetime guard', () => {
  const calls = [], h = hookSetup({ openDetail: (item, guard) => calls.push({ item, guard }) });
  h.view.openDetail(h.w, h.w.rows[0]); assert.equal(calls.length, 1); assert.equal(calls[0].guard(), true);
  h.state.window = windowFor(); assert.equal(calls[0].guard(), false); h.view.openDetail(h.w, h.w.rows[0]); assert.equal(calls.length, 1);
});

test('receive sheet calls the owner only after explicit selection, dismissal and a fresh guard', () => {
  const received = [], h = hookSetup({ receive: (item, guard) => received.push({ item, guard }) });
  h.view.openReceive(h.w, h.w.rows[0]); const [, content, options] = h.calls[0];
  assert.equal(options.dismissible, true); const button = nodes(content, 'WorkerSheetButton')[0]; assert.equal(button.props.label, 'Kirim qilish');
  button.props.onPress(); button.props.onPress(); options.onDismiss(); options.onDismiss();
  assert.deepEqual(h.calls.filter(item => item === 'close'), ['close']);
  // Native onDismiss is expected once; the consumer must remain safe if a callback is duplicated.
  assert.equal(received.length, 1); assert.equal(received[0].guard(), true);
});

test('cancel, stale scope or session reset never calls the receive handler', async () => {
  const received = [], h = hookSetup({ receive: item => received.push(item) });
  h.view.openReceive(h.w, h.w.rows[0]); let [, content, options] = h.calls[0]; options.onDismiss(); assert.deepEqual(received, []);
  h.view.openReceive(h.w, h.w.rows[0]); [, content, options] = h.calls.at(-1); nodes(content, 'WorkerSheetButton')[0].props.onPress();
  h.setCurrent(false); options.onDismiss(); h.setCurrent(true); options.onDismiss(); assert.deepEqual(received, []);
  await h.reset(); assert.ok(h.calls.includes('invalidate')); assert.equal(h.state.window, null);
});

test('no handler means no fake detail or receive action', () => {
  const h = hookSetup(); assert.equal(h.view.openDetail, null); assert.equal(h.view.openReceive, null); assert.deepEqual(h.calls, []);
});

function screenSetup(platform, changes = {}) {
  const calls = [], w = windowFor(), state = { window: w, loading: false, error: null, searchInput: '', ...changes };
  const controller = { refresh: async () => calls.push('refresh'), canInteract: () => true,
    setSearchInput: value => calls.push(['search', value]), selectApparatus: id => { calls.push(['apparatus', id]); },
    selectLimit: count => { calls.push(['limit', count]); } };
  const openDetail = (_window, item) => calls.push(['detail', item.id]), openReceive = (_window, item) => calls.push(['receive', item.id]);
  const Picker = Object.assign(function Picker() {}, { Item: 'Picker.Item' });
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui': { Picker, Row: 'Row', Spacer: 'Spacer', Text: 'NativeText' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui/swift-ui': { Button: 'Button', HStack: 'HStack', ProgressView: 'ProgressView', Section: 'Section', Text: 'SwiftText', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { frame: value => value, onLongPressGesture: fn => ({ onLongPress: fn }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View' },
    'react-native-reanimated': { useSharedValue: value => ({ value }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
    '../preparation/PreparationUI': { PreparationList: 'PreparationList' }, '../shared/localization': { productionText },
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../shared/supplyTasks/supplyTasksPresentation': presentation, './useMaterialTasksView': { useMaterialTasksView: () => ({ state, openDetail, openReceive }) } };
  const component = compile(`material/MaterialTasks.${platform}`, mocks, '.tsx').MaterialTasks;
  return { calls, state, controller, Picker, tree: () => component({ controller, session: {}, locale: 'uz', onMenu: () => calls.push('menu'), onProfile: () => calls.push('profile') }) };
}

for (const platform of ['android', 'ios']) {
  test(`${platform} task screen reuses native search and list, displays rows and real injected callbacks`, async () => {
    const h = screenSetup(platform), tree = h.tree(), header = nodes(tree, 'OrdersHeader')[0]; assert.ok(header);
    assert.equal(header.props.searchPlaceholder, 'Material vazifalari'); header.props.onSearchChange('film'); header.props.onMenu(); header.props.onProfile();
    if (platform === 'android') {
      const list = nodes(tree, 'OrdersList')[0], filters = nodes(tree, 'DropdownFilter'), cards = nodes(tree, 'WorkerQueueCard');
      assert.ok(list); assert.equal(filters.length, 2); assert.equal(cards.length, 2); filters[0].props.onChange('apparatus:a:one');
      filters[1].props.onChange(20); cards[0].props.onPress(); cards[0].props.onLongPress(); await list.props.onRefresh();
    } else {
      const list = nodes(tree, 'PreparationList')[0], pickers = nodes(tree, h.Picker), buttons = nodes(tree, 'Button');
      assert.ok(list); assert.equal(pickers.length, 2); assert.equal(buttons.length, 2); pickers[0].props.onValueChange('apparatus:a:one');
      pickers[1].props.onValueChange(20); buttons[0].props.onPress(); buttons[0].props.modifiers[0].onLongPress(); await list.props.refresh();
    }
    assert.deepEqual(h.calls, [['search', 'film'], 'menu', 'profile', ['apparatus', 'apparatus:a:one'], ['limit', 20],
      ['detail', 'zakaz-17'], ['receive', 'zakaz-17'], 'refresh']);
  });
}

test('loading, error and empty task states have no fabricated order rows', () => {
  for (const platform of ['android', 'ios']) {
    const loading = screenSetup(platform, { loading: true, window: null }).tree();
    assert.equal(nodes(loading, platform === 'android' ? 'ActivityIndicator' : 'ProgressView').length, 1);
    const empty = screenSetup(platform, { window: windowFor({ rows: [], checked_count: 0, missing_count: 0 }) }).tree();
    const texts = nodes(empty, platform === 'android' ? 'Text' : 'SwiftText').map(node => node.props.children);
    assert.ok(texts.includes('Bu apparat navbatida order yo‘q.'));
  }
});

test('detail and receipt interactions are serialized while an injected handler is pending', async () => {
  let resolveDetail, resolveReceipt, details = 0, receipts = 0;
  const detailPending = new Promise(resolve => { resolveDetail = resolve; });
  const receiptPending = new Promise(resolve => { resolveReceipt = resolve; });
  const h = hookSetup({ openDetail: () => { details++; return detailPending; }, receive: () => { receipts++; return receiptPending; } });
  h.view.openDetail(h.w, h.w.rows[0]); h.view.openDetail(h.w, h.w.rows[0]); h.view.openReceive(h.w, h.w.rows[0]);
  assert.equal(details, 1); assert.equal(h.calls.length, 0); resolveDetail(); await new Promise(resolve => setImmediate(resolve));
  h.view.openReceive(h.w, h.w.rows[0]); h.view.openReceive(h.w, h.w.rows[0]); assert.equal(h.calls.filter(value => Array.isArray(value) && value[0] === 'open').length, 1);
  const [, content, options] = h.calls[0]; nodes(content, 'WorkerSheetButton')[0].props.onPress(); options.onDismiss(); options.onDismiss();
  h.view.openDetail(h.w, h.w.rows[0]); assert.equal(receipts, 1); assert.equal(details, 1);
  resolveReceipt(); await new Promise(resolve => setImmediate(resolve)); h.view.openDetail(h.w, h.w.rows[0]); assert.equal(details, 2);
});
