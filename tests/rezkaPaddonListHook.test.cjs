const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const calls = [], effects = []; let deps, reset, watch, current = true, route = true;
  const snapshot = { session: { assigned_apparatus: ['mine'], profile: { role: 'rezka_master' } } };
  class Controller {
    constructor(value) { deps = value; }
    subscribe = () => () => {}; getSnapshot = () => ({ phase: 'loading' });
    resume() { calls.push('resume'); } suspend() { calls.push('suspend'); } dispose() { calls.push('dispose'); }
    invalidate() { calls.push('invalidate'); } start() { calls.push('start'); }
  }
  class ScopeChanged extends Error {}
  const mocks = { react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (_subscribe, get) => get(), useEffect: fn => effects.push(fn) },
    '../auth': { registerSessionResetHook: fn => { reset = fn; return () => calls.push('reset.remove'); },
      subscribeSessionWitness: fn => { watch = fn; return () => calls.push('watch.remove'); } },
    '../apparatusApi': { adminApparatus: async (session, options) => { calls.push(['catalog', session, options]); options.beforeSend(); return []; } },
    '../shared/appRoutes': { appRoutes: { apparatusPaddons: '/paddons' }, canOpenRoute: (_session, path) => route && path === '/paddons' },
    '../shared/localization': { productionText: (key, locale) => `${locale}:${key}`, localizedGetter: (key, locale) => `${locale}:${key}` },
    './useRezkaShell': { useRezkaLocale: () => 'uz' },
    './rezkaPaddonListModel': { rezkaPaddonListContent: (_state, t, retry) => ({ title: t('worker.paddons'), retry }) },
    './rezkaPaddonListController': { RezkaPaddonListController: Controller },
    './rezkaPaddonRead': { readRezkaPaddons: async (owner, apparatus) => { calls.push(['list', owner, apparatus]); return []; } },
    './rezkaSessionGuard': { RezkaScopeChanged: ScopeChanged, isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current,
      guardedRezkaRequest: async (session, access, witness, mutation, send) => {
        calls.push(['guard', session, access, witness, mutation]); return send(() => { if (!current) throw Error('stale'); calls.push('beforeSend'); });
      } } };
  const filename = path.resolve(__dirname, '../src/rezka/useRezkaPaddonList.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const hook = mod.exports.useRezkaPaddonList(snapshot, 'mine', 'Machine'), cleanup = effects[0]();
  return { calls, deps, hook, snapshot, cleanup, reset: () => reset(), loseSession: () => { current = false; watch(); },
    loseRoute: () => { route = false; watch(); } };
}
test('list hook retains original witness for guarded catalog and real scoped list adapter', async () => {
  const h = setup(); await h.deps.loadApparatus(); await h.deps.loadPaddons('mine');
  assert.deepEqual(h.calls.find(c => Array.isArray(c) && c[0] === 'guard').slice(1), [h.snapshot.session, 'master', h.snapshot, false]);
  const catalog = h.calls.find(c => Array.isArray(c) && c[0] === 'catalog');
  assert.equal(catalog[1], h.snapshot.session); assert.equal(catalog[2].limit, 10000); assert.equal(typeof catalog[2].beforeSend, 'function');
  assert.deepEqual(h.calls.find(c => Array.isArray(c) && c[0] === 'list'), ['list', h.snapshot, 'mine']);
  assert.equal(h.deps.routeId, 'mine'); assert.equal(h.deps.routeName, 'Machine');
  h.snapshot.session.assigned_apparatus.push('other'); assert.deepEqual(h.deps.assigned, ['mine']);
  assert.equal(h.hook.content.retry, 'uz:retry'); h.cleanup();
});
test('reset and witness or route loss invalidate the controller and block a stale catalog callback', async () => {
  for (const reason of ['reset', 'session', 'route']) {
    const h = setup(); await h.deps.loadApparatus();
    const beforeSend = h.calls.find(c => Array.isArray(c) && c[0] === 'catalog')[2].beforeSend;
    if (reason === 'reset') await h.reset(); else if (reason === 'session') h.loseSession(); else h.loseRoute();
    assert.ok(h.calls.includes('invalidate'));
    if (reason !== 'reset') assert.throws(beforeSend);
    h.cleanup(); await new Promise(resolve => setImmediate(resolve));
    assert.ok(h.calls.includes('suspend')); assert.ok(h.calls.includes('dispose')); assert.ok(h.calls.includes('watch.remove'));
  }
});
