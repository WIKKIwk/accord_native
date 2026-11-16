const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminWorkerDetailSupport.cjs');
const { load, strings, routes, deferred, flush } = s;
const profileGuard = load('shared/profileSessionGuard');
const scope = load('sessionReadScope');
function fixture(kind) {
  let witnessValid = true, external = () => true;
  const session = { token: 'original-token', baseUrl: 'https://server.example', imageCacheScope: 'original', profile: { role: 'admin', ref: 'original', avatar_url: 'https://images.example/avatar' }, capabilities: ['admin.access', 'admin.settings.read', 'catalog.item.read', 'party.supplier.read', 'werka.code.manage'], assigned_apparatus: [], assigned_apparatus_labels: [] }, witness = { session, generation: 1 };
  class Controller { constructor(deps) { this.deps = deps; } isCurrent() { return this.deps.isCurrent(); } getSnapshot() { return { detail: {}, warehouses: [], responsibilities: [] }; } dispose() {} }
  const api = {}, assignments = {}, controller = { AdminWorkerDetailController: Controller, AdminWorkerDetailEditorController: Controller, AdminWarehouseCreateController: Controller, AdminWarehouseSettingsController: Controller, AdminUsersController: Controller, AdminWerkaController: Controller, AdminSettingsController: Controller };
  const auth = { activeSessionEpoch: () => 1, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: value => value === witness && witnessValid, registerSessionResetHook() {} };
  const mocks = { 'expo-clipboard': {}, '../auth': auth, '../apparatusApi': {}, '../sessionReadScope': scope, '../shared/appRoutes': routes, '../shared/profileSessionGuard': profileGuard,
    '../shared/localization': s.l10n, '../shared/localization/runtime': { localeController: { locale: 'uz' } }, './adminUsersModel': s.model,
    './adminSettings': {}, './adminWerkaApi': {}, './adminUsersApi': api, './adminUsersRuntime': { adminUsersCache: {}, adminUsersRoleStore: {} },
    './adminWarehouseAssignees': {}, './adminWarehouseAssignmentApi': {}, './adminWarehouseSettingsApi': {}, './warehouseApi': {}, './adminWorkerDetailApi': api,
    './adminWorkerDetailAssignmentsApi': assignments, './adminWorkerDetailModel': s.workerModel, './dartJsonString': strings };
  for (const [name, value] of Object.entries(controller)) mocks[`./${name.charAt(0).toLowerCase()}${name.slice(1)}`] = { [name]: value };
  const parent = () => external();
  const targets = {
    worker: () => load('admin/adminWorkerDetailSession', mocks).adminWorkerDetailSession(session, witness, parent, s.entry()),
    werka: () => load('admin/adminWerkaSession', mocks).createAdminWerkaSession(session, witness, parent),
    users: () => load('admin/adminUsersSession', mocks).createAdminUsersSession(session, witness, parent),
    settings: () => load('admin/adminSettingsSession', mocks).adminSettingsSession(session, witness, parent),
    warehouseCreate: () => load('admin/adminWarehouseCreateSession', mocks).adminWarehouseCreateSession(session, witness, parent, { onSaved: async () => {}, onClose() {} }),
    warehouseSettings: () => load('admin/adminWarehouseSettingsSession', mocks).adminWarehouseSettingsSession(session, witness, parent, { onChanged: async () => {}, onDeleted: async () => {} }),
  };
  return { session, auth, owner: targets[kind](), retire: () => { witnessValid = false; }, external: value => { external = value; } };
}
for (const kind of ['worker', 'werka', 'users', 'settings', 'warehouseCreate', 'warehouseSettings']) {
  test(`${kind} genuine parent stays current inside shared cache guard and rejects a retired original witness`, () => {
    const f = fixture(kind); assert.equal(f.owner.current(), true); assert.equal(profileGuard.isProfileSessionCurrent(f.owner.current), true); assert.equal(f.owner.current(), true);
    f.retire(); assert.equal(profileGuard.isProfileSessionCurrent(f.owner.current), false); assert.equal(f.owner.current(), false);
  });
  test(`${kind} actual guarded avatar runtime can load through parent and rejects body-time retirement before cache publication`, async () => {
    const f = fixture(kind), fetchBefore = global.fetch, wait = deferred(); let bodyPending = false;
    const cache = load('shared/profileAvatarCache', { './profileSessionGuard': profileGuard }), runtime = load('shared/profileAvatarRuntime', {
      '../auth': f.auth, '../profileModel': load('profileModel'), './profileAvatarCache': cache, './profileSessionGuard': profileGuard });
    global.fetch = async () => ({ status: 200, arrayBuffer: async () => bodyPending ? wait.promise : Uint8Array.of(1).buffer, headers: { get: () => 'image/png' } });
    try {
      const uri = await runtime.ensureProfileAvatar(f.session, f.session.profile, f.owner.current); assert.equal(uri, 'data:image/png;base64,AQ=='); assert.equal(f.owner.current(), true);
      bodyPending = true; const next = { ...f.session.profile, avatar_url: 'https://images.example/next' }, pending = runtime.ensureProfileAvatar(f.session, next, f.owner.current); await flush();
      f.retire(); wait.resolve(Uint8Array.of(2).buffer); assert.equal(await pending, null); assert.equal(runtime.cachedProfileAvatar(f.session, next, f.owner.current), null);
    } finally { global.fetch = fetchBefore; }
  });
  test(`${kind} per-owner recursion frame still rejects accidentally async and cyclic authority`, () => {
    const async = fixture(kind); async.external(async () => true); assert.equal(async.owner.current(), false);
    const cyclic = fixture(kind); cyclic.external(() => { cyclic.owner.current(); return true; }); assert.equal(cyclic.owner.current(), false); cyclic.external(() => true); assert.equal(cyclic.owner.current(), false);
  });
}
test('new independent guard permits genuine nested guards; legacy global guard keeps prior recursive semantics', () => {
  assert.equal(profileGuard.isProfileSessionCurrent(() => profileGuard.isProfileSessionCurrent(() => true)), false);
  const inner = profileGuard.createProfileSessionGuard(() => true), outer = profileGuard.createProfileSessionGuard(inner);
  assert.equal(profileGuard.isProfileSessionCurrent(outer), true);
  let recursive; recursive = profileGuard.createProfileSessionGuard(() => { recursive(); return true; }); assert.equal(recursive(), false);
});
