const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/gscale', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id]
    : id.endsWith('.xml') ? id : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const { gscaleReceiptGroups } = load('gscaleReceiptLayout.ts');
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function fixture() {
  const calls = [], gestures = [], effects = [], keyboardEvents = {};
  let receiptContext;
  const action = (id, disabled = false, detail) => ({ kind: 'action', id, label: id, detail, disabled, press: () => calls.push(id) });
  const field = (key, value) => ({ kind: 'field', key, label: key, value, disabled: false,
    change: next => calls.push([key, next]), focus: value => calls.push(['focus', value]) });
  const outlined = Object.assign(function OutlinedTextField() {}, { Label: 'FieldLabel', Suffix: 'FieldSuffix' });
  const native = { Host: 'Host', Button: 'Button', Column: 'Column', Icon: 'Icon', IconButton: 'IconButton', OutlinedButton: 'OutlinedButton',
    OutlinedTextField: outlined, Row: 'Row', Shape: { RoundedCorner: value => value }, Switch: 'Switch', Text: 'Text', TextButton: 'TextButton',
    useMaterialColors: () => ({ surface: 'surface', error: 'red', onError: 'white' }),
    useNativeState: value => ({ get: () => value, set: next => { value = next; } }) };
  const mocks = {
    react: { createContext: value => { receiptContext = { value, Provider: 'ContextProvider' }; return receiptContext; },
      useContext: context => context.value, useCallback: fn => fn, useEffect: fn => effects.push(fn),
      useMemo: fn => fn(), useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    '@expo/ui/jetpack-compose': native,
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: (_, name) => value => ({ name, value }) }),
    'expo-router': { router: { navigate: route => calls.push(['navigate', route]) } },
    'react-native': { View: 'View', Text: 'NativeText', Pressable: 'Pressable', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
      KeyboardAvoidingView: 'KeyboardAvoidingView', Keyboard: { metrics: () => undefined, addListener: (name, fn) => {
        keyboardEvents[name] = fn; return { remove: () => { delete keyboardEvents[name]; } };
      } },
      useWindowDimensions: () => ({ width: 400, fontScale: 1 }), StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView', GestureDetector: 'GestureDetector',
      useNativeGesture: config => { gestures.push(config); return config; } },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../preparation/PreparationUI.android': { PreparationDock: 'PreparationDock' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'OrdersWorkspace' },
    './gscaleReceiptLayout': { gscaleReceiptGroups }, './useGScaleScreen': { useGScaleText: () => value => value },
  };
  const exports = load('GScaleReceipt.android.tsx', mocks);
  function render(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(render);
    if (typeof node.type === 'function' && node.type !== outlined) return render(node.type(node.props));
    return { ...node, props: { ...node.props, children: render(node.props?.children) } };
  }
  return { calls, gestures, effects, keyboardEvents, get receiptContext() { return receiptContext; }, action, field, outlined, native, mocks, render, ...exports };
}

test('receipt grouping retains every value, lock and callback in its original order', () => {
  const x = fixture(), rows = [{ kind: 'text', text: 'PE PR · W' }, x.action('gscale-context-edit'),
    x.field('width_text', '100'), x.field('micron_text', '12'), x.field('length_text', '125'),
    x.field('manual_qty_text', '5'), x.field('manual_duplicate_text', '2'), x.action('gscale-print'), x.action('gscale-stop', true)];
  const groups = gscaleReceiptGroups(rows);
  assert.deepEqual(groups.map(group => group.kind), ['summary', 'fields', 'row', 'fields', 'actions']);
  const flattened = groups.flatMap(group => group.rows);
  flattened.forEach((row, index) => assert.equal(row, rows[index]));
  assert.deepEqual(x.calls, []);
});

test('receipt controls preserve selection, quantity, focus and print/stop handlers and disabled states', () => {
  const x = fixture(), order = x.action('gscale-order', true, '0317'), print = x.action('gscale-print'), stop = x.action('gscale-stop');
  const weight = x.field('manual_qty_text', '5'), count = x.field('manual_duplicate_text', '2');
  const rows = [order, x.action('gscale-item', false, 'PE PR'), weight, count,
    { kind: 'toggle', label: 'Babina', value: true, disabled: true, change: value => x.calls.push(['babina', value]) }, print, stop];
  const tree = x.render(x.ReceiptRows({ rows }));
  const pickers = nodes(tree, node => node.type === 'OutlinedButton');
  assert.equal(pickers[0].props.enabled, false); assert.equal(pickers[1].props.onClick, rows[1].press);
  pickers[1].props.onClick(); assert.equal(x.calls.at(-1), 'gscale-item');
  const fields = nodes(tree, node => node.type === x.outlined);
  assert.equal(fields[0].props.value.get(), '5'); assert.equal(fields[1].props.keyboardOptions.keyboardType, 'number');
  fields[0].props.onValueChange('8.2'); fields[0].props.onFocusChanged(false);
  assert.deepEqual(x.calls.slice(-2), [['manual_qty_text', '8.2'], ['focus', false]]);
  const toggle = nodes(tree, node => node.type === 'Switch')[0];
  assert.equal(toggle.props.value, true); assert.equal(toggle.props.enabled, false);
  const buttons = nodes(tree, node => node.type === 'Button');
  assert.equal(buttons[0].props.onClick, print.press); assert.equal(buttons[1].props.onClick, stop.press);
  assert.deepEqual(buttons[1].props.colors, { containerColor: 'red', contentColor: 'white' });
  buttons[0].props.onClick(); buttons[1].props.onClick(); assert.deepEqual(x.calls.slice(-2), ['gscale-print', 'gscale-stop']);
  print.disabled = stop.disabled = true;
  assert.ok(nodes(x.render(x.ReceiptRows({ rows: [print, stop] })), node => node.type === 'Button').every(node => !node.props.enabled));
});

test('receipt reuses the pager and role dock with device, back, profile, history refresh and preserved form values', () => {
  const x = fixture(), field = x.field('manual_qty_text', '5'), pager = { name: 'pager' };
  const tree = x.GScaleReceipt({ session: {}, title: 'Homashyo kirimi', section: 'control',
    onSelect: id => x.calls.push(['tab', id]), control: [{ rows: [x.action('gscale-device')] }, { rows: [field] }], history: [{ rows: [] }],
    connected: false, attention: true, refreshing: false, onDevices: () => x.calls.push('devices'),
    onBack: () => x.calls.push('back'), onRefresh: () => x.calls.push('refresh') });
  assert.equal(tree.type, 'GestureHandlerRootView', 'the standalone receipt route must provide a root for its pager and scroll gestures');
  const keyboardArea = nodes(tree, node => node.type === 'KeyboardAvoidingView')[0];
  assert.equal(keyboardArea.props.behavior, 'height');
  assert.equal(nodes(keyboardArea, node => node.type === 'PreparationDock').length, 0);
  assert.equal(nodes(tree, node => node.type === 'PreparationDock').length, 1);
  assert.equal(nodes(tree, node => node.type === 'PreparationDock')[0].props.avoidKeyboard, false);
  const bar = nodes(tree, node => node.type === 'OrdersWorkspace')[0];
  assert.deepEqual(bar.props.tabs.map(tab => tab.name), ['Print', 'Print tarixi']);
  bar.props.onSelect('history'); assert.deepEqual(x.calls.at(-1), ['tab', 'history']);
  nodes(tree, node => node.type === 'IconButton')[0].props.onClick(); assert.equal(x.calls.at(-1), 'devices');
  const header = nodes(tree, node => node.type === 'RoleHeaderButton');
  header[0].props.onPress(); assert.equal(x.calls.at(-1), 'back');
  header[1].props.onPress(); assert.deepEqual(x.calls.at(-1), ['navigate', '/android-preparation/profile']);
  const control = x.render(bar.props.children('control', pager)), history = x.render(bar.props.children('history', pager));
  assert.equal(nodes(control, node => node.type === x.outlined)[0].props.value.get(), '5');
  assert.equal(x.gestures[0].requireToFail, pager);
  nodes(history, node => node.type === 'ScrollView')[0].props.refreshControl.props.onRefresh(); assert.equal(x.calls.at(-1), 'refresh');
  assert.equal(field.value, '5');
});

test('receipt dock stays at the window bottom while the keyboard resizes the scroll area', () => {
  const x = fixture(), state = [];
  let cursor = 0;
  x.mocks.react.useState = initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  };
  const render = () => {
    cursor = 0;
    return x.GScaleReceipt({ session: {}, title: 'Homashyo kirimi', section: 'control', onSelect() {},
      control: [{ rows: [] }], history: [{ rows: [] }], connected: true, attention: false, refreshing: false,
      onRefresh() {}, onDevices() {}, onBack() {} });
  };
  let tree = render();
  tree.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  tree = render();
  const dock = nodes(tree, node => node.type === 'View' && node.props.onLayout && nodes(node, child => child.type === 'PreparationDock').length)[0];
  dock.props.onLayout({ nativeEvent: { layout: { height: 96 } } });
  tree = render();
  const check = (height, expectedBottom, expectedMargin) => {
    const dockView = nodes(tree, node => node.type === 'View' && node.props.onLayout && nodes(node, child => child.type === 'PreparationDock').length)[0];
    const keyboardArea = nodes(tree, node => node.type === 'KeyboardAvoidingView')[0];
    assert.equal(dockView.props.style[1].bottom, expectedBottom);
    assert.equal(keyboardArea.props.style[1].marginBottom, expectedMargin);
    assert.equal(height - expectedBottom - 96, 704, 'the mounted dock must stay at the same window position');
    assert.equal(nodes(dockView, node => node.type === 'PreparationDock').length, 1);
  };
  check(800, 0, 96);
  tree.props.onLayout({ nativeEvent: { layout: { height: 500 } } });
  tree = render(); check(500, -300, 0);
  tree.props.onLayout({ nativeEvent: { layout: { height: 750 } } });
  tree = render(); check(750, -50, 46);
  tree.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
  tree = render(); check(800, 0, 96);
});

test('keyboard resize reveals the focused field and a manual drag can scroll without losing focus', async () => {
  const x = fixture(), field = x.field('manual_qty_text', '5');
  const page = x.GScaleReceipt({ session: {}, title: 'Homashyo kirimi', section: 'control', onSelect() {},
    control: [{ rows: [x.action('gscale-device')] }, { rows: [field] }], history: [{ rows: [] }],
    connected: true, attention: false, refreshing: false, onRefresh() {}, onDevices() {}, onBack() {} });
  const bar = nodes(page, node => node.type === 'OrdersWorkspace')[0];
  const pageElement = bar.props.children('control', { name: 'pager' });
  const viewport = pageElement.type(pageElement.props);
  const list = nodes(viewport, node => node.type === 'ScrollView')[0];
  const content = nodes(list, node => node.type === 'View' && node.props.collapsable === false)[0];
  const provider = nodes(content, node => node.type === 'ContextProvider')[0];
  const positions = [], sizes = { viewport: 700, scroll: 0 };
  viewport.props.ref.current = { measureInWindow: callback => callback(0, 100, 400, sizes.viewport) };
  content.props.ref.current = { measureInWindow: callback => callback(0, 100 - sizes.scroll, 400, 1000) };
  list.props.ref.current = { scrollTo: value => positions.push(value) };
  const cleanup = x.effects.at(-1)();
  x.receiptContext.value = provider.props.value;
  const input = x.ReceiptField({ row: field });
  input.props.modifiers.find(modifier => modifier.name === 'onGloballyPositioned').value({ x: 0, y: 700, width: 200, height: 50 });
  input.props.onFocusChanged(true);
  sizes.viewport = 400;
  x.keyboardEvents.keyboardDidShow({ endCoordinates: { screenY: 500 } });
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.deepEqual(positions, [{ y: 262, animated: true }]);
  assert.equal(list.props.keyboardShouldPersistTaps, 'always');
  assert.equal(list.props.nestedScrollEnabled, true);
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 262 } } }); sizes.scroll = 262;
  viewport.props.onLayout(); list.props.onScrollBeginDrag();
  x.keyboardEvents.keyboardDidShow({ endCoordinates: { screenY: 500 } });
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.equal(positions.length, 1, 'a manual drag must not be overridden by a pending automatic scroll');
  list.props.onScrollEndDrag(); input.props.onFocusChanged(false);
  const upper = x.ReceiptField({ row: x.field('length_text', '12') });
  upper.props.modifiers.find(modifier => modifier.name === 'onGloballyPositioned').value({ x: 0, y: 130, width: 200, height: 50 });
  upper.props.onFocusChanged(true);
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.deepEqual(positions[1], { y: 220, animated: true }, 'switching fields must reveal one hidden above the tab bar');
  assert.deepEqual(x.calls, [['focus', true], ['focus', false], ['focus', true]]);
  cleanup();
});

test('the preparation dashboard wires the receipt view to existing device, history and back actions', () => {
  const x = fixture(), sheets = [], session = { profile: { role: 'tayyorlov_masteri' }, imageCacheScope: 'scope' };
  let pickerActions, photoOptions;
  const picker = { items: [{ key: 'material', title: 'Mahsulot', select: () => x.calls.push('select') }], query: '',
    setQuery: value => x.calls.push(['search', value]), loading: false, more: true, loadMore: () => x.calls.push('next'),
    photoLoading: false, photoLabels: { take: 'Camera', choose: 'Library' }, photoSearch: async source => { x.calls.push(source); return ''; } };
  const screen = { role: 'tayyorlov_masteri', controlOnly: true, operator: { refreshArchive: () => x.calls.push('archive') },
    state: { device: { selection: null, needsAttention: true }, archiveLoading: false } };
  const { GScaleScreen } = load('GScaleScreen.android.tsx', { ...x.mocks,
    'expo-router': { router: { canGoBack: () => true, back: () => x.calls.push('back') }, Stack: { Screen: 'StackScreen' } },
    'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ...x.mocks['react-native'], Platform: { OS: 'android' }, Alert: { alert: (_title, _message, options) => { photoOptions = options; } } },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'Security' },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'scale' }, canOpenRoute: () => true },
    '../nativeSheet': { useNativeSheet: () => ({ open: (content, options) => sheets.push({ content, options }), close: () => x.calls.push('close') }) },
    '../shared/orders/PickerSheetContent': { PickerSheetContent: 'PickerSheetContent' },
    './GScaleReceipt.android': { GScaleReceipt: 'GScaleReceipt' },
    './gscaleScreenModel': { gscaleDashboardSections: (_screen, section, actions) => { pickerActions = actions; return [{ title: section, rows: [] }]; } },
    './useGScaleScreen': { useGScaleSession: () => ({ session, signOut() {} }), useGScaleScreen: () => screen,
      useGScalePicker: () => picker, useGScaleText: () => value => value },
  });
  const wrapper = GScaleScreen({ args: {} }), dashboard = nodes(wrapper, node => node.type?.name === 'Dashboard')[0];
  const tree = dashboard.type(dashboard.props), view = nodes(tree, node => node.type === 'GScaleReceipt')[0];
  assert.equal(nodes(tree, node => node.type === 'StackScreen')[0].props.options.headerShown, false);
  assert.equal(view.props.control[0].title, 'control'); assert.equal(view.props.history[0].title, 'history');
  view.props.onSelect('history'); view.props.onRefresh(); assert.deepEqual(x.calls, ['archive', 'archive']);
  view.props.onDevices(); assert.equal(sheets.length, 1);
  assert.deepEqual(sheets[0].options, { fitContent: true, dismissible: true });
  view.props.onBack(); assert.equal(x.calls.at(-1), 'back');
  pickerActions.pick({ title: 'Mahsulot tanlang', hint: 'Qidirish', photoSearch: true });
  assert.deepEqual(sheets[1].options, { dismissible: true, heightFraction: 0.66 });
  const choice = sheets[1].content.type(sheets[1].content.props);
  assert.equal(choice.type, 'PickerSheetContent');
  choice.props.onSearch('PE'); choice.props.onLoadMore(); choice.props.onPhoto(); photoOptions[0].onPress();
  choice.props.items[0].select();
  assert.deepEqual(x.calls.slice(-5), [['search', 'PE'], 'next', 'camera', 'select', 'close']);
  session.profile.role = 'material_taminotchi';
  pickerActions.pick({ title: 'Mahsulot tanlang', hint: 'Qidirish' });
  assert.equal(sheets[2].options, undefined);
  assert.notEqual(sheets[2].content.type(sheets[2].content.props).type, 'PickerSheetContent');
  screen.role = 'material_taminotchi';
  assert.equal(nodes(dashboard.type(dashboard.props), node => node.type === 'GScaleReceipt').length, 0);
});
