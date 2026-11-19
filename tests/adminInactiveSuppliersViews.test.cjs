/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const topBar = Object.assign(function TopAppBar() {}, { NavigationIcon: 'TopAppBar.NavigationIcon', Title: 'TopAppBar.Title', Actions: 'TopAppBar.Actions' });
const native = new Proxy({ TopAppBar: topBar, Shape: { RoundedCorner: props => ({ type: 'RoundedCorner', props }) } }, { get: (target, name) => target[name] ?? String(name) });
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function expand(tree) {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!tree || typeof tree !== 'object') return tree;
  if (typeof tree.type === 'function' && tree.type !== topBar) return expand(tree.type(tree.props));
  if (tree.type === 'FlatList') return { ...tree, props: { ...tree.props, children: tree.props.data.map((item, index) => expand(tree.props.renderItem({ item, index }))) } };
  return { ...tree, props: { ...tree.props, children: expand(tree.props?.children) } };
}
const supplier = (ref, removed, blocked) => ({ ref, name: `Name ${ref}`, phone: `Phone ${ref}`, code: `Code ${ref}`, removed, blocked, assigned_item_codes: [], assigned_item_count: 0 });
function render(platform, patch = {}, options = {}) {
  const calls = [], items = [supplier('removed', true, false), supplier('blocked', false, true), supplier('both', true, true), supplier('neither', false, false)];
  const model = { current: true, state: { phase: 'content', items, busyRef: null, ...patch },
    a: key => key, t: key => key, reload: () => { calls.push('reload'); return options.reload ? options.reload() : Promise.resolve(); }, restore: item => calls.push(['restore', item]), unblock: item => calls.push(['unblock', item]) };
  const slots = [], effects = [], cleanups = []; let slot = 0;
  const memo = (make, deps) => { const index = slot++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: make() };
    return slots[index].value;
  };
  const react = { useMemo: memo, useRef: value => memo(() => ({ current: value }), []),
    useState: initial => { const index = slot++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useLayoutEffect: (callback, deps) => { const index = slot++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { slots[index] = { deps }; effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); }); }
    } };
  if (options.current !== undefined) model.current = options.current;
  const colors = { surface: 'surface', surfaceContainerHigh: 'chrome', surfaceContainerLow: 'body', outlineVariant: 'border', outline: 'outline', onSurface: 'text', onSurfaceVariant: 'secondary', primary: 'primary' };
  const mocks = { './AdminTopBar.android': require('./support/adminChrome.cjs'), react, 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': native, '@expo/ui/swift-ui': native,
    '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View', Text: 'NativeText', FlatList: 'FlatList', RefreshControl: 'RefreshControl', Platform: { Version: options.iosVersion ?? '26.0' }, useWindowDimensions: () => ({ width: 390 }), StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: options.dark ? 'dark' : 'light', direction: options.rtl ? 'rightToLeft' : 'leftToRight' }) },
    './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' }, './AdminShellBodyFrame': { AdminShellBodyFrame: 'AdminShellBodyFrame' },
    './AdminTypography.android': { AdminText: 'Text', useAdminFontsReady: () => true }, './adminFontFamily.android': { adminFontNames: { medium: 'source-medium' } },
    './useAdminInactiveSuppliers': { useAdminInactiveSuppliers: () => model } };
  const filename = path.resolve(__dirname, `../src/admin/AdminInactiveSuppliersScreen.${platform}.tsx`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  const footer = { type: 'RealDock', props: {} }, profile = { type: 'RealProfile', props: {} };
  const props = { session: {}, witness: {}, isCurrent: () => true, navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') }, profileAction: profile, footer };
  const result = { tree: null, calls, model, items, rerender: () => {
    slot = 0; result.tree = expand(mod.exports.AdminInactiveSuppliersScreen(props)); effects.splice(0).forEach(effect => effect());
    for (let index = slot; index < slots.length; index++) { cleanups[index]?.(); cleanups[index] = undefined; }
    slots.length = slot; return result.tree;
  }, unmount: () => cleanups.forEach(cleanup => cleanup?.()) };
  result.rerender(); return result;
}
function testId(node, id) { return node.props?.modifiers?.some(modifier => ['testID', 'accessibilityIdentifier'].includes(modifier.name) && modifier.args[0] === id); }
for (const platform of ['android', 'ios']) {
  test(`${platform} inactive supplier actions preserve source precedence, identity and row-specific busy labels`, () => {
    const { tree, calls, items } = render(platform, { busyRef: 'blocked' });
    const restore = nodes(tree, node => testId(node, 'admin-inactive-supplier-restore-0'))[0];
    const unblock = nodes(tree, node => testId(node, 'admin-inactive-supplier-unblock-1'))[0];
    assert.ok(restore); assert.ok(unblock);
    assert.equal(nodes(tree, node => testId(node, 'admin-inactive-supplier-unblock-2')).length, 0);
    assert.equal(nodes(tree, node => testId(node, 'admin-inactive-supplier-restore-3') || testId(node, 'admin-inactive-supplier-unblock-3')).length, 0);
    assert.equal(nodes(unblock, node => node.type === 'Text' && node.props.children === 'users.unblocking').length, 1);
    assert.equal(nodes(restore, node => node.type === 'Text' && node.props.children === 'users.restore').length, 1);
    if (platform === 'android') { assert.equal(unblock.props.enabled, false); assert.equal(restore.props.enabled, true); restore.props.onClick(); }
    else {
      assert.deepEqual(unblock.props.modifiers.find(m => m.name === 'disabled').args, [true]);
      assert.deepEqual(restore.props.modifiers.find(m => m.name === 'disabled').args, [false]); restore.props.onPress();
    }
    assert.deepEqual(calls, [['restore', items[0]]]);
    const text = nodes(tree, node => node.type === 'Text').map(node => node.props.children);
    assert.equal(text.filter(value => value === 'users.removed').length, 2);
    assert.equal(text.filter(value => value === 'users.blocked').length, 1);
  });
  test(`${platform} inactive suppliers retains source loading, retry, empty and retired states`, () => {
    const loading = render(platform, { phase: 'loading' });
    assert.equal(nodes(loading.tree, node => node.type === (platform === 'android' ? 'AdminLoadingIndicator' : 'ProgressView')).length, 1);
    assert.equal(nodes(loading.tree, node => testId(node, 'admin-inactive-supplier-restore-0')).length, 0);
    const error = render(platform, { phase: 'error' });
    const retry = nodes(error.tree, node => testId(node, 'admin-inactive-suppliers-retry'))[0];
    (retry.props.onClick ?? retry.props.onPress)(); assert.deepEqual(error.calls, ['reload']);
    const empty = render(platform, { items: [] });
    assert.equal(nodes(empty.tree, node => node.type === 'Text' && node.props.children === 'users.inactive_empty').length, 1);
    assert.equal(nodes(empty.tree, node => node.type === 'List' || node.type === 'FlatList').length, 0);
    assert.equal(render(platform, { phase: 'invalidated' }).tree, null);
    assert.equal(render(platform, {}, { current: false }).tree, null);
  });
  test(`${platform} inactive supplier body and dock use the original separate source frame`, () => {
    const { tree } = render(platform);
    const frame = nodes(tree, node => node.type === 'AdminShellBodyFrame')[0];
    assert.equal(frame.props.contentPadding, 'default'); assert.equal(frame.props.hasFooter, true);
    assert.equal(nodes(frame, node => node.type === 'RealDock').length, 0);
    assert.equal(nodes(tree, node => node.type === 'RealDock').length, 1);
    if (platform === 'android') assert.equal(nodes(tree, node => node.type === 'RealProfile').length, 1);
    else assert.equal(nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight().type, 'RealProfile');
  });
  test(`${platform} inactive supplier code remains selectable and action targets stay comfortably sized`, () => {
    const { tree } = render(platform);
    const codes = nodes(tree, node => node.props?.children === 'Code removed');
    assert.equal(codes.length, 1);
    if (platform === 'android') assert.equal(codes[0].props.selectable, true);
    else assert.deepEqual(codes[0].props.modifiers.find(m => m.name === 'textSelection').args, [true]);
    const restore = nodes(tree, node => testId(node, 'admin-inactive-supplier-restore-0'))[0];
    if (platform === 'android') assert.deepEqual(restore.props.modifiers.find(m => m.name === 'height').args, [56]);
    else {
      assert.deepEqual(restore.props.modifiers.find(m => m.name === 'buttonStyle').args, ['borderedProminent']);
      assert.deepEqual(restore.props.modifiers.find(m => m.name === 'controlSize').args, ['large']);
      assert.equal(restore.props.modifiers.find(m => m.name === 'frame').args[0].minHeight, 56);
    }
  });
  test(`${platform} blocked-only action passes its exact row and both flags retain the source trailing gap`, () => {
    const { tree, calls, items } = render(platform);
    const unblock = nodes(tree, node => testId(node, 'admin-inactive-supplier-unblock-1'))[0];
    (unblock.props.onClick ?? unblock.props.onPress)(); assert.deepEqual(calls, [['unblock', items[1]]]);
    const actionRow = nodes(tree, node => node.type === (platform === 'android' ? 'Row' : 'HStack') &&
      nodes(node, child => testId(child, 'admin-inactive-supplier-restore-2')).length > 0)[0];
    const gap = nodes(actionRow, node => node.type === 'Spacer')[0];
    assert.ok(gap);
    if (platform === 'android') assert.deepEqual(gap.props.modifiers.find(m => m.name === 'size').args, [12, 1]);
    else assert.deepEqual(gap.props.modifiers.find(m => m.name === 'frame').args, [{ width: 12 }]);
  });
}
test('Android inactive cards retain source card geometry, theme borders and dark shadow', () => {
  for (const dark of [false, true]) {
    const { tree } = render('android', {}, { dark, rtl: true });
    const cards = nodes(tree, node => node.type === 'View' && Array.isArray(node.props.style) && node.props.style[0]?.borderRadius === 24);
    assert.equal(cards.length, 4);
    for (const card of cards) {
      assert.equal(card.props.style[0].padding, 18); assert.equal(card.props.style[1].backgroundColor, 'surface');
      assert.equal(card.props.style[1].borderColor, 'border'); assert.equal(card.props.style[1].borderWidth, dark ? 1.35 : 1);
      assert.equal(card.props.style[1].boxShadow[0].blurRadius, dark ? 18 : 8);
    }
    const code = nodes(tree, node => node.type === 'NativeText' && node.props.children === 'Code removed')[0];
    assert.equal(code.props.style[1].fontFamily, 'source-medium'); assert.equal(code.props.style[1].writingDirection, 'rtl');
    const list = nodes(tree, node => node.type === 'FlatList')[0]; assert.equal(list.props.contentContainerStyle.paddingTop, 4);
    list.props.refreshControl.props.onRefresh();
  }
});

test('Android inactive refresh uses actual viewport/content extent and the exact source .5 threshold', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const f = render('android', {}, { reload: () => pending }), list = () => nodes(f.tree, node => node.type === 'FlatList')[0];
  const control = () => list().props.refreshControl.props;
  assert.equal(control().enabled, false); await control().onRefresh(); assert.deepEqual(f.calls, []);
  list().props.onLayout({ nativeEvent: { layout: { height: 500 } } }); f.rerender(); assert.equal(control().enabled, false);
  list().props.onContentSizeChange(390, 500.5); f.rerender(); assert.equal(control().enabled, false);
  list().props.onContentSizeChange(390, 500.51); f.rerender(); assert.equal(control().enabled, true);
  const requested = control().onRefresh(); assert.equal(requested, pending); assert.deepEqual(f.calls, ['reload']);
  let finished = false; requested.then(() => { finished = true; }); await Promise.resolve(); assert.equal(finished, false);
  complete(); await requested; assert.equal(finished, true);
  const captured = control().onRefresh;
  list().props.onContentSizeChange(390, 200); await captured(); assert.deepEqual(f.calls, ['reload']);
  f.rerender(); assert.equal(control().enabled, false);
});

test('Android native measurements and refresh callbacks retire with the original list/items', async () => {
  const f = render('android'), list = () => nodes(f.tree, node => node.type === 'FlatList')[0], original = list().props;
  original.onLayout({ nativeEvent: { layout: { height: 300 } } }); original.onContentSizeChange(390, 900); f.rerender();
  assert.equal(list().props.refreshControl.props.enabled, true);
  f.model.state = { ...f.model.state, items: [...f.items] }; f.rerender();
  assert.equal(list().props.refreshControl.props.enabled, false);
  original.onLayout({ nativeEvent: { layout: { height: 100 } } }); original.onContentSizeChange(390, 1000); f.rerender();
  assert.equal(list().props.refreshControl.props.enabled, false); await original.refreshControl.props.onRefresh(); assert.deepEqual(f.calls, []);
  list().props.onLayout({ nativeEvent: { layout: { height: 300 } } }); list().props.onContentSizeChange(390, 900); f.rerender();
  const current = list().props.refreshControl.props.onRefresh; assert.equal(list().props.refreshControl.props.enabled, true);
  f.unmount(); await current(); assert.deepEqual(f.calls, []);
});

test('iOS native inactive list keeps source top/gap geometry and SwiftUI rows inside individually measured hosts', () => {
  const f = render('ios'), list = nodes(f.tree, node => node.type === 'FlatList')[0];
  assert.equal(list.props.contentContainerStyle.paddingTop, 4); assert.equal(list.props.contentInsetAdjustmentBehavior, 'never');
  assert.equal(list.props.ItemSeparatorComponent().props.style.height, 12);
  assert.equal(list.props.children.length, f.items.length);
  assert.ok(list.props.children.every(row => row.type === 'BaseHost' && row.props.matchContents.vertical && row.props.style.width === '100%'));
  assert.equal(nodes(f.tree, node => node.type === 'List').length, 0);
  assert.equal(nodes(list, node => testId(node, 'admin-inactive-supplier-restore-0')).length, 1);
});

test('iOS inactive refresh uses native scroll measurements, source threshold and the real refresh Promise', async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  const f = render('ios', {}, { iosVersion: '18.0.1', reload: () => pending }), list = () => nodes(f.tree, node => node.type === 'FlatList')[0];
  assert.equal(list().props.refreshControl, undefined);
  list().props.onLayout({ nativeEvent: { layout: { height: 500 } } }); f.rerender(); assert.equal(list().props.refreshControl, undefined);
  list().props.onContentSizeChange(390, 500.5); f.rerender(); assert.equal(list().props.refreshControl, undefined);
  list().props.onContentSizeChange(390, 500.51); f.rerender();
  const captured = list().props.refreshControl.props.onRefresh, requested = captured(); assert.equal(requested, pending); assert.deepEqual(f.calls, ['reload']);
  let finished = false; requested.then(() => { finished = true; }); await Promise.resolve(); assert.equal(finished, false); complete(); await requested; assert.equal(finished, true);
  list().props.onContentSizeChange(390, 200); await captured(); assert.deepEqual(f.calls, ['reload']);
  f.rerender(); assert.equal(list().props.refreshControl, undefined);
});

test('iOS native measurements and refresh callbacks retain their exact mounted list/items owner', async () => {
  const f = render('ios'), list = () => nodes(f.tree, node => node.type === 'FlatList')[0], original = list().props;
  original.onLayout({ nativeEvent: { layout: { height: 300 } } }); original.onContentSizeChange(390, 900); f.rerender();
  const oldRefresh = list().props.refreshControl.props.onRefresh;
  f.model.state = { ...f.model.state, items: [...f.items] }; f.rerender(); assert.equal(list().props.refreshControl, undefined);
  original.onLayout({ nativeEvent: { layout: { height: 100 } } }); original.onContentSizeChange(390, 1000); f.rerender(); assert.equal(list().props.refreshControl, undefined);
  await oldRefresh(); assert.deepEqual(f.calls, []);
  list().props.onLayout({ nativeEvent: { layout: { height: 300 } } }); list().props.onContentSizeChange(390, 900); f.rerender();
  const currentRefresh = list().props.refreshControl.props.onRefresh; f.unmount(); await currentRefresh(); assert.deepEqual(f.calls, []);
});

test('all supported iOS versions use actual native measurements before admitting refresh, including below18', async () => {
  for (const iosVersion of ['16.4', '17.6', '18.0.1', '26.0']) {
    const f = render('ios', {}, { iosVersion }), list = () => nodes(f.tree, node => node.type === 'FlatList')[0];
    assert.equal(list().props.refreshControl, undefined);
    list().props.onLayout({ nativeEvent: { layout: { height: 500 } } }); list().props.onContentSizeChange(390, 100); f.rerender();
    assert.equal(list().props.refreshControl, undefined);
    list().props.onContentSizeChange(390, 500.5); f.rerender(); assert.equal(list().props.refreshControl, undefined);
    list().props.onContentSizeChange(390, 501); f.rerender();
    await list().props.refreshControl.props.onRefresh(); assert.deepEqual(f.calls, ['reload']);
  }
});
