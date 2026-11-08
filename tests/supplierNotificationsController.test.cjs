const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const screenModel = load('supplier/supplierScreenModel', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
  '../shared/searchNormalizer': load('shared/searchNormalizer'),
});
const { SupplierNotificationsController } = load('supplier/supplierNotificationsController', { './supplierScreenModel': screenModel });
const record = id => ({ id, status: 'pending', item_code: id, item_name: id, sent_qty: 1, accepted_qty: 0, uom: 'kg', note: '', highlight: '' });
const wait = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const session = { profile: { ref: 'S' } }, calls = [], listeners = new Set();
  const hidden = new Set(['hidden']), unread = new Set(['second', 'hidden', 'stale']);
  const store = { historyItems: [record('first'), record('second'), record('hidden')],
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refreshHistory: async () => { calls.push(['refresh']); for (const listener of listeners) listener(); } };
  const hiddenStore = { load: async () => {}, hiddenIdsForProfile: () => new Set(hidden), hideAll: async (_s, ids) => {
    const values = [...ids]; calls.push(['hide', values]); values.forEach(id => hidden.add(id));
  } };
  const unreadStore = { load: async () => {}, unreadIdsForProfile: () => new Set(unread), markSeen: async (_s, ids) => {
    const values = [...ids]; calls.push(['seen', values]); values.forEach(id => unread.delete(id));
  }, retainForProfile: async (_s, ids) => { const values = [...ids]; calls.push(['retain', values]);
    for (const id of unread) if (!values.includes(id)) unread.delete(id);
  } };
  const controller = new SupplierNotificationsController(session, store, hiddenStore, unreadStore, id => calls.push(['open', id]));
  return { controller, calls, hidden, unread, store, listeners };
}

test('history synchronization marks hidden IDs seen, retains current IDs and lists unread first', async () => {
  const f = fixture(); f.controller.start(); await wait(); await f.controller.syncFromStore();
  assert.deepEqual([...f.unread], ['second']);
  assert.deepEqual(f.controller.visibleItems.map(item => item.id), ['second', 'first']);
  assert.deepEqual([...f.controller.highlightedIds], ['second']);
  assert.ok(f.calls.some(call => call[0] === 'seen' && call[1].includes('hidden')));
  assert.ok(f.calls.some(call => call[0] === 'retain' && call[1].length === 3));
  f.controller.stop();
});

test('opening marks seen before navigating and removes highlight; clear hides all current history', async () => {
  const f = fixture(); f.controller.start(); await wait(); await f.controller.syncFromStore();
  await f.controller.open('second');
  assert.deepEqual(f.calls.slice(-2), [['seen', ['second']], ['open', 'second']]);
  assert.equal(f.controller.highlightedIds.has('second'), false);
  await f.controller.clearAll();
  assert.deepEqual(f.calls.slice(-2), [['hide', ['first', 'second', 'hidden']], ['seen', ['first', 'second', 'hidden']]]);
  assert.deepEqual(f.controller.visibleItems, []);
  f.controller.stop();
});

test('refresh synchronizes history and a stopped screen does not navigate after delayed mark-seen', async () => {
  const f = fixture(); f.controller.start(); await wait(); await f.controller.reload();
  assert.ok(f.calls.some(call => call[0] === 'refresh'));
  assert.ok(f.calls.some(call => call[0] === 'retain'));
  f.controller.stop();
  assert.equal(f.listeners.size, 0);
  await f.controller.open('first');
  assert.ok(!f.calls.some(call => call[0] === 'open'));
});
