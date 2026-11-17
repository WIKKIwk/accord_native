const assert = require('node:assert/strict');
const test = require('node:test');
const { load, routes } = require('./adminUsersSupport.cjs');
function fixture() {
  const session = { token: 'first', baseUrl: 'https://example.invalid', profile: { role: 'admin', ref: 'same' }, capabilities: ['admin.access', 'role.capability.read'], assigned_apparatus: [] };
  const witness = { session }, calls = []; let epoch = 1, parent = true, active = true, dependencies;
  const scope = load('sessionReadScope'), guards = load('shared/profileSessionGuard');
  const { adminRolesSession } = load('admin/adminRolesSession', { '../auth': { activeSessionEpoch: value => active && value === session ? epoch : null,
    activeSessionToken: value => active && value === session ? session.token : null, isSessionWitnessCurrent: value => active && value === witness },
    '../sessionReadScope': scope, '../shared/appRoutes': routes, '../shared/profileSessionGuard': guards,
    './adminRolesController': { AdminRolesController: class { constructor(deps) { dependencies = deps; } } },
    './adminRolesApi': { adminRolesFetch: async (_session, guard, readWitness) => { guard(); assert.equal(readWitness(), true); calls.push('read'); return {}; },
      adminRolesSave: async (_session, role, guard) => { guard(); calls.push(['role', role]); return role; } },
    './adminCustomerDetailApi': { adminCustomerUpsertRoleAssignment: async (_session, assignment, guard) => { guard(); calls.push(['assignment', assignment]); return assignment; } } });
  const owner = adminRolesSession({ session, witness, isCurrent: () => parent });
  return { session, witness, calls, owner, deps: dependencies, setParent: value => { parent = value; }, setEpoch: value => { epoch = value; }, retire: () => { active = false; } };
}
test('Roles captures one original session and permits token-only refresh while preserving guarded readers/writers', async () => {
  const f = fixture(); assert.equal(f.owner.current(), true); f.session.token = 'second'; assert.equal(f.owner.current(), true);
  const guard = () => { if (!f.owner.current()) throw Error('retired'); };
  await f.deps.read(guard, f.owner.current); await f.deps.saveRole({ id: 'custom' }, guard); await f.deps.saveAssignment({ role_id: 'custom' }, guard);
  assert.deepEqual(f.calls, ['read', ['role', { id: 'custom' }], ['assignment', { role_id: 'custom' }]]);
});
test('Roles permanently retires after epoch, scope, parent or account loss and rejects asynchronous parent authority', () => {
  for (const change of [f => f.setEpoch(2), f => { f.session.capabilities = []; }, f => f.setParent(false), f => f.retire(), f => f.setParent(Promise.resolve(true))]) {
    const f = fixture(); change(f); assert.equal(f.owner.current(), false); f.session.capabilities = ['admin.access', 'role.capability.read']; f.setParent(true); f.setEpoch(1);
    assert.equal(f.owner.current(), false);
  }
});
