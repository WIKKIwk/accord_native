const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function setup() {
  const snapshot = { session: {} }, watchers = new Set(), resets = new Set(); let current = true, route = true;
  const mocks = { '../auth': { registerSessionResetHook: fn => { resets.add(fn); return () => resets.delete(fn); },
    subscribeSessionWitness: fn => { watchers.add(fn); return () => watchers.delete(fn); } },
  '../shared/appRoutes': { appRoutes: { apparatusPaddonDetail: '/detail' }, canOpenRoute: () => route },
  './rezkaSessionGuard': { isRezkaSessionCurrent: (value, access) => value === snapshot && access === 'master' && current } };
  const filename = path.resolve(__dirname, '../src/rezka/rezkaPaddonDetailLifetime.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: mod.exports, snapshot, watchers, resets,
    lose: reason => { if (reason === 'session') current = false; else route = false; for (const watch of [...watchers]) watch(); },
    loseSilently: () => { current = false; },
    restore: () => { current = true; route = true; } };
}
test('reset closes the original owner, isolates bad subscribers and unregisters its hooks', async () => {
  const h = setup(), owner = h.api.createRezkaPaddonDetailOwner(h.snapshot, ' a ', ' P1 '); let notified = 0;
  assert.ok(Object.isFrozen(owner)); assert.deepEqual(h.api.rezkaPaddonDetailOwnerInput(owner), { snapshot: h.snapshot, apparatusId: 'a', code: 'P1' });
  h.api.subscribeRezkaPaddonDetailOwner(owner, () => { throw Error('listener'); });
  h.api.subscribeRezkaPaddonDetailOwner(owner, async () => { throw Error('late listener'); });
  h.api.subscribeRezkaPaddonDetailOwner(owner, () => { notified++; });
  await Promise.all([...h.resets].map(reset => reset())); await new Promise(resolve => setImmediate(resolve));
  assert.equal(notified, 1); assert.equal(h.api.rezkaPaddonDetailOwnerInput(owner), null);
  assert.equal(h.watchers.size, 0); assert.equal(h.resets.size, 0); owner.close(); assert.equal(notified, 1);
});
test('a stale owner detected during a render retires immediately and notifies other fragments afterward', async () => {
  const h = setup(), owner = h.api.createRezkaPaddonDetailOwner(h.snapshot, 'a', 'P1'); let notified = 0, unmounted = 0;
  h.api.subscribeRezkaPaddonDetailOwner(owner, () => { notified++; });
  const unsubscribe = h.api.subscribeRezkaPaddonDetailOwner(owner, () => { unmounted++; }); h.loseSilently();
  assert.equal(h.api.rezkaPaddonDetailOwnerInput(owner), null); assert.equal(notified, 0);
  unsubscribe(); await new Promise(resolve => queueMicrotask(resolve)); assert.equal(notified, 1); assert.equal(unmounted, 0);
  h.restore(); assert.equal(h.api.rezkaPaddonDetailOwnerInput(owner), null);
  assert.equal(h.watchers.size, 0); assert.equal(h.resets.size, 0);
});
test('session or route ABA cannot revive the original owner; a new owner is distinct', () => {
  for (const reason of ['session', 'route']) {
    const h = setup(), old = h.api.createRezkaPaddonDetailOwner(h.snapshot, 'a', 'P1'); h.lose(reason); h.restore();
    assert.equal(h.api.rezkaPaddonDetailOwnerInput(old), null); assert.equal(h.watchers.size, 0); assert.equal(h.resets.size, 0);
    const fresh = h.api.createRezkaPaddonDetailOwner(h.snapshot, 'a', 'P1'); assert.ok(h.api.rezkaPaddonDetailOwnerInput(fresh));
    assert.equal(h.api.rezkaPaddonDetailOwnerInput({ close() {} }), null); fresh.close();
    assert.equal(h.watchers.size, 0); assert.equal(h.resets.size, 0);
  }
});
