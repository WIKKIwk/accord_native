// Lifecycle tests use mocked hooks only. No native camera or permission prompt is opened.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/rezka/${file}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { RezkaScannerOwner } = load('rezkaScannerOwner.ts');
function setup(appState = 'active') {
  const slots = [], effects = [], calls = []; let cursor = 0, focused = true, current = true, appListener, reset, watch, focusEffect, focusCleanup;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
  const useMemo = (factory, deps) => { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { value: factory(), deps }; return slots[index].value; };
  const react = { useMemo, useCallback: (fn, deps) => useMemo(() => fn, deps), useSyncExternalStore: (_subscribe, get) => get(),
    useEffect: (setup, deps) => { const index = cursor++; if (!effects[index] || !same(effects[index].deps, deps)) {
      effects[index]?.cleanup?.(); effects[index] = { deps, setup, pending: true }; } } };
  const snapshot = { session: { marker: 'captured' } };
  const { useRezkaScanner } = load('useRezkaScanner.ts', { react, './rezkaScannerOwner': { RezkaScannerOwner },
    './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => { calls.push(['current', value, access]); return current; } },
    'react-native': { AppState: { currentState: appState, addEventListener: (type, listener) => {
      assert.equal(type, 'change'); appListener = listener; return { remove: () => { calls.push('app.remove'); appListener = null; } }; } } },
    '../auth': { registerSessionResetHook: fn => { reset = fn; return () => { calls.push('reset.remove'); reset = null; }; },
      subscribeSessionWitness: fn => { watch = fn; return () => { calls.push('watch.remove'); watch = null; }; } },
    'expo-router': { useFocusEffect: callback => react.useEffect(() => {
      focusEffect = callback; if (focused) focusCleanup = callback();
      return () => { focusCleanup?.(); focusCleanup = null; focusEffect = null; };
    }, [callback]) } });
  const render = () => { cursor = 0; const value = useRezkaScanner(snapshot);
    effects.forEach(effect => { if (effect?.pending) { effect.pending = false; effect.cleanup = effect.setup(); } }); return value; };
  const first = render();
  return { render, first, calls, snapshot, app: value => appListener(value), reset: () => reset(),
    invalidate: () => { current = false; watch(); }, focus: value => {
      focused = value; if (value) focusCleanup = focusEffect(); else { focusCleanup?.(); focusCleanup = null; }
    }, unmount: () => effects.forEach(effect => effect?.cleanup?.()) };
}
test('scanner hook keeps the captured witness and synchronously gates app inactivity without dismissing the dialog', async () => {
  const t = setup(), scanner = t.first; assert.equal(scanner.isCurrent(), true);
  const pending = scanner.open(), ticket = t.render().state.ticket;
  t.app('inactive'); assert.equal(scanner.accepts(ticket), false); assert.equal(t.render().state.ticket, ticket);
  scanner.accept(ticket, 'inactive'); t.app('background'); assert.equal(t.render().state.ticket, ticket);
  t.app('active'); scanner.accept(ticket, 'current'); const result = await pending;
  assert.equal(result.value, 'current'); assert.equal(result.isCurrent(), true);
  assert.ok(t.calls.filter(Array.isArray).every(call => call[1] === t.snapshot && call[2] === 'split')); t.unmount();
});
test('focus loss, reset and witness invalidation cancel the exact pending scan before React rerenders', async () => {
  for (const condition of ['focus', 'reset', 'witness']) {
    const t = setup(), scanner = t.first, pending = scanner.open(), ticket = t.render().state.ticket;
    if (condition === 'focus') t.focus(false);
    if (condition === 'reset') await t.reset();
    if (condition === 'witness') t.invalidate();
    scanner.accept(ticket, 'stale'); assert.equal(await pending, null, condition); assert.equal(t.render().state.ticket, null); t.unmount();
  }
});
test('runtime reset permanently retires the owner instead of allowing a stale callback to reopen it', async () => {
  const t = setup(), scanner = t.first; await t.reset();
  assert.equal(scanner.isCurrent(), false); assert.equal(await scanner.open(), null);
  t.app('inactive'); t.app('active'); assert.equal(scanner.isCurrent(), false); t.unmount();
});
test('cleanup removes each listener and old completion; a screen mounted while inactive cannot scan', async () => {
  const t = setup('inactive'); assert.equal(await t.first.open(), null);
  t.app('active'); const pending = t.first.open(), ticket = t.render().state.ticket;
  t.unmount(); t.first.accept(ticket, 'stale'); assert.equal(await pending, null);
  assert.equal(t.first.isCurrent(), false);
  assert.deepEqual(t.calls.filter(value => typeof value === 'string'), ['watch.remove', 'reset.remove', 'app.remove']);
});
