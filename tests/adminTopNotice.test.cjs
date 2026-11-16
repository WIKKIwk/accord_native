const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminTopNoticeSupport.cjs');

test('service requires an original account plus genuine mounted coordinator and root Scaffold; no default readiness', () => {
  const f = s.fixture(); assert.equal(f.show('unmounted'), null); assert.equal(f.target.getSnapshot().head, null); assert.equal(f.clock.size(), 0);
  const stop = f.target.attachDriver(f.driver, false); assert.equal(f.show('without Scaffold'), null); const attach = f.target.attachScaffold(f.scaffold);
  assert.ok(f.show('real target')); assert.equal(f.target.ready(), true); stop(); attach(); f.target.retire();
});
test('one shared Messenger shows the SAME banner in sibling registered roots and excludes nested Source Scaffolds', () => {
  const f = s.fixture(); f.mount(); const sibling = f.target.createScaffold({}, null), nested = f.target.createScaffold({}, f.scaffold); f.target.attachScaffold(sibling); f.target.attachScaffold(nested);
  const shown = f.show('shared'); assert.equal(f.target.bannerFor(f.scaffold), shown.banner); assert.equal(f.target.bannerFor(sibling), shown.banner); assert.equal(f.target.bannerFor(nested), null);
  assert.equal(f.target.bannerFor({ ...f.scaffold }), null); f.target.retire();
});
test('explicit foreign Messenger ancestor is a root; physical/native nesting never substitutes a Source ancestor', () => {
  const a = s.fixture(), b = s.fixture(); a.mount(); b.target.attachDriver(b.driver, false);
  const root = b.target.createScaffold({}, a.scaffold); b.target.attachScaffold(root); const shown = b.show('scoped root'); assert.equal(b.target.bannerFor(root), shown.banner);
  a.target.retire(); b.target.retire();
});
test('show freezes the already resolved message/icon while theme or locale inputs subsequently change', () => {
  const f = s.fixture(); f.mount(); let locale = 'uz', reads = 0; const input = { get message() { reads++; return locale === 'uz' ? 'Tayyor' : 'Ready'; }, tone: 'success', icon: { androidSource: 7, iosSystemName: 'checkmark' } };
  const shown = f.runtime.show(f.target, input); locale = 'en'; input.icon.androidSource = 8; input.icon.iosSystemName = 'xmark';
  assert.equal(reads, 1); assert.equal(shown.banner.message, 'Tayyor'); assert.deepEqual(shown.banner.icon, { androidSource: 7, iosSystemName: 'checkmark' }); assert.ok(Object.isFrozen(shown.banner)); f.target.retire();
});
test('Source timer begins at enqueue, lasts exactly5 seconds, and requests real exit without duration-as-animation acknowledgment', () => {
  const f = s.fixture(); f.mount(); const shown = f.show('duration'); f.complete(); f.clock.advance(4999); assert.equal(shown.isClosed(), false);
  f.clock.advance(1); assert.equal(shown.isClosed(), true); assert.equal(f.target.getSnapshot().phase, 'exiting'); assert.equal(f.target.getSnapshot().head, shown.banner);
  f.clock.advance(25000); assert.equal(f.target.getSnapshot().head, shown.banner); assert.equal(f.complete(), true); assert.equal(f.target.getSnapshot().head, null); f.target.retire();
});
test('Source rapid A/B/C keeps closed B queued, global latest is C and only original native finished transitions advance the queue', () => {
  const f = s.fixture(); f.mount(); const a = f.show('A'); f.complete(); const b = f.show('B'), c = f.show('C');
  assert.equal(a.isClosed(), true); assert.equal(b.isClosed(), true); assert.equal(c.isClosed(), false); assert.equal(f.runtime.isLatest(c), true);
  assert.deepEqual(f.target.getSnapshot().banners.map(value => value.message), ['A', 'B', 'C']); assert.equal(f.target.getSnapshot().phase, 'exiting'); f.complete();
  assert.equal(f.target.getSnapshot().head, b.banner); assert.equal(f.target.getSnapshot().phase, 'entering'); f.complete(); assert.equal(f.target.getSnapshot().phase, 'visible');
  f.clock.advance(5000); assert.equal(c.isClosed(), true); assert.equal(f.target.getSnapshot().head, b.banner); assert.equal(f.target.getSnapshot().phase, 'exiting'); f.complete(); assert.equal(f.target.getSnapshot().head, c.banner); f.target.retire();
});
test('global latest arbitration crosses actual Messenger scopes and missing new target still closes old handle', () => {
  const a = s.fixture(), b = s.fixture(); a.mount(); b.mount(); const first = a.show('A'); a.complete(); const second = a.runtime.show(b.target, { message: 'B', tone: 'error' });
  assert.equal(first.isClosed(), true); assert.equal(a.target.getSnapshot().phase, 'exiting'); assert.equal(b.target.getSnapshot().head, second.banner);
  const absent = new s.messenger.AdminTopNoticeMessenger({ isCurrent: () => true }); assert.equal(a.runtime.show(absent, { message: 'no host', tone: 'success' }), null); assert.equal(second.isClosed(), true); assert.equal(b.target.getSnapshot().phase, 'exiting');
  a.target.retire(); b.target.retire(); absent.retire();
});
test('any genuine text-instance disposal abandons/cancels global latest without hiding its still-rendered banner', async () => {
  const f = s.fixture(); f.mount(); const shown = f.show('two roots'); f.complete(); const a = shown.banner.attachText({}), b = shown.banner.attachText({});
  a(); await s.flush(); assert.equal(shown.isClosed(), true); assert.equal(f.runtime.isLatest(shown), false); assert.equal(f.clock.size(), 0); assert.equal(f.target.getSnapshot().head, shown.banner); assert.equal(f.target.getSnapshot().phase, 'visible');
  f.clock.advance(6000); assert.equal(f.target.getSnapshot().phase, 'visible'); b(); f.target.retire();
});
test('text-instance StrictMode cleanup/reconnect cancels only its cleanup and never abandons on replay', async () => {
  const f = s.fixture(); f.mount(); const shown = f.show('replay'), identity = {}, first = shown.banner.attachText(identity); first(); const again = shown.banner.attachText(identity); await s.flush();
  assert.equal(shown.isClosed(), false); assert.equal(f.clock.size(), 1); again(); await s.flush(); assert.equal(shown.isClosed(), true); assert.equal(f.target.getSnapshot().head, shown.banner); f.target.retire();
});
test('late original text disposal/timer callback cannot clear or hide a newer latest handle', async () => {
  const callbacks = [], runtime = new s.service.AdminTopNoticeService({ setTimer: fn => { callbacks.push(fn); return callbacks.length; }, clearTimer() {} }); const f = s.fixture(); f.mount();
  const a = runtime.show(f.target, { message: 'A', tone: 'success' }), stop = a.banner.attachText({}), b = runtime.show(f.target, { message: 'B', tone: 'error' }), transition = f.target.getSnapshot().transition;
  stop(); callbacks[0](); await s.flush(); assert.equal(runtime.isLatest(b), true); assert.equal(b.isClosed(), false); assert.equal(f.target.getSnapshot().transition, transition); f.target.retire();
});
test('native driver/member replay retains original transitions, real unmount retires account banners/timers, stale callbacks cannot revive', async () => {
  const f = s.fixture(); f.mount(); const shown = f.show('pending'), transition = f.target.getSnapshot().transition; f.stopDriver(); const again = f.target.attachDriver(f.driver, false); await s.flush();
  assert.equal(f.target.current(), true); assert.equal(f.target.completeTransition(f.driver, transition), true); again(); await s.flush(); assert.equal(f.target.current(), false); assert.equal(shown.isClosed(), true); assert.equal(f.clock.size(), 0); assert.equal(f.target.completeTransition(f.driver, transition), false);
});
test('retired/account-changed native callbacks or returned original handle cannot mutate a fresh target', () => {
  const f = s.fixture(), other = s.fixture(); f.mount(); other.mount(); const old = f.show('old'), transition = f.target.getSnapshot().transition;
  f.current(false); assert.equal(f.target.current(), false); const fresh = f.runtime.show(other.target, { message: 'fresh', tone: 'success' }); old.close(); assert.equal(f.target.completeTransition(f.driver, transition), false); assert.equal(other.target.getSnapshot().head, fresh.banner); assert.equal(f.runtime.isLatest(fresh), true); other.target.retire();
});
test('account retirement during synchronous publication cannot start a timer or leave cached visible text', () => {
  const f = s.fixture(); f.mount(); f.target.subscribe(() => { if (f.target.getSnapshot().head) f.current(false); }); assert.equal(f.show('expired during show'), null); assert.equal(f.clock.size(), 0); assert.equal(f.target.getSnapshot().head, null); assert.equal(f.target.getSnapshot().retired, true);
});
test('account expiry while resolving the supplied message cannot close an unrelated latest banner', () => {
  const f = s.fixture(), other = s.fixture(); f.mount(); other.mount(); const fresh = f.runtime.show(other.target, { message: 'still current', tone: 'success' });
  const expired = f.runtime.show(f.target, { get message() { f.current(false); return 'expired'; }, tone: 'error' });
  assert.equal(expired, null); assert.equal(f.runtime.isLatest(fresh), true); assert.equal(other.target.getSnapshot().head, fresh.banner); assert.equal(fresh.isClosed(), false); other.target.retire();
});
test('old target retirement publication cannot abandon a reentrantly shown fresh target', () => {
  const f = s.fixture(), other = s.fixture(); f.mount(); other.mount(); const old = f.show('old'); let fresh;
  f.target.subscribe(() => { if (f.target.getSnapshot().retired) fresh = f.runtime.show(other.target, { message: 'fresh', tone: 'error' }); }); f.target.retire();
  assert.equal(old.isClosed(), true); assert.equal(f.runtime.isLatest(fresh), true); assert.equal(other.target.getSnapshot().head, fresh.banner); other.target.retire();
});
test('only exact original coordinator and current transition may finish, including an interrupted show/hide', () => {
  const f = s.fixture(); f.mount(); const a = f.show('A'), entering = f.target.getSnapshot().transition; f.target.hideCurrent(); const exiting = f.target.getSnapshot().transition;
  assert.equal(f.target.completeTransition({}, exiting), false); assert.equal(f.target.completeTransition(f.driver, entering), false); assert.equal(f.target.getSnapshot().head, a.banner); assert.equal(f.complete(), true); assert.equal(f.target.getSnapshot().head, null); f.target.retire();
});
test('accessibility hide and semantic dismissal use Source immediate removal, stale semantics never removes a replacement', () => {
  const f = s.fixture(); f.mount(true); const a = f.show('A'), b = f.show('B'); assert.equal(f.target.getSnapshot().head, b.banner); f.target.removeCurrent(a.banner); assert.equal(f.target.getSnapshot().head, b.banner);
  f.target.removeCurrent(b.banner); assert.equal(f.target.getSnapshot().head, null); f.target.retire();
});
test('reentrant source guards/render listeners cannot issue duplicate notices or stale transition completion', () => {
  const f = s.fixture(); f.mount(); let nested; f.target.subscribe(() => { if (f.target.getSnapshot().head) nested = f.show('nested'); }); const shown = f.show('single');
  assert.ok(shown); assert.equal(nested, null); assert.equal(f.target.getSnapshot().banners.length, 1); f.target.retire();
});
test('malformed data, asynchronous/reentrant account authority and invented scaffolds/drivers fail closed', async () => {
  const f = s.fixture(); f.mount(); for (const input of [{ message: 7, tone: 'success' }, { message: 'x', tone: 'warning' }, { message: 'x', tone: 'error', icon: { androidSource: 0, iosSystemName: 'checkmark' } }]) assert.equal(f.runtime.show(f.target, input), null);
  assert.equal(f.target.attachDriver({}, false), null); assert.equal(f.target.createScaffold({}, undefined), null); assert.equal(f.target.attachScaffold({}), null);
  const async = s.fixture({ isCurrent: () => Promise.reject(Error('not a synchronous original guard')) }); assert.equal(async.target.current(), false);
  let target; target = new s.messenger.AdminTopNoticeMessenger({ isCurrent: () => target.current() }); assert.equal(target.current(), false); await s.flush(); f.target.retire();
});
