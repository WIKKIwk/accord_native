const assert = require('node:assert/strict');
const test = require('node:test');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
const { load, model, strings, exception, checked } = require('./adminUserCreateSupport.cjs');
const { workerModel } = require('./adminWorkerDetailSupport.cjs');

// @v2-test test/brigader_role_test.dart
// Recorded independently at f11910bb; the uninstrumented V2 oracle passed all five tests.
test('V2 recorded native Brigader identity uses system creation then the 93 access code endpoint', async () => {
  const stem = 'brigader_role_test', name = 'native system brigader creation uses the existing form and 93 code';
  const replay = contractFetch(stem, name), session = { ...recordedSession(stem, name), profile: { role: 'brigader', ref: 'brigader_test' }, capabilities: ['brigader.access'] };
  const transport = { authorizedFetch: (actor, path, init = {}, guard) => {
    guard?.(); return replay(new URL(path, actor.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${actor.token}` } });
  } };
  const shared = { '../authorizedFetch': transport, './adminApiError': {}, './adminProductionRequest': { checkedAdminGuard: checked.checkedAdminGuard },
    './adminWorkerDetailModel': workerModel, './dartJsonString': strings };
  const api = load('admin/adminUserCreateApi', { ...shared, './adminUserCreateModel': model, './adminCustomerDetailModel': {} });
  const detail = load('admin/adminWorkerDetailApi', { ...shared, './dartUri': load('admin/dartUri') });
  const guard = () => {};
  const roles = await api.readAdminUserCreateRoles(session, guard, () => true);
  assert.equal(roles[0].base_role, 'brigader');
  const created = await api.createAdminUserCreateSystem(session, 'brigader', 'Ali Brigader', '+998901234567', guard);
  assert.equal(created.id, 'brigader_ali');
  const issued = await detail.adminWorkerDetailRegenerateSystemCode(session, created.id, guard);
  assert.equal(issued.code, '931234567890');
  replay.assertDone();
  assert.equal(require('./contracts/brigader_role_test.json').baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
});
