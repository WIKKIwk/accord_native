const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const stateModel = load('admin/adminDrawerNavigationState.ts');
const { AdminDrawerNavigation } = load('admin/adminDrawerNavigation.ts', {
  './adminDrawerNavigationState': stateModel, './adminDrawerModel': load('admin/adminDrawerModel.ts'),
  '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard.ts'),
});
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
function stack(names, key = 'admin-stack') {
  return { key, routeKeySeq: names.length, type: 'stack', index: names.length - 1,
    routeNames: ['index', 'settings', 'factory-locations', 'additional-settings', 'item-groups', 'profile'],
    routes: names.map((name, i) => ({ name, key: `${name}-${i}` })), preloadedRoutes: [{ name: 'item-groups', key: 'preloaded' }] };
}
function root(platform, child) { return { type: 'stack', key: 'root', index: 0, routes: [{ name: `${platform}-admin`, state: child }] }; }
function iosRoot(home, focused = '(home)', activity = stack(['index'], 'activity-stack')) {
  return root('ios', { type: 'tab', key: 'tabs', index: focused === '(home)' ? 0 : 1, routes: [{ name: '(home)', state: home }, { name: 'activity', state: activity }] });
}
function fixture(names = ['index', 'settings'], platform = 'android') {
  let current = true, enabled = true, state = stack(names), rootState = () => platform === 'ios' ? iosRoot(state) : root(platform, state), confirmation;
  const scheduled = [], calls = [], reducer = StackRouter({ initialRouteName: 'index' }), options = { routeParamList: {}, routeGetIdList: {} };
  const originalSet = global.setTimeout, originalClear = global.clearTimeout;
  global.setTimeout = (callback, delay) => { const timer = { callback, delay }; scheduled.push(timer); return timer; };
  global.clearTimeout = timer => { timer.cancelled = true; };
  const apply = (type, target) => { calls.push([type, target]); const name = target === `/${platform}-admin` ? 'index' : target.split('/').at(-1);
    state = reducer.getStateForAction(state, { type, payload: { name } }, options).state; };
  const deps = { platform, home: 'home', isCurrent: () => current, rootState: () => rootState(),
    destination: name => enabled ? name === 'home' ? `/${platform}-admin` : `/${platform}-admin/${name}` : null,
    push: target => apply('PUSH', target), replace: target => apply('REPLACE', target), popTo: target => apply('POP_TO', target),
    confirmLogout: callback => { calls.push('confirm'); confirmation = callback; }, logout: () => calls.push('logout') };
  const owner = new AdminDrawerNavigation(deps); owner.attach();
  return { owner, deps, calls, scheduled, names: () => state.routes.slice(0, state.index + 1).map(route => route.name),
    setState: next => { state = next; }, getState: () => state, setRoot: fn => { rootState = fn; }, retire: () => { current = false; }, revive: () => { current = true; },
    deny: () => { enabled = false; }, confirm: () => confirmation?.(), select: (routeName, push = false) => owner.select({ routeName, push }),
    flush: () => scheduled.splice(0).forEach(timer => timer.callback()), restore: () => { owner.detach(); global.setTimeout = originalSet; global.clearTimeout = originalClear; } };
}
for (const platform of ['android', 'ios']) test(`${platform} drawer source plan mutates the real active StackRouter history`, () => {
  for (const [names, target, expected, action] of [
    [['index'], 'factory-locations', ['index', 'factory-locations'], 'PUSH'],
    [['index', 'settings'], 'factory-locations', ['index', 'factory-locations'], 'REPLACE'],
    [['settings'], 'factory-locations', ['settings', 'factory-locations'], 'PUSH'],
    [['index', 'factory-locations', 'settings'], 'factory-locations', ['index', 'factory-locations'], 'POP_TO'],
    [['index', 'settings'], 'home', ['index'], 'POP_TO'],
    [['settings'], 'home', ['settings', 'index'], 'PUSH'],
  ]) {
    const f = fixture(names, platform); try { f.select(target); assert.equal(f.scheduled[0].delay, 220); assert.deepEqual(f.calls, []); f.flush();
      assert.deepEqual(f.names(), expected); assert.equal(f.calls[0][0], action); } finally { f.restore(); }
  }
});
test('source selected route is skipped, while a Profile push preserves prior screens even when Profile already exists', () => {
  const f = fixture(['index', 'profile', 'settings']); try {
    f.select('settings'); assert.equal(f.scheduled.length, 0); f.select('profile', true); f.flush();
    assert.deepEqual(f.names(), ['index', 'profile', 'settings', 'profile']);
    f.select('profile', true); assert.equal(f.scheduled.length, 0);
  } finally { f.restore(); }
});
test('active stack observation excludes parent history, forward routes, preloads and inactive iOS Home history', () => {
  const home = stack(['index', 'factory-locations', 'settings']); home.index = 1;
  const active = stateModel.adminDrawerActiveStack(iosRoot(home), 'ios');
  assert.deepEqual(active, { key: 'admin-stack', currentPath: '/ios-admin/factory-locations', paths: ['/ios-admin', '/ios-admin/factory-locations'] });
  assert.deepEqual(stateModel.adminDrawerActiveStack(iosRoot(home, 'activity'), 'ios'), { key: 'activity-stack', currentPath: '/ios-admin/activity', paths: ['/ios-admin/activity'] });
  const covered = root('android', home); covered.routes.push({ name: 'sheet', state: stack(['index'], 'sheet-stack') }); covered.index = 1;
  assert.equal(stateModel.adminDrawerActiveStack(covered, 'android'), null);
  assert.equal(stateModel.adminDrawerActiveStack({ routes: [{ name: 'android-admin' }] }, 'android'), null);
});
test('delayed navigation uses fresh stack state and ignores preloaded target as a history entry', () => {
  const f = fixture(['index', 'settings']); try {
    f.select('item-groups'); f.flush(); assert.deepEqual(f.names(), ['index', 'item-groups']); assert.equal(f.calls[0][0], 'REPLACE');
    f.select('factory-locations'); f.setState(stack(['index', 'factory-locations', 'settings'])); f.flush();
    assert.deepEqual(f.names(), ['index', 'factory-locations']); assert.equal(f.calls[1][0], 'POP_TO');
  } finally { f.restore(); }
});
test('the delayed action retains the selected immutable source destination', () => {
  const f = fixture(); try {
    const selected = { routeName: 'factory-locations', push: false }; f.owner.select(selected); selected.routeName = 'profile'; selected.push = true; f.flush();
    assert.deepEqual(f.names(), ['index', 'factory-locations']); assert.equal(f.calls[0][0], 'REPLACE');
  } finally { f.restore(); }
});
test('changing the focused iOS tab, opening a root overlay or losing a destination cancels pending navigation', () => {
  for (const change of [f => f.setRoot(() => iosRoot(f.getState(), 'activity')), f => f.setRoot(() => root('ios-gscale', stack(['index']))), f => f.deny()]) {
    const f = fixture(['index', 'settings'], 'ios'); try { f.select('factory-locations'); change(f); f.flush(); assert.deepEqual(f.calls, []); } finally { f.restore(); }
  }
});
test('unmount and StrictMode replay cancel original delayed callbacks without disabling the reattached owner', () => {
  const f = fixture(); try {
    f.select('factory-locations'); const old = f.scheduled[0]; f.owner.detach(); assert.equal(old.cancelled, true); f.owner.attach(); old.callback(); assert.deepEqual(f.calls, []);
    f.select('factory-locations'); f.scheduled.at(-1).callback(); assert.deepEqual(f.names(), ['index', 'factory-locations']);
  } finally { f.restore(); }
});
test('account retirement is permanent for retained callbacks and rejected async authority is safely suppressed', async () => {
  const f = fixture(); try {
    f.select('factory-locations'); f.retire(); f.flush(); f.revive(); f.select('factory-locations'); f.flush(); assert.deepEqual(f.calls, []);
  } finally { f.restore(); }
  const g = fixture(); try { g.deps.isCurrent = () => Promise.reject(new Error('async authority')); g.select('factory-locations'); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(g.calls, []); assert.equal(g.scheduled.length, 0); } finally { g.restore(); }
});
test('the final current callback cannot detach its own lifetime and still dispatch navigation', () => {
  const f = fixture(); try {
    const destination = f.deps.destination; let targetChecks = 0;
    f.deps.destination = route => {
      if (route === 'factory-locations' && ++targetChecks === 3) f.deps.isCurrent = () => { f.owner.detach(); return true; };
      return destination(route);
    };
    f.select('factory-locations'); f.flush(); assert.deepEqual(f.calls, []);
  } finally { f.restore(); }
});
test('reentrant destination or stack callbacks cannot retire authority and still navigate', () => {
  for (const during of ['destination', 'rootState']) {
    const f = fixture(); try {
      f.select('factory-locations'); const original = f.deps[during]; f.deps[during] = (...args) => { f.retire(); return original(...args); }; f.flush(); assert.deepEqual(f.calls, []);
    } finally { f.restore(); }
  }
});
test('logout keeps the source120ms delay and validates the original owner again at confirmation', () => {
  const f = fixture(); try {
    f.owner.logout(); assert.equal(f.scheduled[0].delay, 120); f.flush(); assert.deepEqual(f.calls, ['confirm']); f.confirm(); f.confirm(); assert.deepEqual(f.calls, ['confirm', 'logout']);
    f.owner.logout(); f.flush(); f.owner.detach(); f.owner.attach(); f.confirm(); assert.deepEqual(f.calls, ['confirm', 'logout', 'confirm']);
  } finally { f.restore(); }
});
