const assert = require('node:assert/strict');
const test = require('node:test');
const { roleStore: { AdminUsersRoleStore, adminUsersRolePreferenceKey, parseAdminUserKind }, memoryStorage, deferred, flush } = require('./adminUsersSupport.cjs');

// @v2-test test/admin_users_role_store_test.dart, with original-profile race coverage for native asynchronous storage.
test('role preference uses source profile/default keys and case-insensitive enum names', async () => {
  const storage = memoryStorage(), store = new AdminUsersRoleStore(storage);
  assert.equal(adminUsersRolePreferenceKey('\u0085ADMIN\u0085'), 'admin.users.selected_role.ADMIN');
  assert.equal(adminUsersRolePreferenceKey(''), 'admin.users.selected_role.default');
  assert.equal(parseAdminUserKind('WERKA'), 'werka'); assert.equal(parseAdminUserKind(' rezkaMaster '), 'rezkaMaster');
  assert.equal(parseAdminUserKind('rezka_master'), null); assert.equal(parseAdminUserKind('METALAYZER'), 'metalayzer');
  await store.saveRole('werka', 'ADMIN'); assert.equal(store.cachedRole, 'werka');
  assert.deepEqual(storage.calls.filter(([op]) => op === 'set'), [['set', 'admin.users.selected_role.ADMIN', 'werka'], ['set', 'admin.users.selected_role.default', 'werka']]);
  store.clearCache(); assert.equal(store.cachedRole, null);
  await store.loadSavedRole('ADMIN'); assert.equal(store.cachedRole, 'werka');
});
test('source default is read only when the per-profile value is absent or blank', async () => {
  const storage = memoryStorage(), store = new AdminUsersRoleStore(storage);
  storage.values.set(adminUsersRolePreferenceKey('default'), 'customer');
  assert.equal(await store.loadSavedRole('ADMIN'), 'customer');
  store.clearCache(); storage.calls.length = 0; storage.values.set(adminUsersRolePreferenceKey('ADMIN'), 'invalid');
  assert.equal(await store.loadSavedRole('ADMIN'), null); assert.equal(storage.calls.length, 1);
  storage.values.set(adminUsersRolePreferenceKey('ADMIN'), ' \u0085');
  assert.equal(await store.loadSavedRole('ADMIN'), 'customer');
});
test('a pending restored preference cannot replace a newer manual choice', async () => {
  const storage = memoryStorage(), old = deferred(), store = new AdminUsersRoleStore(storage);
  storage.getItem = () => old.promise;
  const restoring = store.loadSavedRole('ADMIN');
  const rejected = assert.rejects(restoring, /selection changed/);
  await store.saveRole('metalayzer', 'ADMIN'); old.resolve('werka'); await rejected;
  assert.equal(store.cachedRole, 'metalayzer');
});
test('a stale account write cannot dispatch its default-key write after the first storage await', async () => {
  const storage = memoryStorage(), first = deferred(), store = new AdminUsersRoleStore(storage); let current = true;
  storage.setItem = async (key, value) => { storage.calls.push(['set', key, value]); await first.promise; };
  const writing = store.saveRole('supplier', 'ORIGINAL', () => { if (!current) throw new Error('retired'); });
  const rejected = assert.rejects(writing, /retired/); await flush(); current = false; first.resolve(); await rejected;
  assert.deepEqual(storage.calls, [['set', 'admin.users.selected_role.ORIGINAL', 'supplier']]);
});
test('queued selections persist the latest choice after an unavoidable earlier in-flight write', async () => {
  const storage = memoryStorage(), first = deferred(), store = new AdminUsersRoleStore(storage); let calls = 0;
  const originalSet = storage.setItem;
  storage.setItem = async (key, value) => { if (++calls === 1) await first.promise; await originalSet(key, value); };
  const older = store.saveRole('werka', 'ADMIN'), rejected = assert.rejects(older, /selection changed/); await flush();
  const newer = store.saveRole('customer', 'ADMIN'); first.resolve(); await rejected; await newer;
  assert.equal(storage.values.get(adminUsersRolePreferenceKey('ADMIN')), 'customer');
  assert.equal(storage.values.get(adminUsersRolePreferenceKey('default')), 'customer'); assert.equal(store.cachedRole, 'customer');
});
test('ordinary storage failure retains source cached role while runtime reset retires pending work', async () => {
  const storage = memoryStorage(), store = new AdminUsersRoleStore(storage); await store.saveRole('supplier', 'ADMIN');
  storage.getItem = async () => { throw new Error('disk failure'); };
  assert.equal(await store.loadSavedRole('ADMIN'), 'supplier');
  const body = deferred(); storage.getItem = () => body.promise;
  const reading = store.loadSavedRole('ADMIN'), rejected = assert.rejects(reading, /selection changed/);
  store.invalidatePending(); body.resolve('customer'); await rejected; assert.equal(store.cachedRole, 'supplier');
});
