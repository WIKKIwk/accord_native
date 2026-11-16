/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');
const { flattenStyle } = require('./adminShellFrameViewSupport.cjs');
const domain = s.load('admin/adminCreateHubController', { '../shared/camera/synchronousGuard': s.strict });
const dock = s.load('admin/adminDockModel', { '../shared/appRoutes': s.routes, '../shared/localization': s.l10n });
const policy = s.load('admin/adminCreateHubModel', { '../shared/camera/synchronousGuard': s.strict, './adminDockModel': dock });
const colors = { ...s.colors, primaryContainer: '#AABBCC', onPrimaryContainer: '#112233', onPrimary: '#FFFFFF' };
const modifier = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
function fixture(platform, { available = true, empty = false, actions } = {}) {
  const r = s.runtime(), calls = [], completions = [], values = []; let valid = true;
  const controller = new domain.AdminCreateHubController({ isCurrent: () => valid,
    readiness: () => ({ ready: available, missingRoutes: available ? [] : ['/real'], hasPrimary: true }),
    actions: () => empty ? [] : ['First', 'Second'].map((label, index) => ({ id: label, label, routeName: `/real${index}`, materialIcon: 'add_task_outlined', row: index, staggerOrder: 1 - index })),
    routeAvailable: () => available, openRoute: route => calls.push(route), nextFrame: callback => { calls.push(callback); return () => {}; } });
  controller.start(); const ticket = controller.register({ isCurrent: () => valid, canInteract: () => valid, isFocused: () => true, actions });
  const native = new Proxy({ Shape: { Pill: value => value, RoundedCorner: value => value } }, { get: (target, key) => target[key] ?? String(key) });
  const shared = value => { const ref = r.react.useRef(null); if (!ref.current) { ref.current = { value, get() { return this.value; }, set(next) { this.value = next; } }; values.push(ref.current); } return ref.current; };
  const reanimated = { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: shared, useAnimatedStyle: read => read(), useAnimatedReaction: (prepare, react) => { const previous = r.react.useRef(null); r.react.useEffect(() => { const next = prepare(); react(next, previous.current); previous.current = next; }); },
    interpolateColor: (_value, _points, colors) => colors[0], cancelAnimation() {}, withSpring: (value, config, callback) => { completions.push({ value, config, callback }); return value; } };
  const mocks = { react: r.react, '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifier,
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } } },
    'react-native-reanimated': reanimated, 'react-native-worklets': { scheduleOnRN: (callback, ...args) => callback(...args) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: 'light', direction: 'leftToRight' }) },
    './AdminTypography.android': { AdminText: 'Text' }, './adminCreateHubModel': policy };
  mocks['./useAdminCreateHubMotion'] = s.compile(path.resolve(__dirname, '../src/admin/useAdminCreateHubMotion.ts'), mocks);
  mocks['./AdminCreateHubFloating'] = s.compile(path.resolve(__dirname, '../src/admin/AdminCreateHubFloating.tsx'), mocks);
  const view = s.compile(path.resolve(__dirname, `../src/admin/AdminCreateHubHost.${platform}.tsx`), mocks);
  const props = () => ({ controller, state: controller.getSnapshot(), primary: controller.primary(), layout: policy.adminCreateHubLayout(15, true, controller.primary()?.visible ?? false), labels: { trigger: 'Yangi', closed: 'Yaratish markazi', close: 'Yopish' } });
  return { r, controller, calls, completions, values, ticket, render: () => r.render(() => s.expand(view.AdminCreateHubHost(props()))), retire: () => { valid = false; controller.recheck(); } };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} genuine native primary is80/r22/right16/bottom89 and opens root floating actions, never a modal/menu/sheet`, () => {
    const f = fixture(platform), first = f.render(), button = s.byId(first, 'app-primary-navigation-button'); assert.ok(button);
    assert.ok(s.nodes(first, node => flattenStyle(node.props.style).width === 80 && flattenStyle(node.props.style).height === 80 && flattenStyle(node.props.style).borderRadius === 22 && flattenStyle(node.props.style).bottom === 89 && flattenStyle(node.props.style).end === 16).length);
    s.click(button, platform); const tree = f.render(); assert.equal(s.nodes(tree, node => ['Modal', 'BottomSheet', 'ModalBottomSheet', 'Menu'].includes(node.type)).length, 0);
    assert.ok(s.nodes(tree, node => node.props.testID === 'admin-create-hub-overlay').length); assert.ok(s.nodes(tree, node => flattenStyle(node.props.style).bottom === 179 && flattenStyle(node.props.style).gap === 4).length);
    assert.deepEqual(s.texts(tree), ['First', 'Second']); assert.ok(s.byId(tree, 'admin-hub-toggle-button'));
    const action = s.byId(tree, 'First'); if (platform === 'android') { assert.equal(action.props.colors.containerColor, colors.primaryContainer); assert.equal(action.props.contentPadding.start, 14); assert.ok(action.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56)); assert.ok(s.nodes(tree, node => node.type === 'Text' && node.props.style?.fontWeight === '600').length); }
    else assert.ok(s.nodes(action, node => node.props.modifiers?.some(mod => mod.name === 'frame' && mod.args[0].height === 56)).length);
    assert.ok(s.nodes(tree, node => node.type === 'SymbolView' && node.props.size === 24 || node.type === 'Image' && node.props.size === 24).length);
  });
  test(`${platform} all three spring acknowledgements are required; canceled old closing completion cannot remove reopened root overlay`, () => {
    const f = fixture(platform); f.controller.open(f.ticket); f.render(); const overlay = f.controller.getSnapshot().overlay;
    f.controller.close(overlay.id, overlay.generation); f.render(); const closing = f.completions.filter(value => value.value === 0).slice(-3);
    assert.equal(closing.length, 3); closing[0].callback(true); closing[1].callback(true); assert.ok(f.controller.getSnapshot().overlay);
    f.controller.open(f.ticket); f.render(); closing[2].callback(true); assert.equal(f.controller.getSnapshot().overlay.targetOpen, true);
    const current = f.controller.getSnapshot().overlay; f.controller.close(current.id, current.generation); f.render(); f.completions.filter(value => value.value === 0).slice(-3).forEach(value => value.callback(true)); assert.equal(f.controller.getSnapshot().overlay, null);
  });
  test(`${platform} destination-held scope renders no false button; source-empty overlay still opens and disabled custom pill remains native disabled`, () => {
    const held = fixture(platform, { available: false }); assert.equal(s.byId(held.render(), 'app-primary-navigation-button'), undefined);
    const empty = fixture(platform, { empty: true }); s.click(s.byId(empty.render(), 'app-primary-navigation-button'), platform); assert.deepEqual(s.texts(empty.render()), []); assert.ok(empty.controller.getSnapshot().overlay);
    const custom = fixture(platform, { actions: [{ id: 'disabled', label: 'Disabled', icon: { ios: 'shippingbox', android: 'warehouse' }, enabled: false, onPress: () => { throw Error('disabled'); } }] }); custom.controller.open(custom.ticket); const button = s.byId(custom.render(), 'disabled');
    if (platform === 'android') { assert.equal(button.props.enabled, false); assert.equal(button.props.colors.disabledContainerColor, colors.surfaceContainerHigh); }
    else assert.ok(button.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0]));
  });
  test(`${platform} morph label follows actual effects half-point and transparent/unmeasured action pills exclude pointer and accessibility descendants`, () => {
    const f = fixture(platform); f.controller.open(f.ticket); f.render(); let tree = f.render();
    const label = value => s.byId(value, 'admin-hub-toggle-button').props.modifiers.find(mod => mod.name === (platform === 'android' ? 'semantics' : 'accessibilityLabel')).args[0];
    const semantic = value => platform === 'android' ? label(value).contentDescription : label(value);
    assert.equal(semantic(tree), 'Yopish');
    f.values[2].set(.49); f.render(); tree = f.render(); assert.equal(semantic(tree), 'Yaratish markazi'); assert.equal(f.controller.getSnapshot().overlay.targetOpen, true);
    f.values[2].set(.5); f.render(); tree = f.render(); assert.equal(semantic(tree), 'Yopish');
    const pills = value => s.nodes(value, node => node.type === 'Animated.View' && node.props.importantForAccessibility != null);
    assert.ok(pills(tree).every(node => node.props.accessibilityElementsHidden && node.props.pointerEvents === 'none'));
    s.nodes(tree, node => typeof node.props.onLayout === 'function').forEach(node => node.props.onLayout({ nativeEvent: { layout: { width: 220 } } }));
    f.values[2].set(1); f.render(); tree = f.render(); assert.ok(pills(tree).every(node => !node.props.accessibilityElementsHidden && node.props.pointerEvents === 'auto'));
    f.values[2].set(0); f.render(); tree = f.render(); assert.ok(pills(tree).every(node => node.props.accessibilityElementsHidden && node.props.importantForAccessibility === 'no-hide-descendants' && node.props.pointerEvents === 'none'));
  });
  test(`${platform} retained root native buttons and measured-width callbacks cannot affect retired account or reopened generation`, () => {
    const f = fixture(platform); f.controller.open(f.ticket); const tree = f.render(), callbacks = s.nodes(tree, node => typeof node.props.onLayout === 'function').map(node => node.props.onLayout), action = s.byId(tree, 'First'), writes = f.r.counters.writes;
    f.retire(); callbacks.forEach(callback => callback({ nativeEvent: { layout: { width: 300 } } })); s.click(action, platform); assert.equal(f.r.counters.writes, writes); assert.deepEqual(f.calls, []);
  });
}
