const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const scope = load('sessionReadScope'), routes = load('shared/appRoutes'), search = load('shared/searchActivityStore');
const { NotificationHiddenStore } = load('shared/notificationStores', { './searchActivityStore': search });
const guards = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
function fixture() {
  const data = new Map(), session = { baseUrl: 'https://server.example', token: 'token', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access', 'admin.activity.read'] };
  const witness = { session, generation: 1 }; let active = true;
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); } };
  const store = new NotificationHiddenStore(storage, () => session), listeners = new Set();
  const api = load('admin/adminActivityBinding', { '../auth': { isSessionWitnessCurrent: value => active && value === witness,
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); } }, '../sessionReadScope': scope,
    '../shared/appRoutes': routes, '../shared/notificationStoresRuntime': { notificationHiddenStore: store }, './adminProductionRequest': guards });
  return { session, witness, data, storage, store, binding: api.createAdminActivityBinding(session, witness), listeners,
    retire() { active = false; listeners.forEach(listener => listener()); } };
}

test('real Activity binding uses the shared V2 key and trims/deduplicates all current IDs', async () => {
  const f = fixture(); assert.deepEqual([...await f.binding.hidden.load(() => {})], []);
  assert.deepEqual([...await f.binding.hidden.hideAll([' b ', 'a', 'a', ''], () => {})], ['b', 'a']);
  assert.deepEqual(JSON.parse(f.data.get('notification_hidden_v1')), { 'admin:one': ['a', 'b'] });
});
test('binding retires on original witness, permission or scope loss without touching storage', async () => {
  for (const change of [f => f.retire(), f => { f.session.baseUrl = 'https://other.example'; }, f => { f.session.capabilities = ['admin.access']; }]) {
    const f = fixture(); change(f); assert.equal(f.binding.generation(), null);
    await assert.rejects(f.binding.hidden.hideAll(['old'], () => {}), /session changed/); assert.equal(f.data.size, 0);
  }
});
test('binding checks the captured witness during an asynchronous hidden load', async () => {
  const f = fixture(); let finish; f.storage.getItem = () => new Promise(resolve => { finish = resolve; });
  const pending = f.binding.hidden.load(() => {}), rejected = assert.rejects(pending, /session changed/);
  f.retire(); finish('{"admin:one":["old"]}'); await rejected;
  assert.deepEqual([...f.store.hiddenIdsForProfile(f.session)], []);
});
test('binding subscriptions follow session transitions and callback guards cannot reenter an expired operation', async () => {
  const f = fixture(); let calls = 0; const unsubscribe = f.binding.subscribe(() => { calls++; });
  await assert.rejects(f.binding.hidden.hideAll(['old'], () => { f.retire(); }), /session changed/);
  assert.equal(f.data.size, 0); assert.equal(calls, 1); unsubscribe(); assert.equal(f.listeners.size, 0);
});
