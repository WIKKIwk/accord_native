/* global __dirname */
const { adminShellThemeFixture } = require('./support/adminShellTheme.cjs');
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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] :
    id === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : require(id);
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
const colors = { surfaceContainerLow: '#FEFEFEFF', surfaceContainerHigh: '#E6E6E6FF', outlineVariant: '#777777FF', onSurfaceVariant: '#777777FF', surfaceContainerLowest: '#FFFFFFFF',
  secondaryContainer: '#DDDDDDFF', onSecondaryContainer: '#222222FF', onSurface: '#111111FF' };
function model(overrides = {}) {
  const calls = [], state = { screen: 'content', selectedKind: 'supplier', roleMenuOpen: false, loadingMore: false, scrollResetSerial: 0, notice: null };
  return { calls, state, rows: [{ key: 'ONE:0', id: 'ONE', title: 'One', subtitle: 'Supplier • 998', revision: 'one', index: 0, count: 1, entering: false, exiting: false }],
    roleOptions: users.adminUserKinds.map(kind => ({ kind, selected: kind === 'supplier', label: users.adminUserKindLabel(kind, 'uz') })),
    roleLabel: 'Rol: Ta’minotchi', salesManager: false, hasSearchText: false, searchFocused: false, searchText: '', refreshing: false, showFooter: false, focused: true,
    a: key => l10n.adminText(key, 'uz'), t: key => l10n.localizedGetter(key, 'uz'), current: () => true, interactive: () => true, identity: {},
    back: () => calls.push('back'), reload: async () => { calls.push('reload'); }, openUser: async id => { calls.push(['open', id]); },
    toggleRoles: () => calls.push('roles'), selectRole: kind => calls.push(['role', kind]), setSearch: text => calls.push(['search', text]),
    setSearchFocused: value => calls.push(['focus', value]), scrollMetrics: (viewport, extent) => calls.push(['metrics', viewport, extent]), loadMore: async () => { calls.push('more'); }, ...overrides };
}
function render(platform, value) {
  const react = { useEffect() {}, useRef: current => ({ current }), useState: initial => [initial, () => {}], useCallback: callback => callback, useMemo: callback => callback() };
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
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '@expo/ui/jetpack-compose': compose,
    '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../shared/themeRuntime': { themeController: { variant: 'white' } },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(colors), './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminBasicTextField: compose.BasicTextField },
    '../shared/navigation/RoleHeaderRow': require('./support/roleNavigation.cjs').header,
    '../shared/orders/OrdersHeader': { OrdersHeader: 'OrdersHeader' }, '../shared/orders/OrdersList': { OrdersList: 'OrdersList' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, './useAdminUsersScreen': { useAdminUsersScreen: () => value } };
  mocks['./AdminLoadingIndicator.android'] = load('AdminLoadingIndicator.android.tsx', mocks);
  const Screen = load(`AdminUsersScreen.${platform}.tsx`, mocks).AdminUsersScreen;
  const tree = expanded(Screen({ backLabel: 'Orqaga', profileAction: { type: 'RealGuardedProfileAction', props: {} }, footer: { type: 'ExistingDock', props: {} } }));
  return { tree, rows() {
    const list = nodes(tree, n => n.type === (platform === 'android' ? 'OrdersList' : 'List.ForEach'))[0];
    return (list.props.rows ?? list.props.data ?? []).map(item => expanded(platform === 'android' ? list.props.renderRow(item) : list.props.children({ item })));
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
    if (platform === 'android') assert.equal(nodes(tree, n => n.type === 'OrdersHeader')[0].props.profileAction.type, 'RealGuardedProfileAction');
    else assert.equal(nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerRight().type, 'RealGuardedProfileAction');
    const sales = render(platform, model({ salesManager: true })).tree;
    assert.equal(nodes(sales, n => n.type === (platform === 'android' ? 'FilterChip' : 'DisclosureGroup')).length, 0);
  });
  test(`${platform} users search focus hides source back/profile and cancel keeps the query`, () => {
    const m = model({ searchFocused: true, searchText: 'One', hasSearchText: true }), { tree } = render(platform, m);
    if (platform === 'android') {
      const header = nodes(tree, n => n.type === 'OrdersHeader')[0];
      assert.equal(header.props.search, 'One'); assert.equal(header.props.blurOnSearchSubmit, true);
      assert.equal(header.props.controlLabels.close, m.a('action.close'));
      header.props.onSearchBlur();
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
    const button = nodes(row, n => platform === 'android' ? n.type === 'WorkerQueueCard' && n.props.testID === 'admin-user-ONE' :
      n.props.modifiers?.some(mod => mod.name === 'accessibilityIdentifier' && mod.args[0] === 'admin-user-ONE'))[0];
    await button.props.onPress(); assert.deepEqual(m.calls, [['open', 'ONE']]);
    assert.equal(nodes(row, n => n.type === 'ProfileAvatar' || n.type === 'ExpoImage').length, 0);
    if (platform === 'android') {
      assert.equal(button.props.style.height, 61);
      assert.equal(button.props.first, true); assert.equal(button.props.last, false);
    }
  });
  test(`${platform} users loading/error/unselected states hide inaccessible old data and preserve retry`, async () => {
    for (const screen of ['loading', 'error', 'unselected']) {
      const m = model(); m.state.screen = screen; const { tree } = render(platform, m);
      if (platform === 'android') {
        const visibility = nodes(tree, n => n.props.testID === 'admin-users-list-visibility')[0]; assert.equal(visibility.props.importantForAccessibility, 'no-hide-descendants');
      } else assert.ok(nodes(tree, n => n.type === 'List')[0].props.modifiers.some(mod => mod.name === 'accessibilityHidden' && mod.args[0] === true));
      if (screen === 'error') {
        const retry = nodes(tree, n => n.type === (platform === 'android' ? 'WorkerSheetButton' : 'Button') && n.props.label === m.t('retry'))[0];
        await retry.props.onPress(); assert.deepEqual(m.calls, ['reload']);
      }
    }
  });
}
test('android users forwards shared list geometry to source prefetch and clear uses the existing query controller', () => {
  const m = model({ searchText: 'One', hasSearchText: true }), { tree } = render('android', m), list = nodes(tree, n => n.type === 'OrdersList')[0];
  list.props.onScrollMetrics({ viewportHeight: 200, offset: 100, contentHeight: 1000 });
  list.props.onGeometryChange({ viewportHeight: 200, contentHeight: 1050 });
  const header = nodes(tree, n => n.type === 'OrdersHeader')[0]; header.props.onSearchChange('');
  assert.deepEqual(m.calls, [['metrics', 200, 700], ['metrics', 200, 750], ['search', '']]);
  assert.equal(list.props.footer.props.style.paddingBottom, 116); assert.equal(list.props.rowKey(m.rows[0]), 'ONE:0');
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
for (const platform of ['android', 'ios']) test(`${platform} Users fills the Admin body and keeps the genuine dock outside it`, () => {
  const { tree } = render(platform, model()), reserve = nodes(tree, node => node.props.testID === 'admin-users-body-frame-reserve')[0], frame = nodes(tree, node => node.props.testID === 'admin-users-body-frame')[0];
  assert.equal(reserve.props.style[1].marginHorizontal, undefined); assert.equal(reserve.props.style[1].marginBottom, 92);
  assert.equal(frame.props.style[1].borderTopLeftRadius, undefined); assert.equal(frame.props.style[1].borderBottomLeftRadius, undefined); assert.equal(frame.props.style[2], false);
  assert.equal(nodes(frame, node => node.type === 'ExistingDock').length, 0); assert.equal(nodes(tree, node => node.props.testID === 'admin-users-body-frame-safe-area')[0].props.edges.join(), 'left,right');
  if (platform === 'android') {
    assert.equal(nodes(tree, node => node.props.testID === 'admin-users-header-safe-area')[0].props.edges.join(), 'left,right');
    assert.equal(tree.props.style[1].backgroundColor, colors.surfaceContainerLow);
  }
});
test('Android Users full/pagination loading uses the actual expressive source64 host and48 glyph', () => {
  const loading = model(); loading.state.screen = 'loading'; const tree = render('android', loading).tree, indicator = nodes(tree, node => node.type === 'LoadingIndicator')[0];
  assert.ok(indicator.props.modifiers.some(mod => mod.name === 'size' && mod.args.join() === '48,48')); assert.equal(nodes(tree, node => node.type === 'CircularProgressIndicator').length, 0);
  const more = model({ showFooter: true }); more.state.loadingMore = true; const list = nodes(render('android', more).tree, node => node.type === 'OrdersList')[0], footer = expanded(list.props.footer);
  assert.equal(nodes(footer, node => node.type === 'LoadingIndicator').length, 1); assert.ok(nodes(footer, node => node.type === 'Box' && node.props.modifiers?.some(mod => mod.name === 'size' && mod.args.join() === '64,64')).length);
});
