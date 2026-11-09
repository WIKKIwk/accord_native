const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(platform) {
  const session = { token: 'token', imageCacheScope: 'scope', profile: { ref: 'account', role: 'boyoqchi' } }, witness = { session };
  const mounted = { current: true }, routes = [], pending = [];
  const pins = new Map([['account', { app: 'old-app-pin', switch: 'old-switch-pin' }]]);
  let current = session, valid = true, transitioning = false, logouts = 0, cleanups = 0;
  const filename = path.resolve(__dirname, `../src/boyoqchi/BoyoqchiLayout.${platform}.tsx`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  const mocks = { 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack', router: { replace: route => routes.push(route) } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: platform }, View: 'View' },
    '../auth': { currentSession: () => current, isSessionWitnessCurrent: value => valid && value === witness,
      sessionWitnessTransitioning: () => transitioning,
      logout: value => { assert.equal(value, session); logouts++; return new Promise(resolve => pending.push(resolve)); } },
    '../appLock': { clearAppLock: async () => { cleanups++; pins.delete('account'); } },
    '../shared/switchPinRuntime': { switchPinStore: { clear: async () => { cleanups++; pins.delete('account'); } } },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    './boyoqchiEntryGuard': { canEnterBoyoqchi: () => true }, './BoyoqchiShell': { BoyoqchiContextShell: 'BoyoqchiContextShell' },
    './useBoyoqchiSession': { useBoyoqchiSession: () => ({ witness, mounted }) } };
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const tree = loaded.exports.BoyoqchiLayout();
  return { onLogout: tree.props.onLogout, routes, pins, logouts: () => logouts, cleanups: () => cleanups,
    invalidate: () => { valid = false; }, startLogin: () => { transitioning = true; }, unmount: () => { mounted.current = false; }, setCurrent: value => { current = value; },
    finish: () => pending.shift()(), session };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} logout preserves same-account relogin PINs even when old logout completes later`, async () => {
    const f = fixture(platform); f.onLogout(); assert.equal(f.logouts(), 1); assert.equal(f.cleanups(), 0);
    const newSession = { ...f.session, token: 'new-token' }; f.setCurrent(newSession);
    f.pins.set('account', { app: 'new-app-pin', switch: 'new-switch-pin' }); f.finish(); await tick();
    assert.deepEqual(f.pins.get('account'), { app: 'new-app-pin', switch: 'new-switch-pin' });
    assert.equal(f.cleanups(), 0); assert.deepEqual(f.routes, []);
  });
  test(`${platform} an old logout does not redirect while a new login is pending`, async () => {
    for (const value of ['old-session', 'no-session']) {
      const f = fixture(platform); f.onLogout(); f.startLogin();
      if (value === 'no-session') f.setCurrent(null);
      f.finish(); await tick(); assert.deepEqual(f.routes, []); assert.equal(f.cleanups(), 0);
    }
  });
  test(`${platform} rejects a stale logout and only redirects a still-mounted completed logout`, async () => {
    const stale = fixture(platform); stale.invalidate(); stale.onLogout(); assert.equal(stale.logouts(), 0);
    const normal = fixture(platform); normal.onLogout(); normal.setCurrent(null); normal.finish(); await tick();
    assert.deepEqual(normal.routes, ['/']); assert.equal(normal.cleanups(), 0);
    const unmounted = fixture(platform); unmounted.onLogout(); unmounted.unmount(); unmounted.setCurrent(null); unmounted.finish(); await tick();
    assert.deepEqual(unmounted.routes, []);
  });
}
