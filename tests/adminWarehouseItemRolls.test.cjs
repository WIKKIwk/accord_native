const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), scope = load('sessionReadScope');
const models = load('admin/adminWarehouseItemRollsModel', { '../workerPeremotka': load('workerPeremotka'), './dartJsonString': strings });
const { AdminWarehouseItemRollsController } = load('admin/adminWarehouseItemRollsController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings });
const { AdminWarehouseItemRollsOrderController } = load('admin/adminWarehouseItemRollsOrder', { '../shared/camera/synchronousGuard': sync });
const item = { code: ' C ', warehouse: ' A ', order_id: ' Order ', name: ' Item ' };
const roll = (patch = {}) => ({ stock_id: 'id', warehouse: 'A', item_code: 'C', order_id: ' Order ', paddon_code: '', progress_batch_id: '', barcode: ' BAR ', qty: 2.5, uom: 'kg', accepted_by_display_name: '', accepted_at_unix: 0, ...patch });
function fixture() {
  let account = true, parent = true; const calls = [], pending = deferred(), context = { isCurrent: () => parent, onChanged: async () => {} };
  const controller = new AdminWarehouseItemRollsController({ current: () => account, read: async (received, guard, witness) => { guard(); calls.push({ item: received, guard, witness }); return pending.promise; } });
  controller.start(); return { controller, context, calls, pending, retire: () => { account = false; }, retireParent: () => { parent = false; } };
}
test('real rolls owner starts its500-read before returning the awaited sheet and never invents retries/paging', async () => {
  const f = fixture(), result = f.controller.open(item, f.context); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].item, item); assert.equal(f.controller.getSnapshot().presentation.phase, 'loading');
  let returned = false; result.then(() => { returned = true; }); await tick(); assert.equal(returned, false);
  const rows = [roll(), roll({ stock_id: 'next' })]; f.pending.resolve(rows); await tick(); const value = f.controller.getSnapshot().presentation; assert.equal(value.phase, 'ready'); assert.equal(value.rolls, rows);
  f.controller.showDetails(value.id, rows[1]); const details = f.controller.getSnapshot().presentation.details; assert.equal(details.roll, rows[1]); assert.equal(details.index, 1);
  f.controller.dismissDetails(value.id, details.id, false); assert.equal(f.controller.getSnapshot().presentation.details.closing, true); f.controller.dismissDetails(value.id, details.id, true); assert.equal(f.controller.getSnapshot().presentation.details, null);
  f.controller.close(value.id); await result; assert.equal(returned, true); assert.equal(f.controller.getSnapshot().presentation, null);
});
test('roll child native tickets reject old rows/details/dismissal and stale read completion after actual close', async () => {
  const f = fixture(), old = f.controller.open(item, f.context), id = f.controller.getSnapshot().presentation.id;
  f.controller.beginDismiss(id); assert.equal(f.calls[0].witness(), false); f.controller.close(id); await old;
  const next = f.controller.open(item, f.context), freshId = f.controller.getSnapshot().presentation.id; f.controller.close(id); assert.equal(f.controller.getSnapshot().presentation.id, freshId);
  f.pending.resolve([roll()]); await tick(); assert.equal(f.controller.getSnapshot().presentation.id, freshId); assert.equal(f.controller.getSnapshot().presentation.phase, 'ready');
  f.controller.showDetails(freshId, roll()); assert.equal(f.controller.getSnapshot().presentation.details, null, 'foreign DTO cannot open a detail sheet');
  f.controller.close(freshId); await next;
});
test('original parent/account authority and provider StrictMode disposal fence each pending read and resolve the old child', async () => {
  for (const retire of [f => f.retire(), f => f.retireParent(), f => { f.controller.dispose(); f.controller.start(); }]) {
    const f = fixture(), result = f.controller.open(item, f.context); retire(f); assert.equal(f.calls[0].witness(), false); f.pending.resolve([roll()]); await tick();
    assert.equal(f.controller.getSnapshot().presentation?.phase === 'ready', false); f.controller.dispose(); await result;
  }
  const f = fixture(); await f.controller.open({ ...item, warehouse: ' ' }, f.context); await f.controller.open(item, { ...f.context, isCurrent: () => Promise.reject(Error('async authority')) }); await tick(); assert.equal(f.calls.length, 0);
});
test('read failure shows the source generic error and an empty response stays a distinct no-rolls state', async () => {
  const error = fixture(); const pending = error.controller.open(item, error.context); error.pending.reject(Error('server')); await tick(); assert.equal(error.controller.getSnapshot().presentation.phase, 'error'); error.controller.dispose(); await pending;
  const empty = fixture(), close = empty.controller.open(item, empty.context); empty.pending.resolve([]); await tick(); assert.equal(empty.controller.getSnapshot().presentation.phase, 'ready'); assert.deepEqual(empty.controller.getSnapshot().presentation.rolls, []); empty.controller.dispose(); await close;
});
test('roll rows copy source literal title, raw paddon suffix, field order and accepted date visibility in every locale', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    const a = key => l10n.adminText(key, locale), [row] = models.adminWarehouseItemRollRows([roll({ paddon_code: ' P ', progress_batch_id: ' Batch ', accepted_by_display_name: ' Name ', accepted_at_unix: 1 })], a);
    assert.equal(row.title, 'Rulon 1 • Paddon  P '); assert.equal(row.subtitle, 'BAR • 2.5 kg • Order');
    assert.deepEqual(row.details.map(line => line.label), ['label.barcode', 'calculate.order', 'warehouse.available_quantity', 'warehouse.paddon', 'warehouse.progress_batch', 'warehouse.accepted_by', 'label.date'].map(a));
    assert.equal(models.adminWarehouseItemRollRows([roll()], a)[0].details.length, 3);
  }
});
test('reserved-order controller retries only its original read and ignores old body settlement through StrictMode', async () => {
  let current = true, reads = 0; const old = deferred(), order = { map: { id: 'id', title: 'Title', customer_name: ' Customer ' } };
  const controller = new AdminWarehouseItemRollsOrderController({ current: () => current, read: async (_guard, witness) => { reads++; if (reads === 1) { assert.equal(witness(), true); return old.promise; } return order; } });
  controller.start(); const generation = controller.generation; controller.dispose(); controller.start(); await tick(); old.resolve({ map: { id: 'Wrong' } }); await tick(); assert.equal(controller.getSnapshot().order, order); assert.equal(controller.current(generation), false);
  current = false; await controller.load(); assert.equal(reads, 2); controller.invalidate(); assert.equal(controller.getSnapshot().phase, 'invalid');
});
test('child account authority captures original epoch/scope/permission/witness and suppresses asynchronous guards', async () => {
  for (const change of ['scope', 'epoch', 'permission', 'witness', 'role', 'async']) {
    const session = { baseUrl: 'https://a.example', token: 'token', profile: { role: 'admin', ref: 'ref', display_name: 'Original' } }, witness = { session }; let epoch = 1, valid = true, allowed = true, outer = () => true;
    const { adminWarehouseItemRollsAuthority } = load('admin/adminWarehouseItemRollsAuthority', { '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token, isSessionWitnessCurrent: () => valid },
      '../sessionReadScope': scope, '../shared/camera/synchronousGuard': sync, '../shared/appRoutes': { appRoutes: { adminWarehouses: '/warehouses' }, canOpenRoute: () => allowed } });
    const current = adminWarehouseItemRollsAuthority(session, witness, () => outer()); assert.equal(current(), true);
    if (change === 'scope') session.baseUrl = 'https://other.example'; if (change === 'epoch') epoch++; if (change === 'permission') allowed = false; if (change === 'witness') valid = false; if (change === 'role') session.profile.role = 'werka'; if (change === 'async') outer = () => Promise.reject(Error('async guard'));
    assert.equal(current(), false); epoch = 1; valid = true; allowed = true; session.baseUrl = 'https://a.example'; session.profile.role = 'admin'; outer = () => true; assert.equal(current(), false);
  }
  await tick();
});
test('reentrant native open authority cannot replace the original rolls child or its pending resolver', async () => {
  const f = fixture(), nested = []; const context = { ...f.context, isCurrent: () => { nested.push(f.controller.open({ ...item, name: 'Nested' }, f.context)); return true; } };
  const original = f.controller.open(item, context); assert.equal(f.calls.length, 1); assert.equal(f.controller.getSnapshot().presentation.item, item); await Promise.all(nested);
  const id = f.controller.getSnapshot().presentation.id; f.controller.close(id); await original; f.pending.resolve([]); await tick(); assert.equal(f.controller.getSnapshot().presentation, null);
});
