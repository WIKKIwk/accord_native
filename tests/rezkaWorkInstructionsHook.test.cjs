const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const calls = [], effects = []; let deps, reset, watch, current = true;
  const snapshot = { session: { assigned_apparatus: ['mine'], profile: { role: 'rezka_master' } } };
  class Controller {
    constructor(value) { deps = value; }
    subscribe = () => () => {}; getSnapshot = () => ({ phase: 'loading', apparatus: [] });
    resume() { calls.push('resume'); } suspend() { calls.push('suspend'); } dispose() { calls.push('dispose'); }
    invalidate() { calls.push('invalidate'); } start() { calls.push('start'); }
  }
  const mocks = { react: { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (_s, get) => get(), useEffect: fn => effects.push(fn) },
    '../auth': { registerSessionResetHook: fn => { reset = fn; return () => calls.push('reset.remove'); },
      subscribeSessionWitness: fn => { watch = fn; return () => calls.push('watch.remove'); } },
    '../apparatusApi': { adminApparatus: async (session, options) => { calls.push(['apparatus', session, options]); options.beforeSend(); return []; } },
    '../shared/appRoutes': { appRoutes: { apparatusWorkInstructions: '/instructions' }, canOpenRoute: (_session, route) => route === '/instructions' },
    '../shared/localization': { productionText: (key, locale) => `${locale}:${key}` },
    './useRezkaShell': { useRezkaLocale: () => 'uz' }, './rezkaWorkInstructionsModel': { rezkaWorkInstructionsContent: (_rows, t) => ({ title: t('worker.instructions') }) },
    './rezkaWorkInstructionsController': { RezkaWorkInstructionsController: Controller },
    './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current,
      guardedRezkaRequest: async (session, access, witness, mutation, send) => {
        calls.push(['guard', session, access, witness, mutation]); return send(() => { if (!current) throw new Error('stale'); calls.push('beforeSend'); });
      } } };
  const filename = path.resolve(__dirname, '../src/rezka/useRezkaWorkInstructions.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const hook = mod.exports.useRezkaWorkInstructions(snapshot), cleanup = effects[0]();
  return { calls, hook, deps, snapshot, cleanup, reset: () => reset(), invalidate: () => { current = false; watch(); } };
}
test('instructions read reuses adminApparatus limit 300 and the original master witness including its send guard', async () => {
  const t = setup(); await t.deps.load();
  const guarded = t.calls.find(call => Array.isArray(call) && call[0] === 'guard');
  assert.deepEqual(guarded.slice(1), [t.snapshot.session, 'master', t.snapshot, false]);
  const read = t.calls.find(call => Array.isArray(call) && call[0] === 'apparatus');
  assert.equal(read[1], t.snapshot.session); assert.equal(read[2].limit, 300); assert.equal(typeof read[2].beforeSend, 'function');
  assert.ok(t.calls.includes('beforeSend')); assert.equal(t.hook.content.title, 'uz:worker.instructions'); t.cleanup();
});
test('scope change/reset invalidate the read controller; a stale reader cannot bypass the retained send guard', async () => {
  const t = setup(); assert.equal(t.deps.isCurrent(), true); await t.reset(); assert.ok(t.calls.includes('invalidate'));
  t.invalidate(); assert.equal(t.hook.isCurrent(), false); await assert.rejects(t.deps.load(), /stale/);
  t.cleanup(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(t.calls.includes('suspend')); assert.ok(t.calls.includes('dispose')); assert.ok(t.calls.includes('watch.remove'));
});
