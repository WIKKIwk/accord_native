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
const { createBoyoqchiDockScheduler } = load('boyoqchi/boyoqchiDockScheduler', {
  'react-native': { Keyboard: { dismiss() {} } },
});

// Drive the actual role dock and installed Expo SDK 58 stack reducer, not a custom stack model.
function fixture(initialNames) {
  const names = ['index', 'astatka', 'profile', 'chat'];
  const router = StackRouter({ initialRouteName: 'index' }), options = { routeParamList: {}, routeGetIdList: {} };
  let state = { stale: false, type: 'stack', key: 'boyoqchi-stack', index: initialNames.length - 1, routeNames: names,
    routes: initialNames.map((name, index) => ({ key: `${name}-${index}`, name })) };
  const frames = [], cleanups = [], events = [];
  let dismisses = 0, witnessCurrent = true;
  const queue = createBoyoqchiDockScheduler(fn => frames.push(fn), () => { dismisses++; });
  const dispatch = action => {
    events.push(action);
    const result = router.getStateForAction(state, action, options);
    assert.ok(result && result.state, `unhandled: ${JSON.stringify(action)}`);
    state = result.state;
  };
  const { BoyoqchiDock } = load('boyoqchi/BoyoqchiDock.android', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    react: { useRef: value => ({ current: value }), useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
    '../auth': { isSessionWitnessCurrent: () => witnessCurrent }, './BoyoqchiContext': { useBoyoqchiContext: () => ({ witness: {} }) },
    'expo-router': { useNavigation: parent => { assert.equal(parent, '/android-boyoqchi'); return { dispatch }; } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
    './useBoyoqchiText': { useBoyoqchiText: () => value => value, useBoyoqchiGetter: () => value => value },
    './boyoqchiDockScheduler': { queueBoyoqchiDockNavigation: queue },
  }, 'tsx');
  return { dock: active => BoyoqchiDock({ active }).props, names: () => state.routes.slice(0, state.index + 1).map(route => route.name),
    invalidate: () => { witnessCurrent = false; }, events, frames, dismisses: () => dismisses, frame: () => { while (frames.length) frames.shift()(); },
    unmount: () => { while (cleanups.length) cleanups.pop()(); }, back: () => dispatch({ type: 'POP', payload: { count: 1 } }) };
}

test('dock pops an existing destination and pushes an absent one while preserving back history', () => {
  const f = fixture(['index', 'astatka', 'profile']);
  f.dock('profile').onSelect('astatka');
  f.frame();
  assert.deepEqual(f.names(), ['index', 'astatka']);
  f.dock('astatka').onSelect('profile');
  f.frame();
  assert.deepEqual(f.names(), ['index', 'astatka', 'profile']);
  f.back();
  assert.deepEqual(f.names(), ['index', 'astatka']);
  f.dock('astatka').onSelect('home');
  f.frame();
  assert.deepEqual(f.names(), ['index']);
});

test('dock ignores active and unknown destinations and coalesces same-frame requests', () => {
  const f = fixture(['index']);
  const dock = f.dock('home');
  dock.onSelect('home'); dock.onSelect('unknown'); dock.onSelect('chat');
  assert.equal(f.frames.length, 0);
  dock.onSelect('astatka'); dock.onSelect('profile'); dock.onSelect('chat');
  assert.equal(f.frames.length, 1);
  assert.equal(f.dismisses(), 2);
  f.frame();
  assert.deepEqual(f.names(), ['index', 'profile']);
  assert.deepEqual(f.events[0], { type: 'NAVIGATE', payload: { name: 'profile', pop: true } });
});

test('unmounted dock drops a queued route change', () => {
  const f = fixture(['index']);
  f.dock('home').onSelect('astatka');
  f.unmount(); f.frame();
  assert.deepEqual(f.names(), ['index']);
});

test('scheduler rechecks the active destination at the frame and keeps the first requesting context', () => {
  const frames = [], events = [];
  let active = 'home', firstMounted = true;
  const queue = createBoyoqchiDockScheduler(fn => frames.push(fn), () => {});
  queue({ destination: 'astatka', active: () => active, isMounted: () => firstMounted, dispatch: value => events.push(['first', value]) });
  active = 'astatka'; frames.shift()();
  assert.deepEqual(events, []);
  active = 'home';
  queue({ destination: 'astatka', active: () => active, isMounted: () => firstMounted, dispatch: value => events.push(['first', value]) });
  queue({ destination: 'profile', active: () => 'home', isMounted: () => true, dispatch: value => events.push(['second', value]) });
  firstMounted = false; frames.shift()();
  assert.deepEqual(events, []);
});


test('a witness transition drops a dock action already queued for the next frame', () => {
  const f = fixture(['index']); f.dock('home').onSelect('astatka'); f.invalidate(); f.frame();
  assert.deepEqual(f.names(), ['index']); assert.deepEqual(f.events, []);
});
