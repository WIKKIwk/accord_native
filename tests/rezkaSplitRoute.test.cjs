const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}, withJsx = false) {
  const filename = path.resolve(__dirname, `../src/rezka/${file}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    ...(withJsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } }).outputText, filename);
  return mod.exports;
}
const { RezkaScannerOwner } = load('rezkaScannerOwner.ts');
function setup(initial, canBack = true) {
  let snapshot = initial, current = true; const calls = [];
  const owner = new RezkaScannerOwner(() => current); owner.mount(); owner.setFocused(true); owner.setForeground(true);
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { Redirect: 'Redirect', router: { canGoBack: () => canBack, back: () => calls.push('back') } },
    'react-native': { ActivityIndicator: 'ActivityIndicator', View: 'View' }, './RezkaSessionWaiting': { RezkaSessionWaiting: 'Waiting' },
    './RezkaSplit': { RezkaSplitScreen: 'SplitScreen' }, './RezkaTestSessionUnavailable': { RezkaTestSessionUnavailable: 'TestUnavailable' },
    './RezkaSplitScanner': { RezkaSplitScanner: 'Scanner' },
    './useRezkaScanner': { useRezkaScanner: value => { calls.push(['scanner', value]); return { state: owner.getSnapshot(),
      open: owner.open, isCurrent: owner.isCurrent, accepts: owner.accepts,
      accept: (ticket, value, generation) => owner.accept(ticket, value, generation), cancel: ticket => owner.cancel(ticket) }; } },
    './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => { calls.push(['check', value, access]); return current; } },
    './useRezkaShell': { useRezkaShellSession: access => { calls.push(['capture', access]); return snapshot; } } };
  const route = load('RezkaSplitRoute.tsx', mocks, true);
  const render = () => { const root = route.default(); return typeof root.type === 'function' ? root.type(root.props) : root; };
  return { render, page: () => { const root = render(); return root.type === 'Fragment' ? root.props.children[0] : root; }, owner,
    calls, invalidate: () => { current = false; owner.recheckSession(); }, setSnapshot: value => { snapshot = value; } };
}
test('split deep link waits for a validated session and never fabricates a printer', () => {
  const t = setup(undefined); assert.equal(t.render().type, 'View');
  t.setSnapshot(null); assert.equal(t.render().type, 'Redirect');
  t.setSnapshot('transition-pending'); assert.equal(t.render().type, 'Waiting');
  t.setSnapshot('test-token-unavailable'); assert.equal(t.render().type, 'TestUnavailable');
  const snapshot = { session: {} }; t.setSnapshot(snapshot); const page = t.page();
  assert.equal(page.type, 'SplitScreen'); assert.equal(page.props.snapshot, snapshot); assert.equal(page.props.printer, null);
  assert.deepEqual(t.calls.filter(x => Array.isArray(x) && x[0] === 'capture').map(x => x[1]), Array(5).fill('split'));
  assert.equal(t.calls.find(x => Array.isArray(x) && x[0] === 'scanner')[1], snapshot);
  t.invalidate(); page.props.onBack(); assert.ok(!t.calls.includes('back'));
  assert.equal(t.render().type, 'Redirect');
});
test('split home without a previous screen does not offer a looping back action', () => {
  const page = setup({ session: {} }, false).page();
  assert.equal(page.type, 'SplitScreen'); assert.equal(page.props.onBack, undefined);
});
test('scanner is rendered only for its dialog ticket and late native callbacks cannot affect a newer ticket', async () => {
  const snapshot = { session: {} }, t = setup(snapshot), page = t.page();
  assert.equal(t.render().props.children[1], null); assert.equal(page.props.printer, null);
  const first = page.props.scan.open(), firstTree = t.render().props.children[1];
  assert.equal(firstTree.type, 'Scanner'); assert.equal(firstTree.key, t.owner.getSnapshot().ticket);
  assert.equal(firstTree.props.active, true); assert.equal(firstTree.props.isCurrent(), true);
  firstTree.props.close(); assert.equal(await first, null);
  const second = page.props.scan.open(), secondTree = t.render().props.children[1];
  assert.notEqual(secondTree.key, firstTree.key); assert.equal(firstTree.props.isCurrent(), false);
  firstTree.props.accept('stale'); firstTree.props.close(); assert.equal(t.owner.getSnapshot().ticket, secondTree.key);
  secondTree.props.accept('QR'); const result = await second; assert.equal(result.value, 'QR'); assert.equal(result.isCurrent(), true);
  assert.equal(t.render().props.children[1], null);
});
test('route invalidation synchronously drops a displayed scanner result and returns to the route guard', async () => {
  const t = setup({ session: {} }), pending = t.page().props.scan.open(), scanner = t.render().props.children[1];
  t.invalidate(); assert.equal(scanner.props.isCurrent(), false); scanner.props.accept('stale');
  assert.equal(await pending, null); assert.equal(t.render().type, 'Redirect');
});
test('a batched inactive/active cycle invalidates old native callbacks even when the dialog ticket is preserved', async () => {
  const t = setup({ session: {} }), pending = t.page().props.scan.open(), old = t.render().props.children[1];
  t.owner.setForeground(false); t.owner.setForeground(true);
  assert.equal(old.props.isCurrent(), false); old.props.accept('queued-before-suspension');
  const next = t.render().props.children[1]; assert.equal(old.key, next.key); assert.notEqual(old.props.generation, next.props.generation);
  assert.equal(next.props.isCurrent(), true); next.props.accept('current'); assert.equal((await pending).value, 'current');
});
