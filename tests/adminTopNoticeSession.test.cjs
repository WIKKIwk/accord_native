const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminTopNoticeSupport.cjs');
function fixture() {
  let epoch = 3, token = 'genuine', scope = 'scope', witnessCurrent = true, allowed = true, parent = true, listener, unsubscribed = 0;
  const session = { token: 'genuine', profile: { role: 'admin' } }, witness = { session }, clock = s.scheduler(), runtime = new s.service.AdminTopNoticeService({ setTimer: clock.set, clearTimer: clock.clear });
  const module = s.load('admin/adminTopNoticeSession', { '../auth': { activeSessionEpoch: value => value === session ? epoch : null, activeSessionToken: () => token, isSessionWitnessCurrent: value => value === witness && witnessCurrent,
    subscribeSessionWitness: callback => { listener = callback; return () => { listener = null; unsubscribed++; }; } }, '../sessionReadScope': { sessionReadScope: () => scope },
    '../shared/camera/synchronousGuard': s.strict, './adminShellAccess': { adminShellMayEnter: () => allowed }, './adminTopNoticeMessenger': s.messenger, './adminTopNoticeRuntime': { adminTopNoticeService: runtime } });
  const options = { session, witness, isCurrent: () => parent }, owner = module.createAdminTopNoticeSession(options), target = owner.messenger, driver = {}, scaffold = target.createScaffold({}, null);
  target.attachDriver(driver, false); target.attachScaffold(scaffold);
  return { owner, module, options, target, runtime, clock, session, notify: () => listener?.(), unsubscribed: () => unsubscribed,
    mutate: changes => { if ('epoch' in changes) epoch = changes.epoch; if ('token' in changes) token = changes.token; if ('scope' in changes) scope = changes.scope; if ('witness' in changes) witnessCurrent = changes.witness; if ('allowed' in changes) allowed = changes.allowed; if ('parent' in changes) parent = changes.parent; } };
}
for (const [label, changes] of Object.entries({ epoch: { epoch: 4 }, token: { token: null }, scope: { scope: 'changed' }, witness: { witness: false }, permission: { allowed: false }, parent: { parent: false } })) test(`session notification expires original ${label}, cancels five-second timer and cannot revive`, () => {
  const f = fixture(), handle = f.owner.show({ message: 'resolved', tone: 'success' }); assert.ok(handle); f.mutate(changes); f.notify();
  assert.equal(f.target.current(), false); assert.equal(f.target.getSnapshot().head, null); assert.equal(handle.isClosed(), true); assert.equal(f.clock.size(), 0); assert.equal(f.unsubscribed(), 1);
  f.mutate({ epoch: 3, token: 'genuine', scope: 'scope', witness: true, allowed: true, parent: true }); assert.equal(f.owner.show({ message: 'stale', tone: 'error' }), null);
});
test('same-account token refresh preserves message and timer, with no page-focus authority mixed into global banner lifetime', () => {
  const f = fixture(), handle = f.owner.show({ message: 'original', tone: 'success' }); f.session.token = 'refreshed'; f.mutate({ token: 'refreshed' }); f.notify(); assert.equal(f.owner.current(), true); assert.equal(handle.isClosed(), false); assert.equal(f.clock.size(), 1); f.target.retire();
});
test('stale session dismissal cannot close the latest fresh-account target', () => {
  const f = fixture(), old = f.owner.show({ message: 'old', tone: 'success' }), other = s.fixture(); other.mount(); f.mutate({ epoch: 8 }); f.notify();
  const fresh = f.runtime.show(other.target, { message: 'fresh', tone: 'error' }); f.owner.dismiss(); old.close(); assert.equal(f.runtime.isLatest(fresh), true); assert.equal(other.target.getSnapshot().head, fresh.banner); other.target.retire();
});
test('same-object reauthentication, foreign witness, test token and async parent cannot adopt a fresh original authority', async () => {
  const f = fixture(); f.mutate({ epoch: 9 }); assert.equal(f.owner.current(), false);
  const other = fixture(), invalid = other.module.createAdminTopNoticeSession({ ...other.options, witness: { session: other.session } }); assert.equal(invalid.current(), false); other.session.token = 'test-mode-token'; assert.equal(other.owner.current(), false);
  const third = fixture(), async = third.module.createAdminTopNoticeSession({ ...third.options, isCurrent: () => Promise.reject(Error('async authority')) }); assert.equal(async.current(), false); third.target.retire(); await s.flush();
});
