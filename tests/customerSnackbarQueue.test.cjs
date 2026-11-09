const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}

function deliveryHook(failures) {
  const slots = [], effects = [], transitions = [], detail = { record: { id: 'dn', status: 'pending' } };
  let index = 0, firstRender = true, calls = 0;
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback: fn => fn,
    useEffect(fn) { if (firstRender) effects.push(fn); },
    useSyncExternalStore() {},
  };
  const hook = load('useCustomerScreens.ts', { react,
    './customerApi': { customerDeliveryDetail: async () => detail, customerRespondDelivery: async () => {
      const failure = failures[calls++]; if (failure && typeof failure.then === 'function') return await failure; throw failure;
    } },
    './CustomerContext': { useCustomerContext: () => ({ session: {}, store: { applyDetailTransition: (...args) => transitions.push(args) } }),
      useCustomerText: () => ({ method: (_, { error }) => `Failed: ${error}` }) },
    '../shared/notificationStoresRuntime': { refreshHub: {} },
  }).useCustomerDelivery;
  const render = () => { index = 0; const result = hook('dn', () => { throw Error('must not navigate'); }); firstRender = false; return result; };
  render(); const cleanup = effects[0]();
  return { render, cleanup, transitions, calls: () => calls };
}

test('repeated identical response failures queue independently and ignore stale dismissals', async () => {
  const f = deliveryHook([Error('offline'), Error('offline')]);
  await new Promise(resolve => setImmediate(resolve));
  await f.render().send({ deliveryNoteID: 'dn', approve: true });
  const first = f.render(); assert.equal(first.message, 'Failed: Error: offline');
  await first.send({ deliveryNoteID: 'dn', approve: true });
  assert.equal(f.render().message, first.message);
  first.clearMessage();
  const second = f.render(); assert.equal(second.message, first.message);
  assert.notEqual(second.messageId, first.messageId);
  first.clearMessage(); assert.equal(f.render().messageId, second.messageId);
  second.clearMessage(); assert.equal(f.render().message, '');
  assert.equal(f.calls(), 2); assert.deepEqual(f.transitions, []); f.cleanup();
});

test('different response failures stay in source order until each notice closes', async () => {
  const f = deliveryHook([Error('first'), Error('second')]);
  await new Promise(resolve => setImmediate(resolve));
  await f.render().send({ deliveryNoteID: 'dn', approve: true });
  const first = f.render(); await first.send({ deliveryNoteID: 'dn', approve: true });
  assert.equal(f.render().message, 'Failed: Error: first');
  first.clearMessage(); const second = f.render(); assert.equal(second.message, 'Failed: Error: second');
  second.clearMessage(); assert.equal(f.render().message, ''); f.cleanup();
});

test('sequential failures from the same render are both retained', async () => {
  const f = deliveryHook([Error('first'), Error('second')]);
  await new Promise(resolve => setImmediate(resolve));
  const current = f.render();
  await current.send({ deliveryNoteID: 'dn', approve: true });
  await current.send({ deliveryNoteID: 'dn', approve: true });
  const first = f.render(); assert.equal(first.message, 'Failed: Error: first'); first.clearMessage();
  const second = f.render(); assert.equal(second.message, 'Failed: Error: second'); second.clearMessage();
  assert.equal(f.render().message, ''); f.cleanup();
});

test('an in-flight response is not duplicated and an unmounted screen does not enqueue its failure', async () => {
  let reject; const pending = new Promise((_, fail) => { reject = fail; });
  const f = deliveryHook([pending]); await new Promise(resolve => setImmediate(resolve));
  const current = f.render(), first = current.send({ deliveryNoteID: 'dn', approve: true });
  await current.send({ deliveryNoteID: 'dn', approve: true });
  assert.equal(f.calls(), 1); f.cleanup(); reject(Error('offline')); await first;
  assert.equal(f.render().message, ''); assert.deepEqual(f.transitions, []);
});

test('native snackbar effects replay equal text when its queued identity changes', () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  for (const platform of ['ios', 'android']) {
    const effects = [], onDismiss = () => {};
    const react = { useEffect: (fn, deps) => effects.push({ fn, deps }), useRef: () => ({ current: null }) };
    const mocks = { 'react/jsx-runtime': jsx, react,
      'react-native': { View: 'View', Text: 'Text', PlatformColor: x => x },
      '@expo/ui/jetpack-compose': { Host: 'Host', SnackbarHost: 'SnackbarHost' } };
    const component = load(`CustomerSnackbar.${platform}.tsx`, mocks).CustomerSnackbar;
    component({ message: 'same', messageId: 1, onDismiss });
    component({ message: 'same', messageId: 2, onDismiss });
    assert.notDeepEqual(effects[0].deps, effects[1].deps);
  }
});

test('Android snackbar ignores an old completion after its effect is cleaned up', async () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, effects = [], completions = [], calls = [];
  const host = { showSnackbar(options) { calls.push(options); return new Promise(resolve => completions.push(resolve)); } };
  const react = { useEffect: (fn, deps) => effects.push({ fn, deps }), useRef: () => ({ current: host }) };
  const component = load('CustomerSnackbar.android.tsx', { 'react/jsx-runtime': jsx, react,
    'react-native': { View: 'View' }, '@expo/ui/jetpack-compose': { Host: 'Host', SnackbarHost: 'SnackbarHost' } }).CustomerSnackbar;
  const dismissed = [];
  component({ message: 'same', messageId: 1, onDismiss: () => dismissed.push(1) });
  const cleanFirst = effects[0].fn();
  component({ message: 'same', messageId: 2, onDismiss: () => dismissed.push(2) });
  cleanFirst(); const cleanSecond = effects[1].fn();
  assert.deepEqual(calls, [{ message: 'same', duration: 'short' }, { message: 'same', duration: 'short' }]);
  completions[0](); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(dismissed, []);
  completions[1](); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(dismissed, [2]); cleanSecond();
});

test('iOS snackbar clears the old timer and starts a fresh four-second timer for the next notice', () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, effects = [], timers = [], cleared = [], dismissed = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect: (fn, deps) => effects.push({ fn, deps }) },
    'react-native': { View: 'View', Text: 'Text', PlatformColor: x => x } };
  const filename = path.resolve(__dirname, '../src/customer/CustomerSnackbar.ios.tsx');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  const fakeRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', source)(fakeRequire, mod, mod.exports,
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, id => cleared.push(id));
  mod.exports.CustomerSnackbar({ message: 'same', messageId: 1, onDismiss: () => dismissed.push(1) });
  const cleanFirst = effects[0].fn();
  mod.exports.CustomerSnackbar({ message: 'same', messageId: 2, onDismiss: () => dismissed.push(2) });
  cleanFirst(); const cleanSecond = effects[1].fn();
  assert.deepEqual(timers.map(timer => timer.delay), [4000, 4000]); assert.deepEqual(cleared, [1]);
  timers[1].fn(); assert.deepEqual(dismissed, [2]); cleanSecond(); assert.deepEqual(cleared, [1, 2]);
});
