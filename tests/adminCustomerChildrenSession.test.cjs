const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminCustomerChildrenSupport.cjs');
function factory(options = {}) {
  let epoch = 1, scope = 'scope', active, issued = true, allowed = true, check = () => true;
  const session = { token: 'token', profile: { role: options.role ?? 'admin' }, capabilities: options.capabilities ?? ['admin.access'] }, witness = { session }; active = session;
  const { adminCustomerChildScope } = s.load('admin/adminCustomerChildScope', { '../auth': {
    activeSessionEpoch: value => value === active ? epoch : null, activeSessionToken: value => value === active ? value.token : null, isSessionWitnessCurrent: value => issued && value === witness },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminCustomerDetail: '/detail' }, canOpenRoute: () => allowed }, '../shared/camera/synchronousGuard': s.strict });
  const calls = [], predicates = [], props = { session, witness, isCurrent: () => check(), customerRef: ' raw widget ref ', materialTaminotchi: !!options.material,
    isInteractive: () => true, onChanged: () => calls.push('changed'), onNotice: message => calls.push(['notice', message]), principalRef: ' raw DTO ref ', principalRole: 'material_taminotchi',
    displayName: 'Original', assignedWarehouses: ['Existing'], reloadAssignedWarehouses: async () => ['Saved'], assignedMessage: 'Exact material scope', chipKeyPrefix: 'admin-material-detail-warehouse-', addButtonKey: 'admin-material-detail-add-warehouse', buttonRadius: 14 };
  const { adminCustomerApparatusSession } = s.load('admin/adminCustomerApparatusSession', { './adminCustomerChildScope': { adminCustomerChildScope }, './adminCustomerApparatusController': { AdminCustomerApparatusController: s.AdminCustomerApparatusController },
    '../apparatusApi': { adminApparatus: async (account, options) => { assert.equal(account, session); assert.equal(options.limit, 200); options.beforeSend(); assert.equal(options.readWitness(), true); predicates.push(options.beforeSend, options.readWitness); calls.push('apparatus200'); return [s.machine('apparatus:default:press')]; } },
    './adminUsersApi': { adminRoleAssignments: async (account, guard, witness) => { assert.equal(account, session); guard(); assert.equal(witness(), true); predicates.push(guard, witness); calls.push('roles'); return [s.role({ principal_ref: 'raw widget ref', principal_role: options.material ? 'material_taminotchi' : 'aparatchi', assigned_apparatus: ['apparatus:default:press'] })]; } },
    './adminCustomerDetailApi': { AdminCustomerDetailApiException: class SourceError extends Error { toString() { return `Exception: ${this.message}`; } }, adminCustomerUpsertRoleAssignment: async (account, assignment, guard) => { assert.equal(account, session); guard(); calls.push(['upsert', assignment]); return assignment; } } });
  const { adminCustomerMaterialWarehouseSession } = s.load('admin/adminCustomerMaterialWarehouseSession', { './adminCustomerChildScope': { adminCustomerChildScope }, './adminWorkerDetailEditorController': s.worker.editor,
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    './adminWorkerDetailAssignmentsApi': { adminWorkerDetailWarehouses: async (account, guard, witness) => { assert.equal(account, session); guard(); assert.equal(witness(), true); calls.push('catalog500'); predicates.push(guard, witness); return [{ warehouse: 'Saved' }, { warehouse: 'Existing' }, { warehouse: 'Group', is_group: true }]; } },
    './adminWarehouseAssignmentApi': { adminAssignWarehouse: async (account, input, guard) => { assert.equal(account, session); guard(); calls.push(['assign', input]); return { warehouse: input.warehouse }; } },
    './adminWarehouseSettingsApi': { adminUnassignWarehouse: async (account, input, guard) => { assert.equal(account, session); guard(); calls.push(['unassign', input]); } } });
  return { props, calls, predicates, session, witness, apparatus: () => adminCustomerApparatusSession(props), warehouse: () => adminCustomerMaterialWarehouseSession(props, () => props),
    createScope: () => adminCustomerChildScope(session, witness, props.isCurrent), epoch: value => { epoch = value; }, scope: value => { scope = value; }, external: value => { check = value; },
    account: () => { active = { ...session }; }, revoke: () => { issued = false; }, deny: () => { allowed = false; } };
}
test('both genuine child scopes enforce original account/epoch/witness/read scope, source management and strict synchronous callbacks', () => {
  for (const change of [f => f.epoch(2), f => f.scope('new'), f => f.account(), f => f.revoke(), f => f.deny(), f => { f.session.token = 'test-mode-token'; }, f => { f.session.profile.role = 'sales_manager'; }, f => { f.session.capabilities = []; }]) {
    const f = factory(), current = f.createScope(); assert.equal(current(), true); change(f); assert.equal(current(), false); f.epoch(1); f.scope('scope'); f.session.token = 'token'; f.session.profile.role = 'admin'; f.session.capabilities = ['admin.access']; assert.equal(current(), false);
  }
  for (const opts of [{ role: 'sales_manager' }, { capabilities: [] }]) assert.equal(factory(opts).createScope()(), false);
  assert.equal(factory({ role: 'brigader', capabilities: ['brigader.access'] }).createScope()(), true);
  for (const check of [() => true, async () => true, () => 'true']) { const f = factory(); f.external(check); assert.equal(f.createScope()(), check() === true); }
  const reentrant = factory(), current = reentrant.createScope(); reentrant.external(() => current()); assert.equal(current(), false);
});
test('genuine apparatus factory keeps source two readers/limit200 and passes original guards/witness to existing transport and upsert', async t => {
  const f = factory(), owner = f.apparatus(); t.after(() => owner.controller.dispose()); owner.controller.start(); await s.flush(); assert.deepEqual(f.calls, ['roles', 'apparatus200']);
  assert.equal(await owner.controller.save(), true); const assignment = f.calls.find(value => Array.isArray(value) && value[0] === 'upsert')[1];
  assert.equal(assignment.principal_ref, 'raw widget ref'); assert.equal(assignment.principal_role, 'aparatchi'); assert.deepEqual(assignment.assigned_apparatus, ['apparatus:default:press']); assert.ok(f.calls.includes('changed'));
  f.epoch(2); assert.equal(owner.current(), false); for (const check of f.predicates) assert.throws(check); await owner.controller.save(); assert.equal(f.calls.filter(value => Array.isArray(value) && value[0] === 'upsert').length, 1);
});
test('genuine Material warehouse factory sends exact Material identity, uses current widget name, rereads membership and relays source success text', async t => {
  const f = factory({ material: true }), owner = f.warehouse(); t.after(() => owner.controller.dispose()); owner.controller.start(); owner.beginAdd(); await owner.controller.add();
  const picker = owner.controller.getSnapshot().picker; assert.deepEqual(picker.available, ['Saved']); f.props.displayName = 'Latest widget name'; owner.controller.selectWarehouse(picker.id, 'Saved'); await owner.controller.confirmWarehouse(picker.id);
  assert.deepEqual(f.calls.find(value => Array.isArray(value) && value[0] === 'assign')[1], { warehouse: 'Saved', principal_role: 'material_taminotchi', principal_ref: ' raw DTO ref ', display_name: 'Latest widget name' });
  assert.ok(f.calls.some(value => Array.isArray(value) && value[0] === 'notice' && value[1] === s.l10n.adminText('warehouse.assigned', 'uz', { warehouse: 'Saved' })));
  f.props.reloadAssignedWarehouses = async () => []; owner.beginRemove(); owner.controller.requestRemove('Existing'); const dialog = owner.controller.getSnapshot().dialog; await owner.controller.confirmRemove(dialog.id);
  assert.deepEqual(f.calls.find(value => Array.isArray(value) && value[0] === 'unassign')[1], { warehouse: 'Existing', principal_role: 'material_taminotchi', principal_ref: ' raw DTO ref ' });
  f.scope('changed'); for (const check of f.predicates) assert.throws(check); assert.equal(owner.current(), false);
});
