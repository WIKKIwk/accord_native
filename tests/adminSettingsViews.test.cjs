const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { frameModule, metrics, flattenStyle } = require('./adminShellFrameViewSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const model = load('admin/adminSettingsController.ts', { './dartJsonString': load('admin/dartJsonString.ts') });
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
function native(name, slots = []) { const component = props => ({ type: name, props }); slots.forEach(slot => { component[slot] = `${name}.${slot}`; }); return component; }
function render(node) {
  if (Array.isArray(node)) return node.map(render);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children), header: render(node.props?.header), footer: render(node.props?.footer) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate), ...nodes(node.props?.header, predicate), ...nodes(node.props?.footer, predicate)];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? [text(node.props?.children), text(node.props?.header), text(node.props?.footer)].filter(Boolean).join(' ') : '';
}
function fixture(platform, { phase = 'content', saving = false, additional = true, push = true, locale = 'uz', current = true, mode = 'light', nativeMetrics = metrics() } = {}) {
  const calls = [], effects = [];
  const state = { phase, fields: Object.fromEntries(model.adminSettingsFieldNames.map(key => [key, `value-${key}`])), fillVersion: 1, saving, changed: false, notice: null };
  const value = { state, current, additional, push, navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') },
    change: (name, value) => calls.push(['change', name, value]), reload: () => calls.push('retry'), save: () => calls.push('save'), navigate: route => calls.push(['navigate', route]),
    t: key => l10n.localizedGetter(key, locale), a: key => l10n.adminText(key, locale), p: key => l10n.productionText(key, locale) };
  const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: String(key), args }) });
  const colors = { onSurface: 'text', surface: 'bg', onPrimary: 'white', primary: 'primary', surfaceContainerLow: 'low', surfaceContainerHigh: 'high', surfaceContainerHighest: 'highest', onSurfaceVariant: 'secondary', outlineVariant: 'outline' };
  const controls = { useNativeState: value => ({ get: () => value, set() {} }), useMaterialColors: () => colors,
    Shape: { RoundedCorner: value => value }, OutlinedTextField: native('OutlinedTextField', ['Label']),
    TopAppBar: native('TopAppBar', ['Title', 'NavigationIcon', 'Actions']),
    ListItem: native('ListItem', ['LeadingContent', 'HeadlineContent', 'TrailingContent']) };
  const ui = new Proxy(controls, { get: (obj, key) => Object.hasOwn(obj, key) ? obj[key] : String(key) });
  const mocks = { react: { useEffect: fn => effects.push(fn), useRef: current => ({ current }) },
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { View: 'View', PlatformColor: value => value, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-reanimated': { default: { View: 'Animated.View' }, cancelAnimation() {}, Easing: { bezier: (...values) => values },
      useSharedValue: value => ({ value }), useAnimatedStyle: make => make(), withTiming: value => value },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, '../shared/appRoutes': { appRoutes: { adminAdditionalSettings: '/additional', adminPushConfig: '/push' } },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode }) }, './AdminTypography.android': { AdminText: 'Text' },
    './AdminTextFields.android': { AdminOutlinedTextField: controls.OutlinedTextField },
    './AdminShellBodyFrame': frameModule(colors, () => ({ metrics: nativeMetrics, thinGestureBottom: false })),
    './adminSettingsController': model, './useAdminSettings': { useAdminSettings: () => value } };
  mocks['./AdminLoadingIndicator.android'] = load('admin/AdminLoadingIndicator.android.tsx', mocks);
  const View = load(`admin/AdminSettingsScreen.${platform}.tsx`, mocks).AdminSettingsScreen;
  const profileAction = { type: 'GenuineProfileAction', props: {} };
  return { tree: render(View({ footer: 'real-dock', profileAction })), calls, value, effects, colors, profileAction };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} settings renders seven native text fields in source order and source capability links`, () => {
    const f = fixture(platform), fields = nodes(f.tree, n => n.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'));
    assert.equal(fields.length, 7); assert.deepEqual(fields.map(node => node.props[platform === 'ios' ? 'text' : 'value'].get()), model.adminSettingsFieldNames.map(key => `value-${key}`));
    fields[1].props[platform === 'ios' ? 'onTextChange' : 'onValueChange']('typed'); assert.deepEqual(f.calls[0], ['change', 'erp_api_key', 'typed']);
    assert.ok(fields.every(node => node.props.visualTransformation === undefined));
    const labels = text(f.tree); assert.ok(labels.includes(l10n.adminText('settings.api_secret', 'uz'))); assert.ok(labels.includes('real-dock'));
    const links = nodes(f.tree, n => platform === 'ios' ? n.type === 'Button' && n.props.modifiers === undefined : n.type === 'ListItem');
    const invoke = node => platform === 'ios' ? node.props.onPress() : node.props.modifiers.find(mod => mod.name === 'combinedClickable').args[0].onClick();
    invoke(links[0]); invoke(links[1]); assert.deepEqual(f.calls.slice(-2), [['navigate', '/additional'], ['navigate', '/push']]);
  });
  test(`${platform} save is native, disabled while saving, and leaves the seven source inputs editable`, () => {
    const f = fixture(platform, { saving: true });
    const button = nodes(f.tree, n => n.type === 'Button' && n.props.modifiers?.some(mod => mod.name === (platform === 'ios' ? 'accessibilityIdentifier' : 'testID') && mod.args[0] === 'admin-settings-save'))[0];
    assert.ok(button); if (platform === 'android') {
      assert.equal(button.props.enabled, false); assert.ok(button.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56));
      assert.deepEqual(Object.values(button.props.shape.cornerRadii), [20, 20, 20, 20]);
    } else assert.ok(button.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0] === true));
    assert.ok(text(button).includes(l10n.localizedGetter('pinSaving', 'uz')));
    const fields = nodes(f.tree, n => n.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'));
    assert.ok(fields.every(node => node.props.enabled !== false));
    if (platform === 'ios') button.props.onPress(); else button.props.onClick(); assert.deepEqual(f.calls, ['save']);
  });
  test(`${platform} source load/error states never expose form credentials; retry uses real owner`, () => {
    const loading = fixture(platform, { phase: 'loading' }); assert.ok(!text(loading.tree).includes('value-erp_api_secret'));
    const failed = fixture(platform, { phase: 'error' }); const retry = nodes(failed.tree, n => n.type === (platform === 'ios' ? 'Button' : 'TextButton'))[0];
    retry.props[platform === 'ios' ? 'onPress' : 'onClick'](); assert.deepEqual(failed.calls, ['retry']);
    assert.equal(nodes(failed.tree, n => n.type === 'TextField' || n.type === 'OutlinedTextField').length, 0);
    assert.equal(nodes(fixture(platform, { current: false }).tree, n => n.type === 'TextField' || n.type === 'OutlinedTextField').length, 0);
  });
  test(`${platform} capability-gated links are omitted and all four locales resolve source field text`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const f = fixture(platform, { additional: false, push: false, locale });
      assert.ok(text(f.tree).includes(l10n.localizedGetter('erpConnectionTitle', locale)));
      assert.ok(!text(f.tree).includes(l10n.adminText('push.title', locale)));
    }
  });
  test(`${platform} Settings applies real side-safe shell/frame/dock reserve and source12/14 content padding to every phase`, () => {
    for (const phase of ['content', 'loading', 'error']) {
      const f = fixture(platform, { phase }), body = nodes(f.tree, node => node.props.testID === 'admin-settings-body-frame')[0], reserve = nodes(f.tree, node => node.props.testID === 'admin-settings-body-frame-reserve')[0];
      assert.equal(flattenStyle(reserve.props.style).marginHorizontal, 6); assert.equal(flattenStyle(reserve.props.style).marginBottom, 92);
      assert.equal(flattenStyle(body.props.style).backgroundColor, 'low');
      const content = nodes(body, node => flattenStyle(node.props.style).paddingStart === 12 && flattenStyle(node.props.style).paddingEnd === 14)[0]; assert.ok(content);
      assert.equal(text(body).includes('real-dock'), false); assert.equal(text(f.tree).includes('real-dock'), true);
      const safe = nodes(f.tree, node => node.props.testID === 'admin-settings-body-frame-safe-area')[0]; assert.equal(safe.type, 'SafeAreaView'); assert.deepEqual(safe.props.edges, ['left', 'right']);
    }
    const missing = fixture(platform, { nativeMetrics: null }).tree, frame = nodes(missing, node => node.props.testID === 'admin-settings-body-frame')[0];
    assert.equal(frame.props.pointerEvents, 'none'); assert.equal(flattenStyle(frame.props.style).opacity, 0); assert.equal(nodes(frame, node => node.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField')).length, 7);
    const keyboard = fixture(platform, { nativeMetrics: metrics({ viewInsetsBottom: 300 }) }).tree;
    assert.equal(flattenStyle(nodes(keyboard, node => node.props.testID === 'admin-settings-body-frame-reserve')[0].props.style).marginBottom, 0);
  });
  test(`${platform} Settings header keeps genuine profile action and native accessible back glyph`, () => {
    const f = fixture(platform);
    if (platform === 'android') {
      const header = nodes(f.tree, node => node.props.testID === 'admin-settings-header-safe-area')[0], bar = nodes(header, node => node.type === 'TopAppBar')[0];
      assert.deepEqual(header.props.edges, ['left', 'right']); assert.ok(bar.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 60));
      const title = nodes(bar, node => node.type === 'Text' && node.props.style?.fontSize === 24)[0]; assert.equal(title.props.style.fontWeight, '800');
      assert.equal(nodes(bar, node => node.type === 'GenuineProfileAction').length, 1);
      nodes(bar, node => node.type === 'IconButton')[0].props.onClick();
    } else {
      const options = nodes(f.tree, node => node.type === 'Stack.Screen')[0].props.options;
      assert.equal(options.headerRight(), f.profileAction); const back = render(options.headerLeft());
      const button = nodes(back, node => node.type === 'Button')[0]; assert.ok(button.props.modifiers.some(mod => mod.name === 'accessibilityLabel' && mod.args[0] === 'Back'));
      assert.equal(nodes(button, node => node.type === 'Image' && node.props.systemName === 'chevron.left').length, 1); button.props.onPress();
    }
    assert.deepEqual(f.calls, ['back']);
  });
}
test('Android Settings retains source input fill variants, separate scroll tail and top-aligned retry instead of centering errors', () => {
  for (const mode of ['light', 'dark']) {
    const f = fixture('android', { mode }), fields = nodes(f.tree, node => node.type === 'OutlinedTextField');
    assert.equal(fields.length, 7); assert.ok(fields.every(node => node.props.textStyle.fontSize === 16 && node.props.textStyle.fontWeight === '400'));
    assert.ok(fields.every(node => node.props.colors.focusedContainerColor === (mode === 'dark' ? 'high' : 'highest')));
    assert.ok(fields.every(node => node.props.colors.unfocusedIndicatorColor === 'outline'));
    const list = nodes(f.tree, node => node.props.modifiers?.some(mod => mod.name === 'verticalScroll'))[0];
    assert.ok(list.props.modifiers.some(mod => mod.name === 'padding' && JSON.stringify(mod.args) === JSON.stringify([0, 4, 0, 156])));
  }
  const failed = fixture('android', { phase: 'error' }), retry = nodes(failed.tree, node => flattenStyle(node.props.style).paddingVertical === 40)[0];
  assert.equal(flattenStyle(retry.props.style).paddingHorizontal, 24); assert.equal(flattenStyle(retry.props.style).justifyContent, undefined);
  const button = nodes(retry, node => node.type === 'TextButton')[0]; assert.deepEqual(button.props.contentPadding, { start: 12, end: 12, top: 8, bottom: 8 });
  const loading = fixture('android', { phase: 'loading' }).tree; assert.equal(nodes(loading, node => node.type === 'LoadingIndicator').length, 1);
});
