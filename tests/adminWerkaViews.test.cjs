/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const { l10n, strings, deferred, flush } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const colors = { surface: '#FFFFFFFF', surfaceContainerLow: '#EEEEEEFF', surfaceContainerHigh: '#CCCCCCFF', surfaceContainerHighest: '#DDDDDDFF', secondaryContainer: '#BBBBBBFF',
  onSecondaryContainer: '#111111FF', onSurface: '#111111FF', onSurfaceVariant: '#666666FF', primary: '#334455FF' };
function hookRuntime() {
  let cursor = 0, pending = [];
  const slots = [], cleanups = new Map(), counters = { writes: 0 };
  const effect = (callback, deps) => {
    const index = cursor++, old = slots[index];
    if (!old || !deps || deps.some((value, i) => !Object.is(value, old[i]))) {
      slots[index] = deps; pending.push(() => { cleanups.get(index)?.(); cleanups.set(index, callback()); });
    }
  };
  const react = {
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { counters.writes++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useEffect: effect, useLayoutEffect: effect,
  };
  return { react, counters, render(callback) { cursor = 0; pending = []; const tree = callback(); pending.forEach(fn => fn()); return tree; },
    unmount() { [...cleanups.values()].reverse().forEach(cleanup => cleanup?.()); cleanups.clear(); } };
}
function nativeState(react) {
  return initial => {
    const state = react.useRef(null);
    if (!state.current) state.current = { value: initial, writes: [], get() { return this.value; }, set(value) { this.value = value; this.writes.push(value); } };
    return state.current;
  };
}
function load(platform, model, runtime = hookRuntime()) {
  const native = (name, slots = {}) => Object.assign(function Component(props) { return { type: name, props }; }, slots);
  const compose = new Proxy({ Shape: { RoundedCorner: value => value }, useNativeState: nativeState(runtime.react),
    BasicTextField: native('BasicTextField', { DecorationBox: 'DecorationBox', InnerTextField: 'InnerTextField', Placeholder: 'Placeholder' }),
    TopAppBar: native('TopAppBar', { Title: 'TopAppBar.Title', NavigationIcon: 'TopAppBar.NavigationIcon', Actions: 'TopAppBar.Actions' }) }, { get: (target, name) => target[name] ?? String(name) });
  const swift = new Proxy({ useNativeState: nativeState(runtime.react) }, { get: (target, name) => target[name] ?? String(name) });
  const transition = { duration: () => transition, easing: () => transition };
  const mocks = { react: runtime.react, 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': new Proxy({ Animation: { easeOut: value => value } }, { get: (target, name) => target[name] ?? modifiers[name] }),
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    'react-native': { View: 'View', ScrollView: 'RN.ScrollView', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) },
    'react-native-reanimated': { View: 'Animated.View', default: { View: 'Animated.View' }, LinearTransition: transition, Easing: { out: value => value, cubic: 'cubic' },
      useSharedValue: value => runtime.react.useRef({ value }).current, useAnimatedStyle: callback => callback(), withTiming: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminShellBodyFrame': require('./adminShellFrameViewSupport.cjs').frameModule(colors), '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' },
    '../shared/localization': l10n, '../shared/localization/runtime': { localeController: { locale: 'uz' } }, './dartJsonString': strings,
    './useAdminWerka': { useAdminWerka: () => model } };
  const filename = path.resolve(__dirname, `../src/admin/AdminWerkaScreen.${platform}.tsx`), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { ...mod.exports, runtime };
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
function byId(tree, id) { return nodes(tree, node => node.props.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0]; }
function click(node, platform) { return node.props[platform === 'android' ? 'onClick' : 'onPress'](); }
function text(tree) { return nodes(tree, node => node.type === 'Text').map(node => node.props.children); }
function createModel(patch = {}) {
  let current = true, focused = true, save = async () => true;
  const calls = [], fields = { name: 'Old Name', phone: ' 998 old ' };
  const state = { phase: 'content', fields, fillVersion: 1, avatarUrl: 'https://images.example/real.png', code: ' raw code ', seconds: 9,
    saving: false, regenerating: false, expanded: true, changed: false, copiedNotice: null, ...patch };
  const model = { state, fields, generation: 1, displayName: 'Old Name', initials: 'ON', current: () => current, interactive: () => current && focused,
    a: (key, values) => l10n.adminText(key, 'uz', values), t: key => l10n.localizedGetter(key, 'uz'),
    back: () => { if (current && focused) calls.push(['back', state.changed]); }, toggle: () => { if (current && focused) calls.push('toggle'); },
    changeName: value => { if (current && focused) { fields.name = value; calls.push(['name', value]); } },
    changePhone: value => { if (current && focused) { fields.phone = value; calls.push(['phone', value]); } },
    reload: () => { if (current && focused) calls.push('reload'); }, save: async () => { if (!current || !focused) return false; calls.push('save'); return save(); },
    regenerate: () => { if (current && focused) calls.push('regenerate'); }, copy: () => { if (current && focused) calls.push(['copy', state.code]); } };
  return { model, calls, retire: () => { current = false; }, focus: value => { focused = value; }, save: value => { save = value; } };
}
function screen(platform, f, withChat = true) {
  const module = load(platform, f.model), avatars = [];
  const props = { backLabel: 'Orqaga', onBack() {}, footer: { type: 'ActualDock', props: {} }, profileAction: { type: 'ActualProfileAccountAction', props: {} }, chatAction: withChat ? { type: 'ActualChatAction', props: {} } : undefined,
    renderAvatar: value => { avatars.push(value); return { type: 'ActualGuardedAvatar', props: value }; } };
  const tree = module.runtime.render(() => expand(module.AdminWerkaScreen(props)));
  return { tree, avatars };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Werka preserves source identity/avatar/chat/dock and collapsed controls are destroyed`, () => {
    const f = createModel({ expanded: false }), { tree, avatars } = screen(platform, f);
    assert.equal(avatars.length, 1); assert.equal(avatars[0].size, 92); assert.equal(avatars[0].avatarUrl, f.model.state.avatarUrl);
    assert.equal(avatars[0].fallbackText, 'ON'); assert.equal(avatars[0].displayName, 'ON', 'source preview title defaults to initials'); assert.equal(avatars[0].isCurrent, f.model.current); assert.equal(avatars[0].canInteract, f.model.interactive);
    assert.equal(nodes(tree, node => node.type === 'ActualChatAction').length, 1); assert.equal(nodes(tree, node => node.type === 'ActualDock').length, 1);
    const dockHost = nodes(tree, node => node.type === 'View' && node.props.children?.type === 'ActualDock')[0];
    assert.equal(dockHost.props.style.position, 'absolute'); assert.equal(dockHost.props.style.bottom, 0, 'Scaffold.extendBody retains the full scroll viewport behind the genuine dock');
    if (platform === 'android') assert.equal(nodes(tree, node => node.type === 'ActualProfileAccountAction').length, 1);
    else assert.equal(nodes(tree, node => node.type === 'Stack.Screen')[0].props.options.headerRight().type, 'ActualProfileAccountAction');
    assert.equal(byId(tree, 'admin-werka-detail-name-input'), undefined); assert.equal(byId(tree, 'admin-werka-detail-phone-input'), undefined);
    assert.equal(byId(tree, 'admin-werka-detail-save'), undefined); click(byId(tree, 'admin-werka-detail-admin-toggle'), platform); assert.deepEqual(f.calls, ['toggle']);
    assert.ok(text(tree).includes(f.model.a('profile.ready'))); assert.ok(text(tree).includes(f.model.a('profile.warehouse_worker')));
    assert.equal(nodes(screen(platform, f, false).tree, node => node.type === 'ActualChatAction').length, 0);
  });
  test(`${platform} Werka saving/regenerating stay independent of countdown and raw code is delegated unchanged`, () => {
    const f = createModel({ saving: true, seconds: 999 }), { tree } = screen(platform, f);
    const save = byId(tree, 'admin-werka-detail-save'), phone = byId(tree, 'admin-werka-detail-phone-action'), regen = byId(tree, 'admin-werka-detail-regenerate-code');
    const disabled = node => platform === 'android' ? node.props.enabled === false : node.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0]);
    assert.ok(disabled(save)); assert.ok(disabled(phone)); assert.equal(disabled(regen), false);
    click(regen, platform); click(byId(tree, 'admin-werka-detail-copy-code'), platform); assert.deepEqual(f.calls, ['regenerate', ['copy', ' raw code ']]);
    if (platform === 'ios') assert.equal(nodes(byId(tree, 'admin-werka-detail-copy-code'), node => node.type === 'Image' && node.props.systemName === 'document.on.document').length, 1);
    assert.ok(text(tree).includes(f.model.a('profile.code_wait', { seconds: 999 }))); assert.ok(text(tree).includes(f.model.a('profile.code_copy_hint')));
    f.model.state.saving = false; f.model.state.regenerating = true; const other = screen(platform, f).tree;
    assert.equal(disabled(byId(other, 'admin-werka-detail-save')), false); assert.ok(disabled(byId(other, 'admin-werka-detail-regenerate-code')));
    const empty = screen(platform, createModel({ code: '  ', seconds: 0 })).tree;
    assert.equal(byId(empty, 'admin-werka-detail-copy-code'), undefined); assert.ok(text(empty).includes(f.model.a('profile.code_not_shown')));
    assert.equal(text(empty).includes(f.model.a('profile.code_copy_hint')), false);
  });
  test(`${platform} Werka loading/error do not request an avatar and preserve retry/back changed result`, () => {
    const loading = screen(platform, createModel({ phase: 'loading' })); assert.equal(loading.avatars.length, 0);
    if (platform === 'android') { const indicator = nodes(loading.tree, node => node.type === 'LoadingIndicator')[0];
      assert.ok(indicator.props.modifiers.some(mod => mod.name === 'size' && mod.args[0] === 48 && mod.args[1] === 48));
      assert.equal(nodes(loading.tree, node => node.type === 'CircularProgressIndicator').length, 0); }
    const f = createModel({ phase: 'error', changed: true }), retry = screen(platform, f); assert.equal(retry.avatars.length, 0);
    assert.ok(text(retry.tree).includes(f.model.t('serverDisconnectedRetry'))); click(byId(retry.tree, 'admin-werka-retry'), platform);
    if (platform === 'android') click(byId(retry.tree, 'admin-werka-back'), platform);
    else {
      const options = nodes(retry.tree, node => node.type === 'Stack.Screen')[0].props.options;
      assert.equal(options.gestureEnabled, false); assert.equal(options.headerBackVisible, false);
      click(byId(expand(options.headerLeft()), 'admin-werka-back'), platform);
    }
    assert.deepEqual(f.calls, ['reload', ['back', true]]); f.retire(); assert.equal(screen(platform, f).tree, null);
  });
  test(`${platform} native Werka name buffers hydrate only on fillVersion and detached/blurred edits cannot mutate`, () => {
    const f = createModel(), module = load(platform, f.model), render = () => module.runtime.render(() => expand(module.NativeWerkaNameField({ model: f.model })));
    let field = byId(render(), 'admin-werka-detail-name-input'), native = field.props[platform === 'android' ? 'value' : 'text'];
    native.set('Local draft'); field.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Local draft');
    f.model.fields = { ...f.model.fields, name: 'Parent repaint' }; f.model.state.seconds--; render();
    assert.equal(native.get(), 'Local draft'); assert.deepEqual(native.writes, ['Local draft']);
    f.model.state.fillVersion++; f.model.fields = { ...f.model.fields, name: 'New fill' }; render(); assert.equal(native.get(), 'New fill');
    f.focus(false); field.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Blurred'); assert.equal(f.calls.length, 1);
    f.focus(true); module.runtime.unmount(); field.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('Detached'); assert.equal(f.calls.length, 1);
  });
  test(`${platform} native phone submit closes only on success and retired editor callbacks cannot resave or type`, async () => {
    const f = createModel(), module = load(platform, f.model), render = () => module.runtime.render(() => expand(module.NativeWerkaPhoneField({ model: f.model })));
    let tree = render(); click(byId(tree, 'admin-werka-detail-phone-action'), platform); tree = render();
    const field = byId(tree, 'admin-werka-detail-phone-input'), native = field.props[platform === 'android' ? 'value' : 'text'];
    assert.equal(field.props.autoFocus, true); native.set(' draft phone '); field.props[platform === 'android' ? 'onValueChange' : 'onTextChange'](' draft phone ');
    const submitted = platform === 'android' ? field.props.keyboardActions.onDone : field.props.modifiers.find(mod => mod.name === 'onSubmit').args[0];
    await f.model.save(); assert.ok(byId(render(), 'admin-werka-detail-phone-input'), 'the separate full-save action does not end inline editing');
    f.save(async () => false); submitted(); await flush(); assert.ok(byId(render(), 'admin-werka-detail-phone-input'), 'failed save retains inline editor');
    f.save(async () => true); submitted(); await flush(); assert.equal(byId(render(), 'admin-werka-detail-phone-input'), undefined);
    const count = f.calls.length; field.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('stale text'); submitted(); await flush();
    assert.equal(f.calls.length, count, 'callbacks from the disposed native input cannot mutate or send again');
    click(byId(render(), 'admin-werka-detail-phone-action'), platform); const reopened = byId(render(), 'admin-werka-detail-phone-input');
    assert.ok(reopened); assert.equal(reopened.props[platform === 'android' ? 'value' : 'text'].get(), ' draft phone ');
    submitted(); await flush(); assert.equal(f.calls.length, count, 'old input cannot submit a later editor');
  });
  test(`${platform} native phone original pending completion and input callbacks cannot affect a collapsed/reopened owner`, async () => {
    const f = createModel(), pending = deferred(); f.save(() => pending.promise);
    const module = load(platform, f.model), render = () => module.runtime.render(() => expand(module.NativeWerkaPhoneField({ model: f.model })));
    click(byId(render(), 'admin-werka-detail-phone-action'), platform); const oldTree = render(), oldInput = byId(oldTree, 'admin-werka-detail-phone-input');
    oldInput.props[platform === 'android' ? 'onValueChange' : 'onTextChange'](' retained draft ');
    click(byId(oldTree, 'admin-werka-detail-phone-action'), platform); module.runtime.unmount(); const oldWrites = module.runtime.counters.writes;
    const fresh = load(platform, f.model), freshRender = () => fresh.runtime.render(() => expand(fresh.NativeWerkaPhoneField({ model: f.model })));
    assert.equal(byId(freshRender(), 'admin-werka-detail-phone-input'), undefined, 'collapse destroys editing mode without clearing the shared draft');
    click(byId(freshRender(), 'admin-werka-detail-phone-action'), platform); const freshInput = byId(freshRender(), 'admin-werka-detail-phone-input');
    assert.ok(freshInput); assert.equal(freshInput.props[platform === 'android' ? 'value' : 'text'].get(), ' retained draft ');
    oldInput.props[platform === 'android' ? 'onValueChange' : 'onTextChange']('detached text'); pending.resolve(true); await flush();
    assert.equal(module.runtime.counters.writes, oldWrites); assert.ok(byId(freshRender(), 'admin-werka-detail-phone-input')); assert.deepEqual(f.calls, [['phone', ' retained draft '], 'save']);
    f.retire(); click(byId(freshRender(), 'admin-werka-detail-phone-action'), platform); assert.equal(f.calls.length, 2);
  });
}
test('Android Werka keeps source header/action geometry and physical placement', () => {
  const f = createModel(), { tree } = screen('android', f), views = nodes(tree, node => node.type === 'View');
  assert.ok(views.some(view => view.props.style?.height === 204));
  assert.ok(views.some(view => view.props.style?.height === 112 && view.props.style?.backgroundColor === '#000000'));
  assert.ok(views.some(view => view.props.style?.left === 16 && view.props.style?.top === 74 && view.props.style?.width === 92));
  assert.ok(views.some(view => view.props.style?.left === 124 && view.props.style?.top === 140));
  const save = byId(tree, 'admin-werka-detail-save'); assert.ok(save.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 54));
  const bar = nodes(tree, node => node.type === 'TopAppBar')[0]; assert.equal(bar.props.colors.containerColor, colors.surfaceContainerHigh);
  assert.ok(bar.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 60));
  assert.deepEqual(save.props.shape.cornerRadii, { topStart: 14, topEnd: 14, bottomStart: 14, bottomEnd: 14 });
  assert.ok(byId(tree, 'admin-werka-detail-phone-action').props.modifiers.some(mod => mod.name === 'size' && mod.args[0] === 32 && mod.args[1] === 32));
  const list = nodes(tree, node => node.type === 'RN.ScrollView')[0]; assert.equal(list.props.contentContainerStyle.padding, 4); assert.equal(list.props.contentContainerStyle.paddingBottom, 116);
});
