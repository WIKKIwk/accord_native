const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, tick, deferred } = require('./adminUsersSupport.cjs');
const { compile } = require('./adminShellFrameViewSupport.cjs');
const { nativeModule, nodes, byID, click } = require('./adminWarehouseItemRollsNativeSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), domain = load('admin/adminWarehouseMainModel', { './dartJsonString': strings });
const filters = load('admin/adminWarehouseFilterStore', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings });
const MainController = load('admin/adminWarehouseMainController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings, './adminWarehouseMainModel': domain }).AdminWarehouseMainController;
const MainView = load('admin/AdminWarehouseMainViewState', { '../shared/camera/synchronousGuard': sync }).AdminWarehouseMainViewState;
const RollController = load('admin/adminWarehouseItemRollsController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings }).AdminWarehouseItemRollsController;
const QrController = load('admin/adminWarehouseRawQrController', { '../shared/camera/synchronousGuard': sync, '../shared/mobileApiException': load('shared/mobileApiException'), './dartJsonString': strings }).AdminWarehouseRawQrController;
const OrderController = load('admin/adminWarehouseItemRollsOrder', { '../shared/camera/synchronousGuard': sync }).AdminWarehouseItemRollsOrderController;
const rowModel = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': {}, './dartJsonString': strings });
const rollModel = load('admin/adminWarehouseItemRollsModel', { '../workerPeremotka': load('workerPeremotka'), './dartJsonString': strings });

function runtime() {
  const scopes = new Map(); let scope, cursor, pending;
  const memo = (create, deps) => { const index = cursor++, old = scope[index]; if (!old || !deps || deps.some((value, i) => value !== old.deps?.[i])) scope[index] = { deps, value: create() }; return scope[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = scope[index]; if (!old || !deps || deps.some((value, i) => value !== old.deps?.[i])) { const next = { create, deps, cleanup: old?.cleanup }; scope[index] = next; pending.push(() => { next.cleanup?.(); next.cleanup = create(); }); } };
  const unmount = id => { scopes.get(id)?.forEach(value => value?.cleanup?.()); scopes.delete(id); };
  return { react: { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => memo(() => ({ current: value }), []), useLayoutEffect: effect, useEffect: effect, useSyncExternalStore: (_subscribe, get) => get() },
    run(id, fn) { scope = scopes.get(id) ?? []; scopes.set(id, scope); cursor = 0; pending = []; const result = fn(); pending.splice(0).forEach(run => run()); return result; },
    unmount, replay(id) { const targets = id ? [scopes.get(id) ?? []] : [...scopes.values()]; for (const values of targets) values.forEach(value => value?.cleanup?.()); for (const values of targets) values.forEach(value => { if (value?.create) value.cleanup = value.create(); }); },
    dispose() { [...scopes.keys()].forEach(unmount); } };
}

function fixture(platform, scope = 'admin') {
  const hooks = runtime(), calls = [], subscribers = new Set(); let focused = true, account = true, owner, view, rollController, qrController, orderController;
  const item = { name: 'Item', code: 'Code', warehouse: 'A', order_id: ' Order ', on_hand_qty: 5, package_count: 3, uom: 'kg', item_group: 'G' };
  const stock = { id: 'raw', barcode: 'BAR', item_code: 'R', item_name: 'Raw', source_receipt_id: 'Receipt', reserved_order_id: '', status: 'available', qty: 2, uom: 'kg', warehouse: 'A', width_mm: null, length_m: null, micron: null };
  const source = { rolls: async () => [], prepare: async () => ({ reprint_id: 'ID', stock: { ...stock }, print_request: { epc: 'BAR' } }),
    print: async () => true, confirm: async () => {}, order: async () => ({ map: { id: 'Order', title: ' Title ', customer_name: ' Customer ' } }) };
  const shared = { react: hooks.react, 'expo-router': { useIsFocused: () => focused }, '../auth': { subscribeSessionWitness: fn => { subscribers.add(fn); return () => subscribers.delete(fn); } },
    '../shared/localization': l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './dartJsonString': strings,
    './adminWarehouseItemRollsAuthority': { adminWarehouseItemRollsAuthority: (_session, _witness, outer) => () => account && sync.isSynchronouslyTrue(outer) },
    './adminWarehouseItemRollsApi': { readAdminWarehouseItemRolls: async (_session, received, guard, witness) => { guard(); assert.equal(received, item); calls.push('rolls'); return source.rolls(guard, witness); },
      readAdminWarehouseItemRollsOrder: async (_session, id, guard, witness) => { guard(); calls.push(['order', id]); return source.order(guard, witness); } },
    './adminWarehouseItemRollsController': { AdminWarehouseItemRollsController: class extends RollController { constructor(deps) { super(deps); rollController = this; } } }, './adminWarehouseItemRollsModel': rollModel,
    './adminWarehouseRawQrController': { AdminWarehouseRawQrController: class extends QrController { constructor(deps) { super(deps); qrController = this; } } },
    './adminWarehouseRawQrApi': { prepareAdminWarehouseRawQr: async (_session, barcode, orderId, guard) => { guard(); calls.push(['prepare', barcode, orderId]); return source.prepare(guard); },
      confirmAdminWarehouseRawQr: async (_session, barcode, id, guard) => { guard(); calls.push(['confirm', barcode, id]); return source.confirm(guard); } },
    './adminWarehouseRawQrPrint': { printAdminWarehouseRawQr: async (job, guard) => { guard(); calls.push('print'); return source.print(job, guard); } },
    './adminWarehouseRawQrModel': { adminWarehouseRawQrPreview: barcode => ({ payload: barcode, uri: 'controlled-preview', drawnSize: 203 }) }, './AdminWarehouseMainRows': rowModel,
    './adminWarehouseItemRollsOrder': { AdminWarehouseItemRollsOrderController: class extends OrderController { constructor(deps) { super(deps); orderController = this; } } } };
  const providers = { './useAdminWarehouseItemRollsProvider': load('admin/useAdminWarehouseItemRollsProvider', shared), './useAdminWarehouseRawQrProvider': load('admin/useAdminWarehouseRawQrProvider', shared),
    './useAdminWarehouseDetailSurface': load('admin/useAdminWarehouseDetailSurface', shared) };
  const screen = compile(`AdminWarehouseScreen.${platform}.tsx`, { ...shared, ...providers,
    [`./AdminProfileAction.${platform}`]: { AdminProfileAction: 'AdminProfileAction' }, [`./AdminWarehouseItemRollsOrderDetails.${platform}`]: { AdminWarehouseReservedOrderDetails: 'AdminWarehouseReservedOrderDetails' },
    [`./AdminWarehouseItemRollsSheet.${platform}`]: { AdminWarehouseItemRollsSheet: 'AdminWarehouseItemRollsSheet' }, [`./AdminWarehouseMainScreen.${platform}`]: { AdminWarehouseMainScreen: 'AdminWarehouseMainScreen' },
    [`./AdminWarehouseRawQrSheet.${platform}`]: { AdminWarehouseRawQrNativeSheet: 'AdminWarehouseRawQrNativeSheet' } }).AdminWarehouseScreen;
  const orderHook = load('admin/useAdminWarehouseItemRollsOrder', shared).useAdminWarehouseItemRollsOrder;
  const mainHook = load('admin/useAdminWarehouseMain', { ...shared, 'react-native': { Keyboard: { dismiss: () => calls.push('keyboard') } }, './adminWarehouseMainModel': domain,
    './AdminWarehouseMainViewState': { AdminWarehouseMainViewState: class extends MainView { constructor(current) { super(current); view = this; } } }, './useAdminWarehouseLive': { useAdminWarehouseLive() {} },
    './adminWarehouseMainSession': { createAdminWarehouseMainSession: (_session, _witness, original, options) => {
      const current = () => account && sync.isSynchronouslyTrue(original), preferences = new filters.AdminWarehouseFilterStore({ async getItem() { return null; }, async setItem() {}, async removeItem() {} }, 'Original', current);
      const controller = new MainController({ isCurrent: current, canInteract: options.canInteract, preferences, adminScoped: scope === 'admin', summary: async guard => { guard(); calls.push('summary'); return { sections: [{ warehouse: 'A' }], qolipWarehouseNames: [] }; },
        detail: async (_name, guard) => { guard(); return { rawStock: [stock], reservations: [], apparatus: [] }; }, items: async (_name, _query, _offset, guard) => { guard(); return [item]; }, qolipProducts: async () => [] });
      owner = { controller, current, flags: { adminScoped: scope === 'admin', warehouseScoped: scope !== 'admin' }, activate: () => controller.start(), deactivate: () => controller.dispose(), onCreated: controller.reload, onChanged: controller.reload, onDeleted: controller.warehouseDeleted, refreshInPlace: controller.refreshInPlace }; return owner;
    } } }).useAdminWarehouseMain;
  const props = { scope, session: { profile: { role: scope === 'material' ? 'material_taminotchi' : scope } }, witness: {}, isCurrent: () => account, backLabel: 'Back', onBack: () => calls.push('back'), footer: { type: 'GenuineFooter', props: {} }, onProfile: () => calls.push('profile'),
    onRawStockEdit: async () => { calls.push('material-edit'); }, materialStates: { render: () => ({ type: 'GenuineMaterialStates', props: {} }), search: query => calls.push(['material-search', query]), reload: async () => calls.push('material-reload') } };
  let latest;
  const render = () => {
    for (let i = 0; i < 6; i++) {
      const composition = hooks.run('screen', () => screen(props)), [main, rolls] = composition.props.children;
      const model = hooks.run('main', () => mainHook(main.props)), surface = main.props.renderDetailActionSurface();
      if (model.dialog?.kind === 'details') hooks.run('surface', () => surface.type(surface.props)); else hooks.unmount('surface');
      latest = { model, props: main.props, rolls: rolls.props.model, qr: surface.props.model };
    } return latest;
  };
  return { props, item, stock, calls, source, render, controller: () => ({ owner, view, rollController, qrController, orderController }),
    focus: value => { focused = value; }, retire: () => { account = false; subscribers.forEach(fn => fn()); }, unmount: () => hooks.dispose(), replay: id => hooks.replay(id),
    readOrder: props => hooks.run('order', () => orderHook(props)),
    async selected() { render(); await tick(); render().model.selectWarehouse('A'); await tick(); return render(); } };
}

for (const platform of ['android', 'ios']) {
  test(`${platform} genuine composition retains provider callback identities and forwards real profile/material boundaries`, async () => {
    const f = fixture(platform, 'material'), first = await f.selected(), second = f.render();
    assert.equal(first.props.onItemRolls, second.props.onItemRolls); assert.equal(first.props.onRawStockQr, second.props.onRawStockQr); assert.equal(first.props.renderProfileAction, second.props.renderProfileAction);
    assert.equal(second.props.onRawStockEdit, f.props.onRawStockEdit); assert.equal(second.props.materialStates, f.props.materialStates); assert.equal(second.props.onBack, f.props.onBack); assert.equal(second.props.footer, f.props.footer);
    const profile = second.model.profile(); assert.equal(profile.type, 'AdminProfileAction'); assert.equal(profile.props.onProfile, f.props.onProfile); assert.equal(profile.props.isCurrent, second.model.current); assert.equal(profile.props.canInteract(), true);
    second.model.openRow(second.model.availableGroups[1][0]); assert.equal(profile.props.canInteract(), false); f.unmount();
  });
  test(`${platform} actual Main item action opens actual rolls owner, survives blur and returns only after native dismissal`, async () => {
    const f = fixture(platform), pending = deferred(); let witness; f.source.rolls = async (_guard, received) => { witness = received; return pending.promise; };
    let value = await f.selected(); value.model.openRow(value.model.availableGroups[0][0]); value = f.render(); assert.equal(value.rolls.presentation.phase, 'loading'); const id = value.model.dialog.id;
    f.focus(false); f.render(); assert.equal(witness(), true); pending.resolve([]); await tick(); value = f.render(); assert.equal(value.rolls.presentation.phase, 'ready'); assert.equal(value.model.dialog.id, id);
    value.rolls.beginDismiss(); assert.equal(f.controller().view.getSnapshot().dialog.id, id); value.rolls.close(); await tick(); value = f.render(); assert.equal(value.model.dialog, null); assert.equal(value.rolls.presentation, null); assert.equal(value.model.current(), true);
    f.focus(true); assert.equal(f.render().model.interactive(), true); f.unmount();
  });
  test(`${platform} genuine QR presenter awaits actual native hide and keeps generic details alive through return before focus`, async () => {
    const f = fixture(platform), hidden = deferred(); let value = await f.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); const id = value.model.dialog.id;
    value.model.runDetailAction(id, 'qr'); value = f.render(); assert.equal(value.qr.presentation.stock, f.stock); assert.equal(value.qr.presentation.orderId, '');
    const native = nativeModule(`AdminWarehouseRawQrSheet.${platform}.tsx`, {}, { hide: () => hidden.promise });
    let tree = native.render(() => native.exports.AdminWarehouseRawQrNativeSheet({ model: value.qr })); click(byID(tree, 'warehouse-raw-qr-close'), platform); value = f.render();
    assert.equal(value.qr.presentation.closing, true); tree = native.render(() => native.exports.AdminWarehouseRawQrNativeSheet({ model: value.qr }));
    assert.equal(value.model.dialog.id, id); f.focus(false); f.render(); assert.equal(f.controller().view.dialogCurrent(id), true);
    if (platform === 'android') { hidden.resolve(); await tick(); } else nodes(tree, node => node.type === 'BottomSheet')[0].props.onDismiss();
    await tick(); value = f.render(); assert.equal(value.qr.presentation, null); assert.equal(value.model.dialog.id, id); assert.equal(value.model.dialogCurrent(), true); assert.equal(value.model.interactive(), false);
    f.focus(true); value = f.render(); value.model.runDetailAction(id, 'qr'); assert.ok(f.render().qr.presentation, 'native completion releases exactly the original nested action'); f.unmount();
  });
  test(`${platform} removing genuine parent presenter cancels in-flight QR before device/confirm and allows a new original action`, async () => {
    const f = fixture(platform), pending = deferred(); f.source.prepare = async () => pending.promise;
    let value = await f.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); value.model.runDetailAction(value.model.dialog.id, 'qr'); value = f.render(); value.qr.reprint();
    value.model.closeDialog(); f.render(); await tick(); value = f.render(); assert.equal(value.qr.presentation, null, 'surface unmount completes its original child even without native callback');
    pending.resolve({ reprint_id: 'ID', stock: f.stock, print_request: { epc: 'BAR' } }); await tick(); assert.equal(f.calls.includes('print'), false); assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'confirm'), false);
    value = f.render(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); value.model.runDetailAction(value.model.dialog.id, 'qr'); assert.ok(f.render().qr.presentation); f.retire(); value = f.render(); assert.equal(value.qr.presentation, null); f.unmount();
  });
  test(`${platform} composition supplies actual guarded reserved-order read and Werka never enables raw QR`, async () => {
    const f = fixture(platform), pending = deferred(); f.stock.reserved_order_id = 'Order'; f.source.order = async () => pending.promise; let value = await f.selected(); value.model.setStockTab('reserved'); value = f.render(); value.model.openRow(value.model.reservedGroups[0][0]); value = f.render();
    const order = value.model.detailOrder; assert.equal(order.type, 'AdminWarehouseReservedOrderDetails'); assert.equal(order.props.session, f.props.session); assert.equal(order.props.witness, f.props.witness); assert.equal(order.props.orderId, 'Order');
    f.readOrder(order.props); value.model.runDetailAction(value.model.dialog.id, 'qr'); f.render(); f.focus(false); f.render(); pending.resolve({ map: { id: 'Order', title: ' Title ', customer_name: ' Customer ' } }); await tick(); const ready = f.readOrder(order.props); assert.equal(ready.state.phase, 'ready'); assert.ok(ready.lines[0].value.includes(' Title ')); f.unmount();
    const worker = fixture(platform, 'werka'); value = await worker.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = worker.render(); assert.equal(value.model.dialog.row.canQr, false); value.model.runDetailAction(value.model.dialog.id, 'qr'); assert.equal(worker.render().qr.presentation, null); worker.unmount();
  });
  test(`${platform} complete composition StrictMode replay retires old native child and resumes fresh original owners`, async () => {
    const f = fixture(platform), pending = deferred(); let witness; f.source.rolls = async (_guard, value) => { witness = value; return pending.promise; };
    let value = await f.selected(); value.model.openRow(value.model.availableGroups[0][0]); value = f.render(); const old = value, id = value.rolls.presentation.id;
    f.replay(); await tick(); value = f.render(); assert.equal(witness(), false); assert.equal(value.rolls.presentation, null); assert.equal(value.model.dialog, null); assert.equal(value.model.current(), true);
    old.rolls.close(); old.model.openRow(old.model.availableGroups[0][0]); assert.equal(f.controller().view.getSnapshot().dialog, null);
    pending.resolve([]); await tick(); value = f.render(); value.model.openRow(value.model.availableGroups[0][0]); value = f.render(); assert.ok(value.rolls.presentation.id > id); f.unmount();
  });
  test(`${platform} replaying an already-open native QR presenter preserves its original membership`, async () => {
    const f = fixture(platform); let value = await f.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); const parent = value.model.dialog.id;
    value.model.runDetailAction(parent, 'qr'); value = f.render(); const child = value.qr.presentation.id; f.replay('surface'); await tick(); value = f.render();
    assert.equal(value.qr.presentation.id, child); assert.equal(value.model.dialog.id, parent); assert.equal(value.model.dialogCurrent(), true);
    value.qr.close(); await tick(); value = f.render(); value.model.runDetailAction(parent, 'qr'); assert.ok(f.render().qr.presentation.id > child); f.unmount();
  });
  test(`${platform} delayed removed-presenter cleanup cannot dismiss a replacement QR child`, async () => {
    const f = fixture(platform); let value = await f.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); value.model.runDetailAction(value.model.dialog.id, 'qr'); value = f.render();
    const old = value, child = old.qr.presentation.id; let replacement, parent; old.qr.close();
    queueMicrotask(() => { value = f.render(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); parent = value.model.dialog.id; value.model.runDetailAction(parent, 'qr'); value = f.render(); replacement = value.qr.presentation.id; });
    old.model.closeDialog(); f.render(); await tick(); value = f.render(); assert.ok(replacement > child); assert.equal(value.qr.presentation.id, replacement); assert.equal(value.model.dialog.id, parent); f.unmount();
  });
  test(`${platform} parent removal in the QR opening batch completes the issued child before its first native commit`, async () => {
    const f = fixture(platform); let value = await f.selected(); value.model.openRow(value.model.availableGroups[1][0]); value = f.render();
    assert.equal(value.qr.presentation, null); value.model.runDetailAction(value.model.dialog.id, 'qr'); value.model.closeDialog(); f.render(); await tick(); value = f.render();
    assert.equal(value.qr.presentation, null); assert.equal(value.model.dialog, null); value.model.openRow(value.model.availableGroups[1][0]); value = f.render(); value.model.runDetailAction(value.model.dialog.id, 'qr'); assert.ok(f.render().qr.presentation); f.unmount();
  });
}
