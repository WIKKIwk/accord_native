const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { model: users, l10n } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/admin', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function expanded(node) {
  if (Array.isArray(node)) return node.map(expanded);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expanded(node.type(node.props));
  return { ...node, props: { ...node.props, children: expanded(node.props?.children) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const modifier = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const compound = (name, slots) => Object.assign(() => {}, Object.fromEntries(slots.map(slot => [slot, `${name}.${slot}`])));
const basic = compound('BasicTextField', ['DecorationBox', 'InnerTextField', 'Placeholder']);
const chip = compound('FilterChip', ['Label', 'LeadingIcon', 'TrailingIcon']);
const disclosure = Object.assign('DisclosureGroup', { Label: 'DisclosureGroup.Label' });
const colors = { surfaceContainerLow: '#FEFEFEFF', outlineVariant: '#777777FF', onSurfaceVariant: '#777777FF', surfaceContainerLowest: '#FFFFFFFF',
  secondaryContainer: '#DDDDDDFF', onSecondaryContainer: '#222222FF', onSurface: '#111111FF' };
function model(overrides = {}) {
  const calls = [], state = { screen: 'content', selectedKind: 'supplier', roleMenuOpen: false, loadingMore: false, scrollResetSerial: 0, notice: null };
  return { calls, state, rows: [{ key: 'ONE:0', id: 'ONE', title: 'One', subtitle: 'Supplier • 998', revision: 'one', index: 0, count: 1, entering: false, exiting: false }],
    roleOptions: users.adminUserKinds.map(kind => ({ kind, selected: kind === 'supplier', label: users.adminUserKindLabel(kind, 'uz') })),
    roleLabel: 'Rol: Ta’minotchi', salesManager: false, hasSearchText: false, searchFocused: false, searchText: '', refreshing: false, showFooter: false,
    a: key => l10n.adminText(key, 'uz'), t: key => l10n.localizedGetter(key, 'uz'), current: () => true, interactive: () => true, identity: {},
    back: () => calls.push('back'), reload: async () => { calls.push('reload'); }, openUser: async id => { calls.push(['open', id]); },
    toggleRoles: () => calls.push('roles'), selectRole: kind => calls.push(['role', kind]), setSearch: text => calls.push(['search', text]),
    setSearchFocused: value => calls.push(['focus', value]), scrollMetrics: (viewport, extent) => calls.push(['metrics', viewport, extent]), loadMore: async () => { calls.push('more'); }, ...overrides };
}
function render(platform, value) {
  const react = { useEffect() {}, useRef: current => ({ current }), useState: initial => [initial, () => {}], useCallback: callback => callback };
  const compose = new Proxy({ BasicTextField: basic, FilterChip: chip, Shape: { RoundedCorner: value => value }, useNativeState: value => ({ value }), useMaterialColors: () => colors },
    { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({ DisclosureGroup: disclosure, Grid: { Row: 'Grid.Row' }, List: { ForEach: 'List.ForEach' } }, { get: (target, name) => target[name] ?? String(name) });
  const mods = new Proxy({ Animation: { easeOut: value => value }, useScrollGeometryChange: callback => ({ name: 'geometry', args: [callback] }) }, { get: (target, name) => target[name] ?? modifier[name] });
  // Native components are represented by stable names; only our own React child functions are evaluated.
  const component = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  compose.BasicTextField = component('BasicTextField', { DecorationBox: 'BasicTextField.DecorationBox', InnerTextField: 'BasicTextField.InnerTextField', Placeholder: 'BasicTextField.Placeholder' });
  compose.FilterChip = component('FilterChip', { Label: 'FilterChip.Label', LeadingIcon: 'FilterChip.LeadingIcon', TrailingIcon: 'FilterChip.TrailingIcon' });
  swift.DisclosureGroup = component('DisclosureGroup'); swift.Grid = component('Grid', { Row: 'Grid.Row' }); swift.List = component('List', { ForEach: 'List.ForEach' });
  const native = { View: 'View', FlatList: 'FlatList', RefreshControl: 'RefreshControl', Platform: { Version: 26 }, PlatformColor: value => value,
    StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) };
  const reanimated = { View: 'Animated.View', default: { View: 'Animated.View' }, Easing: { cubic: 'cubic', out: value => value }, FadeIn: { duration: value => value }, FadeOut: { duration: value => value },
    useSharedValue: value => ({ value }), useAnimatedStyle: callback => callback(), withTiming: value => value };
  const mocks = { react, 'react-native': native, 'react-native-reanimated': reanimated, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../shared/themeRuntime': { themeController: { variant: 'white' } },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, './useAdminUsersScreen': { useAdminUsersScreen: () => value } };
  const Screen = load(`AdminUsersScreen.${platform}.tsx`, mocks).AdminUsersScreen;
  const tree = expanded(Screen({ backLabel: 'Orqaga', profileAction: { type: 'RealGuardedProfileAction', props: {} }, footer: { type: 'ExistingDock', props: {} } }));
  return { tree, rows() {
    const list = nodes(tree, n => n.type === (platform === 'android' ? 'FlatList' : 'List.ForEach'))[0];
    return (list.props.data ?? []).map(item => expanded(platform === 'android' ? list.props.renderItem({ item }) : list.props.children({ item })));
  } };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} users exposes all 13 current roles inline and preserves the genuine profile/dock slots`, () => {
    const m = model(); m.state.roleMenuOpen = true;
    const { tree } = render(platform, m);
    assert.equal(nodes(tree, n => n.type === 'ExistingDock').length, 1);
    const options = nodes(tree, n => n.props.modifiers?.some(mod => (mod.name === 'testID' || mod.name === 'accessibilityIdentifier') && String(mod.args[0]).startsWith('admin-users-role-option-chip-')));
    assert.equal(options.length, 13);
    assert.ok(options.some(node => node.props.modifiers.some(mod => mod.args[0] === 'admin-users-role-option-chip-metalayzer')));
    if (platform === 'android') assert.equal(nodes(tree, n => n.type === 'RealGuardedProfileAction').length, 1);
    else assert.equal(nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight().type, 'RealGuardedProfileAction');
    const sales = render(platform, model({ salesManager: true })).tree;
    assert.equal(nodes(sales, n => n.type === (platform === 'android' ? 'FilterChip' : 'DisclosureGroup')).length, 0);
  });
  test(`${platform} users search focus hides source back/profile and cancel keeps the query`, () => {
    const m = model({ searchFocused: true, searchText: 'One', hasSearchText: true }), { tree } = render(platform, m);
    if (platform === 'android') {
      const hiddenSlots = nodes(tree, n => n.type === 'Animated.View' && n.props.importantForAccessibility === 'no-hide-descendants');
      assert.equal(hiddenSlots.length, 2); assert.ok(hiddenSlots.every(slot => slot.props.pointerEvents === 'none' && slot.props.style[1].width === 0));
      assert.equal(nodes(tree, n => n.type === 'RealGuardedProfileAction').length, 1);
      const close = nodes(tree, n => n.props.modifiers?.some(mod => mod.name === 'testID' && mod.args[0] === 'admin-users-search-close'))[0]; close.props.onClick();
    } else {
      const options = nodes(tree, n => n.type === 'Stack.Screen')[0].props.options;
      assert.equal(options.headerLeft, undefined); assert.equal(options.headerRight, undefined); assert.equal(options.headerBackVisible, false);
      assert.equal(options.headerSearchBarOptions.hideWhenScrolling, false); options.headerSearchBarOptions.onCancelButtonPress();
      // Installed RNSSearchBar.mm sends this second event automatically after Cancel.
      options.headerSearchBarOptions.onChangeText({ nativeEvent: { text: '' } });
    }
    assert.deepEqual(m.calls, [['focus', false]]);
  });
  test(`${platform} rows use source person symbols, exact subtitle, no invented avatar, and required detail callback`, async () => {
    const m = model(), result = render(platform, m), [row] = result.rows();
    assert.ok(nodes(row, n => n.type === 'Text' && n.props.children === 'One').length);
    assert.ok(nodes(row, n => n.type === 'Text' && n.props.children === 'Supplier • 998').length);
    const button = nodes(row, n => n.props.modifiers?.some(mod => (mod.name === 'testID' || mod.name === 'accessibilityIdentifier') && mod.args[0] === 'admin-user-ONE'))[0];
    await (platform === 'android' ? button.props.onClick() : button.props.onPress()); assert.deepEqual(m.calls, [['open', 'ONE']]);
    assert.equal(nodes(row, n => n.type === 'ProfileAvatar' || n.type === 'ExpoImage').length, 0);
    if (platform === 'android') {
      assert.ok(button.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 61));
      assert.deepEqual(button.props.shape.cornerRadii, { topStart: 18, topEnd: 18, bottomStart: 6, bottomEnd: 6 });
    }
  });
  test(`${platform} users loading/error/unselected states hide inaccessible old data and preserve retry`, async () => {
    for (const screen of ['loading', 'error', 'unselected']) {
      const m = model(); m.state.screen = screen; const { tree } = render(platform, m);
      if (platform === 'android') {
        const list = nodes(tree, n => n.type === 'FlatList')[0]; assert.equal(list.props.importantForAccessibility, 'no-hide-descendants');
      } else assert.ok(nodes(tree, n => n.type === 'List')[0].props.modifiers.some(mod => mod.name === 'accessibilityHidden' && mod.args[0] === true));
      if (screen === 'error') {
        const retry = nodes(tree, n => n.type === (platform === 'android' ? 'TextButton' : 'Button') && (platform === 'android' || n.props.label === m.t('retry')))[0];
        await (platform === 'android' ? retry.props.onClick() : retry.props.onPress()); assert.deepEqual(m.calls, ['reload']);
      }
    }
  });
}
test('android users forwards actual scroll geometry to source prefetch and native clear removes the query', () => {
  const m = model({ searchText: 'One', hasSearchText: true }), { tree } = render('android', m), list = nodes(tree, n => n.type === 'FlatList')[0];
  list.props.onScroll({ nativeEvent: { layoutMeasurement: { height: 200 }, contentOffset: { y: 100 }, contentSize: { height: 1000 } } });
  const clear = nodes(tree, n => n.props.modifiers?.some(mod => mod.name === 'testID' && mod.args[0] === 'admin-users-search-close'))[0]; clear.props.onClick();
  assert.deepEqual(m.calls, [['metrics', 200, 700], ['search', '']]); assert.equal(list.props.contentContainerStyle.paddingBottom, 116);
});
test('ios users forwards native geometry and preserves source absence of a system-user pagination spinner', () => {
  const m = model({ showFooter: false }), { tree } = render('ios', m), list = nodes(tree, n => n.type === 'List')[0];
  list.props.modifiers.find(mod => mod.name === 'geometry').args[0]({ containerHeight: 200, contentHeight: 1000, contentOffsetY: 100 });
  assert.deepEqual(m.calls, [['metrics', 200, 700]]); assert.equal(nodes(tree, n => n.type === 'ProgressView').length, 0);
});
test('ios explicit native search clear still clears after the automatic Cancel clear was consumed', () => {
  const m = model({ searchFocused: true, searchText: 'One', hasSearchText: true }), { tree } = render('ios', m);
  const search = nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions;
  search.onCancelButtonPress(); search.onChangeText({ nativeEvent: { text: '' } });
  assert.deepEqual(m.calls, [['focus', false]]);
  search.onChangeText({ nativeEvent: { text: '' } }); assert.deepEqual(m.calls[1], ['search', '']);
});
test('ios Cancel preserves the latest native edit even when React props have not rendered it yet', () => {
  const m = model({ searchFocused: true, searchText: 'One', hasSearchText: true }), { tree } = render('ios', m);
  const search = nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerSearchBarOptions, restored = [];
  search.ref.current = { setText: text => restored.push(text) };
  search.onChangeText({ nativeEvent: { text: 'Two' } }); search.onCancelButtonPress(); search.onChangeText({ nativeEvent: { text: '' } });
  assert.deepEqual(restored, ['Two', 'Two']); assert.deepEqual(m.calls, [['search', 'Two'], ['focus', false]]);
});
