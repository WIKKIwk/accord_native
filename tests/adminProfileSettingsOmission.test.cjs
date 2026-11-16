/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const tick = () => new Promise(resolve => setImmediate(resolve));
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate)); if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const settings = tree => nodes(tree, node => node.type === 'ProfileSettings');
const settingsSheet = tree => nodes(tree, node => node.type === 'BottomSheet' && settings(node).length)[0];
const registration = tree => nodes(tree, node => typeof node.type === 'function' && node.type.name === 'SettingsOpenerRegistration')[0];
function fixture(platform, overrides = {}) {
  const hooks = [], calls = [], sheets = [], alerts = []; let cursor = 0, pending = [], reads = 0, removed = 0, registered;
  const same = (l, r) => !!l && !!r && l.length === r.length && l.every((value, i) => value === r[i]);
  const memo = (fn, deps) => { const i = cursor++, old = hooks[i]; if (!old || !same(old.deps, deps)) hooks[i] = { deps, value: fn() }; return hooks[i].value; };
  const effect = (fn, deps) => { const i = cursor++, old = hooks[i]; if (!old || !same(old.deps, deps)) { const entry = { deps, create: fn, cleanup: old?.cleanup }; hooks[i] = entry; pending.push(() => { entry.cleanup?.(); entry.cleanup = fn(); }); } };
  const react = { useCallback: (fn, deps) => memo(() => fn, deps), useMemo: memo, useRef: value => memo(() => ({ current: value }), []), useLayoutEffect: effect, useEffect: effect,
    useState: value => { const slot = memo(() => ({ value: typeof value === 'function' ? value() : value }), []); return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; }, useSyncExternalStore: (_subscribe, get) => get() };
  const ui = new Proxy({ FieldGroup: Object.assign(() => {}, { Section: 'FieldSection' }), useNativeState: initial => memo(() => ({ value: initial, set(value) { this.value = value; } }), []) }, { get: (target, name) => target[name] ?? String(name) });
  const modifiers = new Proxy({ shapes: { rectangle: () => ({}), circle: () => ({}) } }, { get: (target, name) => target[name] ?? (() => ({})) });
  const store = { has: async () => { reads++; return overrides.read ? overrides.read() : false; }, save: async () => { throw Error('No test PIN write was authorized'); }, clear: async () => { throw Error('No test PIN removal was authorized'); } };
  const core = load('components/useSwitchPinSetupCore.ts', { react, 'react-native': { Alert: { alert: (...args) => alerts.push(args) } }, '../shared/switchPinRuntime': { switchPinStore: store } });
  const locale = { useBaseLocale: () => ({ text: key => key }) };
  const pin = load('components/useSwitchPinSetup.ios.ts', { '@expo/ui/swift-ui': ui, './useBaseLocale.ios': locale, './useSwitchPinSetupCore': core });
  const nativeSheet = () => memo(() => {
    const state = { content: null, options: null, visible: false }, value = { state, isOpen: () => state.visible,
      open: (content, options) => { calls.push('sheet-open'); state.content = content; state.options = options; state.visible = true; },
      update: (content, options) => { calls.push(content === null ? 'sheet-clear' : 'sheet-update'); state.content = content; if (options) state.options = options; },
      close: () => { calls.push('sheet-close'); } }; sheets.push(value); return value;
  }, []);
  const View = load(`components/ProfileView.${platform}.tsx`, { react, 'expo-router': { useFocusEffect: fn => effect(fn, [fn]) }, '@expo/ui': ui, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: () => ({}) }, 'react-native': { PlatformColor: value => value, Alert: { alert: (...args) => alerts.push(args) } },
    '../profileModel': { profileDisplay: () => ({ name: 'Name', role: 'Role', legalName: '', phone: '', apparatusLabels: [] }) }, '../nativeSheet': { useNativeSheet: nativeSheet },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } },
    '../shared/themeRuntime': { themeController: { setThemeMode: async () => { calls.push('appearance'); } } }, './BaseHost': { BaseHost: 'Host' }, './useBaseLocale.ios': locale,
    './useSwitchPinSetup.ios': pin, './ProfileSettings': { ProfileSettings: 'ProfileSettings' }, './ProfileSettings.ios': { ProfileSettings: 'ProfileSettings' } }).ProfileView;
  const props = { session: { profile: { role: 'admin' } }, snapshot: { profile: {} }, editing: false, busy: false, showDirectLogout: false,
    onRefresh: async () => {}, onOpenEditor() {}, onCloseEditor() {}, onLogout: () => calls.push('logout'), onDailyWork: () => calls.push('daily'),
    registerSettingsOpener: open => { registered = open; return () => { removed++; }; }, ...overrides.props };
  const render = () => { cursor = 0; pending = []; const tree = View(props), child = registration(tree); if (child) child.type(child.props); pending.splice(0).forEach(fn => fn()); return tree; };
  const cleanup = () => hooks.forEach(slot => slot?.cleanup?.()), replay = () => { cleanup(); hooks.forEach(slot => { if (slot?.create) slot.cleanup = slot.create(); }); };
  return { props, render, calls, sheets, alerts, cleanup, replay, reads: () => reads, registered: () => registered, removed: () => removed };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Admin disabled Settings omits action, invented notice, unsafe subtree and opener while retaining real daily work`, async t => {
    const f = fixture(platform, { props: { settingsDisabled: true, settingsUnavailableMessage: 'Must not appear' } }); t.after(f.cleanup); const tree = f.render(); await tick();
    assert.equal(settings(tree).length, 0); assert.equal(registration(tree), undefined); assert.equal(f.reads(), 0); assert.equal(f.registered(), undefined); assert.deepEqual(f.calls, []);
    assert.equal(nodes(tree, node => node.props?.testID === 'profile-settings' || node.props?.children === 'Must not appear').length, 0);
    const daily = nodes(tree, node => node.props?.label === 'Kunlik ish' || node.props?.title === 'Kunlik ish')[0]; assert.ok(daily); daily.props.onPress(); assert.deepEqual(f.calls, ['daily']);
  });
  test(`${platform} undefined/false keep legacy settings, while unavailable-message opt-in still shows its original text`, async t => {
    for (const disabled of [undefined, false]) { const f = fixture(platform, { props: { settingsDisabled: disabled } }); t.after(f.cleanup); const tree = f.render(); await tick();
      if (platform === 'android') { nodes(tree, node => node.props?.testID === 'profile-settings')[0].props.onPress(); assert.equal(settings(f.sheets[1].state.content).length, 1); }
      else { assert.equal(settings(tree).length, 1); assert.equal(f.reads(), 1); assert.equal(typeof f.registered(), 'function'); }
    }
    const f = fixture(platform, { props: { settingsUnavailableMessage: 'Legacy notice' } }); t.after(f.cleanup); const tree = f.render(); await tick(); assert.equal(nodes(tree, node => node.props?.children === 'Legacy notice').length, 1); assert.equal(settings(tree).length, 0); assert.equal(f.reads(), 0);
  });
  test(`${platform} disabling an open Settings removes it immediately and captured open/dismiss callbacks cannot reopen or disconnect`, async t => {
    const f = fixture(platform); t.after(f.cleanup); let tree = f.render(); await tick(); let open, presented, oldDismiss, logout;
    if (platform === 'android') { open = nodes(tree, node => node.props?.testID === 'profile-settings')[0].props.onPress; open(); const sheet = f.sheets[1]; oldDismiss = sheet.state.options.onDismiss; logout = settings(sheet.state.content)[0].props.onLogout; logout(); }
    else { const sheet = settingsSheet(tree); open = sheet.props.anchor.props.onPress; presented = sheet.props.onIsPresentedChange; open(); tree = f.render(); assert.equal(settingsSheet(tree).props.isPresented, true); }
    f.props.settingsDisabled = true; tree = f.render(); assert.equal(settings(tree).length, 0); assert.equal(registration(tree), undefined); const before = f.calls.length; open(); presented?.(true); f.registered()?.(); logout?.(); oldDismiss?.();
    assert.equal(f.calls.length, before); assert.deepEqual(f.alerts, []); if (platform === 'android') { assert.equal(f.sheets[1].state.content, null); assert.deepEqual(f.calls.slice(-2), ['sheet-clear', 'sheet-close']); }
    f.props.settingsDisabled = false; tree = f.render(); if (platform === 'ios') assert.equal(settingsSheet(tree).props.isPresented, false); assert.equal(f.calls.includes('logout'), false);
  });
}
test('disabled iOS settings skips reads across StrictMode replay and suppresses an old pending PIN-read failure after disable', async t => {
  const disabled = fixture('ios', { props: { settingsDisabled: true } }); t.after(disabled.cleanup); disabled.render(); disabled.replay(); await tick(); assert.equal(disabled.reads(), 0); assert.deepEqual(disabled.alerts, []); assert.equal(disabled.registered(), undefined);
  let reject; const f = fixture('ios', { read: () => new Promise((_resolve, failure) => { reject = failure; }) }); t.after(f.cleanup); f.render(); assert.equal(f.reads(), 1); f.props.settingsDisabled = true; f.render(); reject(Error('Retired PIN read')); await tick(); assert.deepEqual(f.alerts, []); assert.equal(settings(f.render()).length, 0);
});
test('ProfileScreen forwards Settings omission only when requested and leaves the original message/default contract intact', () => {
  const react = { useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }), useState: value => [typeof value === 'function' ? value() : value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
  const Screen = load('components/ProfileScreen.tsx', { react, 'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { useFocusEffect() {} },
    'react-native': { Platform: { OS: 'ios' }, Alert: {}, AppState: {} }, '../auth': { activeSessionToken: () => null },
    '../profileModel': { initialProfileSnapshot: () => ({ profile: {} }), profileDisplay: () => ({}) }, '../shared/profileAvatarRuntime': { cachedProfileAvatar: () => null },
    '../shared/localization/runtime': { localeController: { locale: 'en', addListener() {} } }, './ProfileView': { ProfileView: 'ProfileView' } }).ProfileScreen;
  for (const settingsDisabled of [undefined, false, true]) { const wrapper = Screen({ session: { imageCacheScope: 'same', profile: {} }, onLogout() {}, settingsDisabled, settingsUnavailableMessage: 'Legacy notice' }), view = wrapper.type(wrapper.props); assert.equal(view.props.settingsDisabled, settingsDisabled); assert.equal(view.props.settingsUnavailableMessage, 'Legacy notice'); }
});
