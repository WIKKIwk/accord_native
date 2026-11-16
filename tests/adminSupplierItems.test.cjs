const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, checked, deferred, flush } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard'), uri = load('admin/dartUri');
const catalog = load('shared/catalogApi', { '../authorizedFetch': {}, '../appPreferences': {}, './mobileApiException': {}, './searchActivityStore': { SearchActivityStore: class {} } });
const models = load('admin/adminSupplierDetailModel', { '../shared/catalogApi': catalog });
const { AdminSupplierItemsController } = load('admin/adminSupplierItemsController', { '../shared/camera/synchronousGuard': strict });
class SourceException extends Error { toString() { return `Exception: ${this.message}`; } }
const item = code => catalog.supplierItemFromJson({ code, name: `Item ${code}` }), dto = () => models.adminSupplierDetailFromJson({ ref: 'dto ref', name: 'Supplier', assigned_items: [item('A')] });
function fixture(mode = 'add', overrides = {}) {
  let valid = true; const calls = [];
  const deps = { mode, isCurrent: () => valid, detail: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('detail'); return dto(); },
    assigned: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('assigned'); return [item('A'), item('B')]; },
    all: async (guard, witness) => { guard(); assert.equal(witness(), true); calls.push('all'); return [item('B'), item('A'), item('a'), item('B')]; },
    mutate: async (selected, guard) => { guard(); calls.push(['mutate', selected.code]); return dto(); }, ...overrides };
  const controller = new AdminSupplierItemsController(deps);
  return { deps, calls, controller, start: async () => { controller.start(); await flush(); }, retire: () => { valid = false; }, restore: () => { valid = true; } };
}
test('supplier Add loads detail before full catalog, excludes exact DTO codes and preserves order/duplicates', async () => {
  const f = fixture(); await f.start(); assert.deepEqual(f.calls, ['detail', 'all']); assert.equal(f.controller.getSnapshot().supplierName, 'Supplier'); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.code), ['B', 'a', 'B']);
});
test('supplier View reads its separate assigned endpoint after detail rather than relying on detail.assigned_items', async () => {
  const f = fixture('view'); await f.start(); assert.deepEqual(f.calls, ['detail', 'assigned']); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.code), ['A', 'B']);
});
test('initial detail/list failures end loading with the source empty table and no invented retry/notice state', async () => {
  for (const failure of ['detail', 'all', 'assigned']) {
    const f = fixture(failure === 'assigned' ? 'view' : 'add', { [failure]: async () => { throw Error('offline'); } }); await f.start();
    assert.equal(f.controller.getSnapshot().loading, false); assert.deepEqual(f.controller.getSnapshot().items, []); assert.equal(Object.hasOwn(f.controller.getSnapshot(), 'error'), false); assert.equal(Object.hasOwn(f.controller.getSnapshot(), 'notice'), false);
  }
});
test('supplier item prompt is authentic, repeated/forged actions cannot replace it and confirmed write drops every exact duplicate code', async () => {
  const f = fixture(); await f.start(); const selected = f.controller.getSnapshot().items[0]; f.controller.request({ ...selected }); assert.equal(f.controller.getSnapshot().prompt, null);
  f.controller.request(selected); const prompt = f.controller.getSnapshot().prompt; f.controller.request(f.controller.getSnapshot().items[1]); assert.equal(f.controller.getSnapshot().prompt, prompt);
  await f.controller.confirm({ ...prompt }); assert.equal(f.calls.length, 2); await f.controller.confirm(prompt); assert.deepEqual(f.calls.at(-1), ['mutate', 'B']); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.code), ['a']); assert.equal(f.controller.getSnapshot().mutating, false);
});
test('dismissed prompt cannot dispatch; failed mutation retains table, ends busy and throws without a new user message', async () => {
  const f = fixture('view', { mutate: async () => { throw Error('write failed'); } }); await f.start(); const selected = f.controller.getSnapshot().items[0]; f.controller.request(selected); const old = f.controller.getSnapshot().prompt;
  f.controller.dismiss(old); await f.controller.confirm(old); f.controller.request(selected); const before = f.controller.getSnapshot().items;
  await assert.rejects(f.controller.confirm(f.controller.getSnapshot().prompt), /write failed/); assert.equal(f.controller.getSnapshot().items, before); assert.equal(f.controller.getSnapshot().mutating, false);
});
test('all row actions stay disabled while source mutating is true, even after the first prompt has closed', async () => {
  const pending = deferred(), f = fixture('add', { mutate: async () => pending.promise }); await f.start(); f.controller.request(f.controller.getSnapshot().items[0]); const confirm = f.controller.confirm(f.controller.getSnapshot().prompt);
  f.controller.request(f.controller.getSnapshot().items[1]); assert.equal(f.controller.getSnapshot().prompt, null); assert.equal(f.controller.getSnapshot().mutating, true);
  pending.resolve(dto()); await confirm; assert.equal(f.controller.getSnapshot().mutating, false);
});
test('original owner retirement between sequential reads or during write suppresses later effects and scrubs rows/prompt', async () => {
  const read = deferred(), f = fixture('add', { detail: async () => read.promise }); f.controller.start(); f.retire(); read.resolve(dto()); await flush(); assert.equal(f.controller.getSnapshot().valid, false); assert.deepEqual(f.calls, []);
  const pending = deferred(), x = fixture('view', { mutate: async () => pending.promise }); await x.start(); x.controller.request(x.controller.getSnapshot().items[0]); const confirm = x.controller.confirm(x.controller.getSnapshot().prompt); x.retire(); pending.resolve(dto()); await assert.rejects(confirm); assert.deepEqual(x.controller.getSnapshot().items, []); x.restore(); x.controller.start(); assert.equal(x.controller.getSnapshot().valid, false);
});
test('StrictMode reattachment replaces the read lifetime and ignores an original pending assigned response', async () => {
  const reads = [], f = fixture('view', { assigned: (guard, witness) => { const pending = deferred(); reads.push({ pending, guard, witness }); return pending.promise; } });
  f.controller.start(); await flush(); f.controller.dispose(); f.controller.start(); await flush(); assert.throws(reads[0].guard); assert.throws(reads[0].witness);
  reads[0].pending.resolve([item('Old')]); reads[1].pending.resolve([item('New')]); await flush(); assert.deepEqual(f.controller.getSnapshot().items.map(item => item.code), ['New']);
});
function api(fetch) { return load('admin/adminSupplierItemsApi', { '../authorizedFetch': { authorizedFetch: fetch }, '../shared/catalogApi': catalog, './adminProductionRequest': checked,
  './adminSupplierDetailApi': { AdminSupplierDetailApiException: SourceException }, './adminSupplierDetailModel': models, './dartUri': uri }); }
test('supplier item API preserves raw refs/codes with Dart encoding and exact GET/POST/DELETE payloads', async () => {
  const calls = [], guard = () => {}, witness = () => true, a = api(async (_session, path, init, check, timeout, options) => {
    check(); calls.push({ path, init, timeout, options }); return { status: 200, json: async () => path.includes('/assigned?') ? [{ code: 'A' }] : {} }; });
  await a.adminAssignedSupplierItems({}, ' raw~* ', guard, witness); await a.adminAssignSupplierItem({}, ' raw~* ', ' code ', guard); await a.adminRemoveSupplierItem({}, ' raw~* ', ' code~* ', guard);
  assert.deepEqual(calls.map(c => [c.path, c.init?.method ?? 'GET']), [['/v1/mobile/admin/suppliers/items/assigned?ref=+raw~%2A+', 'GET'], ['/v1/mobile/admin/suppliers/items/add?ref=+raw~%2A+', 'POST'], ['/v1/mobile/admin/suppliers/items/remove?ref=+raw~%2A+&item_code=+code~%2A+', 'DELETE']]);
  assert.equal(calls[0].options.readWitness, witness); assert.equal(calls[0].timeout, 10000); assert.deepEqual(JSON.parse(calls[1].init.body), { item_code: ' code ' }); assert.equal(calls[2].init.body, undefined);
});
test('supplier item API keeps source plain Exceptions and guards body/model failures before returning', async () => {
  const bad = api(async () => ({ status: 500 }));
  for (const [method, args, failure] of [['adminAssignedSupplierItems', ['r'], 'Admin assigned supplier items failed'], ['adminAssignSupplierItem', ['r', 'i'], 'Admin assign supplier item failed'], ['adminRemoveSupplierItem', ['r', 'i'], 'Admin remove supplier item failed']]) await assert.rejects(bad[method]({}, ...args), error => String(error) === `Exception: ${failure}`);
  let valid = true; const guard = () => { if (!valid) throw Error('retired'); }, a = api(async () => ({ status: 200, json: async () => { valid = false; return []; } }));
  await assert.rejects(a.adminAssignedSupplierItems({}, 'r', guard, () => valid), /retired/); await assert.rejects(a.adminAssignSupplierItem({}, 'r', 'i', guard), /retired/);
});
test('supplier item owner selects exact route admission and original raw ref while scope/epoch retirement cannot revive', async () => {
  for (const mode of ['add', 'view']) {
    const session = { token: 'token' }, witness = { session }, calls = []; let scope = 'scope', epoch = 1;
    const factory = load('admin/adminSupplierItemsSession', { '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => 'token', isSessionWitnessCurrent: value => value === witness },
      '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminSupplierItemsAdd: 'add route', adminSupplierItemsView: 'view route' }, canOpenRoute: (_session, route) => { calls.push(route); return true; } },
      '../shared/camera/synchronousGuard': strict, './adminSupplierItemsController': { AdminSupplierItemsController: class { constructor(deps) { this.deps = deps; } } },
      './adminSupplierDetailApi': { adminSupplierDetail: async (_s, ref) => calls.push(['detail', ref]) }, './adminCustomerDetailApi': { readAdminCustomerAvailableItems: async () => [] },
      './adminSupplierItemsApi': { adminAssignedSupplierItems: async () => [], adminAssignSupplierItem: async (_s, ref, code) => calls.push(['add', ref, code]), adminRemoveSupplierItem: async (_s, ref, code) => calls.push(['remove', ref, code]) } });
    const owner = factory.createAdminSupplierItemsSession(session, witness, () => true, ' raw ref ', mode); assert.equal(owner.current(), true); assert.equal(calls[0], `${mode} route`);
    await owner.controller.deps.detail(() => {}, () => true); await owner.controller.deps.mutate(item(' code '), () => {}); assert.deepEqual(calls.at(-1), [mode === 'add' ? 'add' : 'remove', ' raw ref ', ' code ']);
    scope = 'new'; assert.equal(owner.current(), false); scope = 'scope'; epoch++; assert.equal(owner.current(), false);
  }
});
