const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const routes = compile('shared/appRoutes');
let current = null;
const { canEnterBoyoqchi } = compile('boyoqchi/boyoqchiEntryGuard', {
  '../auth': { activeSessionToken: session => current === session ? session.token : null }, '../shared/appRoutes': routes,
});
const make = (role = 'boyoqchi', capabilities = ['boyoqchi.access']) => ({ token: 'token', profile: { role, ref: 'ref' }, capabilities });
for (const platform of ['ios', 'android']) test(`${platform} deep link requires the exact active session and V2 route capability`, () => {
  const session = make(); current = session;
  assert.equal(canEnterBoyoqchi(session, platform, platform), true);
  assert.equal(canEnterBoyoqchi(session, platform === 'ios' ? 'android' : 'ios', platform), false);
  const missing = make('boyoqchi', []); current = missing; assert.equal(canEnterBoyoqchi(missing, platform, platform), false);
  const worker = make('aparatchi'); current = worker; assert.equal(canEnterBoyoqchi(worker, platform, platform), true);
  for (const role of ['rezka_master', 'brigader', 'sales_manager']) {
    const restricted = make(role); current = restricted; assert.equal(canEnterBoyoqchi(restricted, platform, platform), false, role);
  }
  current = make(); assert.equal(canEnterBoyoqchi(session, platform, platform), false);
  const noRef = make(); noRef.profile.ref = ''; current = noRef; assert.equal(canEnterBoyoqchi(noRef, platform, platform), false);
});

function layout(platform, selected, devicePlatform = platform) {
  const filename = path.resolve(__dirname, `../src/boyoqchi/BoyoqchiLayout.${platform}.tsx`), loaded = new Module(filename, module);
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect() {}, useState: () => [selected, () => {}] },
    'expo-router': { Redirect: 'Redirect', Stack: 'Stack', router: {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: devicePlatform }, View: 'View' },
    '../auth': { isSessionWitnessCurrent: () => true }, '../appLock': {}, '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/switchPinRuntime': {}, './BoyoqchiShell': { BoyoqchiContextShell: 'BoyoqchiContextShell' },
    './boyoqchiEntryGuard': { canEnterBoyoqchi },
    './useBoyoqchiSession': { useBoyoqchiSession: () => ({ witness: selected == null ? selected : { session: selected }, mounted: { current: true } }) } };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports.BoyoqchiLayout();
}
for (const platform of ['ios', 'android']) test(`${platform} role layout applies guard before mounting the protected role tree`, () => {
  const session = make(); session.imageCacheScope = 'scope'; current = session;
  assert.equal(layout(platform, undefined).type, 'View');
  assert.equal(layout(platform, null).type, 'Redirect');
  assert.equal(layout(platform, session, platform === 'ios' ? 'android' : 'ios').type, 'Redirect');
  const entered = layout(platform, session); assert.equal(entered.type, 'WorkerSecurityProvider');
  assert.equal(entered.props.children.type, 'BoyoqchiContextShell');
  const invalid = make('rezka_master'); current = invalid; assert.equal(layout(platform, invalid).type, 'Redirect');
  current = make(); assert.equal(layout(platform, session).type, 'Redirect');
});
