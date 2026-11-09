const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup(listenerMode = '') {
  const snapshot = { session: {} }, binding = {}, calls = []; let current = true, route = true, ownerOpen = true, watch, reset, bindingWatch, get, cleanup;
  const mocks = { react: { useCallback: fn => fn, useRef: value => ({ current: value }), useSyncExternalStore: (subscribe, read) => {
    get = read; cleanup = subscribe(() => { calls.push('changed'); if (listenerMode === 'throw') throw Error('view listener');
      if (listenerMode === 'async') return Promise.reject(Error('late listener')); }); return read(); } },
  '../auth': { subscribeSessionWitness: fn => { watch = fn; return () => calls.push('unwatch'); },
    registerSessionResetHook: fn => { reset = fn; return () => calls.push('unregister'); } },
  '../shared/appRoutes': { appRoutes: { apparatusPaddonDetail: '/detail' }, canOpenRoute: (s, path) => s === snapshot.session && route && path === '/detail' },
  './rezkaPaddonDetailRead': { isRezkaPaddonDetailBinding: (value, owner) => value === binding && owner === snapshot && ownerOpen,
    subscribeRezkaPaddonDetailBinding: (_value, fn) => { bindingWatch = fn; return () => calls.push('binding.remove'); } },
  './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current } };
  const filename = path.resolve(__dirname, '../src/rezka/useRezkaPaddonDetailAccess.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const initial = mod.exports.useRezkaPaddonDetailAccess(snapshot, binding);
  return { initial, calls, get: () => get(), cleanup: () => cleanup(), reset: () => reset(),
    loseSession: () => { current = false; watch(); }, restoreSession: () => { current = true; watch(); },
    loseRoute: () => { route = false; watch(); }, restoreRoute: () => { route = true; watch(); },
    closeOwner: () => { ownerOpen = false; bindingWatch(); } };
}
test('a witness or route loss retires the captured header even after an ABA restoration', () => {
  for (const reason of ['session', 'route']) {
    const h = setup(); assert.equal(h.initial, true);
    if (reason === 'session') { h.loseSession(); h.restoreSession(); } else { h.loseRoute(); h.restoreRoute(); }
    assert.equal(h.get(), false); assert.ok(h.calls.includes('changed')); h.cleanup();
    assert.ok(h.calls.includes('unwatch')); assert.ok(h.calls.includes('unregister'));
  }
});
test('a session reset retires the header even if its session still appears current', async () => {
  const h = setup(); assert.equal(h.initial, true); await h.reset(); assert.equal(h.get(), false);
  assert.ok(h.calls.includes('changed')); h.cleanup();
});
test('closing the original view lifetime redacts an already mounted fragment', () => {
  const h = setup(); assert.equal(h.initial, true); h.closeOwner();
  assert.equal(h.get(), false); assert.ok(h.calls.includes('changed')); h.cleanup(); assert.ok(h.calls.includes('binding.remove'));
});
test('a throwing view listener cannot fail a session reset or restore old content', async () => {
  for (const mode of ['throw', 'async']) {
    const h = setup(mode); await h.reset(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.get(), false); assert.ok(h.calls.includes('changed')); h.cleanup();
  }
});
