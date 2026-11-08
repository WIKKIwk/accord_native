const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
function load(relative, mocks = {}, extension = 'ts') {
  const filename = path.resolve(__dirname, `../src/${relative}.${extension}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const registration = load('boyoqchi/boyoqchiProfileNavigation');
const { createBoyoqchiDockScheduler } = load('boyoqchi/boyoqchiDockScheduler', {
  'react-native': { Keyboard: { dismiss() {} } },
});
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function scheduler() {
  const frames = [];
  return { queue: createBoyoqchiDockScheduler(fn => frames.push(fn), () => {}), frame: () => { while (frames.length) frames.shift()(); }, frames };
}

// Mount the role-owned Profile registration and drive its actual drawer callback
// through the installed SDK 58 StackRouter. This does not mount a real navigator.
function fixture(initialNames, scheduled = scheduler()) {
  const names = ['index', 'astatka', 'profile', 'chat'], options = { routeParamList: {}, routeGetIdList: {} };
  const reducer = StackRouter({ initialRouteName: 'index' });
  let state = { stale: false, type: 'stack', key: 'boyoqchi-stack', index: initialNames.length - 1, routeNames: names,
    routes: initialNames.map((name, index) => ({ key: `${name}-${index}`, name })) };
  const events = [], hooks = [], slot = { current: null };
  let hookIndex = 0;
  const react = {
    useRef: value => { const index = hookIndex++; return hooks[index] ?? (hooks[index] = { current: value }); },
    useLayoutEffect: (effect, dependencies) => {
      const index = hookIndex++, previous = hooks[index];
      if (previous && dependencies.length === previous.dependencies.length && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      previous?.cleanup?.();
      hooks[index] = { dependencies, cleanup: effect() };
    },
  };
  const dispatch = action => {
    events.push(action);
    const result = reducer.getStateForAction(state, action, options);
    assert.ok(result && result.state, `unhandled ${JSON.stringify(action)}`);
    state = result.state;
  };
  const context = { session: { imageCacheScope: 'account' }, onLogout() {}, profileNavigation: slot };
  const commonText = { useBoyoqchiGetter: () => key => key, useBoyoqchiText: () => key => key };
  const Profile = load('app/android-boyoqchi/profile', {
    'react/jsx-runtime': jsx,
    react,
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'white' }) },
    'expo-router': { router: { navigate() {} }, useNavigation: id => { assert.equal(id, '/android-boyoqchi'); return { dispatch }; } },
    'react-native': { View: 'View' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../../components/ProfileScreen': { ProfileScreen: 'ProfileScreen' },
    '../../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open() {} }) },
    '../../boyoqchi/BoyoqchiDock.android': { BoyoqchiDock: 'BoyoqchiDock' },
    '../../boyoqchi/BoyoqchiContext': { useBoyoqchiContext: () => context },
    '../../boyoqchi/boyoqchiProfileNavigation': registration,
    '../../boyoqchi/useBoyoqchiText': commonText,
  }, 'tsx').default;
  const Drawer = load('boyoqchi/BoyoqchiDrawer', {
    'react/jsx-runtime': jsx, 'react-native': { Platform: { OS: 'android' } },
    'expo-router': { usePathname: () => '/android-boyoqchi/profile', router: {
      replace() { throw new Error('Profile must not replace'); }, navigate() { throw new Error('Profile must not use plain navigate'); },
    } },
    '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ visible: true, onClose() {}, onOpen() {} }) },
    '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout() {} },
    './BoyoqchiContext': { useBoyoqchiContext: () => context }, './useBoyoqchiText': commonText,
    './boyoqchiDockScheduler': { queueBoyoqchiDockNavigation: scheduled.queue },
  }, 'tsx').BoyoqchiDrawer;
  return { mount: () => { hookIndex = 0; return Profile(); }, select: id => Drawer({ children: null }).props.onSelect(id), scheduled, slot, events, context,
    unmount: () => { for (const hook of hooks) hook?.cleanup?.(); },
    names: () => state.routes.slice(0, state.index + 1).map(route => route.name), back: () => dispatch({ type: 'POP', payload: { count: 1 } }) };
}

test('Android Profile drawer pops an existing role destination and pushes an absent one', () => {
  const existing = fixture(['index', 'astatka', 'profile']); existing.mount(); existing.select('astatka'); existing.scheduled.frame();
  assert.deepEqual(existing.names(), ['index', 'astatka']);
  const absent = fixture(['index', 'profile']); absent.mount(); absent.select('astatka'); absent.scheduled.frame();
  assert.deepEqual(absent.names(), ['index', 'profile', 'astatka']);
  absent.back(); assert.deepEqual(absent.names(), ['index', 'profile']);
});

test('Profile drawer coalesces selections and never navigates without its mounted registration', () => {
  const f = fixture(['index', 'profile']);
  f.select('astatka');
  assert.equal(f.scheduled.frames.length, 0);
  f.mount(); f.select('astatka'); f.select('home');
  assert.equal(f.scheduled.frames.length, 1);
  f.scheduled.frame();
  assert.deepEqual(f.names(), ['index']);
  assert.deepEqual(f.events[0], { type: 'NAVIGATE', payload: { name: 'index', pop: true } });
});

test('unmounted or superseded registrations cannot dispatch into another session', () => {
  const shared = scheduler(), old = fixture(['index', 'profile'], shared), next = fixture(['index', 'profile'], shared);
  old.mount(); old.select('astatka'); old.unmount();
  next.mount(); next.select('home'); shared.frame();
  assert.deepEqual(old.events, []); assert.deepEqual(next.events, []);
  next.select('home'); shared.frame();
  assert.deepEqual(next.names(), ['index']);
  const slot = { current: null }, calls = [];
  const removeOld = registration.registerBoyoqchiProfileNavigation(slot, () => calls.push('old'));
  const oldHandle = slot.current;
  const removeNew = registration.registerBoyoqchiProfileNavigation(slot, () => calls.push('new'));
  const newHandle = slot.current;
  assert.equal(oldHandle.isMounted(), false); assert.equal(newHandle.isMounted(), true);
  oldHandle.dispatch({ type: 'NAVIGATE', payload: { name: 'index', pop: true } });
  assert.deepEqual(calls, []);
  removeOld(); assert.equal(slot.current, newHandle);
  removeNew(); assert.equal(slot.current, null);
  newHandle.dispatch({ type: 'NAVIGATE', payload: { name: 'index', pop: true } });
  assert.deepEqual(calls, []);
});

test('changing the session invalidates a queued Profile navigation before re-registering', () => {
  const f = fixture(['index', 'profile']);
  f.mount(); f.select('astatka');
  const prior = f.slot.current;
  f.context.session = { imageCacheScope: 'another-account' };
  f.mount();
  assert.notEqual(f.slot.current, prior);
  f.scheduled.frame();
  assert.deepEqual(f.events, []);
  f.select('home'); f.scheduled.frame();
  assert.deepEqual(f.names(), ['index']);
});
