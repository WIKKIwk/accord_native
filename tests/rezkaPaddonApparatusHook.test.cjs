const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const calls = [], effects = []; let deps, reset, watch, current = true, route = true;
  const snapshot = { session: { assigned_apparatus: ['mine'], profile: { role: 'rezka_master' } } };
  class Controller {
    constructor(value) { deps = value; }
    subscribe = () => () => {}; getSnapshot = () => ({ phase: 'loading', apparatus: [] });
    resume() { calls.push('resume'); } suspend() { calls.push('suspend'); } dispose() { calls.push('dispose'); }
    invalidate() { calls.push('invalidate'); } start() { calls.push('start'); }
  }
  class ScopeChanged extends Error {}
  const mocks = { react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (_s, get) => get(), useEffect: fn => effects.push(fn) },
    '../auth': { registerSessionResetHook: fn => { reset = fn; return () => calls.push('reset.remove'); },
      subscribeSessionWitness: fn => { watch = fn; return () => calls.push('watch.remove'); } },
    '../apparatusApi': { adminApparatus: async (session, options) => { calls.push(['apparatus', session, options]); options.beforeSend(); return []; } },
    '../shared/appRoutes': { appRoutes: { apparatusPaddons: '/apparatus-paddons' }, canOpenRoute: (_session, path) => route && path === '/apparatus-paddons' },
    './rezkaPaddonApparatusController': { RezkaPaddonApparatusController: Controller },
    './rezkaSessionGuard': { RezkaScopeChanged: ScopeChanged, isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current,
      guardedRezkaRequest: async (session, access, witness, mutation, send) => {
        calls.push(['guard', session, access, witness, mutation]); return send(() => { if (!current) throw new Error('stale'); calls.push('beforeSend'); });
      } } };
  const filename = path.resolve(__dirname, '../src/rezka/useRezkaPaddonApparatus.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const hook = mod.exports.useRezkaPaddonApparatus(snapshot), cleanup = effects[0]();
  return { calls, hook, deps, snapshot, cleanup, reset: () => reset(), loseSession: () => { current = false; watch(); },
    loseRoute: () => { route = false; watch(); } };
}
test('prepared reader uses the real apparatus function, V2 limit 10000 and captured guarded master witness', async () => {
  const t = setup(); await t.deps.load();
  assert.deepEqual(t.calls.find(c => Array.isArray(c) && c[0] === 'guard').slice(1), [t.snapshot.session, 'master', t.snapshot, false]);
  const read = t.calls.find(c => Array.isArray(c) && c[0] === 'apparatus');
  assert.equal(read[1], t.snapshot.session); assert.equal(read[2].limit, 10000); assert.equal(typeof read[2].beforeSend, 'function');
  assert.ok(t.calls.includes('beforeSend')); assert.deepEqual(t.deps.assigned, ['mine']);
  t.snapshot.session.assigned_apparatus.push('later'); assert.deepEqual(t.deps.assigned, ['mine']); t.cleanup();
});
test('session loss, route loss and reset invalidate; send guard cannot be bypassed', async () => {
  for (const change of ['session', 'route', 'reset']) {
    const t = setup(); assert.equal(t.hook.isCurrent(), true);
    if (change === 'session') t.loseSession(); else if (change === 'route') t.loseRoute(); else await t.reset();
    assert.ok(t.calls.includes('invalidate'), change);
    if (change !== 'reset') { assert.equal(t.hook.isCurrent(), false); await assert.rejects(t.deps.load()); }
    t.cleanup(); await new Promise(resolve => setImmediate(resolve));
    assert.ok(t.calls.includes('suspend')); assert.ok(t.calls.includes('dispose')); assert.ok(t.calls.includes('watch.remove'));
  }
});
test('the same before-send callback rejects a stale session or lost route on a later retry', async () => {
  for (const change of ['session', 'route']) {
    const t = setup(); await t.deps.load();
    const beforeSend = t.calls.find(c => Array.isArray(c) && c[0] === 'apparatus')[2].beforeSend;
    if (change === 'session') t.loseSession(); else t.loseRoute();
    assert.throws(beforeSend, undefined, change);
    assert.equal(t.calls.filter(c => c === 'beforeSend').length, 1); t.cleanup();
  }
});
