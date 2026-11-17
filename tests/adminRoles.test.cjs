const assert = require('node:assert/strict');
const test = require('node:test');
const { load, strings, l10n, model: users, checked, flush, deferred } = require('./adminUsersSupport.cjs');
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const rezka = load('rezka/rezkaWorkerController', { '../workerControlsApi': controls, './rezkaSessionGuard': {} });
const assignment = load('admin/adminCustomerApparatusModel', { './dartJsonString': strings });
const roles = load('admin/adminRolesModel', { '../rezka/rezkaWorkerController': rezka, '../shared/localization': l10n,
  './adminCustomerApparatusModel': assignment, './dartJsonString': strings });
const createModel = load('admin/adminUserCreateModel', { '../qolip/qolipSearchRelevance': {}, '../shared/mobileApiException': {}, './adminUsersModel': users, './dartJsonString': strings });
const { AdminRolesController } = load('admin/adminRolesController', { './adminRolesModel': roles, './dartJsonString': strings });
const role = (id, patch = {}) => createModel.adminUserCreateRoleFromJson({ id, label: id, ...patch });
const assigned = (principal_role, principal_ref, role_id, assigned_apparatus = []) => ({ principal_role, principal_ref, role_id, assigned_apparatus, assigned_item_groups: [] });
const data = () => ({ capabilities: [{ code: 'catalog.item.read', label: 'Catalog', default_roles: [] }, { code: 'apparatus.queue.read', label: 'Queue', default_roles: [] }],
  roles: [role('werka', { system: true, base_role: 'werka' }), role('catalog_reader', { capability_codes: ['catalog.item.read'] }), role('aparatchi', { system: true, base_role: 'werka', capability_codes: ['apparatus.queue.read'] })],
  assignments: [assigned('werka', 'werka', 'catalog_reader')], settings: { werka_name: '  ' }, suppliers: [{ ref: 's', name: 'Supplier' }, { ref: 'blank', name: '  ' }],
  customers: [{ ref: 'c', name: 'Customer' }], apparatus: [{ id: 'apparatus:print:a', name: 'B' }, { id: 'apparatus:print:b', name: 'A' }] });
function api(overrides = {}) {
  const calls = [], values = data();
  const fetch = async (...args) => { calls.push(args); args[3](); return overrides.response ? overrides.response(...args) : { status: 200, json: async () => [] }; };
  const readers = { roles: async () => values.roles, assignments: async () => values.assignments, settings: async () => values.settings,
    customers: async () => values.customers, apparatus: async () => values.apparatus, ...overrides.readers };
  return { calls, ...load('admin/adminRolesApi', { '../authorizedFetch': { authorizedFetch: fetch }, './adminProductionRequest': checked,
    './adminUserCreateModel': createModel, './adminUsersModel': users, './adminUserCreateApi': { readAdminUserCreateRoles: readers.roles }, './adminUsersApi': { adminRoleAssignments: readers.assignments },
    './adminSettings': { adminSettings: readers.settings }, './adminItemCreateCustomersApi': { readAdminItemCreateCustomers: readers.customers }, '../apparatusApi': { adminApparatus: readers.apparatus } }) };
}
test('Roles capabilities and supplier-page requests retain exact source paths, defaults and read witnesses', async () => {
  const f = api({ response: async (_session, path) => ({ status: 200, json: async () => path.endsWith('/capabilities') ? [{ code: 'x', default_roles: ['omborchi'] }] : [{ ref: ' raw ', name: 'Supplier' }] }) });
  const witness = () => true, guard = () => {};
  assert.deepEqual(await f.adminRolesCapabilities({}, guard, witness), [{ code: 'x', label: '', default_roles: ['werka'] }]);
  const suppliers = await f.adminRolesSuppliers({}, guard, witness); assert.equal(suppliers[0].ref, ' raw '); assert.equal(suppliers[0].blocked, false);
  assert.deepEqual(f.calls.map(call => call[1]), ['/v1/mobile/admin/capabilities', '/v1/mobile/admin/suppliers/list?limit=100']);
  for (const call of f.calls) { assert.equal(call[2], undefined); assert.equal(call[5].readWitness, witness); }
  assert.throws(() => f.adminRolesCapabilityFromJson({ default_roles: ['unknown'] }));
  assert.throws(() => f.adminRolesCapabilityFromJson({ label: 9 }));
});
test('Role PUT uses existing role parser and source toJson fields without system or absent base role', async () => {
  const f = api({ response: async () => ({ status: 200, json: async () => ({ id: 'a', label: 'A' }) }) });
  await f.adminRolesSave({}, role('a', { label: ' A ', capability_codes: ['x', 'x'], system: true }), () => {});
  assert.equal(f.calls[0][1], '/v1/mobile/admin/roles');
  assert.deepEqual(f.calls[0][2], { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"id":"a","label":" A ","capability_codes":["x","x"]}' });
  await f.adminRolesSave({}, role('a', { base_role: 'werka' }), () => {});
  assert.equal(JSON.parse(f.calls[1][2].body).base_role, 'werka');
  const failed = api({ response: async () => ({ status: 201 }) });
  await assert.rejects(failed.adminRolesSave({}, role('a'), () => {}), error => String(error) === 'Exception: Admin role save failed');
});
test('Roles API rejects a body whose original owner retires during decoding', async () => {
  let current = true;
  const f = api({ response: async () => ({ status: 200, json: async () => { current = false; return []; } }) });
  await assert.rejects(f.adminRolesCapabilities({}, () => { if (!current) throw Error('retired'); }, () => current), /retired/);
});
test('Seven-read Roles bootstrap waits for every source Future.wait member and preserves the first arriving error', async () => {
  const slow = deferred(), first = deferred(), second = deferred();
  let customerOptions, apparatusOptions;
  const f = api({ readers: { roles: () => first.promise, settings: () => second.promise, assignments: () => slow.promise,
    customers: async (_s, options) => { customerOptions = options; return []; }, apparatus: async (_s, options) => { apparatusOptions = options; return []; } } });
  let settled = false;
  const pending = f.adminRolesFetch({}, () => {}, () => true).then(() => { settled = true; }, error => { settled = true; throw error; });
  const error = Error('first'), later = Error('later'); first.reject(error); second.reject(later); await flush(); assert.equal(settled, false);
  slow.resolve([]); await assert.rejects(pending, value => value === error);
  assert.deepEqual(customerOptions, { limit: 100 }); assert.equal(apparatusOptions.limit, 200); assert.equal(typeof apparatusOptions.readWitness, 'function');
});
test('Principal display preserves source order, Werka fallback and customer assignment identity rules', () => {
  const source = data(); source.assignments.push(assigned('customer', ' c ', ' APARATCHI '));
  const principals = roles.adminRolesPrincipals(source, 'en');
  assert.deepEqual(principals.map(row => [row.role, row.ref, row.name]), [['werka', 'werka', 'Wmanager'], ['supplier', 's', 'Supplier'], ['aparatchi', 'c', 'Customer']]);
  assert.equal(principals[2].icon, 'precision_manufacturing');
  assert.equal(roles.adminRolesAssignment(source, { role: 'supplier', ref: 's', name: '', icon: 'person' }), null);
  source.assignments.push(assigned('supplier', ' s ', 'custom'));
  assert.equal(roles.adminRolesAssignment(source, principals[1]), null, 'non-customer lookup retains source exact ref equality');
});
test('Source role assignment eligibility keeps every special system-role branch', () => {
  const principal = role => ({ role, ref: 'r', name: 'N', icon: 'person' });
  for (const target of ['werka', 'customer', 'aparatchi', 'qolipchi', 'boyoqchi']) {
    assert.equal(roles.adminRolesCanAssign(role('custom'), principal(target)), true);
    assert.equal(roles.adminRolesCanAssign(role('aparatchi', { system: true }), principal(target)), ['customer', 'aparatchi'].includes(target));
    assert.equal(roles.adminRolesCanAssign(role('qolipchi', { system: true }), principal(target)), ['qolipchi', 'aparatchi'].includes(target));
    assert.equal(roles.adminRolesCanAssign(role('boyoqchi', { system: true }), principal(target)), target === 'boyoqchi');
  }
  assert.equal(roles.adminRolesCanAssign(role('other', { system: true, base_role: 'werka' }), principal('customer')), false);
  assert.equal(roles.adminRolesCanAssign(role('other', { system: true }), principal('customer')), true);
});
test('Role editor retains slugging, cleared base role, selected insertion order and source upsert sorting', () => {
  assert.equal(roles.adminRolesId('  Catalog / Reader  '), 'catalog_reader'); assert.equal(roles.adminRolesId('ўзбек'), 'custom_role');
  const edited = roles.adminRolesEditedRole('  New label  ', ['b', 'a'], role('old', { base_role: 'werka' }));
  assert.deepEqual(edited, { id: 'old', label: 'New label', base_role: null, capability_codes: ['b', 'a'], system: false });
  const source = data(); source.roles = [role('z', { label: 'z' }), role('s', { label: 'S', system: true }), role('b', { label: 'b' })];
  assert.deepEqual(roles.adminRolesUpsertRole(source, role('A')).roles.map(row => row.id), ['s', 'A', 'b', 'z']);
  source.assignments = [assigned('supplier', ' same ', 'old'), assigned('customer', 'same', 'other'), assigned('werka', 'werka', 'werka')];
  assert.deepEqual(roles.adminRolesUpsertAssignment(source, assigned('customer', 'same', 'new')).assignments.map(row => row.role_id), ['werka', 'new']);
});
function fixture(overrides = {}) {
  let current = true; const source = data(), calls = [];
  const deps = { isCurrent: () => current, read: async () => source, saveRole: async (role, guard) => { guard(); calls.push(['role', role]); return role; },
    saveAssignment: async (row, guard) => { guard(); calls.push(['assignment', row]); return row; }, ...overrides };
  const controller = new AdminRolesController(deps);
  return { controller, deps, source, calls, start: async () => { controller.start(); await flush(); }, retire: () => { current = false; controller.invalidate(); } };
}
test('Roles initial failures retry, while later refresh failures retain loaded data and source top notice', async () => {
  const f = fixture({ read: async () => { throw Error('offline'); } }); await f.start(); assert.equal(f.controller.getSnapshot().loading, false); assert.equal(f.controller.getSnapshot().data, null); assert.equal(f.controller.getSnapshot().notice, null);
  f.deps.read = async () => f.source; await f.controller.reload(); f.deps.read = async () => { throw Error('offline'); }; await f.controller.reload();
  assert.equal(f.controller.getSnapshot().data, f.source); assert.equal(f.controller.getSnapshot().notice.key, 'serverDisconnectedRetry');
});
test('Custom role editing sends once only after actual native dismissal, with original Set ordering', async () => {
  const f = fixture(); await f.start(); f.controller.openEditor(); const id = f.controller.getSnapshot().sheet.id;
  f.controller.setLabel(id, ' New catalog '); f.controller.toggleCapability(id, 'catalog.item.read', true); f.controller.toggleCapability(id, 'apparatus.queue.read', true);
  f.controller.toggleCapability(id, 'catalog.item.read', false); f.controller.toggleCapability(id, 'catalog.item.read', true); f.controller.saveEditor(id);
  assert.deepEqual(f.calls, []); assert.equal(f.controller.getSnapshot().sheet.closing, true);
  f.controller.nativeDismiss(id); f.controller.nativeDismiss(id); await flush();
  assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0][1].capability_codes, ['apparatus.queue.read', 'catalog.item.read']);
  assert.equal(f.calls[0][1].id, 'new_catalog'); assert.equal(f.controller.getSnapshot().notice.key, 'adminRoleSaved');
});
test('Assignment apparatus validation stays in its sheet and submission converts the source principal role', async () => {
  const f = fixture(); await f.start(); const principal = roles.adminRolesPrincipals(f.source, 'uz').at(-1);
  f.controller.openAssignment(principal); const id = f.controller.getSnapshot().sheet.id, target = f.source.roles[2];
  f.controller.assign(id, target); assert.equal(f.controller.getSnapshot().notice.channel, 'snackbar'); assert.equal(f.controller.getSnapshot().sheet.closing, false);
  f.controller.toggleApparatus(id, 'apparatus:print:b', true); f.controller.toggleApparatus(id, 'apparatus:print:a', true); f.controller.assign(id, target); f.controller.nativeDismiss(id); await flush();
  assert.deepEqual(f.calls[0], ['assignment', assigned('aparatchi', principal.ref, 'aparatchi', ['apparatus:print:a', 'apparatus:print:b'])]);
  assert.equal(f.controller.getSnapshot().notice.key, 'adminRoleAssigned');
});
test('Cancelled sheets do not save and retired accepted writes cannot publish to a new owner', async () => {
  const write = deferred(), f = fixture({ saveRole: async () => write.promise }); await f.start();
  f.controller.openEditor(); const cancelled = f.controller.getSnapshot().sheet.id; f.controller.closeSheet(cancelled); f.controller.nativeDismiss(cancelled); await flush(); assert.deepEqual(f.calls, []);
  f.controller.openEditor(); const id = f.controller.getSnapshot().sheet.id; f.controller.setLabel(id, 'A'); f.controller.toggleCapability(id, 'catalog.item.read', true); f.controller.saveEditor(id); f.controller.nativeDismiss(id); f.retire();
  write.resolve(role('saved')); await flush(); assert.equal(f.controller.getSnapshot().data, null); assert.equal(f.controller.getSnapshot().notice, null);
});
test('a synchronous account retirement during saved-data publication cannot emit a success notice', async () => {
  const f = fixture(); await f.start(); f.controller.subscribe(() => {
    if (f.controller.getSnapshot().data?.roles.some(role => role.id === 'saved')) f.retire();
  });
  f.controller.openEditor(); const id = f.controller.getSnapshot().sheet.id; f.controller.setLabel(id, 'Saved');
  f.controller.toggleCapability(id, 'catalog.item.read', true); f.controller.saveEditor(id); f.controller.nativeDismiss(id); await flush();
  assert.equal(f.calls.length, 1); assert.equal(f.controller.getSnapshot().valid, false); assert.equal(f.controller.getSnapshot().notice, null);
});
module.exports = { roles, data, role, fixture };
