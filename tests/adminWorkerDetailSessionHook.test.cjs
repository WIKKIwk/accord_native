const assert = require('node:assert/strict');
const test = require('node:test');
const support = require('./adminWorkerDetailSupport.cjs');
const { load, strings, routes, l10n, workerModel, controller: { AdminWorkerDetailController }, editor: { AdminWorkerDetailEditorController }, entry, detail, profile, tick, flush, deferred, scheduler } = support;
const profileGuard = load('shared/profileSessionGuard');
function sessionFixture(kind = 'worker', role = 'aparatchi') {
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'admin' }, capabilities: ['admin.access'] }, witness = { session }, target = { ...entry(kind, role) }, calls = [];
  let epoch = 1, valid = true, external = () => true;
  class Controller { constructor(deps) { this.deps = deps; } isCurrent() { return this.deps.isCurrent(); } getSnapshot() { return { detail: detail(), warehouses: ['A'], responsibilities: [] }; } }
  class Editor { constructor(deps) { this.deps = deps; } }
  const api = {}; for (const name of ['adminWorkerDetail', 'adminWorkerDetailProfile', 'adminWorkerDetailRegenerateCode', 'adminWorkerDetailRegenerateSystemCode', 'adminWorkerDetailSystem', 'adminWorkerDetailUpdatePhone', 'adminWorkerDetailUpdateSystemPhone']) api[name] = async (...args) => { calls.push([name, ...args]); return detail(); };
  const assignments = {}; for (const name of ['adminWorkerDetailAssignedWarehouses', 'adminWorkerDetailAssignResponsibility', 'adminWorkerDetailMaterials', 'adminWorkerDetailResponsibilities', 'adminWorkerDetailUnassignResponsibility', 'adminWorkerDetailWarehouses']) assignments[name] = async (...args) => { calls.push([name, ...args]); return []; };
  const { adminWorkerDetailSession } = load('admin/adminWorkerDetailSession', { 'expo-clipboard': { setStringAsync: async value => { calls.push(['clipboard', value]); return true; } },
    '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: candidate => valid && candidate === witness },
    '../apparatusApi': { adminApparatus: async (...args) => { calls.push(['apparatus', ...args]); return []; } }, '../sessionReadScope': load('sessionReadScope'), '../shared/appRoutes': routes, '../shared/profileSessionGuard': profileGuard,
    '../shared/localization': l10n, '../shared/localization/runtime': { localeController: { locale: 'uz' } }, './adminUsersModel': support.model, './adminWorkerDetailModel': workerModel,
    './adminWorkerDetailApi': api, './adminWorkerDetailAssignmentsApi': assignments, './adminWorkerDetailController': { AdminWorkerDetailController: Controller }, './adminWorkerDetailEditorController': { AdminWorkerDetailEditorController: Editor },
    './adminWarehouseAssignmentApi': { adminAssignWarehouse: async (...args) => calls.push(['assignWarehouse', ...args]) }, './adminWarehouseSettingsApi': { adminUnassignWarehouse: async (...args) => calls.push(['unassignWarehouse', ...args]) }, './dartJsonString': strings });
  const owner = adminWorkerDetailSession(session, witness, () => external(), target);
  return { owner, session, target, calls, epoch: value => { epoch = value; }, retire: () => { valid = false; }, external: value => { external = value; } };
}
for (const change of ['scope', 'epoch', 'witness', 'target', 'capability', 'token']) test(`Worker session captures original ${change} and latches permanent retirement`, () => {
  const f = sessionFixture(); assert.equal(f.owner.current(), true);
  if (change === 'scope') f.session.baseUrl = 'https://different.example'; if (change === 'epoch') f.epoch(2); if (change === 'witness') f.retire();
  if (change === 'target') f.target.id = 'other'; if (change === 'capability') f.session.capabilities = []; if (change === 'token') f.session.token = 'test-mode-token';
  assert.equal(f.owner.current(), false); f.session.baseUrl = 'https://server.example'; f.epoch(1); f.target.id = ' ref '; f.session.capabilities = ['admin.access']; f.session.token = 'new'; assert.equal(f.owner.current(), false);
});
test('Worker session permits same-account token refresh and rejects async/reentrant original authority', () => {
  const f = sessionFixture(); f.session.token = 'refreshed'; assert.equal(f.owner.current(), true);
  const a = sessionFixture(); a.external(async () => true); assert.equal(a.owner.current(), false);
  const r = sessionFixture(); r.external(() => { r.owner.current(); return true; }); assert.equal(r.owner.current(), false);
});
test('Worker factory preserves trimmed widget identity, captured phone DTO, same original read witnesses and current052 Metalayzer mapping', async () => {
  for (const [kind, role, system] of [['worker', 'aparatchi', false], ['metalayzer', 'metalayzer', true]]) {
    const f = sessionFixture(kind, role), deps = f.owner.controller.deps, guard = () => {}, witness = () => true;
    const loaded = await deps.detail(guard, witness); await deps.profile(guard, witness); await deps.apparatus(guard, witness); await deps.savePhone({ ...detail(), id: 'dto ref', name: 'DTO name' }, ' raw phone ', guard); await deps.regenerate(guard); await deps.copy(' raw code ');
    assert.equal(f.calls[0][0], system ? 'adminWorkerDetailSystem' : 'adminWorkerDetail'); assert.deepEqual(f.calls[0].slice(1), [f.session, 'ref', guard, witness]);
    assert.deepEqual(f.calls[2], ['apparatus', f.session, { limit: 10000, beforeSend: guard, readWitness: witness }]);
    assert.deepEqual(f.calls[3], system ? ['adminWorkerDetailUpdateSystemPhone', f.session, { id: 'dto ref', role, name: 'DTO name', phone: ' raw phone ' }, guard]
      : ['adminWorkerDetailUpdatePhone', f.session, 'dto ref', ' raw phone ', guard]);
    assert.equal(f.calls[4][0], system ? 'adminWorkerDetailRegenerateSystemCode' : 'adminWorkerDetailRegenerateCode'); assert.deepEqual(f.calls.at(-1), ['clipboard', ' raw code ']);
    if (system) assert.equal(loaded.level, support.model.adminUserRoleLabel(f.target));
    const editor = f.owner.warehouseEditor.deps; await editor.assignWarehouse('A', 'Display', guard); await editor.unassignWarehouse('A', guard);
    assert.deepEqual(f.calls.at(-2), ['assignWarehouse', f.session, { warehouse: 'A', principal_role: system ? 'metalayzer' : 'tayyorlov_masteri', principal_ref: 'ref', display_name: 'Display' }, guard]);
    assert.deepEqual(f.calls.at(-1), ['unassignWarehouse', f.session, { warehouse: 'A', principal_role: system ? 'metalayzer' : 'tayyorlov_masteri', principal_ref: 'ref' }, guard]);
  }
});
const presentation = load('admin/adminWorkerDetailPresentation', { '../shared/localization': l10n, './adminUsersModel': support.model, './dartJsonString': strings,
  './adminWerkaPresentation': load('admin/adminWerkaPresentation', { './dartJsonString': strings }) });
function hookFixture(t, { kind = 'tayyorlovMasteri', role = 'tayyorlov_masteri', readOnly = false, platform = 'android' } = {}) {
  let valid = true, focused = true, cursor = 0, notify, serial = 0; const slots = [], effects = [], handlers = new Set(), calls = [], backs = [], clock = scheduler();
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const memo = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) slots[index] = { deps, value: create() }; return slots[index].value; };
  const effect = (create, deps) => { const index = cursor++, old = slots[index]; if (!old || !equal(old.deps, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: create() }; }); };
  const react = { useMemo: memo, useCallback: (fn, deps) => memo(() => fn, deps), useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; }, useSyncExternalStore: (_subscribe, get) => get(), useLayoutEffect: effect, useEffect: effect };
  const target = entry(kind, role), rootDeps = { entry: target, readOnly, isCurrent: () => valid, timeout: promise => promise,
    detail: async () => detail(), profile: async () => profile(), apparatus: async () => [], warehouses: async () => ['Assigned'], responsibilities: async () => [{ material_id: 'assigned', material_name: 'Assigned', estimated_kg: null }],
    savePhone: async (_detail, phone, guard) => { guard(); calls.push(['phone', phone]); return phone; }, regenerate: async guard => { guard(); calls.push('regenerate'); return detail({ code: 'new' }); }, copy: async value => { calls.push(['copy', value]); return true; }, schedule: clock.set, cancel: clock.clear };
  const controller = new AdminWorkerDetailController(rootDeps), editorDeps = mode => ({ mode, isCurrent: () => controller.isCurrent() && !readOnly, nextId: () => ++serial, name: () => 'Name',
    assignedWarehouses: () => controller.getSnapshot().warehouses, assignedMaterials: () => controller.getSnapshot().responsibilities,
    warehouses: async guard => { guard(); calls.push('warehouseCatalog'); return [{ warehouse: 'A' }]; }, materials: async guard => { guard(); calls.push('materialCatalog'); return [{ id: 'm', name: 'Material', active: true, variants: [] }]; },
    assignWarehouse: async (warehouse, _name, guard) => { guard(); calls.push('assignWarehouse'); return { warehouse }; }, unassignWarehouse: async (_name, guard) => { guard(); calls.push('unassignWarehouse'); }, reloadWarehouses: async () => ['A'],
    assignMaterial: async (id, guard) => { guard(); calls.push('assignMaterial'); return { material_id: id, material_name: 'Material' }; }, unassignMaterial: async () => {}, reloadMaterials: async () => [{ material_id: 'm', material_name: 'Material' }],
    changedWarehouses: values => controller.updateWarehouses(values), changedMaterials: values => controller.updateResponsibilities(values), text: key => key, notice: (key, values) => controller.notice(key, values), rawNotice: message => controller.rawNotice(message), schedule: clock.set, cancel: clock.clear });
  const warehouseDeps = editorDeps('warehouse'), materialDeps = editorDeps('material'), warehouseEditor = new AdminWorkerDetailEditorController(warehouseDeps), materialEditor = new AdminWorkerDetailEditorController(materialDeps), owner = { controller, warehouseEditor, materialEditor, current: () => valid };
  const hook = load('admin/useAdminWorkerDetail', { react, 'expo-router': { useIsFocused: () => focused, useFocusEffect: fn => effect(fn, [fn]) },
    'react-native': { Platform: { OS: platform }, BackHandler: { addEventListener: (_event, fn) => { handlers.add(fn); return { remove: () => handlers.delete(fn) }; } } }, '../auth': { subscribeSessionWitness: fn => { notify = fn; return () => {}; } },
    '../shared/localization': l10n, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './adminWorkerDetailSession': { adminWorkerDetailSession: () => owner }, './adminWorkerDetailPresentation': presentation, './adminWorkerDetailModel': workerModel, './dartJsonString': strings });
  const props = { session: {}, witness: {}, isCurrent: () => valid, entry: target, readOnly, onBack: changed => backs.push(changed), onOpenActivity: value => calls.push(['activity', value]) };
  const render = () => { cursor = 0; effects.length = 0; const value = hook.useAdminWorkerDetail(props); for (const commit of [...effects]) commit(); return value; };
  const cleanup = () => { for (const slot of slots) if (slot?.cleanup) { slot.cleanup(); slot.cleanup = null; slot.deps = null; } };
  t.after(cleanup);
  return { render, controller, warehouseEditor, materialEditor, rootDeps, warehouseDeps, materialDeps, calls, backs, handlers, props, cleanup, clock, focus: value => { focused = value; }, retire: () => { valid = false; notify?.(); } };
}
test('Worker hook replay fences retained root/field/editor/native callbacks while fresh lifetime remains usable', async t => {
  const f = hookFixture(t); f.render(); await flush(); f.render().toggle(); f.render(); const old = f.render(); old.phoneAction(); const field = f.render();
  f.cleanup(); f.render(); await flush(); const fresh = f.render(); const before = [...f.calls];
  old.toggle(); old.regenerate(); old.copy(); old.reload(); old.back(); old.warehouse.add(); old.material.add(); field.changePhone('stale'); field.submitPhone();
  assert.deepEqual(f.calls, before); assert.deepEqual(f.backs, []); assert.equal(f.controller.getSnapshot().expanded, false);
  fresh.toggle(); const active = f.render(); active.phoneAction(); f.render().changePhone('new'); f.render().submitPhone(); await tick();
  assert.deepEqual(f.calls.at(-1), ['phone', 'new']); assert.equal(f.controller.getSnapshot().changed, true);
});
test('collapsed source panel retires warehouse editor only and retained phone closures cannot target newly mounted panel', async t => {
  const wait = deferred(), f = hookFixture(t); f.render(); await flush(); f.render().toggle(); f.render(); const old = f.render(); old.phoneAction(); const phone = f.render();
  f.warehouseDeps.warehouses = () => wait.promise; old.warehouse.add(); old.toggle(); f.render(); f.render().toggle(); f.render(); const current = f.render();
  phone.changePhone('old'); phone.submitPhone(); old.warehouse.add(); assert.equal(f.controller.getSnapshot().phoneEditing, false);
  wait.resolve([{ warehouse: 'Late' }]); await tick(); assert.equal(f.warehouseEditor.getSnapshot().picker, null); assert.equal(f.materialEditor.isCurrent(), true);
  current.phoneAction(); f.render().changePhone('fresh'); assert.equal(f.controller.getSnapshot().phoneDraft, 'fresh');
});
test('focus gates visible interactions while pending original write can settle; back returns changed once', async t => {
  const f = hookFixture(t), wait = deferred(); f.rootDeps.savePhone = async () => wait.promise; f.render(); await flush(); f.render().toggle(); f.render().phoneAction(); const active = f.render(); active.changePhone('typed'); active.submitPhone();
  f.focus(false); const blurred = f.render(); assert.equal(blurred.current(), false); assert.equal(blurred.scopeCurrent(), true);
  active.changePhone('hidden'); active.copy(); active.regenerate(); active.back(); active.warehouse.add(); active.material.add(); assert.deepEqual(f.calls, []);
  wait.resolve('ack'); await tick(); assert.equal(f.controller.getSnapshot().detail.phone, 'ack'); f.focus(true); const back = f.render(); back.back(); back.back(); assert.deepEqual(f.backs, [true]);
});
test('simultaneous independent editor completions preserve overlay order; only top native callbacks act and back dismisses top first', async t => {
  const f = hookFixture(t), catalogA = deferred(), catalogB = deferred(); f.warehouseDeps.warehouses = () => catalogA.promise; f.materialDeps.materials = () => catalogB.promise;
  f.render(); await flush(); f.render().toggle(); f.render(); const active = f.render(); active.warehouse.add(); active.material.add();
  catalogA.resolve([{ warehouse: 'A' }]); await tick(); const lower = f.render(); const firstId = lower.overlays[0].id;
  catalogB.resolve([{ id: 'm', name: 'Material', active: true, variants: [] }]); await tick(); const both = f.render(); assert.equal(both.overlays.length, 2); assert.ok(both.overlays[1].id > firstId);
  lower.warehouse.dismissPicker(firstId); lower.warehouse.selectWarehouse(firstId, 'A'); active.toggle(); assert.ok(f.warehouseEditor.getSnapshot().picker); assert.equal(f.warehouseEditor.getSnapshot().picker.selected, null);
  both.back(); assert.equal(f.materialEditor.getSnapshot().picker, null); assert.ok(f.warehouseEditor.getSnapshot().picker); assert.deepEqual(f.backs, []);
  f.render().back(); assert.equal(f.warehouseEditor.getSnapshot().picker, null); f.render().back(); assert.deepEqual(f.backs, [false]);
});
test('Worker real activity callback preserves original entry and source no-refresh return; system/read-only screens do not expose it', async t => {
  const f = hookFixture(t, { kind: 'worker', role: 'aparatchi' }); f.render(); await flush(); const visible = f.render(); visible.openActivity(); await tick(); assert.deepEqual(f.calls, [['activity', f.props.entry]]);
  for (const options of [{ readOnly: true, kind: 'worker', role: 'aparatchi' }, {}]) { const hidden = hookFixture(t, options); hidden.render(); await flush(); hidden.render().openActivity(); assert.deepEqual(hidden.calls, []); }
});
test('Worker Android hardware back uses latest changed result; iOS avoids Android subscription and retirement blocks original callbacks', async t => {
  const f = hookFixture(t); f.render(); await flush(); f.render(); assert.equal(f.handlers.size, 1); f.controller.updateWarehouses(['A']); assert.equal([...f.handlers][0](), true); assert.deepEqual(f.backs, [true]);
  const ios = hookFixture(t, { platform: 'ios' }); ios.render(); await flush(); const old = ios.render(); assert.equal(ios.handlers.size, 0); ios.retire(); old.back(); old.toggle(); old.material.add();
  assert.deepEqual(ios.backs, []); assert.equal(ios.controller.getSnapshot().phase, 'invalidated'); assert.equal(ios.materialEditor.getSnapshot().phase, 'invalidated');
});
