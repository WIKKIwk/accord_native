const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminCustomerChildrenSupport.cjs');

async function apparatus(t, overrides = {}) {
  const f = s.apparatusFixture(t, overrides); let valid = true, focused = true; const notices = [], r = s.runtime(), h = s.apparatusHook(r, { current: () => valid, controller: f.controller });
  const props = { session: {}, witness: {}, customerRef: ' dto ref ', materialTaminotchi: !!overrides.material, onChanged() {}, isCurrent: () => valid, isInteractive: () => focused, onNotice: message => notices.push(message) };
  const render = () => r.render(() => h.useAdminCustomerApparatus(props)); render(); await s.flush(); t.after(() => r.unmount());
  return { ...f, get changed() { return f.changed; }, notices, render, r, focus: value => { focused = value; }, retire: () => { valid = false; f.retire(); } };
}
test('genuine apparatus hook forwards each captured source notice once and separates focus from accepted save lifetime', async t => {
  const pending = s.deferred(), f = await apparatus(t, { save: async () => pending.promise }), original = f.render();
  f.focus(false); original.save(); assert.equal(f.controller.getSnapshot().saving, false); f.focus(true); original.save(); f.focus(false); pending.resolve(); await s.flush();
  assert.equal(f.changed, 1); assert.equal(f.render().current(), true); assert.deepEqual(f.notices, [f.render().a('scope.saved')]); f.render(); f.r.replay(); await s.flush(); f.render(); assert.equal(f.notices.length, 1);
  original.toggle('A', true); original.save(); assert.equal(f.controller.getSnapshot().saving, false, 'old native callbacks cannot use the replayed generation');
});
test('material apparatus Close is disabled while saving but native outside/back cancellation remains source-allowed', async t => {
  const pending = s.deferred(), f = await apparatus(t, { material: true, assignments: async () => [s.role({ principal_role: 'material_taminotchi' })], save: async () => pending.promise });
  f.render().openSheet(); let model = f.render(), id = model.state.sheet.id; model.saveSheet(id); model = f.render(); assert.equal(model.state.sheet.saving, true);
  model.closeSheet(id); assert.equal(f.controller.getSnapshot().sheet.id, id); f.focus(false); model.nativeDismiss(id); assert.equal(f.controller.getSnapshot().sheet, null);
  pending.resolve(); await s.flush(); assert.equal(f.changed, 1); assert.equal(f.controller.getSnapshot().sheet, null);
  f.focus(true); f.render().openSheet(); const fresh = f.render().state.sheet; model.toggle('A', true, id); model.nativeDismiss(id); assert.equal(f.controller.getSnapshot().sheet.id, fresh.id);
});
test('material warehouse genuine facade closes a confirmed remove in a committed render before command and retains accepted authority after blur', async t => {
  const pending = s.deferred(), f = s.warehouseFixture(t, { unassignWarehouse: async (name, guard) => { guard(); f.calls.push(['unassign', name]); await pending.promise; } });
  const original = f.render(); original.editor.removeWarehouse('Assigned'); let model = f.render(); const dialog = model.state.dialog;
  assert.equal(model.editor.dialogText.cancel, model.a('action.no')); assert.equal(model.editor.dialogText.confirm, model.a('action.yes'));
  model.editor.confirmRemove(dialog.id); model.editor.dismissDialog(dialog.id); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'unassign'), false);
  f.focus(false); model = f.render(); assert.equal(model.overlays.length, 0); assert.deepEqual(f.calls.filter(value => Array.isArray(value) && value[0] === 'unassign'), [['unassign', 'Assigned']]);
  pending.resolve(); await s.flush(); assert.ok(f.calls.some(value => Array.isArray(value) && value[1] === 'warehouse.unassigned'));
});
test('warehouse original picker choice is reserved before native closure, rejects queued changes/cancels and commits once after blur', async t => {
  const f = s.warehouseFixture(t); let model = f.render(); model.editor.add(); await s.flush(); model = f.render(); const id = model.state.picker.id;
  model.editor.selectWarehouse(id, 'Available'); model = f.render(); const commit = model.prepareWarehousePickerClose(id, true); assert.equal(typeof commit, 'function');
  model.editor.selectWarehouse(id, 'Other'); model.editor.dismissPicker(id); model.editor.confirmWarehouse(id); assert.equal(f.controller.getSnapshot().picker.selected, 'Available'); assert.equal(f.calls.filter(Array.isArray).length, 0);
  f.focus(false); assert.equal(f.render().current(), true); commit(); commit(); await s.flush(); assert.deepEqual(f.calls.find(value => Array.isArray(value) && value[0] === 'assign'), ['assign', 'Available', 'Original name']);
  assert.equal(f.calls.filter(value => Array.isArray(value) && value[0] === 'assign').length, 1);
});
test('warehouse prepared native closure cannot borrow a replayed/collapsed or retired owner', async t => {
  for (const retire of [f => f.r.replay(), f => f.retire(), f => f.r.unmount()]) {
    const f = s.warehouseFixture(t); f.render().editor.add(); await s.flush(); let model = f.render(); const id = model.state.picker.id; model.editor.selectWarehouse(id, 'Available'); model = f.render(); const commit = model.prepareWarehousePickerClose(id, true);
    retire(f); commit(); await s.flush(); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'assign'), false);
  }
});
test('a prepared warehouse close never dispatches a changed selection even if the private owner is synchronously changed outside its native facade', async t => {
  const f = s.warehouseFixture(t); f.render().editor.add(); await s.flush(); let model = f.render(); const id = model.state.picker.id; model.editor.selectWarehouse(id, 'Available'); model = f.render();
  const commit = model.prepareWarehousePickerClose(id, true); f.controller.selectWarehouse(id, 'Other'); commit(); await s.flush(); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'assign'), false); assert.equal(f.controller.getSnapshot().picker, null);
});
for (const platform of ['android', 'ios']) {
  test(`${platform} held detail composition binds actual avatar and assignment owners with the original witness and genuine host actions`, () => {
    const props = { session: {}, witness: {}, profileAction: {}, onBack() {}, footer: {}, chatAction: {} }, composed = s.composition(platform, props), current = () => true, canInteract = () => false;
    assert.equal(composed.type, 'ActualCustomerRoute'); assert.equal(composed.props.profileAction, props.profileAction); assert.equal(composed.props.onBack, props.onBack); assert.equal(composed.props.footer, props.footer);
    const image = composed.props.renderAvatar({ avatarUrl: 'https://images.example/a', displayName: 'CN', fallbackText: 'CN', size: 92, isCurrent: current, canInteract });
    assert.equal(image.type, 'ActualProfileAvatar'); assert.equal(image.props.session, props.session); assert.equal(image.props.witness, props.witness); assert.equal(image.props.isCurrent, current); assert.equal(image.props.canInteract, canInteract);
    const child = { session: props.session, witness: props.witness, isCurrent: current, onNotice() {}, onChanged() {} };
    assert.equal(composed.props.renderApparatusCard(child).type, 'ActualApparatusCard'); const warehouse = composed.props.renderMaterialWarehouseEditor(child); assert.equal(warehouse.type, 'ActualMaterialWarehouseEditor'); assert.equal(warehouse.props.onNotice, child.onNotice);
  });
  test(`${platform} genuine native warehouse picker hide then blur then dismissal commits its original choice`, async t => {
    const f = s.warehouseFixture(t); f.render().editor.add(); await s.flush(); let model = f.render(); const id = model.state.picker.id; model.editor.selectWarehouse(id, 'Available'); model = f.render();
    const v = s.pickerNative(platform, model), tree = v.render(), native = s.nodes(tree, node => node.type === (platform === 'android' ? 'ModalBottomSheet' : 'BottomSheet'))[0], hiding = s.deferred();
    if (platform === 'android') native.props.ref.current = { hide: () => hiding.promise };
    s.click(s.byId(tree, 'admin-material-warehouse-confirm'), platform); assert.equal(f.calls.some(value => Array.isArray(value) && value[0] === 'assign'), false);
    f.focus(false); model.editor.selectWarehouse(id, 'Other'); model.editor.dismissPicker(id); assert.equal(f.controller.getSnapshot().picker.selected, 'Available');
    if (platform === 'android') { native.props.onDismissRequest(); hiding.resolve(); } else { const closed = v.render(); assert.equal(s.nodes(closed, node => node.type === 'BottomSheet')[0].props.isPresented, false); native.props.onDismiss(); native.props.onDismiss(); }
    await s.flush(); assert.deepEqual(f.calls.find(value => Array.isArray(value) && value[0] === 'assign'), ['assign', 'Available', 'Original name']);
    assert.equal(f.calls.filter(value => Array.isArray(value) && value[0] === 'assign').length, 1);
  });
  test(`${platform} apparatus native card preserves source loading/error/role-hidden states and material 82 percent sheet`, async t => {
    const ordinary = await apparatus(t), normal = ordinary.render(), v = s.view(platform, 'AdminCustomerApparatusCard', normal, 'useAdminCustomerApparatus', 'useAdminCustomerApparatus'), tree = v.render({});
    assert.ok(s.texts(tree).includes(normal.a('scope.operator_title'))); assert.ok(s.texts(tree).includes(normal.a('scope.operator_description'))); s.click(s.byId(tree, 'admin-customer-apparatus-save'), platform); await s.flush(); assert.equal(ordinary.changed, 1);
    const loading = { ...normal, state: { ...normal.state, loading: true } }, load = s.view(platform, 'AdminCustomerApparatusCard', loading, 'useAdminCustomerApparatus', 'useAdminCustomerApparatus').render({});
    assert.equal(s.nodes(load, node => node.type === (platform === 'android' ? 'CircularProgressIndicator' : 'ProgressView')).length, 1); assert.equal(s.byId(load, 'admin-customer-apparatus-save'), undefined);
    const error = s.view(platform, 'AdminCustomerApparatusCard', { ...normal, state: { ...normal.state, error: Error('offline') } }, 'useAdminCustomerApparatus', 'useAdminCustomerApparatus').render({});
    assert.ok(s.texts(error).includes(normal.a('scope.load_failed'))); assert.ok(s.byId(error, 'admin-customer-apparatus-retry'));
    const hidden = s.view(platform, 'AdminCustomerApparatusCard', { ...normal, visible: false }, 'useAdminCustomerApparatus', 'useAdminCustomerApparatus').render({}); assert.equal(hidden, null);
    const material = await apparatus(t, { material: true, assignments: async () => [s.role({ principal_role: 'material_taminotchi' })] }); material.render().openSheet(); const model = material.render(), sheet = s.view(platform, 'AdminCustomerApparatusCard', model, 'useAdminCustomerApparatus', 'useAdminCustomerApparatus').render({});
    assert.ok(s.texts(sheet).includes(model.a('scope.material_supplier_title'))); assert.ok(s.byId(sheet, 'admin-material-apparatus-save'));
    if (platform === 'android') { assert.ok(s.nodes(sheet, node => node.type === 'Column').some(node => node.props.modifiers?.some(mod => mod.name === 'height' && mod.args[0] === 844 * .82))); assert.equal(s.nodes(sheet, node => node.type === 'ModalBottomSheet')[0].props.showDragHandle, true); }
    else assert.ok(s.nodes(sheet, node => node.type === 'Group')[0].props.modifiers.some(mod => mod.name === 'presentationDetents' && mod.args[0][0].fraction === .82));
  });
  test(`${platform} Material warehouse native body uses exact Material caption/keys and genuine shared native overlay model`, t => {
    const f = s.warehouseFixture(t), model = f.render(), v = s.view(platform, 'AdminCustomerMaterialWarehouseEditor', model, 'useAdminCustomerMaterialWarehouse', 'useAdminCustomerMaterialWarehouse'), tree = v.render(f.props);
    assert.ok(s.texts(tree).includes('Exact material scope')); assert.ok(s.byId(tree, 'admin-material-detail-warehouse-Assigned')); assert.ok(s.byId(tree, 'admin-material-detail-add-warehouse'));
    assert.equal(s.nodes(tree, node => node.type === 'RealWorkerDetailOverlays')[0].props.model, model); s.click(s.byId(tree, 'admin-material-detail-add-warehouse'), platform); assert.equal(f.calls[0], 'beginAdd');
  });
}
test('genuine child notices use the existing parent notice owner without changing source DTO, changed flag or prior notice lifetimes', async t => {
  let valid = true;
  const controller = new s.AdminCustomerDetailController({ isCurrent: () => valid, mode: { management: true, material: true, items: false, remove: false }, read: async () => s.detail(),
    phone: async () => s.detail(), regenerate: async () => s.detail(), remove: async () => {}, items: async () => [], assign: async () => s.detail(), unassign: async () => s.detail(), groups: async () => [], updateGroups: async () => s.detail(), copy: async () => {}, everySecond: () => 1, cancelTimer() {} });
  const owner = { current: () => valid, controller, mode: controller.mode }, r = s.runtime(), h = s.hooks(r, { './adminCustomerDetailSession': { createAdminCustomerDetailSession: () => owner } }), props = { session: {}, witness: {}, isCurrent: () => valid, customerRef: 'ref', onBack() {} };
  const render = () => r.render(() => h.useAdminCustomerDetail(props)); render(); await s.flush(); t.after(() => r.unmount());
  const original = render(), dto = controller.getSnapshot().detail; original.apparatus.onNotice('  Captured source message  '); const serial = controller.getSnapshot().notice.serial;
  assert.equal(render().notice, '  Captured source message  '); original.materialWarehouse.onNotice('Another source message'); controller.dismissNotice(serial); assert.equal(render().notice, 'Another source message');
  assert.equal(controller.getSnapshot().detail, dto); assert.equal(controller.getSnapshot().changed, false); r.replay(); await s.flush(); original.apparatus.onNotice('stale'); assert.equal(controller.getSnapshot().notice, null);
  valid = false; render().apparatus.onNotice('retired'); assert.equal(controller.getSnapshot().notice, null);
  const readonly = new s.AdminCustomerDetailController({ ...controller.deps, mode: { management: false, material: false, items: false, remove: false }, isCurrent: () => true }); readonly.start(); await s.flush(); readonly.childNotice('hidden'); assert.equal(readonly.getSnapshot().notice, null); readonly.dispose();
});
test('collapsed material child notice callbacks cannot reach the still-mounted genuine parent', () => {
  const calls = [], r = s.runtime(), h = s.hooks(r), warehouse = { onChanged() {}, onNotice: message => calls.push(message), reloadAssignedWarehouses: async () => [] };
  const props = r.render(() => h.useAdminCustomerWarehouseProps(warehouse, () => true, () => true)); props.onNotice('source'); r.unmount(); props.onNotice('stale'); assert.deepEqual(calls, ['source']);
});
