const assert = require('node:assert/strict');
const test = require('node:test');
const { l10n, load, strings, nativeModule, nodes, byID, text, click } = require('./adminWarehouseItemRollsNativeSupport.cjs');
const { deferred, tick } = require('./adminUsersSupport.cjs');
const rowsModel = load('admin/adminWarehouseItemRollsModel', { '../workerPeremotka': load('workerPeremotka'), './dartJsonString': strings });
function rolls(platform, phase = 'ready', details = false, empty = false) {
  const calls = [], a = key => l10n.adminText(key, 'uz'), roll = { stock_id: 'ID', barcode: 'BAR', order_id: 'Order', paddon_code: 'P', progress_batch_id: 'Batch', qty: 3, uom: 'kg', accepted_by_display_name: 'Name', accepted_at_unix: 0 },
    rows = empty ? [] : rowsModel.adminWarehouseItemRollRows([roll], a);
  const model = { active: true, presentation: { id: 7, item: { name: ' Item ', code: 'Code' }, phase, closing: false, rolls: empty ? [] : [roll], details: details ? { id: 8, roll, index: 0, closing: false } : null }, rows, a,
    showDetails: row => calls.push(['details', row]), close: () => calls.push('close'), beginDismiss: () => calls.push('dismiss'), dismissDetails: (id, done) => calls.push(['dismiss-detail', id, done]) };
  const mod = nativeModule(`AdminWarehouseItemRollsSheet.${platform}.tsx`); return { model, calls, roll, rows, render: () => mod.render(() => mod.exports.AdminWarehouseItemRollsSheet({ model })) };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} genuine rolls sheet preserves source fields/order, title, no extra close/retry, and nested details event`, () => {
    const f = rolls(platform), tree = f.render(); assert.ok(text(tree).includes(f.model.a('warehouse.rolls'))); assert.ok(text(tree).includes(' Item ')); assert.ok(text(tree).includes('Rulon 1 • Paddon P'));
    const row = byID(tree, `warehouse-item-roll-${f.rows[0].key}`); row.props.onPress(); assert.deepEqual(f.calls, [['details', f.roll]]);
    const sheet = nodes(tree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet'))[0]; assert.equal(sheet.key, 7);
    if (platform === 'android') {
      assert.equal(sheet.props.showDragHandle, false); sheet.props.onDismissRequest();
      const list = nodes(tree, node => node.type === 'OrdersList')[0]; assert.equal(list.props.footer.props.style.height, 12);
      assert.equal(list.props.rowKey(f.rows[0]), f.rows[0].key); assert.equal(row.type, 'WorkerQueueCard'); assert.equal(row.props.style.height, 61);
    }
    else { sheet.props.onIsPresentedChange(false); sheet.props.onDismiss(); }
    assert.deepEqual(f.calls.slice(1), platform === 'android' ? ['close'] : ['dismiss', 'close']);
    const nested = rolls(platform, 'ready', true), childTree = nested.render(); assert.ok(text(childTree).includes(nested.model.a('warehouse.paddon'))); assert.ok(text(childTree).includes('Batch'));
    const sheets = nodes(childTree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet')); assert.equal(sheets.length, 2);
    if (platform === 'android') sheets[1].props.onDismissRequest(); else { sheets[1].props.onIsPresentedChange(false); sheets[1].props.onDismiss(); }
    assert.deepEqual(nested.calls, platform === 'android' ? [['dismiss-detail', 8, true]] : [['dismiss-detail', 8, false], ['dismiss-detail', 8, true]]);
  });
  test(`${platform} rolls distinguishes loading/error/empty exactly and supplies no invented retry`, () => {
    const loading = rolls(platform, 'loading').render(); assert.equal(nodes(loading, node => node.type === (platform === 'android' ? 'AdminLoadingIndicator' : 'ProgressView')).length, 1);
    for (const [phase, empty, key] of [['error', false, 'warehouse.rolls_load_failed'], ['ready', true, 'warehouse.no_rolls']]) { const f = rolls(platform, phase, false, empty), tree = f.render(); assert.ok(text(tree).includes(f.model.a(key))); assert.equal(nodes(tree, node => ['Button', 'OutlinedButton', 'TextButton'].includes(node.type)).length, 0); }
  });
  test(`${platform} reserved-order native block has the source loader24, genuine retry and exact two detail lines`, () => {
    const calls = [], model = { state: { phase: 'loading' }, current: true, a: key => l10n.adminText(key, 'uz'), lines: [], retry: () => calls.push('retry') };
    const mod = nativeModule(`AdminWarehouseItemRollsOrderDetails.${platform}.tsx`, { './useAdminWarehouseItemRollsOrder': { useAdminWarehouseItemRollsOrder: () => model } });
    const render = () => mod.render(() => mod.exports.AdminWarehouseReservedOrderDetails({}));
    assert.equal(nodes(render(), node => node.type === (platform === 'android' ? 'AdminLoadingIndicator' : 'ProgressView')).length, 1);
    if (platform === 'android') assert.equal(nodes(render(), node => node.type === 'AdminLoadingIndicator')[0].props.size, 24);
    model.state.phase = 'error'; click(byID(render(), 'warehouse-reserved-order-retry'), platform); assert.deepEqual(calls, ['retry']);
    model.state.phase = 'ready'; model.lines = [{ label: model.a('warehouse.reservation_reason'), value: 'Reason' }, { label: model.a('label.customer'), value: ' Customer ' }]; const tree = render(); assert.ok(text(tree).includes('Reason')); assert.ok(text(tree).includes('Customer')); assert.equal(byID(tree, 'warehouse-reserved-order-retry'), undefined);
  });
  test(`${platform} raw QR source labels, busy buttons, no invented picker and native outside cancellation`, () => {
    const calls = [], value = { id: 10, stock: { item_name: ' Name ', item_code: 'Code', barcode: ' BAR ' }, printing: false, closing: false, notice: null }, model = { active: true, presentation: value, preview: { uri: 'data:image/gif;base64,AA', payload: 'BAR', drawnSize: 203 }, details: [{ label: 'Field', value: ' Value ' }], buttonLabel: 'Qayta chop etish', error: null,
      closeButton: () => calls.push('X'), close: () => calls.push('closed'), beginDismiss: () => calls.push('dismiss'), reprint: () => calls.push('reprint') };
    const mod = nativeModule(`AdminWarehouseRawQrSheet.${platform}.tsx`), render = () => mod.render(() => mod.exports.AdminWarehouseRawQrNativeSheet({ model })); let tree = render();
    assert.ok(text(tree).includes('Chop etilgan QR')); assert.ok(text(tree).includes('Name')); assert.ok(text(tree).includes(' BAR ')); assert.equal(nodes(tree, node => node.type === 'AdminWarehouseRawQrPreview').length, 1);
    const print = byID(tree, 'raw-stock-qr-reprint'); click(print, platform); click(byID(tree, 'warehouse-raw-qr-close'), platform); assert.deepEqual(calls, ['reprint', 'X']);
    if (platform === 'android') { assert.ok(print.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56)); assert.equal(print.props.shape.cornerRadii.topStart, 20); assert.equal(nodes(tree, node => node.type === 'ModalBottomSheet')[0].props.modifiers.find(mod => mod.name === 'clip').args[0].topStart, 32); }
    value.printing = true; model.buttonLabel = 'Chop etilmoqda…'; tree = render(); const close = byID(tree, 'warehouse-raw-qr-close');
    if (platform === 'android') { assert.equal(close.props.enabled, false); nodes(tree, node => node.type === 'ModalBottomSheet')[0].props.onDismissRequest(); }
    else { assert.ok(close.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0])); const sheet = nodes(tree, node => node.type === 'BottomSheet')[0]; sheet.props.onIsPresentedChange(false); sheet.props.onDismiss(); }
    assert.deepEqual(calls.slice(2), platform === 'android' ? ['closed'] : ['dismiss', 'closed']); assert.equal(nodes(tree, node => node.type === 'Picker').length, 0);
  });
}
test('Android QR X waits for actual native hide completion before resolving parent child', async () => {
  const wait = deferred(), calls = [], model = { active: true, presentation: { id: 5, closing: true, stock: { barcode: 'BAR', item_name: '', item_code: 'C' }, printing: false }, preview: {}, details: [], close: () => calls.push('closed') };
  const mod = nativeModule('AdminWarehouseRawQrSheet.android.tsx', {}, { hide: () => { calls.push('hide'); return wait.promise; } }); mod.render(() => mod.exports.AdminWarehouseRawQrNativeSheet({ model })); assert.deepEqual(calls, ['hide']); wait.resolve(); await tick(); assert.deepEqual(calls, ['hide', 'closed']);
});
test('native QR preview keeps source white240/208 dimensions and draws the actual normalized barcode image without stretching modules', () => {
  const mod = nativeModule('AdminWarehouseRawQrPreview.tsx'), preview = { payload: '30AA', uri: 'data:image/gif;base64,DATA', drawnSize: 203 };
  const tree = mod.render(() => mod.exports.AdminWarehouseRawQrPreview({ preview, barcode: ' raw ' })), outer = byID(tree, 'raw-stock-qr-preview- raw '), image = nodes(tree, node => node.type === 'ExpoImage')[0];
  assert.equal(outer.props.style.width, 240); assert.equal(outer.props.style.padding, 16); assert.equal(image.props.style.width, 203); assert.equal(image.props.style.height, 203); assert.equal(image.props.source.uri, preview.uri); assert.equal(image.props.accessibilityLabel, '30AA');
});
