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
  const calls = [], gestures = [], effects = [];
  const action = (id, disabled = false, detail) => ({ kind: 'action', id, label: id, detail, disabled, press: () => calls.push(id) });
  const field = (key, value) => ({ kind: 'field', key, label: key, value, disabled: false,
    change: next => calls.push([key, next]), focus: value => calls.push(['focus', value]) });
  const outlined = Object.assign(function OutlinedTextField() {}, { Label: 'FieldLabel', Suffix: 'FieldSuffix' });
  const native = { Host: 'Host', Button: 'Button', Column: 'Column', Icon: 'Icon', IconButton: 'IconButton', OutlinedButton: 'OutlinedButton',
    OutlinedTextField: outlined, Row: 'Row', Shape: { RoundedCorner: value => value }, Switch: 'Switch', Text: 'Text', TextButton: 'TextButton',
    useMaterialColors: () => ({ surface: 'surface', error: 'red', onError: 'white' }),
    useNativeState: value => ({ get: () => value, set: next => { value = next; } }) };
  const mocks = {
    react: { useEffect: fn => effects.push(fn), useMemo: fn => fn(), useState: value => [value, () => {}] },
    '@expo/ui/jetpack-compose': native,
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: (_, name) => value => ({ name, value }) }),
    'expo-router': { router: { navigate: route => calls.push(['navigate', route]) } },
    'react-native': { View: 'View', Text: 'NativeText', Pressable: 'Pressable', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
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
  return { calls, gestures, effects, action, field, outlined, native, mocks, render, ...exports };
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
  assert.equal(nodes(tree, node => node.type === 'PreparationDock').length, 1);
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

test('the preparation dashboard wires the receipt view to existing device, history and back actions', () => {
  const x = fixture(), sheets = [], session = { profile: { role: 'tayyorlov_masteri' }, imageCacheScope: 'scope' };
  const screen = { role: 'tayyorlov_masteri', controlOnly: true, operator: { refreshArchive: () => x.calls.push('archive') },
    state: { device: { selection: null, needsAttention: true }, archiveLoading: false } };
  const { GScaleScreen } = load('GScaleScreen.android.tsx', { ...x.mocks,
    'expo-router': { router: { canGoBack: () => true, back: () => x.calls.push('back') }, Stack: { Screen: 'StackScreen' } },
    'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ...x.mocks['react-native'], Platform: { OS: 'android' } },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'Security' },
    '../shared/appRoutes': { appRoutes: { gscaleMode: 'scale' }, canOpenRoute: () => true },
    '../nativeSheet': { useNativeSheet: () => ({ open: (content, options) => sheets.push({ content, options }), close() {} }) },
    './GScaleReceipt.android': { GScaleReceipt: 'GScaleReceipt' },
    './gscaleScreenModel': { gscaleDashboardSections: (_screen, section) => [{ title: section, rows: [] }] },
    './useGScaleScreen': { useGScaleSession: () => ({ session, signOut() {} }), useGScaleScreen: () => screen, useGScaleText: () => value => value },
  });
  const wrapper = GScaleScreen({ args: {} }), dashboard = nodes(wrapper, node => node.type?.name === 'Dashboard')[0];
  const tree = dashboard.type(dashboard.props), view = nodes(tree, node => node.type === 'GScaleReceipt')[0];
  assert.equal(nodes(tree, node => node.type === 'StackScreen')[0].props.options.headerShown, false);
  assert.equal(view.props.control[0].title, 'control'); assert.equal(view.props.history[0].title, 'history');
  view.props.onSelect('history'); view.props.onRefresh(); assert.deepEqual(x.calls, ['archive', 'archive']);
  view.props.onDevices(); assert.equal(sheets.length, 1);
  assert.deepEqual(sheets[0].options, { fitContent: true, dismissible: true });
  view.props.onBack(); assert.equal(x.calls.at(-1), 'back');
  screen.role = 'material_taminotchi';
  assert.equal(nodes(dashboard.type(dashboard.props), node => node.type === 'GScaleReceipt').length, 0);
});
