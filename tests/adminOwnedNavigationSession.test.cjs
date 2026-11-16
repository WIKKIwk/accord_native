const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
function fixture() {
  const session = { token: 'original-token', baseUrl: 'https://original.example', profile: { role: 'admin', ref: 'ADMIN' }, capabilities: ['admin.access'] }, witness = { session };
  let epoch = 4, witnessed = true, parent = true, source = true, allowed = true;
  const pushes = [], reads = { parent: () => parent, source: () => source }, deps = { session, witness, isCurrent: () => reads.parent(), sourceReady: () => reads.source(), push: id => pushes.push(id) };
  const { AdminOwnedNavigationSession } = s.load('admin/adminOwnedNavigationSession', {
    '../auth': { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token || null, isSessionWitnessCurrent: candidate => candidate === witness && witnessed },
    '../sessionReadScope': s.load('sessionReadScope'), '../shared/appRoutes': { canOpenRoute: () => allowed },
    '../shared/camera/synchronousGuard': s.strict, './adminOwnedRoutes': { AdminOwnedRoutes: s.AdminOwnedRoutes },
    './adminOwnedRemoval': { AdminOwnedRootRemoval: s.AdminOwnedRootRemoval }, './adminShellAccess': { adminShellMayEnter: value => value.profile.role === 'admin' && value.capabilities.includes('admin.access') },
  });
  const owner = new AdminOwnedNavigationSession(deps), originalParent = { isCurrent: () => true, canInteract: () => true };
  const open = () => owner.registry.open({ kind: 'profile' }, originalParent);
  return { owner, deps, reads, session, witness, pushes, open, epoch: value => { epoch = value; }, witnessed: value => { witnessed = value; }, parent: value => { parent = value; }, source: value => { source = value; }, allowed: value => { allowed = value; } };
}
test('private navigation stays held before native admission and while genuine source providers are unavailable', async () => {
  const f = fixture(); assert.equal(f.owner.current(), false); assert.equal(await f.open(), false); assert.deepEqual(f.pushes, []);
  f.source(false); f.owner.activate(); assert.equal(f.owner.current(), true); assert.equal(f.owner.ready(), false); assert.equal(await f.open(), false); assert.deepEqual(f.pushes, []);
  f.source(true); assert.equal(f.owner.ready(), true); const pending = f.open(); assert.equal(f.pushes.length, 1); f.owner.detach(); assert.equal(await pending, false);
});
test('registry starts before admission publication so genuine descendants may claim original arguments in child-first layout', () => {
  const f = fixture(), observations = [];
  f.owner.subscribe(() => { if (f.owner.getSnapshot().active) { observations.push(f.owner.current()); f.open(); observations.push(f.owner.registry.get(f.pushes.at(-1))?.target.kind); } });
  f.owner.activate(); assert.deepEqual(observations, [true, 'profile']); f.owner.detach();
});
for (const change of ['epoch', 'witness', 'endpoint', 'role', 'ref', 'capabilities', 'assigned', 'token', 'parent']) test(`original ${change} loss retires private routes permanently`, async () => {
  const f = fixture(); f.owner.activate(); const pending = f.open(), id = f.pushes[0], generation = f.owner.getSnapshot().generation;
  if (change === 'epoch') f.epoch(5); if (change === 'witness') f.witnessed(false); if (change === 'endpoint') f.session.baseUrl = 'https://new.example';
  if (change === 'role') f.session.profile.role = 'worker'; if (change === 'ref') f.session.profile.ref = 'OTHER'; if (change === 'capabilities') f.session.capabilities = [];
  if (change === 'assigned') f.session.assigned_warehouses = ['new']; if (change === 'token') f.session.token = 'test-mode-token'; if (change === 'parent') f.parent(false);
  assert.equal(f.owner.current(generation), false); assert.equal(f.owner.registry.get(id), null); assert.equal(await pending, false);
  f.epoch(4); f.witnessed(true); f.session.baseUrl = 'https://original.example'; f.session.profile = { role: 'admin', ref: 'ADMIN' }; f.session.capabilities = ['admin.access']; delete f.session.assigned_warehouses; f.session.token = 'refreshed'; f.parent(true);
  f.owner.detach(); f.owner.activate(); assert.equal(f.owner.current(), false); assert.equal(await f.open(), false); assert.equal(f.pushes.length, 1);
});
test('same original account token refresh stays current while leaf capability withdrawal closes only admitted private entries', async () => {
  const f = fixture(); f.owner.activate(); f.session.token = 'refreshed'; assert.equal(f.owner.current(), true);
  const pending = f.open(), id = f.pushes[0]; f.allowed(false); assert.equal(f.owner.registry.get(id), null); assert.equal(await pending, false); assert.equal(f.owner.current(), true);
  f.allowed(true); const next = f.open(); assert.equal(f.pushes.length, 2); f.owner.detach(); assert.equal(await next, false);
});
test('StrictMode detach/setup starts a fresh native lifetime and settles original pending pages without carrying old callbacks', async () => {
  const f = fixture(); f.owner.activate(); const generation = f.owner.getSnapshot().generation, oldCurrent = () => f.owner.current(generation), pending = f.open(), oldId = f.pushes[0];
  f.owner.detach(); assert.equal(await pending, false); f.owner.activate(); assert.equal(f.owner.current(), true); assert.equal(oldCurrent(), false); assert.equal(f.owner.registry.get(oldId), null);
  const fresh = f.open(); assert.equal(f.pushes.length, 2); f.owner.detach(); assert.equal(await fresh, false);
});
test('async/reentrant original authority and recursive source readiness cannot admit a private push', async () => {
  for (const mode of ['async', 'reentrant', 'ready']) {
    const f = fixture();
    if (mode === 'async') f.reads.parent = async () => true;
    if (mode === 'reentrant') f.reads.parent = () => { f.owner.current(); return true; };
    if (mode === 'ready') f.reads.source = () => { f.owner.ready(); return true; };
    f.owner.activate(); assert.equal(await f.open(), false); assert.deepEqual(f.pushes, []); assert.equal(f.owner.current(), false);
  }
});
test('source readiness cannot revive detached authority during its callback and observer exceptions never strand results', async () => {
  const f = fixture(); f.owner.subscribe(() => { throw new Error('observer'); }); f.owner.activate();
  f.reads.source = () => { f.owner.detach(); return true; }; assert.equal(await f.open(), false); assert.deepEqual(f.pushes, []);
  f.reads.source = () => true; f.owner.activate(); const pending = f.open(); assert.equal(f.pushes.length, 1); f.owner.invalidate(); assert.equal(await pending, false);
});
test('replacing caller dependency callbacks cannot renew original shell authority or substitute private pushes', async () => {
  const f = fixture(); f.owner.activate(); f.deps.isCurrent = () => true; f.deps.sourceReady = () => true; f.deps.push = () => assert.fail('substituted push');
  const pending = f.open(); assert.equal(f.pushes.length, 1); f.parent(false); assert.equal(f.owner.current(), false); assert.equal(f.owner.registry.get(f.pushes[0]), null); assert.equal(await pending, false);
});
