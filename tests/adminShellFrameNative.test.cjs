const assert = require('node:assert/strict');
const test = require('node:test');
const { compile, frameModule, metrics, flattenStyle } = require('./adminShellFrameViewSupport.cjs');
const { runtime, nodes } = require('./adminSupplierDetailViewSupport.cjs');
const colors = { surface: '#ffffff', surfaceContainerLow: '#dddddd', surfaceContainerHigh: '#eeeeee', surfaceContainerHighest: '#cccccc', outlineVariant: '#888888', onSurface: '#111111', onSurfaceVariant: '#666666', primary: '#334455', secondaryContainer: '#bbbbbb', onSecondaryContainer: '#111111' };
const modifier = new Proxy({ Animation: { easeOut: value => value } }, { get: (target, name) => target[name] ?? ((...args) => ({ name, args })) });
const families = { Werka: 'werka', SupplierDetail: 'supplier-detail', SupplierItems: 'supplier-items', WorkerDetail: 'worker-detail', WorkerProfile: 'worker-profile', CustomerDetail: 'customer-detail' };

function setup(family, platform) {
  let facts = { metrics: metrics({ platform }), thinGestureBottom: false }, hookReads = 0;
  const r = runtime(), actualFrame = frameModule(colors, () => facts);
  const ui = new Proxy({ Shape: { RoundedCorner: value => value }, TopAppBar: Object.assign(props => ({ type: 'TopAppBar', props }), { NavigationIcon: 'NavigationIcon', Title: 'Title', Actions: 'Actions' }) }, { get: (target, name) => target[name] ?? String(name) });
  const transition = { duration: () => transition, easing: () => transition };
  const genericNative = new Proxy({}, { get: (_target, name) => name === 'workerDetailShape' || name === 'workerDetailCardShape' ? () => ({}) : String(name) });
  const model = { state: { phase: 'content', valid: true, removed: false, loading: false, items: [], notice: null, copiedNotice: null, warehouses: [], expanded: false },
    detail: { avatar_url: '', phone: '', level: '' }, current: () => true, scopeCurrent: () => true, interactive: () => true, mode: { management: false }, overlays: { sheets: [] },
    title: 'Title', readOnly: true, system: true, preparation: false, warehouseEnabled: false, cards: [{ title: 'Card', rows: [] }],
    a: key => key, t: key => key, u: key => key, back() {}, reload() {}, notice: null };
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifier,
    '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifier, 'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', ScrollView: 'RN.ScrollView', RefreshControl: 'RefreshControl', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-reanimated': { default: { View: 'Animated.View' }, View: 'Animated.View', LinearTransition: transition, Easing: { cubic: 'cubic', out: value => value, inOut: value => value },
      useSharedValue: value => ({ value }), useAnimatedStyle: callback => callback(), withTiming: value => value },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 34 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminBasicTextField: ui.BasicTextField, AdminOutlinedTextField: ui.OutlinedTextField }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    '../shared/localization': { uiText: value => value }, '../shared/localization/runtime': { localeController: { locale: 'uz' } }, './dartJsonString': { dartTrim: value => value.trim() }, './AdminShellBodyFrame': actualFrame,
    [`./useAdmin${family}`]: { [`useAdmin${family}`]: () => { hookReads++; return model; } },
  };
  for (const kind of ['AdminWorkerDetailEditors', 'AdminWorkerDetailNative', 'AdminWorkerDetailOverlays', 'AdminCustomerDetailNative', 'AdminCustomerDetailSheets']) mocks[`./${kind}.${platform}`] = genericNative;
  const screen = compile(`Admin${family}Screen.${platform}.tsx`, mocks), props = { footer: { type: 'GenuineDock', props: {} }, profileAction: { type: 'GenuineProfile', props: {} }, backLabel: 'Back', renderAvatar: () => ({ type: 'OwnedAvatar', props: {} }) };
  const expandFrame = node => {
    if (Array.isArray(node)) return node.map(expandFrame); if (!node || typeof node !== 'object') return node;
    if (node.type === actualFrame.AdminShellBodyFrame) return expandFrame(node.type(node.props));
    return { ...node, props: { ...node.props, children: expandFrame(node.props?.children) } };
  };
  return { props, model, set: next => { facts = next; }, get hookReads() { return hookReads; },
    render: () => r.render(() => expandFrame(screen[`Admin${family}Screen`](props))) };
}

for (const [family, id] of Object.entries(families)) for (const platform of ['android', 'ios']) {
  test(`${platform} ${family} uses a real outer dock reserve and source Low clipped frame, with IME/no-footer/unavailable transitions`, () => {
    const f = setup(family, platform), frameID = `admin-${id}-body-frame`;
    const parts = () => { const tree = f.render(), outer = nodes(tree, node => node.props.testID === `${frameID}-reserve`)[0], body = nodes(tree, node => node.props.testID === frameID)[0]; return { tree, outer, body, outside: flattenStyle(outer.props.style), inside: flattenStyle(body.props.style) }; };
    f.set({ metrics: metrics({ platform, viewPaddingBottom: 40, systemGestureInsetsBottom: 48 }), thinGestureBottom: platform === 'android' });
    let p = parts(); assert.equal(p.outside.marginHorizontal, 6); assert.equal(p.outside.marginBottom, 75); assert.equal(p.outside.backgroundColor, undefined);
    const safe = nodes(p.tree, node => node.props.testID === `${frameID}-safe-area`)[0];
    assert.equal(safe.type, 'SafeAreaView'); assert.deepEqual(safe.props.edges, ['left', 'right']);
    assert.equal(flattenStyle(safe.props.style).flex, 1); assert.equal(nodes(safe, node => node === p.outer).length, 1);
    assert.equal(nodes(safe, node => node.type === 'GenuineDock').length, 0);
    if (platform === 'android') {
      const header = nodes(p.tree, node => node.props.testID === 'admin-header-safe-area')[0];
      assert.equal(header.type, 'SafeAreaView'); assert.deepEqual(header.props.edges, ['left', 'right']);
      assert.equal(nodes(header, node => node.props.windowInsets != null && Object.keys(node.props.windowInsets).length === 0).length, 1);
      assert.equal(nodes(header, node => node.props.testID === frameID).length, 0);
    } else assert.equal(nodes(p.tree, node => node.props.testID === 'admin-header-safe-area').length, 0);
    assert.equal(p.inside.backgroundColor, colors.surfaceContainerLow); assert.equal(p.inside.borderTopLeftRadius, 18); assert.equal(p.inside.borderTopRightRadius, 18); assert.equal(p.inside.borderBottomLeftRadius, 18); assert.equal(p.inside.borderBottomRightRadius, 18); assert.equal(p.inside.overflow, 'hidden');
    assert.equal(p.inside.paddingBottom ?? 0, 0); assert.equal(p.inside.opacity, 1); assert.equal(p.body.props.pointerEvents, 'auto');
    assert.ok(nodes(p.tree, node => flattenStyle(node.props.style).backgroundColor === colors.surfaceContainerHigh).length);
    assert.equal(nodes(p.body, node => node.type === 'GenuineDock').length, 0); assert.equal(nodes(p.tree, node => node.type === 'GenuineDock').length, 1);
    f.set({ metrics: metrics({ platform, width: platform === 'ios' ? 1024 : 390, height: 1366, viewPaddingBottom: 24, systemGestureInsetsBottom: 32 }), thinGestureBottom: false });
    p = parts(); assert.equal(p.outside.marginBottom, 92); assert.equal(p.inside.paddingBottom ?? 0, 0);
    f.set({ metrics: metrics({ platform, viewInsetsBottom: 300 }), thinGestureBottom: true });
    p = parts(); assert.equal(p.outside.marginBottom, 0); assert.equal(p.inside.borderBottomLeftRadius, 18);
    f.props.footer = null; p = parts(); assert.equal(p.outside.marginBottom, 0); assert.equal(p.inside.borderBottomLeftRadius, 0); assert.equal(p.inside.borderBottomRightRadius, 0); assert.equal(p.inside.borderTopLeftRadius, 18);
    f.props.footer = { type: 'GenuineDock', props: {} }; f.set({ metrics: null, thinGestureBottom: false });
    p = parts(); assert.equal(p.outside.marginBottom, undefined); assert.equal(p.inside.opacity, 0); assert.equal(p.body.props.pointerEvents, 'none'); assert.equal(p.body.props.accessibilityElementsHidden, true); assert.equal(p.body.props.importantForAccessibility, 'no-hide-descendants'); assert.deepEqual(p.body.props.accessibilityState, { busy: true });
    assert.notEqual(p.body.props.children, null); assert.equal(f.hookReads, 5);
  });
  test(`${platform} ${family} keeps source shell padding separate from child/list padding`, () => {
    const f = setup(family, platform), tree = f.render(), body = nodes(tree, node => node.props.testID === `admin-${id}-body-frame`)[0], inside = flattenStyle(body.props.style);
    if (family === 'SupplierItems') {
      assert.equal(inside.paddingStart, 4); assert.equal(inside.paddingEnd, 6); assert.equal(inside.paddingTop, 0); assert.equal(inside.paddingBottom, 0);
      const child = nodes(body, node => flattenStyle(node.props.style).paddingTop === 4)[0]; assert.equal(flattenStyle(child.props.style).paddingStart, undefined); assert.equal(flattenStyle(child.props.style).paddingEnd, undefined);
    } else {
      assert.equal(inside.paddingTop, undefined); assert.equal(inside.paddingStart, undefined);
      if (platform === 'android') {
        const list = nodes(body, node => node.props.contentContainerStyle?.paddingBottom === 116)[0]; assert.ok(list); assert.equal(list.props.contentContainerStyle.padding ?? list.props.contentContainerStyle.paddingHorizontal, family === 'WorkerProfile' ? 8 : 4);
      } else if (family === 'WorkerProfile') {
        assert.ok(nodes(body, node => node.props.modifiers?.some(mod => mod.name === 'frame' && mod.args[0].height === 116)).length);
        assert.ok(nodes(body, node => node.props.modifiers?.some(mod => mod.name === 'padding' && mod.args[0].top === 8)).length);
      } else assert.ok(nodes(body, node => node.props.modifiers?.some(mod => mod.name === 'padding' && mod.args[0].leading === 4 && mod.args[0].trailing === 4 && mod.args[0].top === 4 && mod.args[0].bottom === 116)).length);
    }
  });
}

test('Expo Go Home remains interactive without native measurements, except inside a source window', () => {
  const facts = { metrics: null, thinGestureBottom: false, sourceWindow: false };
  const { AdminShellBodyFrame } = frameModule(colors, () => facts);
  const body = () => nodes(AdminShellBodyFrame({ hasFooter: true, testID: 'preview', allowMissingInsets: true, children: 'Home' }),
    node => node.props.testID === 'preview')[0];
  assert.equal(body().props.pointerEvents, 'auto');
  assert.equal(flattenStyle(body().props.style).opacity, 1);
  facts.sourceWindow = true;
  assert.equal(body().props.pointerEvents, 'none');
});

test('measurement-pending body keeps a genuine child read lifetime mounted across metric/keyboard updates', () => {
  const r = runtime(); let facts = { metrics: null, thinGestureBottom: false }, reads = 0, cleanups = 0;
  const { AdminShellBodyFrame } = frameModule(colors, () => facts);
  function OwnedReader() { r.react.useLayoutEffect(() => { reads++; return () => { cleanups++; }; }, []); return { type: 'OwnedReadContent', props: {} }; }
  const expand = node => { if (Array.isArray(node)) return node.map(expand); if (!node || typeof node !== 'object') return node; if (typeof node.type === 'function') return expand(node.type(node.props)); return { ...node, props: { ...node.props, children: expand(node.props?.children) } }; };
  const render = () => r.render(() => expand(AdminShellBodyFrame({ hasFooter: true, testID: 'pending', children: { type: OwnedReader, props: {} } })));
  let tree = render(); assert.equal(reads, 1); assert.equal(nodes(tree, node => node.type === 'OwnedReadContent').length, 1); assert.equal(flattenStyle(nodes(tree, node => node.props.testID === 'pending')[0].props.style).opacity, 0);
  facts = { metrics: metrics(), thinGestureBottom: true }; render(); facts = { metrics: metrics({ viewInsetsBottom: 300 }), thinGestureBottom: true }; render();
  facts = { metrics: null, thinGestureBottom: true }; render(); assert.equal(reads, 1); assert.equal(cleanups, 0); r.unmount(); assert.equal(cleanups, 1);
});
