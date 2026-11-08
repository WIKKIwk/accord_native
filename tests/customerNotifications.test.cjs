const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const notifications = loadTs('shared/notificationStores.ts', { './searchActivityStore': { sessionAccessRole: session => session.profile.role } });
const sharedApi = loadTs('shared/notificationApi.ts', { '../authorizedFetch': { authorizedFetch: () => { throw Error('unexpected fetch'); } } });
const logic = loadTs('customer/customerLogic.ts');
const api = loadTs('customer/customerApi.ts', { '../authorizedFetch': {}, '../shared/notificationApi': sharedApi, './customerLogic': logic });
const { CustomerNotificationsController, CUSTOMER_NOTIFICATIONS_CACHE } = loadTs('customer/customerNotifications.ts', { './customerApi': api });
const record = (id, extra = {}) => ({ id, record_type: 'delivery_note', supplier_ref: '', supplier_name: '', item_code: id,
  item_name: id, uom: 'kg', sent_qty: 1, accepted_qty: 0, amount: 0, currency: '', note: '', event_type: '', highlight: '',
  status: 'pending', created_label: '', ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const values = new Map(), writes = [], session = { profile: { role: 'customer', ref: 'c1' } };
  const storage = { async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); writes.push([key, value]); }, async removeItem(key) { values.delete(key); } };
  const hidden = new notifications.NotificationHiddenStore(storage, () => session);
  const unread = new notifications.NotificationUnreadStore(storage, () => session);
  const refreshHub = new notifications.RefreshHub(), scheduled = [], listeners = new Set();
  const store = { loaded: false, loading: false, historyItems: [], bootstraps: 0, refreshes: 0,
    async bootstrap() { this.bootstraps++; }, async refresh() { this.refreshes++; },
    clear() { this.loaded = false; this.loading = false; this.historyItems = []; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, change() { for (const fn of listeners) fn(); } };
  const controller = new CustomerNotificationsController({ session, store, storage, hidden, unread, refreshHub,
    schedule: fn => scheduled.push(fn) });
  return { values, writes, session, storage, hidden, unread, refreshHub, scheduled, store, controller };
}

// Source-derived from customer_notifications_screen_widgets_part_01.dart; no V2 widget test was found.
test('loads cached records, filters hidden IDs and puts highlighted unread records first', async () => {
  const f = fixture();
  await f.storage.setItem(CUSTOMER_NOTIFICATIONS_CACHE, JSON.stringify([record('b'), record('a'), record('c')]));
  await f.unread.markUnread(f.session, ['a', 'c']); await f.hidden.hideAll(f.session, ['c']);
  f.controller.start(); await tick();
  assert.equal(f.store.bootstraps, 1);
  assert.deepEqual(f.controller.items.map(item => item.id), ['a', 'b']);
  assert.deepEqual([...f.controller.highlightedIds], ['a', 'c']);
  f.controller.stop();
});

test('store sync marks hidden seen, retains current IDs and caches unfiltered history', async () => {
  const f = fixture();
  f.store.loaded = true; f.store.historyItems = [record('b'), record('a'), record('c')];
  await f.unread.markUnread(f.session, ['a', 'c', 'obsolete']); await f.hidden.hideAll(f.session, ['c']);
  f.controller.start(); await tick(); await f.controller.syncFromStore();
  assert.deepEqual([...f.unread.unreadIdsForProfile(f.session)], ['a']);
  assert.deepEqual(f.controller.items.map(item => item.id), ['a', 'b']);
  assert.deepEqual(JSON.parse(f.values.get(CUSTOMER_NOTIFICATIONS_CACHE)).map(item => item.id), ['b', 'a', 'c']);
  f.controller.stop();
});

test('marking a detail seen and clearing confirmed history update the reused stores', async () => {
  const f = fixture(); f.store.loaded = true; f.store.historyItems = [record('a'), record('b')];
  await f.unread.markUnread(f.session, ['a', 'b']);
  f.controller.start(); await tick(); await f.controller.syncFromStore();
  await f.controller.markDetailSeen('a');
  assert.deepEqual([...f.unread.unreadIdsForProfile(f.session)], ['b']);
  assert.deepEqual([...f.controller.highlightedIds], ['b']);
  await f.controller.clearAll();
  assert.deepEqual([...f.hidden.hiddenIdsForProfile(f.session)].sort(), ['a', 'b']);
  assert.deepEqual([...f.unread.unreadIdsForProfile(f.session)], []);
  assert.deepEqual(f.controller.items, []);
  f.controller.stop();
});

test('coalesces store updates and reloads only new Customer refresh events', async () => {
  const f = fixture(); f.store.loaded = true; f.store.historyItems = [record('a')];
  f.controller.start(); await tick();
  f.store.change(); f.store.change(); assert.equal(f.scheduled.length, 1);
  f.scheduled.shift()(); await tick();
  assert.deepEqual(JSON.parse(f.values.get(CUSTOMER_NOTIFICATIONS_CACHE)).map(item => item.id), ['a']);
  f.refreshHub.emit('supplier'); assert.equal(f.scheduled.length, 0);
  f.refreshHub.emit('customer'); assert.equal(f.scheduled.length, 1);
  f.scheduled.shift()(); await tick(); assert.equal(f.store.refreshes, 1);
  f.controller.stop(); f.refreshHub.emit('customer'); assert.equal(f.scheduled.length, 0);
});

test('late cache reads after stop cannot repopulate an inactive controller', async () => {
  const f = fixture(); let finish;
  f.storage.getItem = key => key === CUSTOMER_NOTIFICATIONS_CACHE ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(null);
  f.controller.start(); f.controller.stop(); finish(JSON.stringify([record('old')])); await tick();
  assert.deepEqual(f.controller.items, []);
});

test('session reset waits for in-flight cache writes before removing account data', async () => {
  const f = fixture(); f.store.loaded = true; f.store.historyItems = [record('old')];
  f.controller.start(); await tick();
  let finishWrite;
  f.storage.setItem = (key, value) => key === CUSTOMER_NOTIFICATIONS_CACHE ? new Promise(resolve => {
    finishWrite = () => { f.values.set(key, value); resolve(); };
  }) : Promise.resolve();
  const syncing = f.controller.syncFromStore(); await tick();
  const resetting = f.controller.resetSession(); await tick();
  finishWrite(); await syncing; await resetting;
  assert.equal(f.values.has(CUSTOMER_NOTIFICATIONS_CACHE), false);
  assert.deepEqual(f.controller.items, []);
});

test('an old cache read cannot overwrite a newly restarted notification controller', async () => {
  const f = fixture(); const pending = [];
  f.storage.getItem = key => key === CUSTOMER_NOTIFICATIONS_CACHE ? new Promise(resolve => pending.push(resolve)) : Promise.resolve(null);
  f.controller.start(); f.controller.stop(); f.controller.start();
  pending[1](JSON.stringify([record('new')])); await tick();
  pending[0](JSON.stringify([record('old')])); await tick();
  assert.deepEqual(f.controller.items.map(item => item.id), ['new']);
  f.controller.stop();
});
