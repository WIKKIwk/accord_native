const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminFixedSnackBarSupport.cjs');

test('ordinary FIFO belongs to exact actual Source Messenger identity and stays separate from global TopNotice', () => {
  const f = s.fixture(), other = s.fixture(); assert.equal(s.runtime.adminFixedSnackBarController(f.target), s.runtime.adminFixedSnackBarController(f.target)); assert.notEqual(s.runtime.adminFixedSnackBarController(f.target), s.runtime.adminFixedSnackBarController(other.target));
  const top = f.runtime.show(f.target, { message: 'top', tone: 'success' }), first = f.show('fixed'); assert.equal(f.target.getSnapshot().head, top.banner); assert.equal(f.queue.getSnapshot().head, first); f.cleanup(); other.cleanup();
});
test('structural driver connection can precede first Source Scaffold/geometry, without a cyclic mount dependency or fake position', () => {
  const f = s.fixture({ sourceMounted: false, geometry: false }); assert.equal(f.queue.connected(), true); assert.equal(f.queue.hasUsableHosts(), false); assert.equal(f.show('no actual Source registration'), null);
  const stop = f.target.attachScaffold(f.scaffold); const first = f.show('first Screen'); assert.ok(first); assert.equal(f.queue.entryFor(f.host), null); assert.equal(f.queue.getSnapshot().phase, 'entering'); assert.equal(f.clock.size(), 0);
  assert.equal(f.finish(), false); assert.equal(f.build(), false); f.clock.advance(10000); assert.equal(f.queue.getSnapshot().head, first); f.queue.setGeometry(f.host, f.facts); assert.equal(f.queue.entryFor(f.host), first); assert.equal(f.finish(), true); assert.equal(f.build(), true); stop(); f.cleanup();
});
test('FIFO preserves duplicate calls/identity/text and captures resolved message exactly once', () => {
  const f = s.fixture(), id = {}; let message = 'resolved uz', reads = 0; const first = f.queue.enqueue({ identity: id, get message() { reads++; return message; } }); message = 'translated en';
  const second = f.show('same', id), third = f.show('same', id); assert.equal(reads, 1); assert.equal(first.message, 'resolved uz'); assert.notEqual(second, third); assert.equal(second.sourceIdentity, id); assert.deepEqual(f.queue.getSnapshot().entries.map(entry => entry.message), ['resolved uz', 'same', 'same']); f.cleanup();
});
test('plain4 seconds begins only after genuine entry completion and next Source Messenger build, never at enqueue', () => {
  const f = s.fixture(), first = f.show('timer'); f.clock.advance(9000); assert.equal(f.queue.getSnapshot().phase, 'entering'); assert.equal(f.clock.size(), 0); assert.equal(f.build(), false);
  f.finish(); assert.equal(f.queue.getSnapshot().phase, 'visible'); assert.equal(f.clock.size(), 0); f.build(); assert.equal(f.build(), false); f.clock.advance(3999); assert.equal(f.queue.getSnapshot().phase, 'visible');
  f.clock.advance(1); assert.equal(f.queue.getSnapshot().phase, 'exiting'); assert.equal(f.queue.getSnapshot().head, first); f.clock.advance(10000); assert.equal(f.queue.getSnapshot().head, first); f.finish(); assert.equal(f.queue.getSnapshot().head, null); f.cleanup();
});
test('queued entry advances only after original exit finished, then receives its own entry and new full4-second timer', () => {
  const f = s.fixture(), first = f.show('first'), second = f.show('second'); f.finish(); f.build(); f.clock.advance(4000); const exit = f.queue.getSnapshot().transition;
  assert.equal(f.queue.getSnapshot().head, first); assert.equal(f.queue.completeTransition({}, exit), false); f.finish(); assert.equal(f.queue.getSnapshot().head, second); assert.equal(f.clock.size(), 0); assert.equal(f.queue.getSnapshot().phase, 'entering');
  assert.equal(f.queue.completeTransition(f.driver, exit), false); f.finish(); f.build(); f.clock.advance(3999); assert.equal(f.queue.getSnapshot().phase, 'visible'); f.clock.advance(1); assert.equal(f.queue.getSnapshot().phase, 'exiting'); f.cleanup();
});
test('Source plain no-action SnackBar still expires with accessible navigation; hide and semantic/swipe removal are immediate', () => {
  const f = s.fixture({ accessible: true }), first = f.show('accessible'), second = f.show('queued'); f.finish(); f.build(); f.clock.advance(4000); assert.equal(f.queue.getSnapshot().head, second); assert.equal(f.queue.getSnapshot().phase, 'entering');
  f.queue.remove(first); assert.equal(f.queue.getSnapshot().head, second); f.queue.remove(second); assert.equal(f.queue.getSnapshot().head, null); assert.equal(f.clock.size(), 0); f.cleanup();
});
test('source sibling roots share same head while nested and reflected Source Scaffold metadata never paints another bar', () => {
  const f = s.fixture(), sibling = f.target.createScaffold({}, null), nested = f.target.createScaffold({}, f.scaffold); f.target.attachScaffold(sibling); f.target.attachScaffold(nested);
  const make = scaffold => { const host = f.queue.createHost({ identity: {}, scaffold, isCurrent: () => true, canInteract: () => true }); f.queue.attachHost(host); f.queue.setGeometry(host, f.facts); return host; };
  const siblingHost = make(sibling), nestedHost = make(nested), reflected = make({ ...f.scaffold }), entry = f.show('shared'); assert.equal(f.queue.entryFor(f.host), entry); assert.equal(f.queue.entryFor(siblingHost), entry); assert.equal(f.queue.entryFor(nestedHost), null); assert.equal(f.queue.entryFor(reflected), null); f.cleanup();
});
test('genuine Source text/host disposal does NOT abandon ordinary queue or cancel its root timer; no page-focus timer pause', async () => {
  const f = s.fixture(), entry = f.show('retained global'); f.finish(); f.build(); f.stopHost(); await s.flush(); assert.equal(f.queue.entryFor(f.host), null); assert.equal(f.queue.getSnapshot().head, entry); assert.equal(f.clock.size(), 1);
  f.clock.advance(4000); assert.equal(f.queue.getSnapshot().phase, 'exiting'); f.finish(); assert.equal(f.queue.getSnapshot().head, null); f.cleanup();
});
test('unknown geometry retains queued entry without inventing zero; another native window cannot replace original host receipt', () => {
  const f = s.fixture(), entry = f.show('paired'); f.queue.setGeometry(f.host, null); assert.equal(f.queue.geometryFor(f.host), null); assert.equal(f.queue.entryFor(f.host), null); assert.equal(f.queue.getSnapshot().head, entry);
  assert.equal(f.queue.setGeometry(f.host, f.facts), true); assert.equal(f.queue.setGeometry(f.host, s.pair({})), false); assert.equal(f.queue.geometryFor(f.host), null); assert.equal(f.queue.setGeometry(f.host, f.facts), false); f.cleanup();
});
test('host and native driver StrictMode exact-member replay preserve original queue, geometry and timer; actual coordinator removal retires', async () => {
  const f = s.fixture(), entry = f.show('replay'); f.finish(); f.build(); f.stopHost(); const stopHost = f.queue.attachHost(f.host); f.stopDriver(); const stopDriver = f.queue.attachDriver(f.driver); await s.flush();
  assert.equal(f.queue.current(), true); assert.equal(f.queue.entryFor(f.host), entry); assert.equal(f.clock.size(), 1); stopHost(); stopDriver(); await s.flush(); assert.equal(f.queue.current(), false); assert.equal(f.clock.size(), 0); f.cleanup();
});
test('duplicate global driver/old transition cannot animate or finish another original queue or a new head', () => {
  const f = s.fixture(); assert.equal(f.queue.attachDriver({}), null); const first = f.show('first'), entering = f.queue.getSnapshot().transition; f.queue.hide(first); const exit = f.queue.getSnapshot().transition;
  assert.equal(f.queue.completeTransition(f.driver, entering), false); assert.equal(f.queue.completeTransition({}, exit), false); f.queue.remove(first); f.show('new'); assert.equal(f.queue.completeTransition(f.driver, exit), false); f.cleanup();
});
test('account/witness reset through shared Messenger scrubs every entry/timer and rejects retained original native callbacks', () => {
  const f = s.fixture(), first = f.show('private'); f.finish(); f.build(); const second = f.show('queued private'); f.current(false); f.target.current();
  assert.equal(f.queue.current(), false); assert.equal(f.queue.getSnapshot().head, null); assert.equal(f.clock.size(), 0); f.queue.remove(first); f.queue.hide(second); f.current(true); assert.equal(f.show('must not revive'), null); f.cleanup();
});
test('late original timer cannot clear a new timer, hide its new entry or create a second visible deadline', () => {
  const callbacks = [], cleared = [], f = s.fixture({ timers: { setTimer: callback => { callbacks.push(callback); return callbacks.length; }, clearTimer: id => cleared.push(id) } });
  const first = f.show('first'); f.finish(); f.build(); f.queue.remove(first); const second = f.show('second'); f.finish(); f.build(); callbacks[0](); assert.equal(f.queue.getSnapshot().head, second); assert.equal(f.build(), false);
  f.queue.retire(); assert.deepEqual(cleared, [1, 2]); callbacks[1](); assert.equal(f.queue.getSnapshot().head, null); f.cleanup();
});
test('reentrant publication cannot enqueue/close another decision and account retirement wins before entry is returned', () => {
  const f = s.fixture(); let nested; f.queue.subscribe(() => { if (f.queue.getSnapshot().head) nested = f.show('nested'); }); const first = f.show('one'); assert.ok(first); assert.equal(nested, null); assert.equal(f.queue.getSnapshot().entries.length, 1); f.cleanup();
  const g = s.fixture(); g.queue.subscribe(() => { if (g.queue.getSnapshot().head) { g.current(false); g.target.current(); } }); assert.equal(g.show('retired during show'), null); assert.equal(g.queue.getSnapshot().head, null); g.cleanup();
});
test('original host top authority is independent of account, rejects async/changed geometry reentrancy and never revives an expired host owner', async () => {
  const f = s.fixture(), entry = f.show('gesture'); assert.equal(f.queue.canInteract(f.host, entry), true); f.top(false); assert.equal(f.queue.canInteract(f.host, entry), false); assert.equal(f.queue.current(), true); f.top(true); assert.equal(f.queue.canInteract(f.host, entry), true);
  f.hostCurrent(false); assert.equal(f.queue.canInteract(f.host, entry), false); f.hostCurrent(true); assert.equal(f.queue.canInteract(f.host, entry), false);
  const host = f.queue.createHost({ identity: {}, scaffold: f.scaffold, isCurrent: () => true, canInteract: () => { f.queue.setGeometry(host, null); return true; } }); f.queue.attachHost(host); f.queue.setGeometry(host, f.facts); assert.equal(f.queue.canInteract(host, entry), false);
  const asyncHost = f.queue.createHost({ identity: {}, scaffold: f.scaffold, isCurrent: () => true, canInteract: () => Promise.reject(Error('async native top')) }); f.queue.attachHost(asyncHost); f.queue.setGeometry(asyncHost, f.facts); assert.equal(f.queue.canInteract(asyncHost, entry), false);
  assert.equal(f.queue.hasDriverLease(undefined), false); f.cleanup(); await s.flush();
});
