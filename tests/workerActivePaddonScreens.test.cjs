const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function nodes(node, type) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  if (typeof node.type === 'function' && node.type.name === 'PaddonChoice') return nodes(node.type(node.props), type);
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)]; }
function setup(platform) {
  const h = { events: [] }, state = { code: '00001', selection: 'ready', picker: 'ready', busy: false, paddons: [{ code: '00001', item_count: 3 }, { code: '00002', item_count: 2 }] };
  const native = new Proxy({}, { get: (_, key) => key === 'useMaterialColors' ? () => ({}) : key === 'ListItem' ? Object.assign('Item', {}) : key });
  const Item = { HeadlineContent: 'Headline', SupportingContent: 'Supporting', LeadingContent: 'Leading', TrailingContent: 'Trailing' };
  const modifiers = new Proxy({}, { get: (_, key) => key === 'shapes' ? { rectangle: () => ({ shape: 'rectangle' }) } : (...args) => ({ kind: key, args }) });
  const compose = { ...Object.fromEntries(['Badge', 'BadgedBox', 'Box', 'CircularProgressIndicator', 'Column', 'IconButton', 'LazyColumn', 'ModalBottomSheet', 'RNHostView', 'Text'].map(key => [key, key])),
    ListItem: Object.assign(function ItemView() {}, Item), useMaterialColors: () => ({}) };
  compose.BadgedBox = Object.assign(function BadgeBox() {}, { Badge: 'BadgeSlot' });
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value === null ? { hide: async () => { h.events.push('hide'); } } : value }) },
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'Symbol' }, 'react-native': { PlatformColor: value => value, useWindowDimensions: () => ({ width: 390, height: 840 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }, './BaseHost': { BaseHost: 'Host' },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: (key, values) => values ? `${key}:${values.count}` : key }) } };
  h.views = compile(`components/WorkerActivePaddon.${platform}.tsx`, mocks);
  h.props = { state, label: 'selected', controller: { open: async () => h.events.push('open'), choose: async code => h.events.push(['choose', code]), close: () => h.events.push('close') } };
  h.state = state; h.itemType = platform === 'ios' ? 'Button' : compose.ListItem; return h;
}
// @v2-test test/active_rezka_paddon_test.dart
for (const platform of ['ios', 'android']) {
  test(`${platform}: native picker keeps None before scoped rows, counts and the live selection`, async () => {
    const h = setup(platform), tree = h.views.WorkerActivePaddonPicker(h.props), rows = nodes(tree, h.itemType);
    assert.equal(rows.length, 3); const texts = nodes(tree, 'Text').map(n => n.props.children);
    assert(texts.includes('worker.paddon.active.choose')); assert(texts.indexOf('worker.paddon.active.none') < texts.indexOf('00001'));
    assert(texts.includes('worker.paddon.active.rolls:3')); assert(texts.includes('worker.paddon.active.rolls:2'));
    if (platform === 'ios') { assert.equal(nodes(tree, 'Image').filter(n => n.props.systemName === 'checkmark').length, 1); rows[2].props.onPress(); }
    else { assert.equal(nodes(tree, 'Trailing').length, 1); rows[2].props.modifiers.find(m => m.kind === 'clickable').args[0](); }
    await new Promise(setImmediate); assert.deepEqual(h.events, platform === 'ios' ? [['choose', '00002']] : ['hide', ['choose', '00002'], 'close']);
  });
  for (const failure of ['selection', 'picker']) test(`${platform}: ${failure} read error offers no stale or None choice`, () => {
    const h = setup(platform); h.state[failure] = 'error'; const tree = h.views.WorkerActivePaddonPicker(h.props);
    assert.equal(nodes(tree, h.itemType).length, 0); assert(nodes(tree, 'Text').some(n => n.props.children === 'worker.paddon.active.load_failed'));
  });
  test(`${platform}: empty picker retains explicit None and the V2 create-in-Paddons hint`, () => {
    const h = setup(platform); h.state.paddons = []; h.state.code = null; const tree = h.views.WorkerActivePaddonPicker(h.props);
    assert.equal(nodes(tree, h.itemType).length, 1); assert(nodes(tree, 'Text').some(n => n.props.children === 'worker.paddon.active.empty'));
  });
  test(`${platform}: loading offers no choices and native dismiss closes the picker`, () => {
    const h = setup(platform); h.state.picker = 'loading'; const tree = h.views.WorkerActivePaddonPicker(h.props);
    assert.equal(nodes(tree, h.itemType).length, 0);
    if (platform === 'ios') nodes(tree, 'BottomSheet')[0].props.onIsPresentedChange(false); else nodes(tree, 'ModalBottomSheet')[0].props.onDismissRequest();
    assert.deepEqual(h.events, ['close']);
  });
  test(`${platform}: toolbar uses a native icon button with an accessible live label`, () => {
    const h = setup(platform); h.state.busy = true; const tree = h.views.WorkerActivePaddonButton(h.props);
    const button = nodes(tree, platform === 'ios' ? 'Button' : 'IconButton')[0]; assert(button);
    if (platform === 'ios') { assert(button.props.modifiers.some(m => m.kind === 'disabled' && m.args[0] === true)); assert(button.props.modifiers.some(m => m.kind === 'accessibilityLabel' && m.args[0] === 'selected')); }
    else { assert.equal(button.props.enabled, false); assert(button.props.modifiers.some(m => m.kind === 'semantics' && m.args[0].contentDescription === 'selected')); }
  });
}

test('iOS picker makes each full-width choice, including its trailing space, interactive', () => {
  const h = setup('ios'), rows = nodes(h.views.WorkerActivePaddonPicker(h.props), 'Button');
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const layout = nodes(row, 'HStack')[0].props.modifiers;
    const width = layout.findIndex(modifier => modifier.kind === 'frame' && modifier.args[0].maxWidth === Infinity);
    const hitArea = layout.findIndex(modifier => modifier.kind === 'contentShape' && modifier.args[0].shape === 'rectangle');
    assert(width >= 0 && hitArea > width);
  }
  for (const row of rows.slice(1)) {
    assert.deepEqual(row.props.modifiers.find(modifier => modifier.kind === 'listRowInsets').args[0], { top: 0, bottom: 0, leading: 0, trailing: 0 });
  }
  rows[0].props.onPress(); rows[1].props.onPress(); rows[2].props.onPress();
  assert.deepEqual(h.events, [['choose', null], ['choose', '00001'], ['choose', '00002']]);
});

test('iOS queue connects the worker action inside its existing native toolbar and keeps profile', () => {
  const native = new Proxy({}, { get: (_, key) => key === 'Toolbar' ? { Content: 'ToolbarContent' } : key === 'useNativeState' ? value => value : key });
  const modifiers = new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) });
  const { OrdersWorkspace } = compile('shared/orders/OrdersWorkspace.ios.tsx', {
    'react/jsx-runtime': jsx, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Screen' } }, 'react-native': { ActivityIndicator: 'Spinner', PlatformColor: value => value, View: 'View', StyleSheet: { create: value => value } },
    '../../components/WorkerProfileButton.ios': { WorkerProfileButton: 'Profile' }, './ordersWorkspaceTypes': { visibleOrdersTabs: rows => rows } });
  const props = { session: {}, tabs: [{ id: 'cut', name: 'Rezka' }], selected: 'cut', onSelect() {}, children: () => jsx.jsx('Queue', {}) };
  const withAction = OrdersWorkspace({ ...props, toolbarActions: jsx.jsx('PaddonAction', {}) });
  assert.deepEqual(nodes(withAction, 'ToolbarItem').filter(node => node.props.placement === 'topBarTrailing').map(node => node.props.children.type), ['PaddonAction', 'Profile']);
  const ordinary = OrdersWorkspace(props);
  assert.deepEqual(nodes(ordinary, 'ToolbarItem').filter(node => node.props.placement === 'topBarTrailing').map(node => node.props.children.type), ['Profile']);
});
