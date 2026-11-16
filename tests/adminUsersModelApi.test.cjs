const assert = require('node:assert/strict');
const test = require('node:test');
const { model: m, api, entry, routes, deferred } = require('./adminUsersSupport.cjs');

// @v2 AdminUserListEntry/roleLabel at f119; precise Metalayzer drift from 052655a is deliberately local.
test('users model preserves all 13 current role choices and Metalayzer kind precedence/detail/footer rules', () => {
  assert.deepEqual(m.adminUserKinds, ['werka', 'customer', 'supplier', 'materialTaminotchi', 'worker', 'qolipchi', 'boyoqchi',
    'tayyorlovMasteri', 'homashyoRezkachi', 'salesManager', 'brigader', 'rezkaMaster', 'metalayzer']);
  const metal = entry('MET', 'Metal', 'metalayzer', 'worker');
  assert.equal(metal.kind, 'metalayzer'); assert.equal(m.adminUserRoleLabel(metal), 'Metalayzer');
  assert.equal(m.adminUserKindLabel('metalayzer', 'ru'), 'Metalayzer'); assert.equal(m.adminUserKindRoleQuery('metalayzer'), 'metalayzer');
  assert.equal(m.adminUserDetailRoute(metal), routes.appRoutes.adminWorkerDetail);
  assert.equal(m.adminUsersShowFooter('metalayzer', 1, false, true), false);
  for (const kind of [null, ...m.adminUserKinds]) assert.equal(m.adminUserKindUsesWorkers(kind), false);
  assert.equal(entry('W', 'Worker', 'qolipchi', 'worker').kind, 'worker');
});
test('users parser honors nullable defaults, entity ref identity, aliases and Dart cast failures', () => {
  const value = m.adminUserListEntryFromJson({ id: ' unused ', entity_ref: '\u0085ROW\u0085', source: ' OMBORCHI ', name: null });
  assert.equal(value.id, 'ROW'); assert.equal(value.kind, 'werka'); assert.equal(value.principal_role, 'werka');
  assert.equal(value.name, ''); assert.equal(value.blocked, false); assert.equal(value.role_label, null);
  assert.deepEqual(m.adminUserListPageFromJson({ items: null, has_more: null }), { items: [], has_more: false });
  for (const change of [{ source: 'worker' }, { principal_role: '' }, { principal_role: 4 }, { name: 3 }, { blocked: 'false' }, { role_label: 3 }]) {
    assert.throws(() => m.adminUserListEntryFromJson({ source: 'supplier', ...change }));
  }
  assert.throws(() => m.adminUserListPageFromJson({ items: {}, has_more: false }));
  assert.throws(() => m.adminUserListPageFromJson({ items: [], has_more: 1 }));
  assert.throws(() => m.adminUserPrincipalRoleFromJson(null), /^TypeError: Unsupported user role: null$/);
  assert.throws(() => m.adminUserPrincipalRoleFromJson(''), /^TypeError: Unsupported user role: $/);
  assert.throws(() => m.adminUserPrincipalRoleFromJson(' Unknown '), /^TypeError: Unsupported user role:  Unknown $/);
});
test('role label composes apparatus once and suppresses canonical IDs while fixed system labels beat overrides', () => {
  const worker = { ...entry('W', 'Worker', 'aparatchi', 'worker'), apparatus_display: 'Lamination', role_label: 'Master' };
  assert.equal(m.adminUserRoleLabel(worker), 'Lamination Master');
  assert.equal(m.adminUserRoleLabel({ ...worker, role_label: 'lamination Master' }), 'lamination Master');
  for (const apparatus_display of ['apparatus:default:one', 'apparatus legacy', '']) {
    assert.equal(m.adminUserRoleLabel({ ...worker, apparatus_display }), 'Master');
  }
  assert.equal(m.adminUserRoleLabel({ ...entry('B', 'Brigader', 'brigader'), role_label: 'Custom' }), 'Brigader');
  assert.equal(m.adminUserMatchesSearch(worker, 'lamination master'), true);
  assert.equal(m.adminUserMatchesSearch(worker, 'W'), true);
  assert.equal(m.adminUserMatchesSearch(worker, 'missing'), false);
});
// @v2-test test/admin_suppliers_screen_test_cases_resplit_part_01.dart, material membership and customer exclusion.
test('material assignments promote matching customer entries and clear apparatus fields exactly once', () => {
  const customer = { ...entry(' Mat-A ', 'Material', 'customer'), apparatus_display: 'Press', apparatus_id: 'apparatus:default:press' };
  const assignments = [m.adminRoleAssignmentFromJson({ principal_role: 'customer', principal_ref: ' mat-a ', role_id: 'material_taminotchi' })];
  assert.deepEqual(m.adminUsersVisibleItems([customer], assignments, 'customer', 'uz'), []);
  const [promoted] = m.adminUsersVisibleItems([customer], assignments, 'materialTaminotchi', 'uz');
  assert.equal(promoted.kind, 'materialTaminotchi'); assert.equal(promoted.principal_role, 'material_taminotchi');
  assert.equal(promoted.apparatus_id, ''); assert.equal(promoted.apparatus_display, '');
  assert.equal(m.adminUserRoleLabel(promoted), 'Material ta’minotchisi');
});
test('role assignment reader keeps full typed lists and canonical apparatus deduplication', () => {
  const value = m.adminRoleAssignmentFromJson({ principal_role: ' OMBORCHI ', principal_ref: ' REF ', role_id: ' Custom ',
    assigned_apparatus: [' apparatus:default:press ', 'apparatus:default:press'], assigned_item_groups: [' A ', 'B'] });
  assert.equal(value.principal_role, 'werka'); assert.equal(value.principal_ref, ' REF '); assert.equal(value.role_id, ' Custom ');
  assert.deepEqual(value.assigned_apparatus, ['apparatus:default:press']); assert.deepEqual(value.assigned_item_groups, [' A ', 'B']);
  assert.throws(() => m.adminRoleAssignmentFromJson({ principal_role: 'supplier', assigned_apparatus: ['legacy'] }));
  assert.throws(() => m.adminRoleAssignmentFromJson({ principal_role: 'supplier', assigned_item_groups: [null] }));
});
test('users API sends the exact conditional live query and default limit without test-mode branches', async () => {
  const calls = [], session = {}, a = api(async (...args) => { calls.push(args); return new Response(JSON.stringify({ items: [{ id: 'one', source: 'supplier' }], has_more: true })); });
  const value = await a.adminUserList(session, { query: '\u0085Two words\u0085', limit: 50, offset: 50, role: ' metalayzer ' });
  assert.equal(value.items[0].id, 'one'); assert.equal(value.has_more, true);
  assert.equal(calls[0][1], '/v1/mobile/admin/users/list?q=Two+words&limit=50&offset=50&role=metalayzer');
  await a.adminUserList(session); assert.equal(calls[1][1], '/v1/mobile/admin/users/list?limit=20');
  await a.adminUserList(session, { limit: 0, offset: -1 }); assert.equal(calls[2][1], '/v1/mobile/admin/users/list');
  await assert.rejects(a.adminUserList(session, { limit: 1.5 }), /pagination/); assert.equal(calls.length, 3);
});
test('assignment API consumes a plain list and both APIs keep source status failures', async () => {
  const calls = [], a = api(async (_session, path) => { calls.push(path); return new Response(JSON.stringify([{ principal_role: 'metalayzer', role_id: 'metalayzer' }])); });
  assert.equal((await a.adminRoleAssignments({}))[0].principal_role, 'metalayzer');
  assert.deepEqual(calls, ['/v1/mobile/admin/role-assignments']);
  const failed = api(async () => ({ status: 403, json() { throw new Error('must not parse a rejected response'); } }));
  await assert.rejects(failed.adminUserList({}), /^Error: Admin user list failed$/);
  await assert.rejects(failed.adminRoleAssignments({}), /^Error: Admin role assignments failed$/);
});
test('scoped users API transports read witness and checks again after body decode; async guards cannot send', async () => {
  const pending = deferred(), calls = []; let valid = true;
  const guard = () => { if (!valid) throw new Error('retired'); }, witness = () => valid;
  const a = api(async (...args) => { calls.push(args); return { status: 200, json: () => pending.promise }; });
  const reading = a.adminUserList({}, {}, guard, witness); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][5].readWitness, witness); assert.equal(calls[0][4], 10000);
  valid = false; pending.resolve({ items: [], has_more: false }); await assert.rejects(reading, /retired/);
  await assert.rejects(a.adminUserList({}, {}, async () => {}), /Invalid admin guard/); assert.equal(calls.length, 1);
});
