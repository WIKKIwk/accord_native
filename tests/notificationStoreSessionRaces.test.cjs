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
const search = load('shared/searchActivityStore');
const { NotificationHiddenStore, NotificationUnreadStore } = load('shared/notificationStores', { './searchActivityStore': search });
const deferred = () => { let resolve; return { promise: new Promise(yes => { resolve = yes; }), resolve: value => resolve(value) }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const account = server => ({ baseUrl: `https://${server}.example`, profile: { role: 'admin', ref: 'same-ref' }, capabilities: ['admin.access'] });
function memory() { const data = new Map(); return { data, getItem: async key => data.get(key) ?? null,
  setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); } }; }

test('a hidden read completing after reset cannot repopulate the same role/ref on another server', async () => {
  const storage = memory(), read = deferred(), one = account('one'), two = account('two');
  storage.getItem = () => read.promise;
  const store = new NotificationHiddenStore(storage, () => one), pending = store.load();
  const rejected = assert.rejects(pending, /reset/);
  await store.clearAll(); read.resolve('{"admin:same-ref":["old"]}'); await rejected;
  assert.deepEqual([...store.hiddenIdsForProfile(two)], []);
  assert.equal(storage.data.has('notification_hidden_v1'), false);
});

test('a clear awaiting initial hidden data cannot dispatch a write after reset', async () => {
  const storage = memory(), read = deferred(), one = account('one'); let writes = 0;
  storage.getItem = () => read.promise; storage.setItem = async () => { writes++; };
  const store = new NotificationHiddenStore(storage, () => one), pending = store.hideAll(one, ['old']);
  const rejected = assert.rejects(pending, /reset/); await tick();
  await store.clearAll(); // Reset never waits for an old read that has not dispatched a write.
  read.resolve(null); await rejected;
  assert.equal(writes, 0); assert.deepEqual([...store.hiddenIdsForProfile(one)], []);
});

test('reset drains a dispatched old write before removal and a new account write', async () => {
  const storage = memory(), writing = deferred(), order = [], one = account('one'), two = account('two');
  let current = one, first = true;
  storage.setItem = async (key, value) => { order.push(['write', value]); if (first) { first = false; await writing.promise; } storage.data.set(key, value); };
  storage.removeItem = async key => { order.push(['remove']); storage.data.delete(key); };
  const store = new NotificationHiddenStore(storage, () => current); await store.load();
  const old = store.hideAll(one, ['old']), rejected = assert.rejects(old, /reset/); await tick();
  current = two; const reset = store.clearAll(), fresh = store.hideAll(two, ['new']);
  assert.deepEqual([...store.hiddenIdsForProfile(two)], []);
  writing.resolve(); await rejected; await reset; await fresh;
  assert.deepEqual(order.map(row => row[0]), ['write', 'remove', 'write']);
  assert.deepEqual(JSON.parse(storage.data.get('notification_hidden_v1')), { 'admin:same-ref': ['new'] });
  assert.deepEqual([...store.hiddenIdsForProfile(two)], ['new']);
});

test('queued hidden writes recheck their original guard before changing memory or storage', async () => {
  const storage = memory(), writing = deferred(), one = account('one'); let calls = 0, valid = true;
  storage.setItem = async (key, value) => { if (++calls === 1) await writing.promise; storage.data.set(key, value); };
  const store = new NotificationHiddenStore(storage, () => one); await store.load();
  const first = store.hideAll(one, ['one']); await tick();
  const queued = store.hideAllGuarded(one, ['stale'], () => { if (!valid) throw new Error('expired'); });
  const rejected = assert.rejects(queued, /expired/); valid = false; writing.resolve(); await first; await rejected;
  assert.equal(calls, 1); assert.deepEqual([...store.hiddenIdsForProfile(one)], ['one']);
});

test('concurrent hidden mutations preserve both ID sets and malformed loads install no partial state', async () => {
  const storage = memory(), one = account('one'), store = new NotificationHiddenStore(storage, () => one);
  await Promise.all([store.hideAll(one, ['b']), store.hideAll(one, ['a'])]);
  assert.deepEqual(JSON.parse(storage.data.get('notification_hidden_v1')), { 'admin:same-ref': ['a', 'b'] });
  storage.data.set('notification_hidden_v1', '{"admin:same-ref":["leak"],"bad":[3]}');
  const other = new NotificationHiddenStore(storage, () => one); await assert.rejects(other.load(), TypeError);
  assert.deepEqual([...other.hiddenIdsForProfile(one)], []);
});

test('unread mutations share reset ordering and a failed old write does not poison future storage', async () => {
  const storage = memory(), writing = deferred(), one = account('one'); let first = true;
  storage.setItem = async (key, value) => { if (first) { first = false; await writing.promise; throw new Error('disk'); } storage.data.set(key, value); };
  const store = new NotificationUnreadStore(storage, () => one); await store.load();
  const pending = store.markUnread(one, ['old']), rejected = assert.rejects(pending, /disk/); await tick();
  const reset = store.clearAll(); writing.resolve(); await rejected; await reset;
  await store.markUnread(one, ['new']);
  assert.deepEqual(JSON.parse(storage.data.get('notification_unread_v1')), { 'admin:same-ref': ['new'] });
});
