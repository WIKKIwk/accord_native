const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { createInitialState } = require('expo-router/build/react-navigation/core/createInitialState');
const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');
const { TabRouter, TabActions } = require('expo-router/build/react-navigation/routers/TabRouter');

function load(relative, mocks = {}, extension = 'ts') {
  const filename = path.resolve(__dirname, `../src/${relative}.${extension}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}
const { selectRoleDrawerItem } = load('shared/navigation/roleDrawerModel');

// Feed actions emitted by the actual Boyoqchi drawer into the installed Expo
// Router reducers. This models stack/history behavior but does not mount a navigator.
function harness(platform) {
  const names = platform === 'android' ? ['entry', 'index', 'astatka', 'profile', 'chat']
    : ['(home)', '(astatka)', 'profile', 'chat'];
  const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
  const sdk = platform === 'android'
    ? StackRouter({ initialRouteName: 'entry' })
    : TabRouter({ initialRouteName: '(home)', backBehavior: 'history' });
  let state = createInitialState({ routeNames: names, initialRouteName: platform === 'android' ? 'entry' : '(home)', parentChain: '' });
  function action(event) {
    const result = sdk.getStateForAction(state, event, options);
    assert.ok(result && result.state, `unhandled ${event.type}`);
    state = result.state;
  }
  if (platform === 'android') action(StackActions.push('index'));
  const events = [], base = `/${platform}-boyoqchi`;
  const targetName = target => {
    const name = target === base ? 'home' : target.slice(base.length + 1);
    return platform === 'ios' && (name === 'home' || name === 'astatka') ? `(${name})` : name === 'home' ? 'index' : name;
  };
  const router = {
    navigate: target => { events.push(['navigate', target]); action({ type: 'NAVIGATE', payload: { name: targetName(target) } }); },
    replace: target => { events.push(['replace', target]);
      action(platform === 'android' ? StackActions.replace(targetName(target)) : TabActions.replace(targetName(target))); },
  };
  const currentPath = () => {
    const name = state.routes[state.index].name;
    return name === 'index' || name === '(home)' ? base : `${base}/${name === '(astatka)' ? 'astatka' : name}`;
  };
  let closes = 0, logouts = 0;
  const profileNavigation = { current: { isMounted: () => true, dispatch: event => {
    events.push(['profile-dispatch', event.payload.name]); action(event);
  } } };
  const immediateQueue = request => request.dispatch({ type: 'NAVIGATE',
    payload: { name: request.destination === 'home' ? 'index' : request.destination, pop: true } });
  const { BoyoqchiDrawer } = load('boyoqchi/BoyoqchiDrawer', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'expo-router': { router, usePathname: currentPath },
    'react-native': { Platform: { OS: platform } },
    '../shared/navigation/RoleDrawer': { RoleDrawer() {} },
    '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ visible: true, onClose: () => { closes++; }, onOpen() {} }) },
    '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout: () => { logouts++; } },
    './BoyoqchiContext': { useBoyoqchiContext: () => ({ onLogout() {}, profileNavigation }) },
    './useBoyoqchiText': { useBoyoqchiText: () => value => value, useBoyoqchiGetter: () => value => value },
    './boyoqchiDockScheduler': { queueBoyoqchiDockNavigation: immediateQueue },
  }, 'tsx');
  const { BoyoqchiDock } = load('boyoqchi/BoyoqchiDock.android', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    react: { useRef: value => ({ current: value }), useEffect: effect => { effect(); } },
    'expo-router': { useNavigation: parent => {
      assert.equal(parent, '/android-boyoqchi');
      return { dispatch: event => { events.push(['dock-dispatch', event.payload.name]); action(event); } };
    } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../shared/navigation/RoleBottomBar.android': { RoleBottomBar() {} },
    './useBoyoqchiText': { useBoyoqchiText: () => value => value, useBoyoqchiGetter: () => value => value },
    './boyoqchiDockScheduler': { queueBoyoqchiDockNavigation: immediateQueue },
  }, 'tsx');
  function select(id) {
    const props = BoyoqchiDrawer({ children: null }).props;
    const item = [...props.items, props.footerAction].find(candidate => candidate.id === id);
    assert.ok(item, `unknown item ${id}`);
    selectRoleDrawerItem(item, props);
  }
  const selectDock = id => BoyoqchiDock({ active: state.routes[state.index].name === 'index' ? 'home' : state.routes[state.index].name }).props.onSelect(id);
  return { select, selectDock, action, get state() { return state; }, events, get closes() { return closes; }, get logouts() { return logouts; } };
}

test('Android drawer replaces Home/Astatka without leaving those screens on the back stack', () => {
  const nav = harness('android');
  for (const [id, name] of [['astatka', 'astatka'], ['home', 'index'], ['astatka', 'astatka'], ['profile', 'profile']]) {
    nav.select(id);
    assert.deepEqual(nav.state.routes.slice(0, nav.state.index + 1).map(route => route.name), ['entry', name]);
  }
  assert.deepEqual(nav.events.map(([event]) => event), Array(4).fill('replace'));
  nav.action({ type: 'GO_BACK' });
  assert.equal(nav.state.routes[nav.state.index].name, 'entry');
});

test('drawer selecting the current destination only closes, and logout does not navigate', () => {
  for (const platform of ['android', 'ios']) {
    const nav = harness(platform);
    nav.select('home');
    assert.equal(nav.closes, 1);
    assert.deepEqual(nav.events, []);
    nav.select('logout');
    assert.equal(nav.closes, 2);
    assert.equal(nav.logouts, 1);
    assert.deepEqual(nav.events, []);
  }
});

test('iOS native-tab reducer handles replacement from Home and Astatka', () => {
  const nav = harness('ios');
  for (const [id, name] of [['astatka', '(astatka)'], ['home', '(home)'], ['chat', 'chat']]) {
    nav.select(id);
    assert.equal(nav.state.routes[nav.state.index].name, name);
  }
  assert.deepEqual(nav.events.map(([event]) => event), Array(3).fill('replace'));
});

test('Profile drawer uses the registered role stack on Android and preserves iOS navigation', () => {
  for (const platform of ['android', 'ios']) {
    const nav = harness(platform);
    nav.select('profile');
    nav.select('astatka');
    assert.equal(nav.events.at(-1)[0], platform === 'android' ? 'profile-dispatch' : 'navigate');
    assert.equal(nav.state.routes[nav.state.index].name, platform === 'ios' ? '(astatka)' : 'astatka');
  }
});

test('SDK Android Profile drawer pushes an absent route and pops to an existing route', () => {
  const nav = harness('android');
  nav.action(StackActions.push('profile'));
  nav.select('astatka');
  assert.deepEqual(nav.state.routes.map(route => route.name), ['entry', 'index', 'profile', 'astatka']);

  const existing = harness('android');
  existing.action(StackActions.push('profile'));
  existing.select('home');
  assert.deepEqual(existing.state.routes.map(route => route.name), ['entry', 'index']);
});

test('Android dock should pop an existing destination without duplicating it', () => {
  const nav = harness('android');
  nav.action(StackActions.push('profile'));
  nav.selectDock('home');
  assert.deepEqual(nav.state.routes.map(route => route.name), ['entry', 'index']);
});
