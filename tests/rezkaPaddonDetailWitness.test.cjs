// Uses the real in-memory auth witness implementation and mocked HTTP only.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const testFile = path.resolve(__dirname, 'authLoginRollback.test.cjs'), helper = new Module(testFile, module);
helper.filename = testFile; helper.paths = module.paths;
helper._compile(fs.readFileSync(testFile, 'utf8').split("test('failed login retains")[0] + '\nmodule.exports = { auth };', testFile);
function load(auth, loadCatalog) {
  const cache = new Map();
  function get(relative) {
    const file = path.resolve(__dirname, '../src', `${relative}.ts`);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); cache.set(file, mod); mod.filename = file; mod.paths = module.paths;
    mod.require = id => {
      if (id === '../auth' || id === './auth') return auth;
      if (id === '../apparatusApi') return { adminApparatus: loadCatalog ?? (async (_session, options) => { options.beforeSend();
        return [{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'active', sort_order: 1 }]; }) };
      return id.startsWith('.') ? get(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
  }
  return { guard: get('rezka/rezkaSessionGuard'), detail: get('rezka/rezkaPaddonDetailRead') };
}
const master = ref => ({ token: 'master-token', baseUrl: 'https://example.test', imageCacheScope: 'scope',
  profile: { role: 'rezka_master', ref }, capabilities: ['rezka.master.access'], assigned_apparatus: ['apparatus:default:a'], assigned_apparatus_labels: [] });
test('real witness retires an issued binding after same-epoch account ABA', async () => {
  const original = global.fetch; let requests = 0;
  global.fetch = async () => { requests++; return new Response('{"paddon":{"code":"P1","apparatus_id":"apparatus:default:a"},"items":[]}', { status: 200 }); };
  try {
    const auth = helper.exports.auth({}), session = master('one'), other = master('other');
    await auth.saveSession(session); const api = load(auth), snapshot = api.guard.captureRezkaSession(session), epoch = auth.activeSessionEpoch(session);
    const owner = api.detail.createRezkaPaddonDetailOwner(snapshot, 'apparatus:default:a', 'P1');
    const binding = await api.detail.readRezkaPaddonDetail(owner);
    assert.equal(api.detail.isRezkaPaddonDetailBinding(binding, snapshot), true);
    await auth.saveSession(other); await auth.saveSession(session); assert.equal(auth.activeSessionEpoch(session), epoch);
    assert.equal(api.detail.isRezkaPaddonDetailBinding(binding, snapshot), false); assert.equal(requests, 1);
  } finally { global.fetch = original; }
});
test('same-epoch account ABA while the catalog is pending cannot send a stale detail request', async () => {
  const original = global.fetch; let requests = 0, release, catalogs = 0;
  const rows = [{ id: 'apparatus:default:a', name: 'A', operation: 'cut', lifecycle_state: 'active', sort_order: 1 }];
  const pendingCatalog = new Promise(resolve => { release = resolve; });
  global.fetch = async () => { requests++; return new Response('{"paddon":{"code":"P1","apparatus_id":"apparatus:default:a"},"items":[]}', { status: 200 }); };
  try {
    const auth = helper.exports.auth({}), session = master('one'), other = master('other'); await auth.saveSession(session);
    const api = load(auth, async (_session, options) => { options.beforeSend(); return ++catalogs === 1 ? pendingCatalog : rows; });
    const snapshot = api.guard.captureRezkaSession(session), epoch = auth.activeSessionEpoch(session);
    const owner = api.detail.createRezkaPaddonDetailOwner(snapshot, 'apparatus:default:a', 'P1');
    const pending = api.detail.readRezkaPaddonDetail(owner);
    await auth.saveSession(other); await auth.saveSession(session); assert.equal(auth.activeSessionEpoch(session), epoch);
    release(rows); await assert.rejects(pending, e => e.name === 'RezkaScopeChanged'); assert.equal(requests, 0);
    const freshSnapshot = api.guard.captureRezkaSession(session);
    const freshOwner = api.detail.createRezkaPaddonDetailOwner(freshSnapshot, 'apparatus:default:a', 'P1');
    const binding = await api.detail.readRezkaPaddonDetail(freshOwner);
    assert.equal(api.detail.isRezkaPaddonDetailBinding(binding, freshSnapshot), true); assert.equal(requests, 1); freshOwner.close();
  } finally { global.fetch = original; }
});
