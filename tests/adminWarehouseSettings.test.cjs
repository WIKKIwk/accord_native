const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, model, tick, deferred, l10n } = require('./adminUsersSupport.cjs');
const exception = load('shared/mobileApiException');
const domain = { adminWarehouseRoleForUser: user => user.principal_role, adminWarehouseAssigneeSearch: (users, query) => users.filter(user => user.name.toLowerCase().includes(query.toLowerCase())) };
const controllerModule = load('admin/adminWarehouseSettingsController', { '../shared/camera/synchronousGuard': load('shared/camera/synchronousGuard'),
  '../shared/mobileApiException': exception, './adminWarehouseAssignees': domain, './adminUsersModel': model, './dartJsonString': strings });
const presentation = load('admin/adminWarehouseSettingsPresentation', { '../shared/localization': l10n });
const summary = (warehouse = 'A', fields = {}) => ({ warehouse, product_count: 2, reserved_count: 0, assignment_count: 1, assigned_display_names: [], ...fields });
const row = (fields = {}) => ({ warehouse: 'A', principal_role: 'werka', principal_ref: 'ref', display_name: 'Name', ...fields });
const user = (id = 'other', fields = {}) => ({ id, name: 'Other', principal_role: 'werka', kind: 'werka', ...fields });
async function fixture(overrides = {}, initialSummary = summary()) {
  let current = true; const calls = [], assigned = row(), candidate = user();
  const deps = { isCurrent: () => current, users: async guard => { guard(); calls.push('users'); return [candidate]; },
    assignments: async (warehouse, guard, witness) => { guard(); assert.equal(witness(), true); calls.push(['read', warehouse]); return [assigned]; },
    assign: async (input, guard) => { guard(); calls.push(['assign', input]); }, unassign: async (assignment, guard) => { guard(); calls.push(['unassign', assignment]); },
    deleteWarehouse: async (warehouse, products, guard) => { guard(); calls.push(['delete', warehouse, products]); },
    onChanged: async () => { calls.push('changed'); }, onDeleted: async () => { calls.push('deleted'); }, ...overrides };
  const controller = new controllerModule.AdminWarehouseSettingsController(deps); controller.start(); controller.setSelection(' A ', [initialSummary]); await tick();
  return { controller, calls, deps, assigned, candidate, retire: () => { current = false; } };
}
test('settings counts use first case-insensitive selected summary; missing selection hides content and makes no assignment read', async () => {
  const f = await fixture(); assert.equal(f.controller.summary().product_count, 2); assert.equal(f.controller.getSnapshot().warehouse, 'A');
  f.controller.setSelection(null, [summary()]); assert.equal(f.controller.summary(), null); assert.equal(f.controller.getSnapshot().assignmentsLoading, false);
  assert.deepEqual(f.calls, [['read', 'A']]); await f.controller.requestAssign(); f.controller.requestDelete(); assert.equal(f.controller.getSnapshot().dialog, null);
});
test('initial assignment error deliberately settles empty with no extra error/retry/notice; latest selection read wins', async () => {
  const f = await fixture({ assignments: async () => { throw new Error('read'); } });
  assert.equal(f.controller.getSnapshot().assignmentsLoading, false); assert.deepEqual(f.controller.getSnapshot().assignments, []); assert.equal(f.controller.getSnapshot().notice, null);
  const first = deferred(), second = deferred(), g = await fixture(); g.deps.assignments = name => name === 'B' ? first.promise : second.promise;
  g.controller.setSelection('B', [summary('B'), summary('C')]); assert.deepEqual(g.controller.getSnapshot().assignments, []);
  g.controller.setSelection('C', [summary('B'), summary('C')]); second.resolve([row({ warehouse: 'C' })]); await tick(); first.resolve([row({ warehouse: 'B' })]); await tick();
  assert.equal(g.controller.getSnapshot().assignments[0].warehouse, 'C'); assert.equal(g.controller.summary().warehouse, 'C');
});
test('assignment candidates exclude normalized role+ref principals, preserving different roles and source search/cancellation', async () => {
  const candidates = [user(' REF '), user('ref', { name: 'Qolip', principal_role: 'qolipchi', kind: 'qolipchi' }), user('fresh', { name: 'Fresh' })];
  const f = await fixture({ users: async () => candidates }); await f.controller.requestAssign(); const picker = f.controller.getSnapshot().picker;
  assert.deepEqual(picker.users, candidates.slice(1)); assert.equal(f.controller.getSnapshot().assigning, false);
  f.controller.searchPicker(picker.id, 'fresh'); assert.deepEqual(f.controller.visibleUsers(), [candidates[2]]); f.controller.dismissPicker(picker.id);
  await f.controller.requestAssign(); const fresh = f.controller.getSnapshot().picker;
  assert.equal(fresh.query, ''); assert.notEqual(fresh.id, picker.id); await f.controller.selectUser(picker.id, candidates[2]); assert.equal(f.calls.some(value => value[0] === 'assign'), false);
});
test('candidate empty and loading failure use only source all-assigned and users-load-failed notices', async () => {
  const f = await fixture({ users: async () => [user('ref')] }); await f.controller.requestAssign(); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.all_assigned');
  f.deps.users = async () => { throw new Error('users'); }; await f.controller.requestAssign(); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.users_load_failed');
  assert.equal(f.controller.getSnapshot().assigning, false); assert.equal(f.controller.getSnapshot().picker, null);
});
test('assign sends current warehouse only after picked and sequences assign→reread→parent reload→success', async () => {
  const f = await fixture(); await f.controller.requestAssign(); const picker = f.controller.getSnapshot().picker;
  f.controller.setSelection('B', [summary('B')]); await tick(); await f.controller.selectUser(picker.id, f.candidate);
  assert.deepEqual(f.calls.slice(-3), [['assign', { warehouse: 'B', principal_role: 'werka', principal_ref: 'other', display_name: 'Other' }], ['read', 'B'], 'changed']);
  assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.assigned_user_success'); assert.deepEqual(f.controller.getSnapshot().notice.values, { name: 'Other' });
  assert.equal(f.controller.getSnapshot().assigning, false); await f.controller.selectUser(picker.id, f.candidate); assert.equal(f.calls.filter(call => call[0] === 'assign').length, 1);
});
for (const failure of ['assign', 'read', 'changed']) test(`assign ${failure} failure uses source generic message without rolling back a successful earlier command`, async () => {
  const f = await fixture(); await f.controller.requestAssign(); const picker = f.controller.getSnapshot().picker;
  f.deps[failure === 'read' ? 'assignments' : failure === 'changed' ? 'onChanged' : 'assign'] = async () => { throw new Error(failure); };
  await f.controller.selectUser(picker.id, f.candidate); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.assign_user_failed'); assert.equal(f.controller.getSnapshot().assigning, false);
  assert.equal(f.controller.getSnapshot().picker, null);
});
test('unassign confirm captures exact assignment, trims only prompt name/ref fallback and refreshes before parent success', async () => {
  const f = await fixture(); f.assigned.display_name = ' \u0085 '; f.assigned.principal_ref = ' ref ';
  f.controller.requestUnassign(f.assigned); const dialog = f.controller.getSnapshot().dialog;
  assert.equal(dialog.kind, 'unassign'); assert.equal(dialog.displayName, 'ref'); assert.equal(dialog.warehouse, 'A');
  f.controller.dismissDialog(dialog.id); await f.controller.confirmDialog(dialog.id); assert.equal(f.calls.some(call => call[0] === 'unassign'), false);
  f.controller.requestUnassign(f.assigned); const fresh = f.controller.getSnapshot().dialog; await f.controller.confirmDialog(fresh.id);
  assert.deepEqual(f.calls.slice(-3), [['unassign', f.assigned], ['read', 'A'], 'changed']); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.unassigned_user_success');
  assert.deepEqual(f.controller.getSnapshot().notice.values, { name: 'ref' }); assert.equal(f.controller.getSnapshot().removingKey, null);
});
test('unassign MobileApiException message is shown verbatim, ordinary errors use localized fallback, and stale row/ticket are rejected', async () => {
  const f = await fixture(); f.controller.requestUnassign({ ...f.assigned }); assert.equal(f.controller.getSnapshot().dialog, null);
  f.deps.unassign = async () => { throw new exception.MobileApiException({ code: 'anything', message: 'Source backend message' }); };
  f.controller.requestUnassign(f.assigned); await f.controller.confirmDialog(f.controller.getSnapshot().dialog.id); assert.equal(f.controller.getSnapshot().notice.message, 'Source backend message');
  f.deps.unassign = async () => { throw new Error('not exposed'); }; f.controller.requestUnassign(f.assigned); await f.controller.confirmDialog(f.controller.getSnapshot().dialog.id);
  assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.unassign_user_failed');
});
test('reserved warehouse opens blocked-only dialog and never deletes; unassign controls remain independently available', async () => {
  const f = await fixture({}, summary('A', { reserved_count: 3 })); f.controller.requestDelete(); const dialog = f.controller.getSnapshot().dialog;
  assert.equal(dialog.kind, 'blocked'); await f.controller.confirmDialog(dialog.id); assert.equal(f.calls.some(call => call[0] === 'delete'), false);
  assert.equal(f.controller.getSnapshot().dialog, null); assert.equal(f.controller.getSnapshot().notice, null);
});
for (const count of [0, 5]) test(`delete confirms productCount=${count} choice and preserves captured summary before parent clear+reload`, async () => {
  const f = await fixture({}, summary('A', { product_count: count })); f.controller.requestDelete(); const dialog = f.controller.getSnapshot().dialog;
  f.controller.setSelection('B', [summary('B')]); await tick(); await f.controller.confirmDialog(dialog.id);
  assert.deepEqual(f.calls.slice(-2), [['delete', 'A', count > 0], 'deleted']); assert.equal(f.controller.getSnapshot().notice.key, 'warehouse.deleted'); assert.equal(f.controller.getSnapshot().deleting, false);
});
for (const [code, key] of [['warehouse_has_active_reservations', 'active'], ['warehouse_has_children', 'children'], ['warehouse_not_empty', 'not_empty'], ['warehouse_not_found', 'not_found'], ['constructor', null]]) {
  test(`delete backend ${code} maps only known source code`, async () => {
    const f = await fixture({ deleteWarehouse: async () => { throw new exception.MobileApiException({ code, message: 'server-message' }); } }); f.controller.requestDelete(); await f.controller.confirmDialog(f.controller.getSnapshot().dialog.id);
    assert.equal(f.controller.getSnapshot().notice.key, `warehouse.delete_error${key ? `_${key}` : ''}`); assert.equal(f.controller.getSnapshot().deleting, false);
  });
}
test('confirmation text and button order exactly include source product+assignment warnings for four locales', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    const s = summary('Storage', { product_count: 5, assignment_count: 3 }), labels = presentation.adminWarehouseSettingsDialogText({ kind: 'delete', id: 1, summary: s }, locale);
    assert.equal(labels.body, l10n.adminText('warehouse.delete_products_warning', locale, { warehouse: 'Storage', count: 5 }));
    assert.equal(labels.warning, l10n.adminText('warehouse.delete_assignments_warning', locale, { count: 3 })); assert.equal(labels.vertical, true);
    const empty = presentation.adminWarehouseSettingsDialogText({ kind: 'delete', id: 1, summary: summary('Empty', { product_count: 0, assignment_count: 0 }) }, locale);
    assert.equal(empty.warning, ''); assert.equal(empty.body, l10n.adminText('warehouse.delete_confirmation', locale, { warehouse: 'Empty' }));
    const unlink = presentation.adminWarehouseSettingsDialogText({ kind: 'unassign', id: 2, assignment: row(), displayName: 'Name', warehouse: 'A' }, locale);
    assert.equal(unlink.cancel, l10n.adminText('action.cancel', locale)); assert.equal(unlink.confirm, l10n.adminText('action.delete', locale)); assert.equal(unlink.vertical, false);
  }
  assert.equal(controllerModule.adminWarehouseSettingsRoleLabel('material_taminotchi'), "Material ta'minotchisi");
  assert.equal(controllerModule.adminWarehouseSettingsRoleLabel('customer'), 'Haridor');
});
test('duplicate confirmation and synchronous subscriber callbacks cannot dispatch a second delete or resurrect old dialogs', async () => {
  const pending = deferred(), f = await fixture({ deleteWarehouse: async () => { f.calls.push('delete'); await pending.promise; } }); f.controller.requestDelete(); const id = f.controller.getSnapshot().dialog.id;
  f.controller.subscribe(() => { if (f.controller.getSnapshot().deleting) { void f.controller.confirmDialog(id); f.controller.requestDelete(); } });
  const running = f.controller.confirmDialog(id); assert.equal(f.controller.getSnapshot().dialog, null); pending.resolve(); await running; assert.equal(f.calls.filter(call => call === 'delete').length, 1);
});
for (const stage of ['candidate', 'assign', 'unassign', 'delete', 'changed', 'deleted']) test(`account retirement during ${stage} prevents every subsequent command/callback/notice`, async () => {
  const pending = deferred(), f = await fixture(); let running;
  if (stage === 'candidate') { f.deps.users = () => pending.promise; running = f.controller.requestAssign(); }
  else if (stage === 'assign' || stage === 'changed') {
    await f.controller.requestAssign(); f.deps[stage === 'changed' ? 'onChanged' : 'assign'] = async () => pending.promise;
    running = f.controller.selectUser(f.controller.getSnapshot().picker.id, f.candidate);
  } else {
    f.deps[stage === 'delete' ? 'deleteWarehouse' : stage === 'deleted' ? 'onDeleted' : 'unassign'] = async () => pending.promise;
    if (stage === 'unassign') f.controller.requestUnassign(f.assigned); else f.controller.requestDelete();
    running = f.controller.confirmDialog(f.controller.getSnapshot().dialog.id);
  }
  await tick(); f.retire(); pending.resolve(stage === 'candidate' ? [f.candidate] : undefined); await running;
  assert.equal(f.controller.getSnapshot().phase, 'invalidated'); assert.equal(f.controller.getSnapshot().notice, null); assert.deepEqual(f.controller.getSnapshot().assignments, []);
});
test('StrictMode detach invalidates pending load, restarts new selection and permanently fences original retired authority', async () => {
  const wait = deferred(), f = await fixture(); f.deps.assignments = () => wait.promise;
  f.controller.setSelection('B', [summary('B')]); const oldGeneration = f.controller.interactionGeneration; f.controller.dispose(); f.controller.start();
  f.deps.assignments = async () => [row({ warehouse: 'C' })]; f.controller.setSelection('C', [summary('C')]); await tick(); wait.resolve([row({ warehouse: 'B' })]); await tick();
  assert.notEqual(oldGeneration, f.controller.interactionGeneration); assert.equal(f.controller.getSnapshot().assignments[0].warehouse, 'C');
  f.retire(); f.controller.requestDelete(); f.controller.dispose(); f.controller.start(); assert.equal(f.controller.isCurrent(), false);
});
