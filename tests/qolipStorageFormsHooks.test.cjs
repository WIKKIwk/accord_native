const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(kind) {
  let memoIndex = 0, effectIndex = 0, original, expired = false, current = true;
  const memo = [], effects = [], pending = [], listeners = new Set(), calls = [], cache = new Map();
  const boundary = { current: () => current, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  const equal = (a, b) => a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useMemo: (factory, deps) => { const i = memoIndex++; if (!equal(memo[i]?.deps, deps)) memo[i] = { deps, value: factory() }; return memo[i].value; },
    useSyncExternalStore: (_subscribe, get) => get(),
    useLayoutEffect: (effect, deps) => { const i = effectIndex++; if (!equal(effects[i]?.deps, deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: effect() }; }); },
  };
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), mod = new Module(filename, module); cache.set(name, mod);
    mod.require = key => key === 'react' ? react : key === './useQolipPassiveBoundary' ? { useQolipPassiveBoundary: value => {
      original ??= value; if (value !== original || !current) expired = true;
      return { valid: !expired, isCurrent: () => !expired && current };
    } } : key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : require(key);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return mod.exports;
  }
  const hook = load('qolip/useQolipStorageForms.ts')[kind === 'create' ? 'useQolipPaddonCreate' : 'useQolipInspection'];
  const props = { boundary, warehouses: ['W', 'X'], expected: ['A'], close: value => calls.push(value), scan: async () => 'A' };
  return { props, calls, render: (next = props) => { memoIndex = 0; effectIndex = 0; const value = hook(next); pending.splice(0).forEach(effect => effect()); return value; },
    expire: () => { current = false; [...listeners].forEach(fn => fn()); }, stop: () => effects.forEach(effect => effect.cleanup?.()) };
}
test('create hook retains selection through equivalent parent rebuilds, returns the exact draft and closes once', () => {
  const h = harness('create'); let state = h.render(); state.choose('X'); state = h.render({ ...h.props, warehouses: ['W', 'X'], initial: { warehouse: 'W' } });
  assert.equal(state.warehouse, 'X'); state.submit(); state.submit(); state.dismiss();
  assert.deepEqual(h.calls, [{ warehouse: 'X', location: '', note: '' }]); h.stop();
});
test('inspection hook retains scanned codes through new callback/expected-array identities and saves without requiring completeness', async () => {
  const h = harness('inspect'); let state = h.render(); state.scan(); await tick();
  state = h.render({ ...h.props, expected: ['A', 'B'], scan: async () => 'this replacement must not reset the original dialog' });
  state = h.render({ ...h.props, expected: ['A', 'B'] }); assert.deepEqual(state.codes.map(x => x.value), ['A']); assert.deepEqual(state.missing, ['B']);
  state.save(); state.save(); assert.deepEqual(h.calls, [['A']]); h.stop();
});
test('inspection button cancel is blocked during a scan; backdrop/back dismissal retires its pending result', async () => {
  const h = harness('inspect'); let resolve; h.props.scan = () => new Promise(done => { resolve = done; }); let state = h.render(); state.scan(); state = h.render();
  assert.equal(state.scanning, true); state.cancel(); assert.deepEqual(h.calls, []); state.dismiss(); resolve('late'); await tick();
  state.save(); assert.deepEqual(h.calls, [null]); h.stop();
});
test('boundary replacement blanks every hook field and seals previously captured handlers', async () => {
  for (const kind of ['create', 'inspect']) {
    const h = harness(kind), old = h.render(); if (kind === 'create') old.choose('W'); else { old.scan(); await tick(); }
    const state = h.render({ ...h.props, boundary: { ...h.props.boundary } });
    assert.equal(state.invalid, true);
    if (kind === 'create') { assert.equal(state.warehouse, null); assert.deepEqual(state.warehouses, []); old.submit(); }
    else { assert.deepEqual(state.codes, []); assert.deepEqual(state.missing, []); old.save(); }
    old.dismiss(); assert.deepEqual(h.calls, []); h.stop();
  }
});
