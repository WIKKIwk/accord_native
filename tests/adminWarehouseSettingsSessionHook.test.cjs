const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, model, routes, tick, deferred } = require('./adminUsersSupport.cjs');
const exception = load('shared/mobileApiException'), sync = load('shared/camera/synchronousGuard'), profile = load('shared/profileSessionGuard');
const controllers = load('admin/adminWarehouseSettingsController', { '../shared/camera/synchronousGuard': sync, '../shared/mobileApiException': exception,
  './adminWarehouseAssignees': { adminWarehouseRoleForUser: user => user.principal_role, adminWarehouseAssigneeSearch: users => users }, './adminUsersModel': model, './dartJsonString': strings });
function sessionFixture() {
  const session = { token: 'token', baseUrl: 'https://server.example', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access', 'catalog.item.read'] };
  const witness = { session }; let epoch = 1, valid = true, outer = () => true;
  const { adminWarehouseSettingsSession } = load('admin/adminWarehouseSettingsSession', { '../auth': { activeSessionEpoch: () => epoch,
    activeSessionToken: () => session.token || null, isSessionWitnessCurrent: candidate => valid && candidate === witness }, '../sessionReadScope': load('sessionReadScope'),
    '../shared/appRoutes': routes, '../shared/profileSessionGuard': profile, './adminUsersApi': {}, './adminWarehouseAssignees': {}, './adminWarehouseAssignmentApi': {},
    './adminWarehouseSettingsApi': {}, './adminWarehouseSettingsController': controllers, './warehouseApi': {}, './adminUsersModel': model });
  const owner = adminWarehouseSettingsSession(session, witness, () => outer(), { onChanged: async () => {}, onDeleted: async () => {} });
  return { session, owner, epoch: value => { epoch = value; }, retire: () => { valid = false; }, outer: value => { outer = value; } };
}
for (const kind of ['scope', 'epoch', 'permission', 'witness', 'token']) test(`settings session retains original ${kind} and latches retirement`, () => {
  const f = sessionFixture(); assert.equal(f.owner.current(), true);
  if (kind === 'scope') f.session.baseUrl = 'https://other.example'; if (kind === 'epoch') f.epoch(2); if (kind === 'permission') f.session.capabilities = [];
  if (kind === 'witness') f.retire(); if (kind === 'token') f.session.token = '';
  assert.equal(f.owner.current(), false); f.session.baseUrl = 'https://server.example'; f.epoch(1); f.session.capabilities = ['admin.access', 'catalog.item.read']; f.session.token = 'restored'; assert.equal(f.owner.current(), false);
});
test('settings session accepts token-only refresh and rejects async/reentrant original isCurrent', () => {
  const f = sessionFixture(); f.session.token = 'fresh'; assert.equal(f.owner.current(), true);
  const g = sessionFixture(); g.outer(async () => true); assert.equal(g.owner.current(), false);
  const h = sessionFixture(); h.outer(() => { h.owner.current(); return true; }); assert.equal(h.owner.current(), false);
});
function hookFixture(overrides = {}) {
  let focused = true, current = true, slot = 0, notify; const slots = [], effects = [], calls = [];
  const assignment = { warehouse: 'A', principal_role: 'werka', principal_ref: 'one', display_name: 'Name' }, user = { id: 'two', name: 'Other', principal_role: 'werka' };
  const controller = new controllers.AdminWarehouseSettingsController({ isCurrent: () => current,
    users: async () => { calls.push('users'); return [user]; }, assignments: async name => { calls.push(['read', name]); return [assignment]; },
    assign: async () => { calls.push('assign'); }, unassign: async () => { calls.push('unassign'); }, deleteWarehouse: async () => { calls.push('delete'); },
    onChanged: async () => { calls.push('changed'); }, onDeleted: async () => { calls.push('deleted'); }, ...overrides });
  const owner = { controller, current: () => current };
  const memo = (make, deps) => { const index = slot++, previous = slots[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) slots[index] = { deps, value: make() }; return slots[index].value; };
  const effect = (create, deps) => { const index = slot++, previous = slots[index]; if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
    const entry = { create, deps, cleanup: previous?.cleanup }; slots[index] = entry; effects.push(() => { entry.cleanup?.(); entry.cleanup = create(); });
  } };
  const react = { useMemo: memo, useRef: value => memo(() => ({ current: value }), []), useLayoutEffect: effect, useEffect: effect, useSyncExternalStore: (_subscribe, get) => get() };
  const { useAdminWarehouseSettings } = load('admin/useAdminWarehouseSettings', { react, 'expo-router': { useIsFocused: () => focused },
    '../shared/camera/synchronousGuard': sync,
    '../auth': { subscribeSessionWitness: fn => { notify = fn; return () => calls.push('unsubscribe'); } }, '../shared/localization': { adminText: key => key, localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, './adminWarehouseSettingsSession': { adminWarehouseSettingsSession: () => owner },
    './adminWarehouseSettingsPresentation': { adminWarehouseSettingsDialogText: () => ({}) } });
  const props = { session: {}, witness: {}, isCurrent: () => current, onChanged: async () => {}, onDeleted: async () => {}, warehouse: 'A',
    summaries: [{ warehouse: 'A', product_count: 2, reserved_count: 0, assignment_count: 1 }], onFilterToggle: () => calls.push('filter'), onWarehouseChanged: name => calls.push(['warehouse', name]) };
  const Harness = () => { slot = 0; const value = useAdminWarehouseSettings(props); effects.splice(0).forEach(run => run()); return value; };
  const unmount = () => slots.forEach(entry => entry?.cleanup?.());
  return { calls, controller, assignment, user, props, render: Harness, unmount, focus: value => { focused = value; }, retire: () => { current = false; notify(); },
    replay: () => { unmount(); slots.forEach(entry => { if (entry?.create) entry.cleanup = entry.create(); }); } };
}
test('actual settings hook replays attach-cleanup-attach and fences all callbacks retained from old generation', async () => {
  const f = hookFixture(), stale = f.render(); await tick(); f.replay(); await tick(); const fresh = f.render(), before = [...f.calls];
  stale.toggleFilter(); stale.selectWarehouse('A'); stale.assign(); stale.deleteWarehouse(); stale.unassign(f.assignment); stale.confirm(1); stale.dismiss(1); stale.select(1, f.user); stale.search(1, 'old'); stale.dismissPicker(1);
  assert.deepEqual(f.calls, before); assert.equal(f.controller.getSnapshot().dialog, null);
  fresh.toggleFilter(); fresh.selectWarehouse('A'); fresh.selectWarehouse('unknown'); fresh.assign(); await tick();
  assert.deepEqual(f.calls.slice(-4), ['filter', ['warehouse', 'A'], 'users', ['read', 'A']]); assert.ok(f.controller.getSnapshot().picker); f.unmount();
});
test('blur forbids retained UI callbacks without canceling captured account authority; real selection and confirmations work after refocus', async () => {
  const f = hookFixture(); f.render(); await tick(); const old = f.render(); f.focus(false); assert.equal(f.render().current, false); const before = [...f.calls];
  old.toggleFilter(); old.selectWarehouse('A'); old.assign(); old.unassign(f.assignment); old.deleteWarehouse(); assert.deepEqual(f.calls, before); assert.equal(f.controller.isCurrent(), true);
  f.focus(true); const fresh = f.render(); fresh.unassign(f.assignment); const id = f.controller.getSnapshot().dialog.id; fresh.confirm(id); await tick();
  assert.deepEqual(f.calls.slice(-3), ['unassign', ['read', 'A'], 'changed']); f.unmount(); fresh.assign(); assert.equal(f.controller.isCurrent(), false);
});
test('retired pending hook operation cannot publish success, run parent callback or restart after StrictMode replay', async () => {
  const wait = deferred(), f = hookFixture({ deleteWarehouse: async () => { f.calls.push('delete'); return wait.promise; } }); f.render(); await tick(); const view = f.render();
  view.deleteWarehouse(); view.confirm(f.controller.getSnapshot().dialog.id); f.retire(); wait.resolve(); await tick(); f.replay(); assert.equal(f.render().current, false);
  assert.equal(f.calls.includes('deleted'), false); assert.equal(f.controller.getSnapshot().notice, null); f.unmount();
});
test('a retained hidden pager rejects native callbacks while keeping account reads and visible-page confirmations alive', async () => {
  let visible = true; const f = hookFixture(); f.props.canInteract = () => visible; f.render(); await tick(); const original = f.render();
  original.unassign(f.assignment); const id = f.controller.getSnapshot().dialog.id;
  visible = false; const before = [...f.calls];
  original.confirm(id); original.dismiss(id); original.assign(); original.deleteWarehouse(); original.toggleFilter(); original.selectWarehouse('A');
  assert.deepEqual(f.calls, before); assert.equal(f.controller.isCurrent(), true, 'the hidden page does not retire the account owner');
  visible = true; original.confirm(id); await tick(); assert.deepEqual(f.calls.slice(-3), ['unassign', ['read', 'A'], 'changed']);
  f.props.canInteract = () => Promise.reject(Error('async visibility is not authority')); f.render(); const count = f.calls.length; original.assign(); await tick(); assert.equal(f.calls.length, count);
  f.props.canInteract = () => { f.unmount(); return true; }; f.render(); original.assign(); assert.equal(f.calls.length, count + 1); assert.equal(f.calls.at(-1), 'unsubscribe', 'a synchronous visibility callback can detach but cannot authorize a read or write afterward');
});
