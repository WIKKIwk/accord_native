const assert = require('node:assert/strict'), test = require('node:test');
const { load, core, guard, fixture, presentation, content } = require('./adminRootPresentationSupport.cjs');
function sessionFixture() {
  let epoch = 3, token = 'genuine', scope = 'original-permission-scope', witnessCurrent = true, allowed = true, parent = true, listener = null, unsubscribed = 0;
  const session = { token: 'genuine', profile: { role: 'admin' } }, witness = { session };
  const module = load('admin/adminRootPresentationSession', {
    '../auth': { activeSessionEpoch: value => value === session ? epoch : null, activeSessionToken: () => token, isSessionWitnessCurrent: value => value === witness && witnessCurrent,
      subscribeSessionWitness: callback => { listener = callback; return () => { listener = null; unsubscribed++; }; } },
    '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/camera/synchronousGuard': guard,
    './adminShellAccess': { adminShellMayEnter: () => allowed }, './adminRootPresentationChain': core,
  });
  const rootIdentity = {}, nativeIdentity = {}, options = { session, witness, isCurrent: () => parent, rootIdentity, platform: 'ios' }, chain = module.createAdminRootPresentationSession(options);
  chain.attachNative(chain.root, nativeIdentity, rootIdentity); chain.nativeShown(chain.root, nativeIdentity);
  const open = () => chain.open({ parent: chain.top(), identity: {}, kind: 'dialog', renderContent: content, presentation, isCurrent: () => true, onRequestClose: () => {} });
  return { chain, open, options, session, module, mutate: changes => { if ('epoch' in changes) epoch = changes.epoch; if ('token' in changes) token = changes.token; if ('scope' in changes) scope = changes.scope;
    if ('witness' in changes) witnessCurrent = changes.witness; if ('allowed' in changes) allowed = changes.allowed; if ('parent' in changes) parent = changes.parent; },
    notify: () => listener?.(), unsubscribed: () => unsubscribed };
}
for (const [label, changes] of Object.entries({ epoch: { epoch: 4 }, token: { token: null }, scope: { scope: 'changed' }, witness: { witness: false }, permission: { allowed: false }, parent: { parent: false } })) {
  test(`real session captures original ${label} and subscription retires pending native results`, async () => {
    const f = sessionFixture(), original = f.open(); assert.ok(original); f.mutate(changes); f.notify(); assert.equal(f.chain.current(), false); assert.equal(await original.closed, 'retired'); assert.equal(f.unsubscribed(), 1);
    f.mutate({ epoch: 3, token: 'genuine', scope: 'original-permission-scope', witness: true, allowed: true, parent: true }); assert.equal(f.open(), null);
  });
}
test('session factory rejects same account object reauthentication and witness replacement without adopting the new epoch', () => {
  const f = sessionFixture(); f.mutate({ epoch: 9 }); assert.equal(f.chain.current(), false);
  const other = sessionFixture(); const wrong = other.module.createAdminRootPresentationSession({ ...other.options, witness: { session: other.session } }); assert.equal(wrong.current(), false);
});
test('legacy test-mode token and an accidental rejected async parent guard are fail-closed without native readiness', async () => {
  const f = sessionFixture(); f.session.token = 'test-mode-token'; assert.equal(f.chain.current(), false);
  const other = sessionFixture(), rejected = other.module.createAdminRootPresentationSession({ ...other.options, isCurrent: () => Promise.reject(Error('async guard')) }); assert.equal(rejected.current(), false); await new Promise(resolve => setImmediate(resolve));
});
test('Root identity/future host membership remains insufficient until actual carrier native receipt events', () => {
  const f = fixture('ios'); assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.chain.top(), f.chain.root); assert.equal(f.open(), null); f.chain.retire();
});
