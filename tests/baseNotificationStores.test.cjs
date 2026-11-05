const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const search = load('shared/searchActivityStore');
const { NotificationHiddenStore, NotificationUnreadStore, RefreshHub } = load('shared/notificationStores', { './searchActivityStore': search });
function memory() { const data = new Map(); return { data, getItem: async key => data.get(key) ?? null,
  setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) }; }
const session = (ref, role = 'supplier', capabilities = ['supplier.access']) => ({ profile: { role, ref }, capabilities });

test('hidden notifications persist sorted unique IDs separately for each access role', async () => {
  const storage = memory(), one = session('one'), two = session('two');
  const hidden = new NotificationHiddenStore(storage, () => one); let changes = 0; hidden.subscribe(() => { changes++; });
  await hidden.hideAll(null, [' b ', 'a', 'a', '']);
  await hidden.hideAll(two, ['x']); await hidden.hideAll(one, ['a']);
  assert.deepEqual(JSON.parse(storage.data.get('notification_hidden_v1')), { 'supplier:one': ['a', 'b'], 'supplier:two': ['x'] });
  assert.equal(changes, 2);
  const restarted = new NotificationHiddenStore(storage, () => null); await restarted.load();
  assert.deepEqual([...restarted.hiddenIdsForProfile(one)], ['a', 'b']);
  await restarted.clearAll(); assert.equal(restarted.hiddenIdsForProfile(one).size, 0);
});

test('unread notification IDs can be consumed, seen, and retained independently', async () => {
  const storage = memory(), one = session('one'), unread = new NotificationUnreadStore(storage, () => one);
  await unread.markUnread(null, [' a ', 'b', 'c']);
  assert.deepEqual([...await unread.consumeUnread(one, [' c ', 'z'])], ['c']);
  await unread.markSeen(one, ['a']);
  assert.deepEqual([...unread.unreadIdsForProfile(one)], ['b']);
  await unread.retainForProfile(one, ['missing']); assert.equal(unread.hasUnreadForProfile(one), false);
  assert.equal(JSON.parse(storage.data.get('notification_unread_v1'))['supplier:one'], undefined);
});

test('refresh hub increments even when the same topic is emitted twice', () => {
  const hub = new RefreshHub(); let calls = 0; const stop = hub.subscribe(() => { calls++; });
  hub.emit('orders'); hub.emit('orders'); stop(); hub.emit('other');
  assert.equal(calls, 2); assert.equal(hub.version, 3); assert.equal(hub.topic, 'other');
});


test('mark seen can remove an empty ID loaded from old persisted data', async () => {
  const storage = memory(), one = session('one');
  storage.data.set('notification_unread_v1', JSON.stringify({ 'supplier:one': [''] }));
  const unread = new NotificationUnreadStore(storage, () => one); await unread.load();
  await unread.markSeen(one, [' ']);
  assert.equal(unread.hasUnreadForProfile(one), false);
});
