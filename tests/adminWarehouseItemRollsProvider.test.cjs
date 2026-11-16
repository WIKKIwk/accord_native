const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), exception = load('shared/mobileApiException');
const RollController = load('admin/adminWarehouseItemRollsController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings }).AdminWarehouseItemRollsController;
const QrController = load('admin/adminWarehouseRawQrController', { '../shared/camera/synchronousGuard': sync, '../shared/mobileApiException': exception, './dartJsonString': strings }).AdminWarehouseRawQrController;
const OrderController = load('admin/adminWarehouseItemRollsOrder', { '../shared/camera/synchronousGuard': sync }).AdminWarehouseItemRollsOrderController;
const MainView = load('admin/AdminWarehouseMainViewState', { '../shared/camera/synchronousGuard': sync }).AdminWarehouseMainViewState;
const rowsModel = load('admin/adminWarehouseItemRollsModel', { '../workerPeremotka': load('workerPeremotka'), './dartJsonString': strings });
const rowDetails = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': {}, './dartJsonString': strings });
function fixture(kind) {
  let cursor = 0, focused = true, account = true, controller, notify; const slots = [], pending = [], calls = [];
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) { const next = { create, deps, cleanup: old?.cleanup }; slots[index] = next; pending.push(() => { next.cleanup?.(); next.cleanup = create(); }); } };
  const react = { useMemo: memo, useRef: initial => memo(() => ({ current: initial }), []), useEffect: effect, useLayoutEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const main = new MainView(() => account); main.attach(true); const item = { name: 'Item', code: 'C', warehouse: 'A', order_id: ' Order ' };
  const stock = { barcode: 'BAR', item_code: 'R', item_name: 'Raw', source_receipt_id: 'Receipt', reserved_order_id: 'Order', status: 'available', qty: 2, uom: 'kg', warehouse: 'A', width_mm: null, length_m: null, micron: null };
  const row = { kind: kind === 'rolls' ? 'item' : 'raw', item, stock }; main.setRows([row]); const dialog = main.openRow(row), action = kind !== 'rolls' ? main.beginAction(dialog.id) : null;
  const context = { isCurrent: action?.current ?? (() => main.dialogCurrent(dialog.id)), onChanged: async () => {} }, source = {
    rolls: async () => [{ stock_id: 'ID', barcode: 'BAR', qty: 2, uom: 'kg', order_id: 'Order', paddon_code: '', progress_batch_id: '', accepted_by_display_name: '', accepted_at_unix: 0 }],
    prepare: async () => ({ reprint_id: 'ID', stock: { ...stock }, print_request: { epc: 'BAR' } }),
    print: async () => true, confirm: async () => {}, order: async () => ({ map: { id: 'Order', title: ' Title ', customer_name: ' Customer ' } }) };
  const track = (name, fn) => async (...args) => { args.at(-1)(); calls.push(name); return fn(...args); };
  const shared = { react, 'expo-router': { useIsFocused: () => focused }, '../auth': { subscribeSessionWitness: fn => { notify = fn; return () => calls.push('unsubscribe'); } }, '../shared/localization': l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminWarehouseItemRollsAuthority': { adminWarehouseItemRollsAuthority: (_session, _witness, outer) => () => account && sync.isSynchronouslyTrue(outer) },
    './adminWarehouseItemRollsApi': { readAdminWarehouseItemRolls: async (_session, received, guard, witness) => { guard(); assert.equal(received, item); calls.push('rolls'); return source.rolls(guard, witness); },
      readAdminWarehouseItemRollsOrder: async (_session, id, guard, witness) => { guard(); assert.equal(id, 'Order'); calls.push('order'); return source.order(guard, witness); } },
    './adminWarehouseItemRollsController': { AdminWarehouseItemRollsController: class extends RollController { constructor(deps) { super(deps); controller = this; } } }, './adminWarehouseItemRollsModel': rowsModel,
    './adminWarehouseRawQrController': { AdminWarehouseRawQrController: class extends QrController { constructor(deps) { super(deps); controller = this; } } },
    './adminWarehouseRawQrApi': { prepareAdminWarehouseRawQr: async (_session, barcode, orderId, guard) => { guard(); calls.push(['prepare', barcode, orderId]); return source.prepare(guard); }, confirmAdminWarehouseRawQr: async (_session, barcode, id, guard) => { guard(); calls.push(['confirm', barcode, id]); return source.confirm(guard); } },
    './adminWarehouseRawQrPrint': { printAdminWarehouseRawQr: track('print', (...args) => source.print(...args)) }, './adminWarehouseRawQrModel': { adminWarehouseRawQrPreview: value => ({ payload: value, uri: 'real-preview-tested-separately', drawnSize: 203 }) }, './AdminWarehouseMainRows': rowDetails,
    './adminWarehouseItemRollsOrder': { AdminWarehouseItemRollsOrderController: class extends OrderController { constructor(deps) { super(deps); controller = this; } } }, './dartJsonString': strings };
  const hook = load(kind === 'rolls' ? 'admin/useAdminWarehouseItemRollsProvider' : kind === 'qr' ? 'admin/useAdminWarehouseRawQrProvider' : 'admin/useAdminWarehouseItemRollsOrder', shared);
  const session = { profile: { role: 'admin' } }, witness = {}, current = () => account, props = { session, witness, isCurrent: context.isCurrent, orderId: 'Order' };
  const render = () => { let value; for (let i = 0; i < 8; i++) { cursor = 0; value = kind === 'rolls' ? hook.useAdminWarehouseItemRollsProvider(session, witness, current) : kind === 'qr' ? hook.useAdminWarehouseRawQrProvider(session, witness, current) : hook.useAdminWarehouseItemRollsOrder(props);
    pending.splice(0).forEach(run => run()); if (value.state === controller.getSnapshot()) return value; } throw Error('hook failed to settle'); };
  const unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return { calls, context, item, stock, source, main, session, render, unmount, controller: () => controller, focus: value => { focused = value; main.setFocused(value); }, retire: () => { account = false; notify(); },
    replay: () => { unmount(); main.detach(); main.attach(true); slots.forEach(slot => { if (slot?.create) slot.cleanup = slot.create(); }); } };
}
test('actual rolls provider retains issued read across Main blur and awaits native dismissal before returning', async () => {
  const f = fixture('rolls'), pending = deferred(); let witness; f.source.rolls = async (_guard, received) => { witness = received; return pending.promise; };
  const model = f.render(), result = model.open(f.item, f.context); let done = false; result.then(() => { done = true; }); f.focus(false); f.render(); assert.equal(witness(), true); pending.resolve([]); await tick();
  const background = f.render(); assert.equal(background.presentation.phase, 'ready'); background.showDetails({}); assert.equal(f.controller().getSnapshot().presentation.details, null); assert.equal(done, false);
  background.close(); await result; assert.equal(done, true); assert.equal(f.controller().getSnapshot().presentation, null); f.unmount();
});
test('actual QR provider blocks background native events but an already-issued print continues to confirm before focus returns', async () => {
  const f = fixture('qr'), pending = deferred(); f.source.prepare = async () => pending.promise; let model = f.render(); const closed = model.open(f.stock, '', f.context); model = f.render();
  model.reprint(); assert.equal(f.controller().getSnapshot().presentation.printing, true); f.focus(false); f.render(); assert.equal(f.context.isCurrent(), true);
  pending.resolve({ reprint_id: 'ID', stock: { ...f.stock }, print_request: { epc: 'BAR' } }); await tick(); const background = f.render(); assert.ok(background.presentation.notice); assert.equal(background.presentation.printing, false);
  const before = [...f.calls]; background.reprint(); background.closeButton(); assert.deepEqual(f.calls, before); assert.equal(f.controller().getSnapshot().presentation.closing, false);
  assert.ok(f.calls.some(call => Array.isArray(call) && call[0] === 'confirm')); f.focus(true); model = f.render(); model.closeButton(); assert.equal(f.controller().getSnapshot().presentation.closing, true); model.close(); await closed; f.unmount();
});
test('child provider StrictMode cleanup clears old native tickets and resolves its parent without reviving original context', async () => {
  for (const kind of ['rolls', 'qr']) {
    const f = fixture(kind), model = f.render(), closed = kind === 'rolls' ? model.open(f.item, f.context) : model.open(f.stock, '', f.context); await tick(); const old = f.render(); f.replay(); await closed; const fresh = f.render();
    assert.equal(fresh.presentation, null); const count = f.calls.length; old.close(); if (kind === 'qr') old.reprint(); else old.showDetails(old.rows[0].roll); assert.equal(f.calls.length, count);
    await (kind === 'rolls' ? fresh.open(f.item, f.context) : fresh.open(f.stock, '', f.context)); assert.equal(f.controller().getSnapshot().presentation, null, 'the detached original Main context cannot open under the new provider lifetime'); f.unmount();
  }
});
test('actual reserved-order hook reads while its parent is covered, retries only visible original lifetime, and copies source title/customer', async () => {
  const f = fixture('order'), pending = deferred(); f.source.order = async () => pending.promise; f.render(); f.focus(false); f.render(); pending.resolve({ map: { id: 'Order', title: ' Title ', customer_name: ' Customer ' } }); await tick();
  const model = f.render(); assert.equal(model.state.phase, 'ready'); assert.ok(model.lines[0].value.includes(' Title ')); assert.equal(model.lines[1].value, ' Customer '); const count = f.calls.length; model.retry(); assert.equal(f.calls.length, count);
  f.focus(true); const foreground = f.render(); foreground.retry(); await tick(); assert.equal(f.calls.filter(value => value === 'order').length, 2); f.replay(); await tick(); const before = f.calls.length; foreground.retry(); assert.equal(f.calls.length, before); f.unmount();
});
test('Warehouse QR provider itself preserves the source admin/brigader/material role enable condition', async () => {
  const f = fixture('qr'); f.session.profile.role = 'werka'; const model = f.render(); assert.equal(model.active, false); await model.open(f.stock, '', f.context); assert.equal(f.controller().getSnapshot().presentation, null); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'prepare'), false); f.unmount();
});
test('actual QR feedback keeps repeated successful reprints in source4s FIFO order and cancels old presentation timers', async t => {
  const originalSet = global.setTimeout, originalClear = global.clearTimeout, timers = new Map(); let serial = 0;
  global.setTimeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, delay }); return id; }; global.clearTimeout = id => timers.delete(id);
  t.after(() => { global.setTimeout = originalSet; global.clearTimeout = originalClear; });
  const f = fixture('qr'); let model = f.render(); const closed = model.open(f.stock, '', f.context); model = f.render(); model.reprint(); await tick(); model = f.render(); const first = model.presentation.notice;
  model.reprint(); await tick(); model = f.render(); assert.equal(model.presentation.notice, first); assert.equal(timers.size, 1); const firstTimer = [...timers.values()][0]; assert.equal(firstTimer.delay, 4000); firstTimer.fn();
  model = f.render(); assert.ok(model.presentation.notice > first); const secondTimer = [...timers.values()][0]; assert.equal(secondTimer.delay, 4000); secondTimer.fn(); model = f.render(); assert.equal(model.presentation.notice, null);
  model.reprint(); await tick(); f.render(); assert.equal(timers.size, 1); f.unmount(); await closed; assert.equal(timers.size, 0);
});
