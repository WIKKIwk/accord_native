const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard');
const { AdminWarehouseMainViewState } = load('admin/AdminWarehouseMainViewState', { '../shared/camera/synchronousGuard': sync });
const date = load('qolip/qolipApiCommon', { '../shared/mobileApiException': {} });
const rows = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': date, './dartJsonString': strings });
const { adminWarehouseMainEntries } = load('admin/AdminWarehouseMainEntries');
const raw = (patch = {}) => ({ id: 'raw', barcode: ' BAR ', item_code: ' CODE ', item_name: ' Name ', warehouse: ' A ', qty: 2.5, uom: 'kg', status: ' Band ', reserved_order_id: ' order ', source_receipt_id: '', width_mm: null, micron: null, length_m: null, ...patch });
const a = (key, values) => l10n.adminText(key, 'uz', values), p = (key, values) => l10n.productionText(key, 'uz', values);
const rawRow = () => rows.adminWarehouseMainRawRow(raw(), 0, a, true, true);
test('StrictMode presentation reattaches with fresh native tickets, row membership and no revived dialog', () => {
  const view = new AdminWarehouseMainViewState(() => true), row = rawRow(); view.attach(true); view.setRows([row]); const old = view.capture();
  const dialog = view.openRow(row); assert.ok(dialog); view.detach(); view.attach(true); view.setRows([row]); assert.equal(old(), false); assert.equal(view.dialogCurrent(dialog.id), false);
  const fresh = view.capture(); assert.equal(fresh(), true); const reopened = view.openRow(row); assert.ok(reopened); view.close(dialog.id); assert.equal(view.getSnapshot().dialog.id, reopened.id);
  view.close(reopened.id); view.setRows([]); assert.equal(view.openRow(row), null, 'a recycled row callback is rejected once its data/page is replaced');
});
test('idle details/create close on blur but an issued item child retains original lifetime authority until return', async () => {
  const view = new AdminWarehouseMainViewState(() => true); view.attach(true); const row = rawRow(); view.setRows([row]);
  const idle = view.openRow(row); view.setFocused(false); assert.equal(view.dialogCurrent(idle.id), false); view.setFocused(true); view.openCreate(); view.setFocused(false); assert.equal(view.getSnapshot().dialog, null);
  view.setFocused(true); const item = { ...row, kind: 'item' }; view.setRows([item]); const dialog = view.openRow(item), oldNative = view.capture(), pending = deferred();
  const issued = () => view.dialogCurrent(dialog.id), result = pending.promise.then(() => { assert.equal(issued(), true, 'child settlement before parent focus returns is still authorized'); });
  view.setFocused(false); assert.equal(oldNative(), false); assert.equal(issued(), true); assert.equal(view.openRow(item), null); pending.resolve(); await result;
  view.close(dialog.id); assert.equal(issued(), false); view.setFocused(true); assert.equal(view.capture()(), true);
});
test('nested QR/editor child authority survives blur while native redispatch, dismiss and original account retirement are fenced', () => {
  let current = true; const view = new AdminWarehouseMainViewState(() => current); view.attach(true); const row = rawRow(); view.setRows([row]); const dialog = view.openRow(row), action = view.beginAction(dialog.id);
  assert.ok(action); assert.equal(view.beginAction(dialog.id), null); view.setFocused(false); assert.equal(action.current(), true); assert.equal(view.beginAction(dialog.id), null);
  view.setFocused(true); action.finish(); const next = view.beginAction(dialog.id); assert.ok(next); action.finish(); assert.equal(next.current(), true, 'old completion cannot unlock the next child');
  current = false; assert.equal(next.current(), false); view.close(dialog.id); assert.equal(next.current(), false);
  current = true; const newer = view.openRow(row); view.beginDismiss(newer.id); assert.equal(view.dialogCurrent(newer.id), false); assert.equal(view.beginAction(newer.id), null);
  view.close(newer.id); assert.equal(view.getSnapshot().dialog, null);
});
test('strict synchronous presentation boundaries consume async rejection and recheck lifecycle after current callback', async () => {
  const asyncView = new AdminWarehouseMainViewState(() => Promise.reject(Error('async current'))); asyncView.attach(true); assert.equal(asyncView.canInteract(), false); asyncView.openCreate(); assert.equal(asyncView.getSnapshot().dialog, null); await tick();
  let invalidate = false; const view = new AdminWarehouseMainViewState(() => { if (invalidate) { view.detach(); view.attach(true); } return true; }); view.attach(true); const old = view.capture(); invalidate = true;
  view.openCreate(); assert.equal(old(), false); assert.equal(view.getSnapshot().dialog, null, 'detach/attach during authority check does not authorize the old event');
});
test('native search only receives explicit fills; reported keystrokes, focus-close and same-scope redraw never echo text', () => {
  const view = new AdminWarehouseMainViewState(() => true); view.attach(true); view.setSearchFocused(true); view.typed(' newer draft '); view.synchronizeText(' newer draft ');
  assert.equal(view.getSnapshot().fillVersion, 0); view.setSearchFocused(false); assert.equal(view.getSnapshot().fillVersion, 0);
  view.synchronizeText(''); assert.equal(view.getSnapshot().fillVersion, 1); assert.equal(view.getSnapshot().fillText, ''); view.synchronizeText(''); assert.equal(view.getSnapshot().fillVersion, 1);
});
test('raw/reservation details preserve source field order, exact apparatus lookup, date overflow, quantity and footer eligibility', () => {
  const stock = raw({ width_mm: 400, micron: 12.5, length_m: 200, source_receipt_id: ' receipt ' }), row = rows.adminWarehouseMainRawRow(stock, 0, a, true, false);
  assert.equal(row.title, 'Name'); assert.equal(row.subtitle, 'BAR • 2.5 kg'); assert.deepEqual(row.details.map(value => value.label), ['label.item_code', 'label.barcode', 'label.warehouse', 'label.quantity', 'warehouse.roll_width', 'label.micron', 'warehouse.roll_length', 'label.status', 'calculate.order', 'label.receipt'].map(a));
  assert.equal(row.details[7].value, a('stock.status.reserved')); assert.equal(rows.adminWarehouseMainDetailValue('\u0085 '), '-');
  const assignment = { barcode: 'bar', order_id: 'Reserved', item_name: ' Product ', item_code: 'CODE', item_group: 'Group', stock_qty: 8, stock_uom: 'kg', apparatus: ' APP ', assigned_by_name: 'Name', assigned_at: '2020-01-42T03:04:00', stock_status: 'available', received_qty: 8, consumed_qty: 3, remaining_qty: 5 };
  const [reservation] = rows.adminWarehouseMainReservationRows([assignment], [stock], [{ id: 'APP', name: ' Machine ' }, { id: 'APP', name: ' Latest machine ' }], a, p, true);
  assert.equal(reservation.stock, stock); assert.equal(reservation.canQr, true); assert.equal(reservation.title, ' Product '); assert.equal(reservation.subtitle, 'CODE • bar • Group');
  assert.equal(reservation.details.find(value => value.label === a('label.apparatus')).value, 'Latest machine'); assert.equal(reservation.details.find(value => value.label === a('label.date')).value, '11.02.2020 03:04');
  assert.equal(reservation.details.filter(value => value.label === a('calculate.order')).length, 1); assert.ok(reservation.details.at(-1).value.includes('5 kg'));
  const [missing] = rows.adminWarehouseMainReservationRows([assignment], [], [], a, p, true); assert.equal(missing.canQr, false); assert.equal(missing.details.find(value => value.label === a('label.apparatus')).value, 'APP');
});
test('item and Qolip field projections retain source raw title and literal per-mold details', () => {
  const item = rows.adminWarehouseMainItemRow({ name: ' Item ', code: ' C ', order_id: ' O ', on_hand_qty: 1.25, uom: 'kg', package_count: 3, item_group: ' G ', warehouse: ' A ' }, 0, a);
  assert.equal(item.title, ' Item '); assert.equal(item.subtitle, 'O • C • 1.25 kg • G'); assert.equal(item.details[0].label, a('label.code'));
  const qolip = rows.adminWarehouseMainQolipRow({ name: 'Name', code: 'C', itemGroup: 'Group', qolips: [{ qolip_code: '', first_qolip_code: ' F ', size: 12, color: ' red ', is_in_use: false }] }, 0, a);
  assert.equal(qolip.details.at(-1).value, 'F • Razmer: 12 • Rang: red • Holati: Mavjud');
});
test('source entry plan keeps no-selection, mutually-exclusive loading/error/product states, raw block order and retry paging', () => {
  const item = { ...rawRow(), kind: 'item', id: 'item' }, raw = rawRow(); const state = { summary: { sections: [] }, warehouse: null, stockTab: 'available', itemsLoading: false, itemsError: null, items: [], loadingMore: false, hasMore: false };
  assert.equal(adminWarehouseMainEntries(state, false, [], [])[0].textKey, 'warehouse.empty'); state.summary.sections = [{}]; assert.equal(adminWarehouseMainEntries(state, false, [], [])[0].textKey, 'warehouse.no_selection');
  state.warehouse = 'A'; state.itemsLoading = true; let entries = adminWarehouseMainEntries(state, false, [[item], [raw]], []); assert.deepEqual(entries.map(value => value.kind), ['loading', 'row']); assert.equal(entries[0].gap, 36); assert.equal(entries[1].gap, 16);
  state.itemsLoading = false; state.itemsError = Error('offline'); entries = adminWarehouseMainEntries(state, false, [[raw]], []); assert.equal(entries[0].kind, 'retry'); assert.equal(entries[0].more, false); assert.equal(entries[1].row, raw);
  state.items = [{}]; entries = adminWarehouseMainEntries(state, false, [[item], [raw]], []); assert.deepEqual(entries.map(value => value.kind), ['row', 'row', 'retry']); assert.equal(entries.at(-1).more, true);
  state.itemsError = null; state.hasMore = true; entries = adminWarehouseMainEntries(state, false, [[item], [raw]], []); assert.equal(entries.at(-1).textKey, 'warehouse.load_more_hint');
  state.stockTab = 'reserved'; entries = adminWarehouseMainEntries(state, false, [[item]], [[raw]]); assert.equal(entries.length, 1); assert.equal(entries[0].row, raw); assert.equal(entries[0].gap, 8);
});
