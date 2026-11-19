/* global __dirname */
const { adminShellThemeFixture } = require('./support/adminShellTheme.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const s = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const strict = s.load('shared/camera/synchronousGuard');
const { AdminSupplierDetailController } = s.load('admin/adminSupplierDetailController', { '../shared/camera/synchronousGuard': strict, './dartJsonString': s.strings });
const presentation = s.load('admin/adminWerkaPresentation', { './dartJsonString': s.strings });
function runtime() {
  let cursor = 0, pending = [];
  const slots = [], effects = new Map(), cleanups = new Map(), counters = { writes: 0 };
  const memo = (callback, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) slots[index] = { deps, value: callback() };
    return slots[index].value;
  };
  const effect = (callback, deps) => {
    const index = cursor++, old = slots[index]; effects.set(index, callback);
    if (!old || !deps || deps.some((value, i) => !Object.is(value, old[i]))) {
      slots[index] = deps; pending.push(() => { cleanups.get(index)?.(); cleanups.set(index, callback()); });
    }
  };
  const react = {
    useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: value => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [slots[index], next => { counters.writes++; slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useMemo: memo, useCallback: (callback, deps) => memo(() => callback, deps), useEffect: effect, useLayoutEffect: effect,
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  const unmount = () => { [...cleanups.values()].reverse().forEach(cleanup => cleanup?.()); cleanups.clear(); };
  return { react, counters, unmount, render(callback) { cursor = 0; pending = []; const value = callback(); pending.forEach(run => run()); return value; },
    replay() { unmount(); for (const [index, callback] of effects) cleanups.set(index, callback()); } };
}
function compile(filename, mocks, transform = source => source) {
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] :
    id === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : require(id);
  mod._compile(ts.transpileModule(transform(fs.readFileSync(filename, 'utf8')), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function hooks(r, extra = {}) {
  return compile(path.resolve(__dirname, '../src/admin/useAdminSupplierDetail.ts'), { react: r.react, '../shared/camera/synchronousGuard': strict, './AdminOwnedBackContext': { useAdminOwnedBack() {} },
    'expo-router': { useIsFocused: () => true, useFocusEffect: callback => r.react.useEffect(callback, [callback]) },
    'react-native': { Platform: { OS: 'ios' }, BackHandler: {} }, '../auth': { subscribeSessionWitness: () => () => {} },
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './adminSupplierDetailSession': {}, './adminWerkaPresentation': presentation, './dartJsonString': s.strings, ...extra });
}
const detail = patch => ({ ref: 'resolved ref', name: 'Supplier Name', phone: ' original phone ', avatar_url: 'https://images.example/real.png', code: ' raw code ',
  blocked: false, removed: false, code_locked: true, code_retry_after_sec: 0, assigned_items: [{ code: 'C', name: 'Item' }], ...patch });
function model(patch = {}, readOnly = false) {
  let valid = true, focused = true, phone = async () => true, confirming = async () => {};
  const calls = [], state = { phase: 'content', detail: detail(), seconds: 9, expanded: true, savingStatus: false, savingPhone: false, regenerating: false, removing: false,
    changed: false, notice: null, removePrompt: null, ...patch };
  const result = { state, readOnly, generation: 1, locale: 'uz', displayName: 'Supplier Name', initials: 'SN', notice: null,
    current: () => valid, interactive: () => valid && focused,
    a: (key, values) => s.l10n.adminText(key, 'uz', values), t: key => s.l10n.localizedGetter(key, 'uz'),
    back: () => { if (valid && focused) calls.push(['back', state.changed]); }, reload: () => { if (valid && focused) calls.push('reload'); },
    toggle: () => { if (valid && focused && !readOnly) calls.push('toggle'); },
    savePhone: async (dto, input) => { calls.push(['phone', dto, input]); return phone(); },
    toggleBlocked: dto => calls.push(['status', dto]), copy: code => calls.push(['copy', code]), regenerate: () => calls.push('regen'),
    viewItems: () => calls.push('view'), addItem: () => calls.push('add'), requestRemove: () => calls.push('remove'),
    promptIsCurrent: prompt => valid && state.removePrompt === prompt,
    dismissRemove: prompt => { if (valid && state.removePrompt === prompt) { calls.push(['dismiss', prompt]); state.removePrompt = null; } },
    confirmRemove: prompt => { if (valid && state.removePrompt === prompt) { calls.push(['confirm', prompt]); return confirming(); } },
  };
  return { model: result, calls, focus: value => { focused = value; }, valid: value => { valid = value; }, phone: value => { phone = value; }, confirm: value => { confirming = value; } };
}
const modifier = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const colors = { surface: '#FFFFFFFF', surfaceContainerLow: '#EEEEEEFF', surfaceContainerHigh: '#CCCCCCFF', surfaceContainerHighest: '#DDDDDDFF', secondaryContainer: '#BBBBBBFF',
  onSecondaryContainer: '#111111FF', onSurface: '#111111FF', onSurfaceVariant: '#666666FF', primary: '#334455FF', outlineVariant: '#888888FF', errorContainer: '#FFBBBBFF', onErrorContainer: '#770000FF' };
function view(platform, value, r = runtime()) {
  const components = (name, slots = {}) => Object.assign(function Native(props) { return { type: name, props }; }, slots);
  const nativeState = initial => { const state = r.react.useRef(null); return state.current ??= { value: initial, writes: [], get() { return this.value; }, set(value) { this.value = value; this.writes.push(value); } }; };
  const compose = new Proxy({ Shape: { RoundedCorner: value => value }, useNativeState: nativeState,
    BasicTextField: components('BasicTextField', { DecorationBox: 'DecorationBox', InnerTextField: 'InnerTextField', Placeholder: 'Placeholder' }),
    TopAppBar: components('TopAppBar', { Title: 'TopAppBar.Title', NavigationIcon: 'TopAppBar.NavigationIcon', Actions: 'TopAppBar.Actions' }) }, { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({ useNativeState: nativeState }, { get: (target, name) => target[name] ?? String(name) });
  const transition = { duration: () => transition, easing: () => transition }, shared = hooks(r);
  const mocks = { './AdminTopBar.android': require('./support/adminChrome.cjs'), react: r.react, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': swift,
    '@expo/ui/swift-ui/modifiers': new Proxy({ Animation: { easeOut: value => value } }, { get: (target, name) => target[name] ?? modifier[name] }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'RN.ScrollView', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute' } }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-reanimated': { View: 'Animated.View', default: { View: 'Animated.View' }, LinearTransition: transition, Easing: { cubic: 'cubic', out: value => value },
      useSharedValue: value => r.react.useRef({ value }).current, useAnimatedStyle: callback => callback(), withTiming: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(colors), './AdminTypography.android': { AdminText: 'Text' }, './AdminTextFields.android': { AdminBasicTextField: compose.BasicTextField, AdminOutlinedTextField: compose.OutlinedTextField }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    '../shared/localization': s.l10n, './dartJsonString': s.strings, './useAdminSupplierDetail': { ...shared, useAdminSupplierDetail: () => value } };
  const exports = compile(path.resolve(__dirname, `../src/admin/AdminSupplierDetailScreen.${platform}.tsx`), mocks);
  const avatars = [], props = { profileAction: { type: 'ActualProfileAction', props: {} }, footer: { type: 'ActualDock', props: {} }, chatAction: { type: 'ActualChatAction', props: {} }, backLabel: 'Orqaga',
    renderAvatar: value => { avatars.push(value); return { type: 'ActualAvatar', props: value }; } };
  return { ...exports, runtime: r, avatars, props, render: () => r.render(() => expand(exports.AdminSupplierDetailScreen(props))) };
}
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const byId = (tree, id) => nodes(tree, node => node.props.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
const click = (node, platform) => node.props[platform === 'android' ? 'onClick' : 'onPress']();
const texts = tree => nodes(tree, node => node.type === 'Text').map(node => node.props.children);
module.exports = { ...s, strict, AdminSupplierDetailController, runtime, hooks, detail, model, view, expand, nodes, byId, click, texts, colors, compile };
