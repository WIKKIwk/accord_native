const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function hooks() {
  const slots = [], effects = [];
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const api = {
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i];
      if (same(previous?.deps, deps)) return;
      slots[i] = { deps };
      effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
    },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  };
  return { api, render(fn) { cursor = 0; const result = fn(); effects.splice(0).forEach(run => run()); return result; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const accounts = ['current', 'protected', 'other'].map(id => ({ id, base_url: 'https://erp.test', profile: { ref: id, display_name: id } }));

function modelHarness() {
  const react = hooks(), calls = [], initial = { baseUrl: 'https://erp.test', token: 'current-token', imageCacheScope: 'old' };
  const state = { session: initial, protected: true, pinFailure: false, switchFailure: false, hasWait: null, switchWait: null, controllerWait: null };
  let back;
  const field = { value: '', get() { return this.value; }, set(value) { this.value = value; } };
  const controller = { async switchTo(id) {
    calls.push(['switch', id]);
    if (state.switchWait) await state.switchWait.promise;
    if (state.switchFailure) throw new Error('Offline');
    state.session = { baseUrl: 'https://erp.test', token: `${id}-token`, imageCacheScope: id };
  } };
  const props = { onEmpty: () => calls.push(['empty']), onSwitched: session => calls.push(['switched', session]), onAddAccount: () => calls.push(['add']) };
  const { useAccountSwitcher } = load('components/useAccountSwitcher.ts', {
    react: react.api,
    'react-native': { Platform: { OS: 'android' }, BackHandler: { addEventListener: (_name, handler) => { back = handler; return { remove() { back = undefined; } }; } } },
    '../auth': { loadSession: async () => state.session, activeSessionToken: session => session === state.session ? session.token : null,
      createRuntimeAccountSwitchController: async baseUrl => { calls.push(['controller', baseUrl]); if (state.controllerWait) await state.controllerWait.promise; return controller; } },
    '../savedAccountRuntime': { initializeSavedAccounts: async endpoint => { calls.push(['load', endpoint]); return { accountsForEndpoint: endpoint => {
      calls.push(['accounts', endpoint]); return accounts;
    }, activeAccountId: 'current' }; } },
    '../shared/switchPinRuntime': { switchPinStore: {
      async has(account) { if (state.hasWait) await state.hasWait.promise; if (state.pinFailure) throw new Error('Storage unavailable'); return account.profile.ref === 'protected' && state.protected; },
      async verify(account, pin) { calls.push(['verify', account.profile.ref, pin]); return pin === '1234'; },
    } },
    '../shared/localization': { localizedGetter: key => key, localizedMethod: (key, _locale, args) => `${key}:${args.name}` },
    '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    '../shared/accountEntryLogic': { savedAccountDisplayName: account => account.profile.display_name },
  });
  const render = () => react.render(() => useAccountSwitcher(field, props));
  return { state, calls, field, render, unmount: react.unmount, back: () => back?.(),
    ready: async () => { render(); await flush(); return render(); } };
}

test('saved-account chooser uses the current endpoint and ignores the active account', async () => {
  const h = modelHarness(), model = await h.ready();
  assert.equal(model.loading, false); assert.equal(model.activeId, 'current'); assert.equal(model.pins.protected, true);
  assert.deepEqual(h.calls.slice(0, 2), [['load', 'https://erp.test'], ['accounts', 'https://erp.test']]);
  await model.select(accounts[0]);
  assert.equal(h.calls.some(([kind]) => kind === 'controller'), false);
});

test('a protected account verifies four digits before switching; wrong PIN clears the input', async () => {
  const h = modelHarness(); let model = await h.ready();
  await model.select(accounts[1]); model = h.render();
  assert.equal(model.target.id, 'protected'); assert.equal(model.pinPrompt, 'accountPinPrompt:protected');
  assert.equal(h.calls.some(([kind]) => kind === 'switch'), false);
  model.changePin('99x99extra'); assert.equal(h.field.value, '9999');
  await model.verify(); model = h.render();
  assert.equal(model.error, 'pinWrong'); assert.equal(h.field.value, '');
  assert.equal(h.calls.some(([kind]) => kind === 'switch'), false);
  await model.verify('1234');
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'switch'), [['switch', 'protected']]);
  assert.equal(h.calls.find(([kind]) => kind === 'switched')[1], h.state.session);
});

test('PIN back returns to the list, and busy actions cannot start another switch or add account', async () => {
  const h = modelHarness(); let model = await h.ready();
  await model.select(accounts[1]); model = h.render(); model.changePin('12');
  h.back(); model = h.render(); assert.equal(model.target, null); assert.equal(h.field.value, '');
  h.state.switchWait = deferred();
  const first = model.select(accounts[2]); await flush(); model = h.render();
  assert.equal(model.busy, true); model.addAccount(); await model.select(accounts[1]);
  assert.deepEqual(h.calls.filter(([kind]) => kind === 'switch'), [['switch', 'other']]);
  assert.equal(h.calls.some(([kind]) => kind === 'add'), false);
  h.state.switchWait.resolve(); await first;
});

test('selection checks PIN storage again and fails closed when it cannot be read', async () => {
  const h = modelHarness(), model = await h.ready();
  h.state.pinFailure = true; await model.select(accounts[2]);
  assert.equal(h.render().error, 'accountSwitchFailed');
  assert.equal(h.calls.some(([kind]) => kind === 'switch'), false);
  const failedLoad = modelHarness(); failedLoad.state.pinFailure = true;
  const failed = await failedLoad.ready();
  assert.equal(failed.ready, false); assert.equal(failed.error, 'accountSwitchFailed');
  failed.addAccount(); assert.equal(failedLoad.calls.some(([kind]) => kind === 'add'), false);
});

test('a switch failure preserves the screen and can be retried', async () => {
  const h = modelHarness(), model = await h.ready();
  h.state.switchFailure = true; await model.select(accounts[2]);
  assert.equal(h.render().error, 'accountSwitchFailed'); assert.equal(h.render().busy, false);
  assert.equal(h.calls.some(([kind]) => kind === 'switched'), false);
  h.state.switchFailure = false; await h.render().select(accounts[2]);
  assert.equal(h.calls.filter(([kind]) => kind === 'switched').length, 1);
});

test('dismissing before a switch starts cancels it; a switch already committed still replaces the old role', async () => {
  const canceled = modelHarness(), model = await canceled.ready(); canceled.state.controllerWait = deferred();
  const selecting = model.select(accounts[2]); await flush(); canceled.unmount();
  canceled.state.controllerWait.resolve(); await selecting;
  assert.equal(canceled.calls.some(([kind]) => kind === 'switch'), false);
  const committed = modelHarness(), next = await committed.ready(); committed.state.switchWait = deferred();
  const switching = next.select(accounts[2]); await flush(); committed.unmount(); committed.state.switchWait.resolve(); await switching;
  assert.equal(committed.calls.filter(([kind]) => kind === 'switched').length, 1);
});

test('an obsolete chooser cannot activate an account after its source session changed', async () => {
  const h = modelHarness(), model = await h.ready();
  h.state.session = { ...h.state.session, token: 'different' };
  await model.select(accounts[2]);
  assert.equal(h.render().error, 'accountSwitchFailed'); assert.equal(h.calls.some(([kind]) => kind === 'switch'), false);
});

function launcherHarness() {
  const react = hooks(), calls = [];
  let entry = null;
  const sheet = { isOpen: () => !!entry, open(content, options) { calls.push('open'); entry = { content, options }; }, close() { calls.push('close'); } };
  const { useAccountSwitcherLauncher } = load('components/useAccountSwitcherLauncher.tsx', {
    react: react.api, 'expo-haptics': { ImpactFeedbackStyle: { Medium: 'medium' }, impactAsync: async kind => calls.push(kind) },
    'expo-router': { router: { push: route => calls.push(['push', route]) } },
    '../nativeSheet': { useNativeSheet: () => sheet }, './AccountSwitcher': { AccountSwitcher: 'AccountSwitcher' },
    './useAccountHome': { useAccountHome: () => session => calls.push(['home', session]) },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz' } },
  });
  const launcher = react.render(() => useAccountSwitcherLauncher(() => calls.push('profile')));
  return { calls, launcher, entry: () => entry, dismiss() { const current = entry; entry = null; current.options.onDismiss(); } };
}

test('long press opens one native sheet, gives feedback and suppresses the short-tap release', () => {
  const h = launcherHarness(); h.launcher.onPress(); assert.deepEqual(h.calls, ['profile']);
  h.launcher.open(); h.launcher.open(); h.launcher.onPress();
  assert.deepEqual(h.calls, ['profile', 'open', 'medium']);
  assert.equal(h.entry().options.dismissible, true); assert.equal(h.launcher.hint, 'accountSwitchHint');
  h.dismiss(); h.launcher.onPress(); assert.equal(h.calls.at(-1), 'profile');
});

test('switch and add-account navigation run after the chooser is removed, and cancel does not navigate', () => {
  const h = launcherHarness(), session = { imageCacheScope: 'new' };
  h.launcher.open(); h.entry().content.props.onSwitched(session);
  assert.equal(h.calls.some(item => Array.isArray(item)), false);
  h.dismiss(); assert.deepEqual(h.calls.at(-1), ['home', session]);
  h.launcher.open(); h.entry().content.props.onAddAccount(); h.dismiss();
  assert.deepEqual(h.calls.at(-1), ['push', '/add-account']);
  h.launcher.open(); const afterCancel = h.entry().content.props.onSwitched; h.dismiss();
  afterCancel(session); assert.deepEqual(h.calls.at(-1), ['home', session]);
});

test('account home clears the previous role stack and forces a fresh worker entry with a complete RESET state', () => {
  const calls = [], state = { stale: false, type: 'stack', key: 'root', routeKeySeq: 7, index: 1,
    routeNames: ['index', 'ios-preparation', 'sheet/[id]'], routes: [{ name: 'index', key: 'old-worker' }, { name: 'sheet/[id]', key: 'sheet' },
      { name: 'ios-preparation', key: 'old-preloaded-role' }] };
  const { useAccountHome } = load('components/useAccountHome.ts', {
    'expo-router': { useNavigation: parent => { assert.equal(parent, '/'); return { getState: () => state, dispatch: action => calls.push(action) }; } },
    '../shared/securityUnlockRuntime': { unlockAfterLogin: session => calls.push(['unlock', session]) },
  });
  const session = { imageCacheScope: 'new-scope' }; useAccountHome()(session);
  assert.deepEqual(calls[0], ['unlock', session]);
  assert.equal(calls[1].type, 'RESET'); const next = calls[1].payload;
  assert.equal(next.stale, false); assert.equal(next.key, 'root'); assert.equal(next.routeKeySeq, 7);
  assert.deepEqual(next.routes, [{ name: 'index', key: 'account-new-scope' }]);
  assert.equal(next.index, 0); assert.equal(state.routes.length, 3);
  const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
  const result = StackRouter({ initialRouteName: 'index' }).getStateForAction(state, calls[1], {});
  assert.deepEqual(result.state.routes, next.routes); assert.equal(result.state.index, 0);
});

test('adding an account uses the transactional login flow and back preserves the current role', () => {
  const calls = [], goHome = () => {};
  const { default: AddAccount } = load('app/add-account.tsx', {
    'expo-router': { router: { back: () => calls.push('back') } }, '../LoginScreen': { LoginScreen: 'LoginScreen' },
    '../components/useAccountHome': { useAccountHome: () => goHome },
  });
  const screen = AddAccount(); assert.equal(screen.props.addAccountMode, true); assert.equal(screen.props.onLogin, goHome);
  screen.props.onBack(); assert.deepEqual(calls, ['back']);
});

const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name, args }) });
function switcherMock(calls) {
  return onProfile => ({ onPress: onProfile, open: () => calls.push('switch'), hint: 'accountSwitchHint' });
}
test('the shared header binds long press only to profile, with a 500ms hold and the original short tap', () => {
  const calls = [];
  const { RoleHeaderButton } = load('shared/navigation/RoleHeaderButton.tsx', {
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { Pressable: 'Pressable', StyleSheet: { create: value => value } },
    '../../components/useAccountSwitcherLauncher': { useAccountSwitcherLauncher: switcherMock(calls) },
  });
  for (const icon of ['menu', 'back', 'profile']) {
    const button = RoleHeaderButton({ icon, label: icon, tintColor: 'ink', onPress: () => calls.push(icon) });
    button.props.onPress();
    if (icon === 'profile') { assert.equal(button.props.delayLongPress, 500); assert.equal(button.props.accessibilityHint, 'accountSwitchHint'); button.props.onLongPress(); }
    else assert.equal(button.props.onLongPress, undefined);
  }
  assert.deepEqual(calls, ['menu', 'back', 'profile', 'switch']);
});

function loadProfilePressTarget(launcher) {
  return load('components/ProfilePressTarget.ios.tsx', {
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: value => value } },
    './useAccountSwitcherLauncher': { useAccountSwitcherLauncher: launcher },
  }).ProfilePressTarget;
}

test('the iOS toolbar avatar uses one RN press target without a competing SwiftUI Button', () => {
  const calls = [];
  const ProfilePressTarget = loadProfilePressTarget(switcherMock(calls));
  const { WorkerProfileButton } = load('components/WorkerProfileButton.ios.tsx', {
    '@expo/ui/swift-ui': { HStack: 'HStack', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': modifiers, 'expo-router': { useFocusEffect() {} },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { PlatformColor: value => value },
    react: { useCallback: fn => fn, useState: fn => [fn(), () => {}] },
    '../auth': { activeSessionToken: () => 'token' }, '../authorizedFetch': {},
    '../profileModel': { profileAvatarSource: () => null }, './ProfileAvatar': { ProfileAvatar: 'ProfileAvatar' },
    './ProfilePressTarget.ios': { ProfilePressTarget },
  });
  const tree = WorkerProfileButton({ session: { profile: {} }, onPress: () => calls.push('profile') });
  assert.equal(nodes(tree, node => node.type === 'Button').length, 0);
  const bridge = nodes(tree, node => node.type === 'RNHostView')[0]; assert.equal(bridge.props.matchContents, true);
  const target = nodes(tree, node => node.type === ProfilePressTarget)[0], press = ProfilePressTarget(target.props);
  assert.equal(press.props.delayLongPress, 500); assert.equal(press.props.accessibilityHint, 'accountSwitchHint');
  press.props.onPress(); press.props.onLongPress(); assert.deepEqual(calls, ['profile', 'switch']);
});

test('the legacy iOS search header reuses the same profile press target while preserving menu', () => {
  const calls = [];
  const ProfilePressTarget = loadProfilePressTarget(switcherMock(calls));
  const { WorkerHeader } = load('components/WorkerHeader.ios.tsx', {
    '@expo/ui': { Button: 'Button', Host: 'Host', Icon: 'Icon', TextInput: 'TextInput', useNativeState: value => ({ get: () => value }) },
    '@expo/ui/swift-ui/modifiers': modifiers, react: { useEffect() {} },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { StyleSheet: { create: value => value }, View: 'View' }, './useWorkerColors': { useWorkerColors: () => ({}) },
    './ProfilePressTarget.ios': { ProfilePressTarget },
  });
  const tree = WorkerHeader({ search: '', onSearchChange() {}, onMenu: () => calls.push('menu'), onProfile: () => calls.push('profile') });
  const buttons = nodes(tree, node => node.type === 'Button'); assert.equal(buttons.length, 1);
  const target = nodes(tree, node => node.type === ProfilePressTarget)[0], press = ProfilePressTarget(target.props);
  buttons[0].props.onPress(); press.props.onPress(); press.props.onLongPress();
  assert.deepEqual(calls, ['menu', 'profile', 'switch']);
});

let nativePressability;
function loadNativePressability() {
  if (nativePressability) return nativePressability;
  const filename = path.resolve(__dirname, '../node_modules/react-native/Libraries/Pressability/Pressability.js');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const mocks = {
    '../../src/private/featureflags/ReactNativeFeatureFlags': { shouldPressibilityUseW3CPointerEventsForHover: () => false },
    '../Components/Sound/SoundManager': { playTouchSound() {} },
    '../ReactNative/UIManager': { measure: (_tag, measured) => measured(0, 0, 44, 44, 0, 0) },
    '../StyleSheet/Rect': { normalizeRect: value => value }, '../Utilities/Platform': { OS: 'ios' },
    './HoverState': { isHoverEnabled: () => false }, './PressabilityPerformanceEventEmitter.js': { emitEvent() {} },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  const { code } = require('@babel/core').transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false, presets: ['module:@react-native/babel-preset'],
  });
  mod._compile(code, filename);
  return nativePressability = mod.exports.default;
}
const touch = (x = 22, y = 22) => ({ currentTarget: 1, persist() {}, nativeEvent: { pageX: x, pageY: y } });
function profilePressability(h) {
  const ProfilePressTarget = loadProfilePressTarget(() => h.launcher);
  const { props } = ProfilePressTarget({ children: 'avatar' });
  const Pressability = loadNativePressability();
  return new Pressability({ delayLongPress: props.delayLongPress, onLongPress: props.onLongPress, onPress: props.onPress });
}

test('iOS opens the chooser at 500ms while the finger remains down, once, and release never opens profile', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = launcherHarness(), press = profilePressability(h), events = press.getEventHandlers();
  events.onResponderGrant(touch()); t.mock.timers.tick(499); assert.equal(h.entry(), null);
  t.mock.timers.tick(1); assert.ok(h.entry()); assert.deepEqual(h.calls, ['open', 'medium']);
  t.mock.timers.tick(1500); assert.deepEqual(h.calls, ['open', 'medium']);
  events.onResponderRelease(touch()); assert.deepEqual(h.calls, ['open', 'medium']);
  h.dismiss(); events.onResponderGrant(touch()); t.mock.timers.tick(100); events.onResponderRelease(touch());
  assert.equal(h.calls.at(-1), 'profile'); press.reset();
});

test('iOS short tap, canceled hold, movement away and unmount cannot open the chooser later', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const action of ['tap', 'cancel', 'move', 'unmount']) {
    const h = launcherHarness(), press = profilePressability(h), events = press.getEventHandlers();
    events.onResponderGrant(touch()); t.mock.timers.tick(200);
    if (action === 'tap') events.onResponderRelease(touch());
    else if (action === 'cancel') events.onResponderTerminate(touch());
    else if (action === 'move') events.onResponderMove(touch(100, 100));
    else press.reset();
    t.mock.timers.tick(1000);
    assert.equal(h.entry(), null, action); assert.deepEqual(h.calls, action === 'tap' ? ['profile'] : [], action);
    press.reset();
  }
});

function sheetHarness(props = {}) {
  const react = hooks(), closed = [];
  const ScrollView = Object.assign(() => null, { Context: { Provider: 'ScrollTree' } });
  const { WorkerOrderSheet } = load('components/WorkerOrderSheet.ios.tsx', {
    '@expo/ui/swift-ui': { BottomSheet: 'BottomSheet', Group: 'Group', Host: 'Host', RNHostView: 'RNHostView' },
    '@expo/ui/swift-ui/modifiers': modifiers,
    react: { ...react.api, useCallback: fn => fn },
    'react-native': { ScrollView, View: 'View', PlatformColor: name => name,
      VirtualizedList: { contextType: { Provider: 'ListTree' } }, useWindowDimensions: () => ({ height: 800, width: 390 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 40, bottom: 20 }) },
    './workerSheetContext': { WorkerSheetCloseContext: { Provider: 'SheetClose' } },
    './useBaseTheme': { useBaseTheme: () => ({ mode: 'dark', direction: 'leftToRight', colors: { primary: '#aabbcc' } }) },
  });
  return { ScrollView, closed, render: () => react.render(() => WorkerOrderSheet({ children: 'content', onClose: () => closed.push('closed'), ...props })) };
}
const sheetNode = (tree, type) => nodes(tree, node => node.type === type)[0];
const sheetModifier = (tree, name) => sheetNode(tree, 'Group').props.modifiers.find(modifier => modifier.name === name);

test('iOS compact account sheets retain content fitting and bounded scrolling; other sheets retain native detents', () => {
  const h = sheetHarness({ compact: true, fitContent: true, dismissible: true }), fitted = h.render();
  assert.equal(sheetNode(fitted, 'BottomSheet').props.fitToContents, true);
  assert.equal(sheetModifier(fitted, 'presentationDetents'), undefined);
  assert.equal(sheetModifier(fitted, 'interactiveDismissDisabled').args[0], false);
  assert.deepEqual(sheetNode(fitted, 'RNHostView').props.matchContents, { vertical: true });
  const scroll = sheetNode(fitted, h.ScrollView);
  assert.equal(scroll.props.style.flexGrow, 0); assert.equal(scroll.props.style.height, undefined);
  assert.ok(scroll.props.style.maxHeight > 0 && scroll.props.style.maxHeight < 800 - 40 - 20);
  const compact = sheetHarness({ compact: true }).render();
  assert.deepEqual(sheetModifier(compact, 'presentationDetents').args[0], [{ fraction: 0.5 }, { fraction: 0.9 }]);
  assert.equal(sheetNode(compact, 'BottomSheet').props.fitToContents, false);
  const ordinary = sheetHarness().render();
  assert.deepEqual(sheetModifier(ordinary, 'presentationDetents').args[0], [{ fraction: 0.9 }]);
  assert.equal(sheetModifier(ordinary, 'interactiveDismissDisabled').args[0], true);
});

test('iOS native sheet background covers the safe area and its viewport does not inherit scroll content height', () => {
  const tree = sheetHarness().render();
  const body = sheetNode(tree, 'RNHostView').props.children;
  assert.equal(sheetModifier(tree, 'presentationBackground').args[0], body.props.style.backgroundColor);
  assert.equal(body.props.style.backgroundColor, 'systemGroupedBackground');
  assert.equal(body.props.style.height, 0); assert.equal(body.props.style.flexGrow, 1);
  assert.equal(sheetNode(tree, 'RNHostView').props.matchContents, false);
  assert.equal(sheetNode(tree, 'ScrollTree').props.value, null);
  assert.equal(sheetNode(tree, 'ListTree').props.value, null);
});

test('iOS close and swipe notify callers once after native dismissal, so another sheet can open safely', () => {
  for (const gesture of [false, true]) {
    const h = sheetHarness({ dismissible: true }), tree = h.render();
    if (gesture) sheetNode(tree, 'BottomSheet').props.onIsPresentedChange(false);
    else sheetNode(tree, 'SheetClose').props.value();
    const sheet = sheetNode(h.render(), 'BottomSheet');
    assert.equal(sheet.props.isPresented, false); assert.deepEqual(h.closed, []);
    sheet.props.onDismiss(); sheet.props.onDismiss();
    assert.deepEqual(h.closed, ['closed']);
  }
});

test('iOS closing sheet ignores delayed native presentation echoes until dismissal', () => {
  const h = sheetHarness({ dismissible: true }), tree = h.render();
  sheetNode(tree, 'SheetClose').props.value();
  sheetNode(tree, 'BottomSheet').props.onIsPresentedChange(true);
  const closing = sheetNode(h.render(), 'BottomSheet');
  assert.equal(closing.props.isPresented, false);
  assert.deepEqual(h.closed, []);
  closing.props.onIsPresentedChange(false);
  closing.props.onDismiss();
  closing.props.onIsPresentedChange(true);
  assert.equal(sheetNode(h.render(), 'BottomSheet').props.isPresented, false);
  assert.deepEqual(h.closed, ['closed']);
});

for (const platform of ['android', 'ios']) {
  test(`${platform}: native chooser connects every saved row, PIN input and add action with busy guards`, () => {
    const calls = [], field = { get: () => '1234' };
    const model = { accounts, activeId: 'current', pins: { protected: true }, ready: true, loading: false, busy: false, target: null,
      field, text: key => key, select: account => calls.push(['select', account.id]), verify: value => calls.push(['verify', value]),
      addAccount: () => calls.push('add'), changePin: value => calls.push(['pin', value]), back: () => calls.push('back') };
    const ui = Object.fromEntries(['Box', 'Button', 'CircularProgressIndicator', 'Column', 'Icon', 'IconButton', 'OutlinedTextField', 'Row', 'Text',
      'HStack', 'Image', 'ProgressView', 'SecureField', 'Spacer', 'VStack'].map(name => [name, name]));
    const ListItem = Object.assign(() => null, Object.fromEntries(['LeadingContent', 'HeadlineContent', 'SupportingContent', 'TrailingContent'].map(name => [name, `ListItem.${name}`])));
    ui.ListItem = ListItem; ui.OutlinedTextField = Object.assign(() => null, { Label: 'Label' }); ui.useNativeState = () => field;
    const { AccountSwitcher } = load(`components/AccountSwitcher.${platform}.tsx`, {
      [`@expo/ui/${platform === 'android' ? 'jetpack-compose' : 'swift-ui'}`]: ui,
      [`@expo/ui/${platform === 'android' ? 'jetpack-compose' : 'swift-ui'}/modifiers`]: modifiers,
      '../shared/accountEntryLogic': { savedAccountDisplayName: account => account.profile.display_name, savedAccountSubtitle: () => 'role' },
      './BaseHost': { BaseHost: 'Host' }, './useAccountSwitcher': { useAccountSwitcher: () => model },
      './useBaseTheme': { useBaseTheme: () => ({ colors: { onSurface: '#ffffff', primary: '#d0bcff' } }) },
      '../../assets/icons/gscale/arrow_back.xml': 'arrow-back',
    });
    const byId = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(mod =>
      ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
    let tree = AccountSwitcher({});
    assert.ok(byId(tree, 'saved-account-current')); assert.ok(byId(tree, 'saved-account-protected'));
    const row = byId(tree, 'saved-account-other');
    if (platform === 'android') {
      assert.equal(byId(tree, 'saved-account-current').props.modifiers.some(mod => mod.name === 'clickable'), false);
      row.props.modifiers.find(mod => mod.name === 'clickable').args[0]();
    } else {
      assert.equal(byId(tree, 'saved-account-current').props.modifiers.find(mod => mod.name === 'disabled').args[0], false);
      row.props.onPress();
    }
    const add = byId(tree, 'account-switch-add'); (add.props.onClick ?? add.props.onPress)();
    assert.deepEqual(calls, [['select', 'other'], 'add']);
    model.target = accounts[1]; model.pinPrompt = 'Protected PIN'; tree = AccountSwitcher({});
    const input = byId(tree, 'account-switch-pin');
    if (platform === 'android') {
      assert.equal(input.props.visualTransformation, 'password'); assert.equal(input.props.colors.unfocusedTextColor, '#ffffff');
      input.props.onValueChange('1234'); input.props.keyboardActions.onDone('4321');
    } else { assert.equal(input.type, 'SecureField'); input.props.onTextChange('1234'); }
    const unlock = byId(tree, 'account-switch-unlock'); (unlock.props.onClick ?? unlock.props.onPress)();
    assert.deepEqual(calls.at(-1), ['verify', '1234']);
    model.busy = true; tree = AccountSwitcher({});
    const back = byId(tree, 'account-switch-back');
    if (platform === 'android') assert.equal(back.props.enabled, false);
    else assert.equal(back.props.modifiers.find(mod => mod.name === 'disabled').args[0], true);
  });
}
