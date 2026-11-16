const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, deferred, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard'), domain = load('admin/adminWarehouseMainModel', { './dartJsonString': strings });
const filters = load('admin/adminWarehouseFilterStore', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings });
const controllers = load('admin/adminWarehouseMainController', { '../shared/camera/synchronousGuard': sync, './dartJsonString': strings, './adminWarehouseMainModel': domain });
const viewModule = load('admin/AdminWarehouseMainViewState', { '../shared/camera/synchronousGuard': sync });
const rows = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': load('qolip/qolipApiCommon', { '../shared/mobileApiException': {} }), './dartJsonString': strings });
function fixture(scope = 'admin') {
  let focused = true, authorized = true, cursor = 0, owner, presentation, locale = 'uz'; const slots = [], pending = [], calls = [], live = [];
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((item, i) => item !== old.deps[i])) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((item, i) => item !== old.deps[i])) { const next = { create, deps, cleanup: old?.cleanup }; slots[index] = next; pending.push(() => { next.cleanup?.(); next.cleanup = create(); }); } };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useLayoutEffect: effect, useEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const item = { name: 'Item', code: 'Code', order_id: 'Order', warehouse: 'A', on_hand_qty: 5, package_count: 3, uom: 'kg', item_group: 'G' };
  const raw = { id: 'raw', barcode: 'BAR', status: 'available', reserved_order_id: '', item_name: 'Raw', item_code: 'R', warehouse: 'A', qty: 1, uom: 'kg', source_receipt_id: '', width_mm: null, length_m: null, micron: null };
  const createSession = (_session, _witness, original, options) => {
    const current = () => authorized && sync.isSynchronouslyTrue(original);
    const preferences = new filters.AdminWarehouseFilterStore({ async getItem() { return null; }, async setItem() {}, async removeItem() {} }, 'Original', current);
    const controller = new controllers.AdminWarehouseMainController({ isCurrent: current, canInteract: options.canInteract, preferences, adminScoped: scope === 'admin',
      summary: async (guard, witness) => { guard(); calls.push('summary'); assert.equal(witness(), true); return { sections: [{ warehouse: 'A', product_count: 7 }], qolipWarehouseNames: [] }; },
      detail: async (_name, guard) => { guard(); calls.push('detail'); return { rawStock: [raw], reservations: [], apparatus: [] }; },
      items: async (_name, query, offset, guard) => { guard(); calls.push(['items', query, offset]); return [item]; }, qolipProducts: async () => [] });
    owner = { controller, current, flags: { adminScoped: scope === 'admin', warehouseScoped: scope !== 'admin' }, activate: () => controller.start(), deactivate: () => controller.dispose(),
      onCreated: controller.reload, onChanged: controller.reload, onDeleted: controller.warehouseDeleted, refreshInPlace: controller.refreshInPlace }; return owner;
  };
  const { useAdminWarehouseMain } = load('admin/useAdminWarehouseMain', { react, 'expo-router': { useIsFocused: () => focused }, 'react-native': { Keyboard: { dismiss: () => calls.push('keyboard') } },
    '../shared/localization': l10n, '../shared/localization/runtime': { localeController: { get locale() { return locale; }, addListener() {} } },
    './adminWarehouseMainModel': domain, './adminWarehouseMainSession': { createAdminWarehouseMainSession: createSession }, './AdminWarehouseMainRows': rows,
    './AdminWarehouseMainViewState': { AdminWarehouseMainViewState: class extends viewModule.AdminWarehouseMainViewState { constructor(current) { super(current); presentation = this; } } },
    './dartJsonString': strings, './useAdminWarehouseLive': { useAdminWarehouseLive: (...args) => live.push(args) } });
  const props = { session: { profile: { role: scope === 'material' ? 'material_taminotchi' : scope === 'werka' ? 'werka' : 'admin' } }, witness: {}, isCurrent: () => authorized, scope,
    onBack: () => calls.push('back'), renderProfileAction: context => ({ type: 'RealProfile', props: context }), onItemRolls: async () => { calls.push('rolls'); },
    onRawStockQr: async () => { calls.push('qr'); }, onRawStockEdit: async () => { calls.push('edit'); }, renderReservedOrderDetails: (orderId, context) => ({ type: 'RealOrder', props: { orderId, ...context } }),
    materialStates: { render: context => ({ type: 'RealStates', props: context }), search: query => calls.push(['material-search', query]), reload: async () => { calls.push('material-reload'); } } };
  const render = () => { let result; for (let i = 0; i < 12; i++) { cursor = 0; result = useAdminWarehouseMain(props); pending.splice(0).forEach(run => run());
    if (result.presentation === presentation.getSnapshot() && result.state === owner.controller.getSnapshot()) return result; } throw Error('hook did not settle'); };
  const unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return { props, item, raw, calls, live, render, unmount, view: () => presentation, owner: () => owner, focus: value => { focused = value; }, retire: () => { authorized = false; }, locale: value => { locale = value; },
    replay: () => { unmount(); slots.forEach(slot => { if (slot?.create) slot.cleanup = slot.create(); }); },
    selected: async () => { render(); await tick(); let model = render(); model.selectWarehouse('A'); await tick(); return render(); } };
}
test('real Main hook starts summary/live with original authority, never auto-selects, and keeps menu/current refs stable', async () => {
  const f = fixture(), first = f.render(); await tick(); const model = f.render(); assert.equal(model.state.warehouse, null); assert.deepEqual(f.calls, ['summary']); assert.equal(model.summaryScreen, 'content');
  assert.equal(model.settings.isCurrent, model.current); assert.equal(f.live.at(-1)[2], model.current); assert.equal(f.live.at(-1)[3], f.owner().refreshInPlace);
  const stable = { actions: model.actions, current: model.interactive, settings: model.settings.canInteract }; model.setSearchFocused(true); const repaint = f.render(); assert.equal(repaint.actions, stable.actions); assert.equal(repaint.interactive, stable.current); assert.equal(repaint.settings.canInteract, stable.settings);
  assert.equal(first.current, model.current, 'header updates retain the original account owner'); f.unmount();
});
test('native UI callbacks cannot mutate across blur or StrictMode replay; original read scope resumes', async () => {
  const f = fixture(), old = await f.selected(); f.focus(false); f.render(); const before = [...f.calls]; old.setSearch('stale'); old.toggleFilter(); old.selectWarehouse('A'); old.actions[0].onPress(); old.back(); old.openRow(old.availableGroups[0][0]);
  assert.deepEqual(f.calls, before); assert.equal(f.owner().current(), true); f.focus(true); let resumed = f.render(); resumed.toggleFilter(); assert.equal(f.owner().controller.getSnapshot().filterExpanded, true);
  f.replay(); resumed.setSearch('old replay'); resumed.actions[0].onPress(); assert.equal(f.view().getSnapshot().dialog, null); await tick(); resumed = f.render(); resumed.setSearch('fresh'); assert.equal(f.owner().controller.getSnapshot().search, 'fresh'); f.unmount(); resumed.back(); assert.equal(f.calls.includes('back'), false);
});
test('awaited real item route survives parent blur, can reload before return focus, and loses authority on original settlement', async () => {
  const f = fixture(), pending = deferred(); let context; f.props.onItemRolls = async (item, value) => { assert.equal(item, f.item); context = value; await pending.promise; };
  const model = await f.selected(); model.openRow(model.availableGroups[0][0]); f.render(); assert.equal(context.isCurrent(), true); f.focus(false); f.render(); assert.equal(context.isCurrent(), true);
  const before = f.calls.length; await context.onChanged(); assert.deepEqual(f.calls.slice(before), ['summary', 'detail']); assert.equal(context.isCurrent(), true);
  pending.resolve(); await tick(); assert.equal(context.isCurrent(), false); assert.equal(f.view().getSnapshot().dialog, null); f.focus(true); assert.equal(f.render().interactive(), true); f.unmount();
});
test('nested QR/edit uses the captured raw snapshot and original context through blur; retired account cannot refresh', async () => {
  const f = fixture('material'), pending = deferred(); let context; f.props.onRawStockEdit = async (stock, value) => { assert.equal(stock, f.raw); context = value; await pending.promise; };
  let model = await f.selected(); model.openRow(model.availableGroups[1][0]); model = f.render(); const id = model.dialog.id; model.runDetailAction(id, 'edit'); assert.equal(context.isCurrent(), true);
  f.focus(false); f.render(); assert.equal(context.isCurrent(), true); const before = f.calls.length; await context.onChanged(); assert.deepEqual(f.calls.slice(before), ['material-reload', 'summary', 'detail']);
  f.retire(); assert.equal(context.isCurrent(), false); const count = f.calls.length; await context.onChanged(); assert.equal(f.calls.length, count); pending.resolve(); await tick(); assert.equal(context.isCurrent(), false); f.unmount();
});
test('visible page controls row membership/settings dispatch without retiring background reads or material dual search', async () => {
  const f = fixture('material'); let model = await f.selected(), row = model.availableGroups[0][0]; assert.equal(model.settings.canInteract(), false); const predicate = model.settings.canInteract;
  model.setSearch(' value '); assert.deepEqual(f.calls.at(-1), ['material-search', ' value ']); model.closeSearch(); assert.equal(f.owner().controller.getSnapshot().search, ' value '); model.clearSearch(); assert.deepEqual(f.calls.at(-1), ['material-search', '']);
  model.setPageTab('settings'); model = f.render(); assert.equal(model.settings.canInteract, predicate); assert.equal(predicate(), true); model.openRow(row); assert.equal(f.view().getSnapshot().dialog, null, 'old product row cannot open from a retained hidden page');
  assert.equal(model.current(), true); model.setPageTab('products'); model = f.render(); assert.equal(predicate(), false); model.openRow(row); assert.ok(f.view().getSnapshot().dialog); f.unmount();
});
test('opening and closing a native dialog retires the old main controls before React rerenders', async () => {
  const f = fixture(), old = await f.selected(); old.openRow(old.availableGroups[1][0]); const before = [...f.calls], selected = f.owner().controller.getSnapshot();
  old.setPageTab('settings'); old.setSearch('under modal'); old.toggleFilter(); old.selectWarehouse('A'); old.back(); assert.deepEqual(f.calls, before); assert.equal(f.owner().controller.getSnapshot(), selected);
  const sheet = f.render(); sheet.closeDialog(); old.setSearch('after close'); assert.equal(f.owner().controller.getSnapshot().search, '');
  f.render().setSearch('fresh header'); assert.equal(f.owner().controller.getSnapshot().search, 'fresh header'); f.unmount();
});
test('a retained material return callback cannot restart child reads after unmount or across a StrictMode mount lifetime', async () => {
  const f = fixture('material'), original = await f.selected(), returned = original.materialStates.props.onAssetReturned;
  f.replay(); await tick(); const count = f.calls.length; await returned(); assert.equal(f.calls.length, count);
  const fresh = f.render().materialStates.props.onAssetReturned; await fresh(); assert.deepEqual(f.calls.slice(-3), ['material-reload', 'summary', 'detail']);
  f.unmount(); const detached = f.calls.length; await fresh(); assert.equal(f.calls.length, detached);
});
