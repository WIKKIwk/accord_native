const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function setup(initial, canBack = true) {
  let snapshot = initial, current = true; const calls = [];
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { Redirect: 'Redirect', router: { canGoBack: () => canBack, back: () => calls.push('back') } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' }, './RezkaSessionWaiting': { RezkaSessionWaiting: 'Waiting' },
    './RezkaSplit': { RezkaSplitScreen: 'SplitScreen' }, './RezkaTestSessionUnavailable': { RezkaTestSessionUnavailable: 'TestUnavailable' },
    './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => { calls.push(['check', value, access]); return current; } },
    './useRezkaShell': { useRezkaShellSession: access => { calls.push(['capture', access]); return snapshot; } } };
  const filename = path.resolve(__dirname, '../src/rezka/RezkaSplitRoute.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { render: () => mod.exports.default(), calls, invalidate: () => { current = false; }, setSnapshot: value => { snapshot = value; } };
}
test('split deep link waits for a validated session and never fabricates a printer', () => {
  const t = setup(undefined); assert.equal(t.render().type, 'View');
  t.setSnapshot(null); assert.equal(t.render().type, 'Redirect');
  t.setSnapshot('transition-pending'); assert.equal(t.render().type, 'Waiting');
  t.setSnapshot('test-token-unavailable'); assert.equal(t.render().type, 'TestUnavailable');
  const snapshot = { session: {} }; t.setSnapshot(snapshot); const page = t.render();
  assert.equal(page.type, 'SplitScreen'); assert.equal(page.props.snapshot, snapshot); assert.equal(page.props.printer, null);
  assert.deepEqual(t.calls.filter(x => Array.isArray(x) && x[0] === 'capture').map(x => x[1]), Array(5).fill('split'));
  t.invalidate(); page.props.onBack(); assert.ok(!t.calls.includes('back'));
  assert.equal(t.render().type, 'Redirect');
});
test('split home without a previous screen does not offer a looping back action', () => {
  const page = setup({ session: {} }, false).render();
  assert.equal(page.type, 'SplitScreen'); assert.equal(page.props.onBack, undefined);
});
