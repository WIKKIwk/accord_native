const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? {} : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const strict = load('shared/camera/synchronousGuard.ts'), dart = load('admin/dartJsonString.ts');
const { AdminWarehouseFilterStore, adminWarehouseFilterPreferenceKey } = load('admin/adminWarehouseFilterStore.ts', { '../shared/camera/synchronousGuard': strict, './dartJsonString': dart });
const model = load('admin/adminWarehouseMainModel.ts', { './dartJsonString': dart });
const { AdminWarehouseMainController } = load('admin/adminWarehouseMainController.ts', { '../shared/camera/synchronousGuard': strict, './dartJsonString': dart,
  './adminWarehouseFilterStore': { AdminWarehouseFilterStore }, './adminWarehouseMainModel': model });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function storage(initial = {}) { const values = new Map(Object.entries(initial)), calls = [];
  return { values, calls, async getItem(key) { calls.push(['get', key]); return values.get(key) ?? null; }, async setItem(key, value) { calls.push(['set', key, value]); values.set(key, value); }, async removeItem(key) { calls.push(['remove', key]); values.delete(key); } };
}
const summary = (names = ['A', 'B'], qolipWarehouseNames = []) => ({ sections: names.map(warehouse => ({ warehouse, product_count: 7, reserved_count: 8, assignment_count: 1, assigned_display_names: [] })), qolipWarehouseNames });
const detail = (id = 'raw') => ({ rawStock: [{ id, barcode: id, status: 'available', reserved_order_id: '' }], reservations: [], apparatus: [] });
function fixture({ saved = {}, adminScoped = true } = {}) {
  let current = true; const calls = [], db = storage(saved), preferences = new AdminWarehouseFilterStore(db, 'User', () => current);
  const deps = { isCurrent: () => current, adminScoped, preferences,
    summary: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('summary'); return summary(); },
    detail: async (warehouse, guard) => { guard(); calls.push(['detail', warehouse]); return detail(warehouse); },
    items: async (warehouse, query, offset, guard) => { guard(); calls.push(['items', warehouse, query, offset]); return [{ code: warehouse }]; },
    qolipProducts: async (query, guard) => { guard(); calls.push(['qolip', query]); return []; } };
  const controller = new AdminWarehouseMainController(deps);
  return { controller, deps, calls, db, preferences, start: async () => { controller.start(); await tick(); }, retire: () => { current = false; }, revive: () => { current = true; } };
}
test('preference keys retain exact per-ref/default spelling, trim and default fallback', async () => {
  assert.equal(adminWarehouseFilterPreferenceKey('\u0085 User \u0085'), 'admin.warehouses.selected_warehouse.User');
  assert.equal(adminWarehouseFilterPreferenceKey(' '), 'admin.warehouses.selected_warehouse.default');
  const db = storage({ 'admin.warehouses.selected_warehouse.default': ' A ' }), prefs = new AdminWarehouseFilterStore(db, 'User', () => true);
  assert.equal(await prefs.loadSavedWarehouse(), 'A'); assert.deepEqual(db.calls.map(row => row[1]), ['admin.warehouses.selected_warehouse.User', 'admin.warehouses.selected_warehouse.default']);
  assert.equal(prefs.resolveWarehouse([' b ', ' a ']), 'a'); assert.equal(prefs.resolveWarehouse(['A'], ''), null);
  await prefs.saveWarehouse(' B '); assert.equal(db.values.get('admin.warehouses.selected_warehouse.User'), 'B'); assert.equal(db.values.get('admin.warehouses.selected_warehouse.default'), 'B');
  await prefs.saveWarehouse(''); assert.equal(prefs.cachedWarehouse, null); assert.equal(db.values.size, 0);
});
test('slow saved preference cannot replace a newer manual cache or persist obsolete selection after a later selection', async () => {
  const pending = deferred(), db = storage(); db.getItem = async () => pending.promise;
  const prefs = new AdminWarehouseFilterStore(db, 'User', () => true), read = prefs.loadSavedWarehouse();
  const first = prefs.saveWarehouse('B'), second = prefs.saveWarehouse('C'); pending.resolve('A');
  assert.equal(await read, 'C'); await Promise.all([first, second]); assert.equal(prefs.cachedWarehouse, 'C');
  assert.deepEqual([...db.values.values()], ['C', 'C']); assert.equal(db.calls.some(row => row[2] === 'B'), false);
});
test('preference writes retain original authority at each settlement and local failures keep the cache', async () => {
  let current = true; const pending = deferred(), db = storage(); db.setItem = async (key, value) => { db.calls.push(['set', key, value]); await pending.promise; };
  const prefs = new AdminWarehouseFilterStore(db, 'User', () => current), write = prefs.saveWarehouse('A'); await Promise.resolve(); current = false; pending.resolve(); await write;
  assert.equal(db.calls.length, 1); assert.equal(await prefs.loadSavedWarehouse(), null);
  const broken = new AdminWarehouseFilterStore({ async getItem() { throw Error('offline'); }, async setItem() { throw Error('offline'); }, async removeItem() {} }, 'User', () => true);
  await broken.saveWarehouse('A'); assert.equal(await broken.loadSavedWarehouse(), 'A');
});
test('initial summary never auto-selects the first warehouse; default preference restores canonical available spelling', async () => {
  const empty = fixture(); await empty.start(); assert.equal(empty.controller.getSnapshot().warehouse, null); assert.deepEqual(empty.calls, ['summary']); empty.controller.dispose();
  const f = fixture({ saved: { 'admin.warehouses.selected_warehouse.default': ' a ' } }); await f.start();
  assert.equal(f.controller.getSnapshot().warehouse, 'A'); assert.deepEqual(f.calls.filter(Array.isArray), [['detail', 'A'], ['items', 'A', '', 0]]);
});
test('manual warehouse selection wins a late preference load and selection change clears search, filter and product page', async () => {
  const f = fixture(), saved = deferred(); f.db.getItem = async () => saved.promise; await f.start();
  f.controller.toggleFilter(); f.controller.selectWarehouse(' B '); saved.resolve('A'); await tick();
  assert.equal(f.controller.getSnapshot().warehouse, 'B'); assert.equal(f.controller.getSnapshot().filterExpanded, false); assert.equal(f.controller.getSnapshot().items[0].code, 'B');
  assert.deepEqual(f.calls.filter(row => Array.isArray(row) && row[0] === 'items'), [['items', 'B', '', 0]]);
});
test('header text typed before the product child mounts is retained without an early product read or invented query', async () => {
  const f = fixture({ saved: { 'admin.warehouses.selected_warehouse.default': 'A' } }), pending = deferred(); f.deps.summary = async () => pending.promise;
  f.controller.start(); f.controller.search('typed before load'); await tick(); assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().query, '');
  pending.resolve(summary()); await tick(); assert.equal(f.controller.getSnapshot().search, 'typed before load'); assert.deepEqual(f.calls.at(-1), ['items', 'A', '', 0]);
});
test('source reload refreshes summary+raw detail while live refresh only replaces summary and preserves item page', async () => {
  const f = fixture(); await f.start(); f.controller.selectWarehouse('A'); await tick(); f.calls.length = 0;
  await f.controller.reload(); await tick(); assert.deepEqual(f.calls, ['summary', ['detail', 'A']]); assert.equal(f.controller.getSnapshot().items[0].code, 'A');
  f.calls.length = 0; await f.controller.refreshInPlace(); assert.deepEqual(f.calls, ['summary']);
  f.controller.selectWarehouse('A'); await tick(); assert.deepEqual(f.calls, ['summary', ['detail', 'A']]);
});
test('explicit source parent page controller survives summary failure and retry on the selected Settings page', async () => {
  const f = fixture(); await f.start(); f.controller.setPageTab('settings'); assert.equal(f.controller.getSnapshot().pageTab, 'settings');
  f.deps.summary = async () => { throw Error('summary offline'); }; await assert.rejects(f.controller.refreshInPlace());
  assert.equal(f.controller.getSnapshot().summaryPhase, 'error'); assert.equal(f.controller.getSnapshot().pageTab, 'settings');
  f.deps.summary = async () => summary(); await f.controller.reload(); assert.equal(f.controller.getSnapshot().pageTab, 'settings'); f.controller.dispose();
});
test('raw-detail FutureBuilder retains data while waiting but drops it on error and resets the removed reserved stock tab', async () => {
  const f = fixture(); f.deps.detail = async () => ({ ...detail(), reservations: [{ barcode: 'raw' }] }); await f.start(); f.controller.selectWarehouse('A'); await tick();
  f.controller.setStockTab('reserved'); const original = f.controller.getSnapshot().detail, pending = deferred(); f.deps.detail = () => pending.promise;
  await f.controller.reload(); assert.equal(f.controller.getSnapshot().detailPhase, 'loading'); assert.equal(f.controller.getSnapshot().detail, original); assert.equal(f.controller.getSnapshot().stockTab, 'reserved');
  pending.reject(Error('raw detail unavailable')); await tick(); assert.equal(f.controller.getSnapshot().detailPhase, 'error'); assert.equal(f.controller.getSnapshot().detail, null); assert.equal(f.controller.getSnapshot().stockTab, 'available'); f.controller.dispose();
});
test('deleting the selected warehouse clears per-ref/default preference and a late saved read cannot resurrect it', async () => {
  const f = fixture(), saved = deferred(); await f.preferences.saveWarehouse('A'); f.db.getItem = async () => saved.promise; await f.start();
  assert.equal(f.controller.getSnapshot().warehouse, 'A'); f.deps.summary = async () => summary(['B']); await f.controller.warehouseDeleted(); saved.resolve('A'); await tick();
  const state = f.controller.getSnapshot(); assert.equal(state.warehouse, null); assert.equal(state.detail, null); assert.deepEqual(state.items, []); assert.equal(f.db.values.size, 0);
});
test('summary errors retain their own retry state, detail errors stay separate and stale summary generations cannot publish', async () => {
  const f = fixture(); await f.start(); f.controller.selectWarehouse('A'); await tick(); const old = deferred(); f.deps.summary = async () => old.promise;
  const pending = f.controller.reload().catch(() => {}); f.deps.summary = async () => summary(['A', 'B', 'C']); await f.controller.refreshInPlace(); old.resolve(summary(['Old'])); await pending;
  assert.deepEqual(f.controller.getSnapshot().summary.sections.map(row => row.warehouse), ['A', 'B', 'C']);
  f.deps.detail = async () => { throw Error('detail'); }; await f.controller.reload(); await tick(); assert.equal(f.controller.getSnapshot().summaryPhase, 'ready'); assert.equal(f.controller.getSnapshot().detailPhase, 'error');
  f.deps.summary = async () => { throw Error('summary'); }; await assert.rejects(f.controller.reload(), /summary/); assert.equal(f.controller.getSnapshot().summaryPhase, 'error');
});
test('80-row pagination preserves hasMore and earlier rows on next-page failure so the same offset can be retried', async () => {
  const f = fixture(); let count = 0; f.deps.items = async (warehouse, query, offset, guard) => { guard(); f.calls.push(['items', warehouse, query, offset]);
    if (count++ === 0) return Array.from({ length: 80 }, (_, i) => ({ code: String(i) })); if (count === 2) throw Error('next page'); return [{ code: '80' }]; };
  await f.start(); f.controller.selectWarehouse('A'); await tick(); await f.controller.loadMoreItems(); assert.equal(f.controller.getSnapshot().items.length, 80); assert.equal(f.controller.getSnapshot().hasMore, true);
  await f.controller.loadMoreItems(); assert.equal(f.controller.getSnapshot().items.length, 81); assert.equal(f.controller.getSnapshot().hasMore, false);
  assert.deepEqual(f.calls.filter(row => Array.isArray(row) && row[0] === 'items').map(row => row[3]), [0, 80, 80]);
});
test('search uses source220ms debounce, resets item offset and does not filter raw detail client-side', async () => {
  const f = fixture(); await f.start(); f.controller.selectWarehouse('A'); await tick(); const originalSet = global.setTimeout, originalClear = global.clearTimeout, timers = [];
  global.setTimeout = (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; }; global.clearTimeout = timer => { timer.cancelled = true; };
  try {
    f.controller.search('old'); f.controller.search('\u0085 new \u0085'); assert.equal(timers[0].cancelled, true); assert.equal(timers[1].delay, 220); timers[0].callback(); assert.equal(f.controller.getSnapshot().query, '');
    timers[1].callback(); await tick(); assert.equal(f.controller.getSnapshot().query, 'new'); assert.deepEqual(f.calls.at(-1), ['items', 'A', 'new', 0]); assert.equal(f.controller.getSnapshot().detail.rawStock[0].id, 'A');
  } finally { f.controller.dispose(); global.setTimeout = originalSet; global.clearTimeout = originalClear; }
});
test('Qolip classification follows literal names and assignment names only for admin/brigader; mode change reloads the right source', async () => {
  const f = fixture(); await f.start(); f.controller.selectWarehouse('A'); await tick();
  f.deps.summary = async () => summary(['A', 'B'], [' a ']); await f.controller.refreshInPlace(); await tick(); assert.equal(f.controller.isQolipWarehouse, true); assert.deepEqual(f.calls.at(-1), ['qolip', '']);
  assert.equal(model.adminWarehouseMainIsQolip(' QOLIP OMBORI ', [], true), true); assert.equal(model.adminWarehouseMainIsQolip('A', ['a'], false), false);
});
test('raw reservation counts, editability and Qolip group dedup/order reproduce source helpers', () => {
  const stock = [{ barcode: ' A ', status: 'available', reserved_order_id: '' }, { barcode: 'B', status: 'band', reserved_order_id: '' }, { barcode: 'C', status: 'available', reserved_order_id: 'order' }, { barcode: 'D', status: 'consumed', reserved_order_id: '' }];
  assert.equal(model.adminWarehouseMainAvailableStock(stock).length, 1); assert.equal(model.adminWarehouseMainReservedStock(stock).length, 2); assert.equal(model.adminWarehouseMainReservedCount(stock, [{ barcode: 'A' }]), 1);
  assert.equal(model.adminWarehouseMainCanEditStock(stock[0], [{ barcode: 'a' }]), false); assert.equal(model.adminWarehouseMainCanEditStock(stock[0], []), true);
  const groups = model.adminWarehouseMainQolipGroups([{ code: 'Z', name: 'Beta', item_group: '', qolip_code: 'M1' }, { code: 'z', name: 'Other', item_group: '', qolip_code: ' m1 ' }, { code: '', name: ' Alpha ', item_group: 'X', qolip_code: 'M2' }, { code: 'X', name: '', item_group: '', qolip_code: '' }]);
  assert.deepEqual(groups.map(row => [row.name, row.qolips.length]), [['Alpha', 1], ['Beta', 1]]);
});
test('original detail/item responses after warehouse ABA, account retirement and StrictMode cleanup cannot settle into new reads', async () => {
  const f = fixture(); await f.start(); const first = deferred(), second = deferred(); let reads = 0;
  f.deps.items = async () => ++reads === 1 ? first.promise : second.promise; f.controller.selectWarehouse('A'); f.controller.selectWarehouse('B'); f.controller.selectWarehouse('A');
  first.resolve([{ code: 'old' }]); second.resolve([{ code: 'fresh' }]); await tick(); assert.equal(f.controller.getSnapshot().items[0].code, 'fresh');
  const oldDetail = deferred(); let details = 0; f.deps.detail = async () => ++details === 1 ? oldDetail.promise : detail('reattached');
  f.controller.selectWarehouse('B'); f.controller.dispose(); f.controller.start(); await tick(); oldDetail.resolve(detail('old')); await tick();
  assert.equal(details, 2); assert.equal(f.controller.getSnapshot().detailPhase, 'ready'); assert.equal(f.controller.getSnapshot().detail.rawStock[0].id, 'reattached');
  f.retire(); await f.controller.refreshInPlace(); f.revive(); f.controller.selectWarehouse('A'); assert.equal(f.controller.getSnapshot().valid, false);
});
test('synchronous reentrant selection and search cannot invalidate the newer detail or replace its query', async () => {
  const f = fixture(); await f.start(); let changed = false;
  const unsubscribe = f.controller.subscribe(() => { if (!changed && f.controller.getSnapshot().warehouse === 'A') { changed = true; f.controller.selectWarehouse('B'); } });
  f.controller.selectWarehouse('A'); unsubscribe(); await tick(); assert.equal(f.controller.getSnapshot().warehouse, 'B'); assert.equal(f.controller.getSnapshot().detail.rawStock[0].id, 'B');
  assert.equal(f.calls.some(row => Array.isArray(row) && row[0] === 'detail' && row[1] === 'A'), false);
});
