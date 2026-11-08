// Route and owner tests use mocked sessions, camera and navigation only. No network or device is used.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}, jsxEnabled = false) { const filename = path.resolve(__dirname, `../src/${file}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(jsxEnabled ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename); return mod.exports; }
function hooks() { const slots = [], pending = []; let cursor = 0, alive = true;
  const react = { useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { if (alive) slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useEffect: (effect, deps) => { const i = cursor++, previous = slots[i];
      if (!previous || !deps || deps.some((v, j) => v !== previous.deps[j])) pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; }); },
    useCallback: fn => { cursor++; return fn; }, useSyncExternalStore: (_subscribe, get) => { cursor++; return get(); } };
  return { react, render: fn => { cursor = 0; const result = fn(); while (pending.length) pending.shift()(); return result; },
    unmount: () => { alive = false; slots.forEach(value => value?.cleanup?.()); }, fresh: () => { slots.length = 0; pending.length = 0; alive = true; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const routes = load('shared/appRoutes.ts');
const session = (role, capabilities = [], token = 'token') => ({ token, profile: { role, ref: 'user' }, capabilities, imageCacheScope: 'scope' });
test('role home mapping leaves Worker and Preparation unchanged and rejects unauthorized role/capability', () => {
  const role = session('homashyo_rezkachi', ['raw_material.split']);
  assert.equal(routes.homeTarget(role, 'ios'), '/ios-homashyo'); assert.equal(routes.homeTarget(role, 'android'), '/android-homashyo');
  assert.equal(routes.homeTarget(role, 'web'), null); assert.equal(routes.homeTarget(session('aparatchi', ['apparatus.queue.read']), 'android'), 'worker');
  assert.equal(routes.homeTarget(session('tayyorlov_masteri', ['preparation.access']), 'ios'), '/ios-preparation');
  for (const subject of [null, session('homashyo_rezkachi'), session('customer', ['raw_material.split']), session('homashyo_rezkachi', ['raw_material.split'], '')]) {
    assert.equal(routes.canOpenRoute(subject, routes.appRoutes.rawMaterialSplit), false);
    assert.equal(routes.canOpenRoute(subject, routes.appRoutes.rawMaterialSplitHistory), false);
  }
  assert.equal(routes.canOpenRoute(role, routes.appRoutes.rawMaterialSplitHistory), true);
});
function gateHarness(value, platform = 'ios', epoch = true, deferred) {
  const h = hooks(); let reset;
  let logoutCalls = 0, clearCalls = 0, redirects = 0, captures = 0, witnessValid = true, captureAllowed = true, transitioning = false, current = value, logoutImpl;
  const alerts = [];
  const auth = { loadSession: () => deferred ?? Promise.resolve(value), registerSessionResetHook: fn => { reset = fn; return () => {}; },
    currentSession: () => current, logout: async () => { logoutCalls++; if (logoutImpl) await logoutImpl(); else current = null; }, clearSession: async () => { clearCalls++; }, captureSessionWitness: () => { captures++; return captureAllowed ? {} : null; },
    isSessionWitnessCurrent: () => witnessValid, subscribeSessionWitness: () => () => {}, sessionWitnessVersion: () => 0, sessionWitnessTransitioning: () => transitioning,
    ...(epoch ? { activeSessionEpoch: () => 0 } : {}) };
  const mocks = { 'react/jsx-runtime': jsx, react: h.react, 'expo-router': { Redirect: 'Redirect', router: { replace() { redirects++; } } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Alert: { alert: (...args) => alerts.push(args) }, Platform: { OS: platform }, Text: 'Text', View: 'View' },
    '../auth': auth, '../appLock': { clearAppLock: async () => {} }, '../components/WorkerSecurity': { WorkerSecurityProvider: 'Security' },
    '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../shared/appRoutes': routes, './rawSplitApi': { createRawSplitSessionTicket: (session, _readEpoch, checkWitness) => {
      if (!checkWitness()) throw new Error('invalid'); return { session, check: () => { if (!checkWitness()) throw new Error('invalid'); } }; },
      rawSplitSessionIsCurrent: ticket => { try { ticket.check(); return true; } catch { return false; } } }, './RawSplitContext': { RawSplitProvider: 'Provider' } };
  const Gate = load('homashyo/RawSplitSessionGate.tsx', mocks, true).RawSplitSessionGate;
  return { render: () => h.render(() => Gate({ platform: 'ios', children: 'route' })), reset: () => reset(), unmount: h.unmount,
    logoutCalls: () => logoutCalls, clearCalls: () => clearCalls, redirects: () => redirects, alerts, captures: () => captures,
    setCurrent: next => { current = next; }, setLogout: fn => { logoutImpl = fn; }, setTransitioning: next => { transitioning = next; },
    setWitness: value => { witnessValid = value; }, setCaptureAllowed: value => { captureAllowed = value; },
    activate: element => { h.fresh(); return () => h.render(() => element.type(element.props)); } };
}
test('each direct role entry waits for session and rejects wrong role, missing capability, or wrong platform', async () => {
  for (const [value, platform] of [[null, 'ios'], [session('customer', ['raw_material.split']), 'ios'],
    [session('homashyo_rezkachi'), 'ios'], [session('homashyo_rezkachi', ['raw_material.split']), 'android']]) {
    const h = gateHarness(value, platform); h.render(); await flush(); assert.equal(h.render().type, 'Redirect'); h.unmount();
  }
  const valid = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); valid.render(); await flush();
  assert.equal(typeof valid.render().type, 'function'); valid.unmount();
});
test('missing epoch reader is fail-closed and an old load cannot restore access after a session reset', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split']), 'ios', false); h.render(); await flush();
  const blocked = h.render(); assert.equal(blocked.type, 'View'); assert.equal(blocked.props.children.props.children, 'Sessiya xavfsizligi mavjud emas.'); h.unmount();
  let resolve; const deferred = new Promise(done => { resolve = done; }); const old = gateHarness(null, 'ios', true, deferred);
  old.render(); await old.reset(); resolve(session('homashyo_rezkachi', ['raw_material.split'])); await flush();
  assert.equal(old.render().type, 'View'); old.unmount();
});
test('both platform layouts guard index, history and profile; no Homashyo Chat route exists', () => {
  for (const platform of ['ios', 'android']) {
    const root = path.resolve(__dirname, `../src/app/${platform}-homashyo`);
    assert.match(fs.readFileSync(path.join(root, '_layout.tsx'), 'utf8'), new RegExp(`RawSplitSessionGate platform="${platform}"`));
    const folder = platform === 'ios' ? path.join(root, '(home)') : root;
    for (const name of ['index.tsx', 'history.tsx']) assert.ok(fs.existsSync(path.join(folder, name)));
    assert.ok(fs.existsSync(path.join(root, 'profile.tsx'))); assert.equal(fs.existsSync(path.join(root, 'chat')), false);
  }
});

test('picker overlay Back dismisses immediately and final unmount settles', async () => {
  const h = hooks(), listeners = {}, calls = [], request = {}, owner = { dismiss: value => calls.push(['dismiss', value]), removed: value => calls.push(['removed', value]) };
  const mod = load('homashyo/useRawSplitPickerOverlay.ts', { react: h.react, 'react-native': { BackHandler: { addEventListener: (_name, fn) => {
    listeners.back = fn; return { remove() { delete listeners.back; } }; } } } });
  const close = h.render(() => mod.useRawSplitPickerOverlay(request, owner)); assert.equal(listeners.back(), true); close();
  assert.deepEqual(calls, [['dismiss', request], ['dismiss', request]]); h.unmount(); await flush(); assert.deepEqual(calls.at(-1), ['removed', request]);
});

test('picker overlay StrictMode temporary effect cleanup does not settle the live request', async () => {
  const setups = [], removed = [], ref = { current: { mounts: 0 } };
  const react = { useRef: () => ref, useEffect: fn => setups.push(fn) };
  const mod = load('homashyo/useRawSplitPickerOverlay.ts', { react, 'react-native': { BackHandler: { addEventListener: () => ({ remove() {} }) } } });
  const request = {}, owner = { dismiss() {}, removed: value => removed.push(value) }; mod.useRawSplitPickerOverlay(request, owner);
  const firstCleanup = setups[0](); firstCleanup(); const secondCleanup = setups[0](); await flush(); assert.deepEqual(removed, []);
  secondCleanup(); await flush(); assert.deepEqual(removed, [request]);
});
function scannerHarness() {
  const h = hooks(); let valid = true, appListener, alert, values = [], lookups = [];
  const home = { locked: false, setBarcode: value => values.push(value), lookup: async value => lookups.push(value) };
  const ctx = { ticket: {}, runtime: { home } };
  const mocks = { react: h.react, 'expo-router': { useFocusEffect: fn => h.react.useEffect(fn, []) },
    'react-native': { Alert: { alert: (...args) => { alert = args; } }, AppState: { currentState: 'active',
      addEventListener: (_name, fn) => { appListener = fn; return { remove() {} }; } } },
    './rawSplitApi': { rawSplitSessionIsCurrent: () => valid }, './RawSplitContext': { useRawSplitContext: () => ctx } };
  const { useRawSplitHomeScreen } = load('homashyo/useRawSplitHomeScreen.ts', mocks);
  return { render: () => h.render(() => useRawSplitHomeScreen()), values, lookups, alert: () => alert,
    invalidate: () => { valid = false; }, app: value => appListener(value), unmount: h.unmount };
}
test('scanner displays detected code and requires confirmation before source lookup', async () => {
  const h = scannerHarness(); let flow = h.render(); flow.scan(); flow = h.render();
  assert.equal(flow.visible, true); assert.equal(flow.cameraActive, true); assert.equal(flow.isScannerCurrent(), true);
  flow.complete('CODE-123'); assert.deepEqual(h.values, ['CODE-123']); assert.deepEqual(h.lookups, []);
  assert.equal(h.alert()[1], 'CODE-123'); h.alert()[2][1].onPress(); await flush(); assert.deepEqual(h.lookups, ['CODE-123']); h.unmount();
});
test('scanner rejects background, lost session, and confirmation after the session changes', async () => {
  const h = scannerHarness(); let flow = h.render(); flow.scan(); flow = h.render(); h.app('background');
  flow.complete('wrong'); assert.deepEqual(h.values, []); h.app('active'); flow = h.render(); flow.complete('current');
  h.invalidate(); h.alert()[2][1].onPress(); await flush(); assert.deepEqual(h.lookups, []); h.unmount();
});
test('history detail reuses native sheet and defers printer picker until sheet dismissal', async () => {
  let current = true, opened, options, closes = 0, selections = 0, reprints = 0;
  const controller = { selectPrinter: async () => { selections++; }, getSnapshot: () => ({ printer: null }), reprint: async () => { reprints++; } }, sheet = { isOpen: () => false,
    open: (node, nextOptions) => { opened = node; options = nextOptions; }, close: () => { closes++; } };
  const ctx = { ticket: {}, runtime: { history: controller } };
  const mocks = { 'react/jsx-runtime': jsx, 'react-native': { Alert: { alert() {} } }, '../nativeSheet': { useNativeSheet: () => sheet },
    './rawSplitApi': { rawSplitSessionIsCurrent: () => current }, './RawSplitContext': { useRawSplitContext: () => ctx },
    './RawSplitDetails': { RawSplitIssueDetails: 'IssueDetails' }, './RawSplitResultBinding': { RawSplitResultBinding: 'ResultBinding' } };
  const { useRawSplitHistoryActions } = load('homashyo/useRawSplitHistoryActions.tsx', mocks, true), flow = useRawSplitHistoryActions();
  flow.onResult({ id: 'result' }); assert.equal(opened.type, 'ResultBinding'); assert.equal(options.dismissible, true);
  opened.props.onSelectPrinterAfterDismiss(); assert.equal(closes, 1); assert.equal(selections, 0); options.onDismiss(); await flush(); assert.equal(selections, 1);
  flow.onResult({ id: 'reprint' }); await opened.props.onReprintRequest(); await opened.props.onReprintRequest();
  assert.equal(reprints, 0); options.onDismiss(); await flush(); assert.equal(reprints, 1);
  flow.onResult({ id: 'second' }); opened.props.onSelectPrinterAfterDismiss(); current = false; options.onDismiss(); await flush(); assert.equal(selections, 1);
  current = true; const issue = { id: 'issue' }; flow.onIssue(issue, true); assert.equal(opened.type, 'IssueDetails'); assert.equal(opened.props.issue, issue);
});

test('a prior scan confirmation cannot look up after a second scan, Back, or background/resume', async () => {
  for (const action of ['second', 'back', 'background']) {
    const h = scannerHarness(); let flow = h.render(); flow.scan(); flow = h.render(); flow.complete('OLD');
    const confirmOld = h.alert()[2][1].onPress; flow = h.render();
    if (action === 'second') { flow.scan(); flow = h.render(); flow.complete('NEW'); }
    else if (action === 'back') { flow.scan(); flow = h.render(); flow.close(); }
    else { h.app('background'); h.app('active'); }
    confirmOld(); await flush(); assert.deepEqual(h.lookups, [], action); h.unmount();
  }
});
test('repeated camera events cannot complete or look up a second detection', () => {
  const h = scannerHarness(); let flow = h.render(); flow.scan(); flow = h.render(); flow.complete('ONE'); flow.complete('TWO');
  assert.deepEqual(h.values, ['ONE']); assert.equal(h.alert()[1], 'ONE'); assert.deepEqual(h.lookups, []); h.unmount();
});
test('provider composes the real picker owner, enables only a current witness, and cancels on transition', async () => {
  const h = hooks(); h.react.createContext = () => ({ Provider: 'ContextProvider' }); let reset, witnessListener, runtimeOptions, disposals = 0, renderedRequest, current = true;
  const discovery = load('gscale/gscaleDiscovery.ts');
  const { createTransientDevicePicker } = load('shared/printing/transientDevicePicker.ts', { '../../gscale/gscaleDiscovery': discovery });
  const { RawSplitPickerCoordinator } = load('homashyo/rawSplitPickerCoordinator.ts');
  const mocks = { 'react/jsx-runtime': jsx, react: h.react, 'react-native': { Alert: { alert() {} }, View: 'View', Text: 'Text' },
    'expo-router': { router: { replace() {} } }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../auth': { registerSessionResetHook: fn => { reset = fn; return () => {}; } },
    '../preparation/PreparationNotice': { PreparationNotice: 'Notice' }, '../preparation/usePreparationNotice': { usePreparationNotice: () => ({ show() {}, message: '' }) },
    '../shared/printing/transientDevicePickerRuntime': { createNativeTransientDevicePicker: isCurrent => {
      renderedRequest = createTransientDevicePicker({ isCurrent, scan: async () => ({ servers: [], candidateCount: 0 }), probe: async () => null }); return renderedRequest; } },
    './rawSplitApi': { rawSplitSessionIsCurrent: () => current }, './rawSplitDeviceSelection': { rawSplitDeviceSelection: value => value, validateRawSplitDeviceSelection() {} },
    './RawSplitPickerOverlay': { RawSplitPickerOverlay: 'Overlay' }, './rawSplitPickerCoordinator': { RawSplitPickerCoordinator },
    './rawSplitPrintRuntime': { rawSplitUnsupportedReason: () => 'blocked' }, './rawSplitRuntime': { createRawSplitRuntime: options => { runtimeOptions = options; return { dispose() { disposals++; } }; } } };
  const { RawSplitProvider } = load('homashyo/RawSplitContext.tsx', mocks, true), props = { session: { token: 'real-session-placeholder' }, ticket: {}, onLogout() {}, children: 'screen',
    subscribeWitness: listener => { witnessListener = listener; return () => {}; }, witnessVersion: () => 0 };
  const render = () => h.render(() => RawSplitProvider(props)); render(); assert.equal(runtimeOptions.canMutate(), true);
  const pending = runtimeOptions.selectPrinter(); const tree = render(); const content = tree.props.children.props.children;
  assert.equal(content[0].props.importantForAccessibility, 'no-hide-descendants'); assert.equal(content[2].type, 'Overlay');
  assert.equal(content[2].props.request, renderedRequest); current = false; witnessListener(); assert.equal(await pending, null); assert.equal(disposals, 1);
  assert.equal(runtimeOptions.canMutate(), false); assert.equal(render().type, 'View'); h.unmount(); await flush();
});

test('late cancellation or dismiss from an old confirmation cannot close the next scanner', () => {
  const h = scannerHarness(); let flow = h.render(); flow.scan(); flow = h.render(); flow.complete('OLD');
  const oldAlert = h.alert(); flow = h.render(); flow.scan(); flow = h.render(); assert.equal(flow.isScannerCurrent(), true);
  oldAlert[2][0].onPress(); oldAlert[3].onDismiss(); flow = h.render(); assert.equal(flow.isScannerCurrent(), true); assert.equal(flow.visible, true); h.unmount();
});
test('both profile routes reuse the shared Profile without a worker daily-work callback', () => {
  const context = { session: { profile: { role: 'homashyo_rezkachi' } }, onLogout() {} }, ProfileScreen = () => null, guard = () => true;
  for (const platform of ['ios', 'android']) {
    const mocks = { 'react/jsx-runtime': jsx, 'react-native': { PlatformColor: value => value },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../components/ProfileScreen': { ProfileScreen },
      '../preparation/PreparationUI.android': { usePreparationText: () => value => value }, '../preparation/PreparationUI': { usePreparationText: () => value => value },
      './useRawSplitProfileGuard': { useRawSplitProfileGuard: () => guard }, './RawSplitContext': { useRawSplitContext: () => context },
      './RawSplitFrame.android': { RawSplitFrame: 'RawSplitFrame' } };
    const Screen = load(`homashyo/RawSplitProfileScreen.${platform}.tsx`, mocks, true).RawSplitProfileScreen;
    const profile = Screen().props.children; assert.equal(profile.type, ProfileScreen); assert.equal(profile.props.session, context.session);
    assert.equal(profile.props.onLogout, context.onLogout); assert.equal('onDailyWork' in profile.props, false);
    assert.equal(profile.props.isCurrent, guard); assert.equal(profile.props.settingsUnavailableMessage, 'Profil sozlamalari hozircha mavjud emas.');
  }
});

test('demo-token home shows a stable non-redirect warning without backend, print or unverified logout', async () => {
  const demo = session('homashyo_rezkachi', ['raw_material.split'], 'test-mode-token');
  assert.equal(routes.homeTarget(demo, 'ios'), '/ios-homashyo'); const h = gateHarness(demo); h.render(); await flush();
  const tree = h.render(); assert.equal(tree.type, 'View'); assert.equal(tree.props.children.props.children, 'Demo/test rejimi hozir mavjud emas.');
  assert.equal(h.render().type, 'View'); assert.equal(h.logoutCalls(), 0); assert.equal(h.clearCalls(), 0); h.unmount();
});

test('authorized shell captures one witness and never recaptures the same stale owner', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush();
  const element = h.render(), renderAuthorized = h.activate(element); let tree = renderAuthorized();
  assert.equal(tree.type, 'Security'); assert.equal(h.captures(), 1); const ticket = tree.props.children.props.ticket; ticket.check();
  h.setWitness(false); assert.throws(() => ticket.check(), /invalid/); tree = renderAuthorized(); assert.equal(h.captures(), 1);
  h.setWitness(true); renderAuthorized(); assert.equal(h.captures(), 1); h.unmount();
});
test('a shell that cannot capture a witness stays on the explanation instead of looping or silently recapturing', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush(); const element = h.render();
  h.setCaptureAllowed(false); const renderAuthorized = h.activate(element); let tree = renderAuthorized();
  assert.equal(tree.type, 'View'); assert.match(tree.props.children[0].props.children, /Sessiya o‘zgargan/); assert.equal(h.captures(), 1);
  h.setCaptureAllowed(true); tree = renderAuthorized(); assert.equal(tree.type, 'View'); assert.equal(h.captures(), 1); h.unmount();
});

test('provider subscribes then rechecks a witness invalidated before subscription completed', () => {
  const h = hooks(); h.react.createContext = () => ({ Provider: 'ContextProvider' }); let current = true, disposals = 0, subscribeCalls = 0;
  class Picker { dispose() {} }
  const mocks = { 'react/jsx-runtime': jsx, react: h.react, 'react-native': { Alert: { alert() {} }, View: 'View', Text: 'Text' },
    'expo-router': { router: { replace() {} } }, '../components/WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    '../auth': { registerSessionResetHook: () => () => {} }, '../preparation/PreparationNotice': { PreparationNotice: 'Notice' },
    '../preparation/usePreparationNotice': { usePreparationNotice: () => ({ show() {}, message: '' }) },
    '../shared/printing/transientDevicePickerRuntime': {}, './rawSplitApi': { rawSplitSessionIsCurrent: () => current },
    './rawSplitDeviceSelection': {}, './RawSplitPickerOverlay': { RawSplitPickerOverlay: 'Overlay' }, './rawSplitPickerCoordinator': { RawSplitPickerCoordinator: Picker },
    './rawSplitPrintRuntime': { rawSplitUnsupportedReason: () => 'blocked' }, './rawSplitRuntime': { createRawSplitRuntime: () => ({ dispose() { disposals++; } }) } };
  const { RawSplitProvider } = load('homashyo/RawSplitContext.tsx', mocks, true);
  const props = { session: { token: 'real-placeholder' }, ticket: {}, onLogout() {}, children: 'screen', witnessVersion: () => 0,
    subscribeWitness: () => { subscribeCalls++; current = false; return () => {}; } };
  const render = () => h.render(() => RawSplitProvider(props)); render(); assert.equal(subscribeCalls, 1); assert.equal(disposals, 1);
  assert.equal(render().type, 'View'); h.unmount();
});

test('stale logout confirmation neither logs out nor clears the PIN', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush();
  const renderAuthorized = h.activate(h.render()), tree = renderAuthorized(); h.setWitness(false); tree.props.onLogout(); await flush();
  assert.equal(h.logoutCalls(), 0); assert.equal(h.clearCalls(), 0); assert.equal(h.redirects(), 0); h.unmount();
});
test('logout completion does not redirect when a different account became current', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush();
  const renderAuthorized = h.activate(h.render()), tree = renderAuthorized(); let finish; h.setLogout(() => new Promise(done => { finish = done; }));
  tree.props.onLogout(); h.setCurrent(session('customer', ['customer.access'])); finish(); await flush();
  assert.equal(h.logoutCalls(), 1); assert.equal(h.clearCalls(), 0); assert.equal(h.redirects(), 0); h.unmount();
});

test('logout completion cannot redirect while a new login is pending, even with no current session', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush();
  const renderAuthorized = h.activate(h.render()), tree = renderAuthorized(); let finish; h.setLogout(() => new Promise(done => { finish = done; }));
  tree.props.onLogout(); h.setCurrent(null); h.setTransitioning(true); finish(); await flush();
  assert.equal(h.logoutCalls(), 1); assert.equal(h.clearCalls(), 0); assert.equal(h.redirects(), 0); h.unmount();
});
test('ordinary logout completion redirects when no other session or login exists', async () => {
  const h = gateHarness(session('homashyo_rezkachi', ['raw_material.split'])); h.render(); await flush();
  const renderAuthorized = h.activate(h.render()), tree = renderAuthorized(); tree.props.onLogout(); await flush();
  assert.equal(h.logoutCalls(), 1); assert.equal(h.redirects(), 1); h.unmount();
});
