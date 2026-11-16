const assert = require('node:assert/strict');
const test = require('node:test');
const { load, deferred } = require('./adminUsersSupport.cjs');
const strict = load('shared/camera/synchronousGuard');
class SourceException extends Error { toString() { return `Exception: ${this.message}`; } }
function fixture({ role = 'admin', capabilities = ['admin.access'], entry = null, readOnly = false, copy = async () => true } = {}) {
  const session = { token: 'token', capabilities, profile: { role } }, witness = { session }, calls = [];
  let epoch = 1, scope = 'scope', active = session, allowed = true, issued = true, check = () => true, groups = async () => ['Group'];
  const api = { AdminCustomerDetailApiException: SourceException };
  for (const method of ['adminCustomerDetail', 'adminMaterialTaminotchiDetail', 'adminUpdateCustomerPhone', 'adminUpdateMaterialTaminotchiPhone',
    'adminRegenerateCustomerCode', 'adminRegenerateMaterialTaminotchiCode', 'adminRemoveCustomer', 'adminRemoveCustomerItem', 'adminAssignCustomerItem',
    'readAdminCustomerAvailableItems', 'adminUpdateMaterialTaminotchiItemGroups']) api[method] = async (...args) => {
      assert.equal(args[0], session); calls.push([method, ...args.slice(1).filter(value => typeof value !== 'function')]); return { ref: 'resolved ref' };
    };
  const { createAdminCustomerDetailSession } = load('admin/adminCustomerDetailSession', {
    'expo-clipboard': { setStringAsync: async code => { calls.push(['copy', code]); return copy(); } },
    '../auth': { activeSessionEpoch: value => value === active ? epoch : null, activeSessionToken: value => value === active ? value.token : null, isSessionWitnessCurrent: value => issued && value === witness },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminCustomerDetail: '/detail' }, canOpenRoute: () => allowed },
    '../shared/camera/synchronousGuard': strict, './adminCustomerDetailApi': api,
    './adminCustomerDetailController': { AdminCustomerDetailController: class { constructor(deps) { this.deps = deps; } } }, './itemGroupApi': { adminItemGroups: async (_session, guard, witness) => { guard(); assert.equal(witness(), true); return groups(); } },
  });
  const owner = createAdminCustomerDetailSession(session, witness, () => check(), ' widget raw ref ', entry, readOnly);
  const guard = () => { if (!owner.current()) throw Error('retired'); };
  return { owner, session, entry, calls, guard, setGroups: fn => { groups = fn; }, epoch: value => { epoch = value; }, scope: value => { scope = value; },
    deny: () => { allowed = false; }, witness: () => { issued = false; }, account: () => { active = { ...session }; }, external: fn => { check = fn; } };
}
test('customer original factory derives source management from capabilities, excludes Sales and respects readOnly', () => {
  for (const [options, expected] of [[{}, true], [{ capabilities: [] }, false], [{ role: 'brigader', capabilities: ['brigader.access'] }, true],
    [{ role: 'sales_manager', capabilities: ['admin.access'] }, false], [{ role: 'customer', capabilities: ['admin.access'] }, true], [{ readOnly: true }, false]]) {
    const f = fixture(options); assert.deepEqual(f.owner.mode, { management: expected, material: false, items: expected, remove: expected }); assert.equal(Object.isFrozen(f.owner.mode), true);
  }
});
test('customer factory uses raw widget ref for read/regenerate/remove/items and captured DTO ref for phone', async () => {
  const f = fixture(), deps = f.owner.controller.deps, witness = () => true, selected = { code: ' item ' };
  await deps.read(f.guard, witness); await deps.phone({ ref: 'captured ref' }, '123', f.guard); await deps.regenerate(f.guard); await deps.remove(f.guard); await deps.assign(selected, f.guard); await deps.unassign(selected, f.guard);
  assert.deepEqual(f.calls, [['adminCustomerDetail', ' widget raw ref '], ['adminUpdateCustomerPhone', 'captured ref', '123'], ['adminRegenerateCustomerCode', ' widget raw ref '],
    ['adminRemoveCustomer', ' widget raw ref '], ['adminAssignCustomerItem', ' widget raw ref ', ' item '], ['adminRemoveCustomerItem', ' widget raw ref ', ' item ']]);
});
test('material target is selected by source kind or principal role and keeps the source item/remove controls absent', async () => {
  for (const entry of [{ id: 'r', kind: 'materialTaminotchi', principal_role: 'customer' }, { id: 'r', kind: 'customer', principal_role: 'material_taminotchi' }]) {
    const f = fixture({ entry }), deps = f.owner.controller.deps; assert.deepEqual(f.owner.mode, { management: true, material: true, items: false, remove: false });
    await deps.read(f.guard, () => true); await deps.phone({ ref: 'dto' }, '123', f.guard); await deps.regenerate(f.guard); await deps.updateGroups({ ref: 'dto' }, ['Group'], f.guard, () => true);
    assert.deepEqual(f.calls, [['adminMaterialTaminotchiDetail', ' widget raw ref '], ['adminUpdateMaterialTaminotchiPhone', 'dto', '123'], ['adminRegenerateMaterialTaminotchiCode', ' widget raw ref '], ['adminUpdateMaterialTaminotchiItemGroups', 'dto', ['Group']]]);
  }
});
test('customer original epoch/scope/witness/account/capability/target authority retires permanently and rejects asynchronous/reentrant checks', () => {
  for (const change of [f => f.epoch(2), f => f.scope('new'), f => f.witness(), f => f.account(), f => f.deny(), f => { f.entry.id = 'another'; }, f => { f.session.token = 'test-mode-token'; }]) {
    const f = fixture({ entry: { id: 'original', kind: 'customer', principal_role: 'customer' } }); assert.equal(f.owner.current(), true); change(f); assert.equal(f.owner.current(), false);
    f.epoch(1); f.scope('scope'); f.entry.id = 'original'; f.session.token = 'token'; assert.equal(f.owner.current(), false);
  }
  const async = fixture(); async.external(() => Promise.reject(Error('async'))); assert.equal(async.owner.current(), false);
  const recursive = fixture(); recursive.external(() => recursive.owner.current()); assert.equal(recursive.owner.current(), false);
});
test('customer copy preserves raw code and fences false acknowledgment and original-owner retirement during native copy', async () => {
  const good = fixture(); await good.owner.controller.deps.copy(' raw ', good.guard); assert.deepEqual(good.calls, [['copy', ' raw ']]);
  const failed = fixture({ copy: async () => false }); await assert.rejects(failed.owner.controller.deps.copy('code', failed.guard), /Clipboard write failed/);
  const pending = deferred(), stale = fixture({ copy: async () => pending.promise }); const copying = stale.owner.controller.deps.copy('code', stale.guard); stale.epoch(2); pending.resolve(true); await assert.rejects(copying, /retired/);
});
test('material group read plain failure preserves source Exception formatting for fallback-only operation notice', async () => {
  const f = fixture(); f.setGroups(async () => { throw Error('Admin item groups failed'); });
  await assert.rejects(f.owner.controller.deps.groups(f.guard, () => true), error => String(error) === 'Exception: Admin item groups failed');
});
