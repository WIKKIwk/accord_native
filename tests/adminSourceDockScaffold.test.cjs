const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminSourceDockScaffoldSupport.cjs');
const metrics = patch => ({ platform: 'android', width: 400, height: 800, viewPaddingBottom: 24, systemGestureInsetsBottom: 16, viewInsetsBottom: 0, ...patch });
const primary = { ticket: {}, hasPrimary: true, visible: true, ready: true };
test('Source semantic dock target preserves thin gesture, Android media and iPhone/tablet branches without inventing a measurement', () => {
  assert.deepEqual(s.policy.adminSourceDockSizing(metrics(), true, primary), { dockHeight: 75, hostHeight: 199, toggleBottom: 89, actionsBottom: 179, dockBottomInset: 15 });
  assert.equal(s.policy.adminSourceDockSizing(metrics(), false, primary).hostHeight, 208);
  assert.equal(s.policy.adminSourceDockSizing(metrics({ platform: 'ios', viewPaddingBottom: 34 }), false, primary).hostHeight, 199);
  assert.equal(s.policy.adminSourceDockSizing(metrics({ platform: 'ios', width: 800, height: 1000, viewPaddingBottom: 34 }), false, primary).hostHeight, 218);
  assert.equal(s.policy.adminSourceDockSizing(metrics(), true, { ...primary, visible: false }).hostHeight, 75);
  for (const [m, thin, p] of [[null, true, primary], [metrics(), null, primary], [metrics(), true, null], [metrics({ width: 0 }), true, primary], [metrics({ viewInsetsBottom: NaN }), true, primary]]) assert.equal(s.policy.adminSourceDockSizing(m, thin, p), null);
});
test('Flutter extendBody shrinks only when RAW IME exceeds actual dock, preserving equality and independently measured fractional heights', () => {
  for (const [ime, dock, expected] of [[0, 199, 0], [198, 199, 0], [199, 199, 0], [200, 199, 200], [199, 547 / 2.75, 199]]) assert.equal(s.policy.adminSourceDockBodyBottom(metrics({ viewInsetsBottom: ime }), dock), expected);
  assert.equal(s.policy.adminSourceDockBodyBottom(null, 199), null); assert.equal(s.policy.adminSourceDockBodyBottom(metrics(), null), null);
});
test('real original Reader viewport bootstraps semantic target then genuine dock ACK supplies actual host height; scalar and foreign callbacks cannot acknowledge it', async t => {
  const f = s.fixture({ pending: true }); t.after(f.cleanup); const o = f.scaffoldOwner;
  assert.equal(o.getSnapshot().geometryReady, false); f.viewport(); assert.equal(o.getSnapshot().target, null);
  f.settle(0); await s.flush(); const target = o.getSnapshot().target; assert.equal(target.sizing.hostHeight, 199);
  o.bindDock({ tag: 12, nativeID: target.nativeID }, { ...target }); o.bindDock({ tag: 12, nativeID: 'foreign' }, target); assert.equal(f.calls.length, 1);
  f.bindDock(); assert.equal(f.calls.length, 2); assert.equal(o.getSnapshot().geometryReady, false); f.settle(1); await s.flush();
  assert.equal(o.getSnapshot().geometryReady, true); assert.equal(o.getSnapshot().native.dockHeight, 547 / 2.75); assert.notEqual(o.getSnapshot().native.dockHeight, target.sizing.hostHeight);
  assert.equal(o.hubRequest().windowIdentity, o.getSnapshot().native.windowIdentity); assert.equal(o.hostAvailable(o.hubRequest()), true);
});
test('retained original ticket reads geometry through logical blur but page commands keep actual own-top guards', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner, first = o.hubRequest(); assert.equal(first.canOpenPrimary(), true);
  f.focus(false); f.top(false); assert.equal(f.hub.primary(), null); assert.ok(f.hub.primaryFor(f.ticket)); f.hub.refreshLocale();
  const retained = o.hubRequest(); assert.ok(retained); assert.equal(retained.isCurrent(), true); assert.equal(retained.canOpenPrimary(), false); assert.equal(f.hub.open(f.ticket), false);
  assert.equal(o.getSnapshot().geometryReady, true); assert.equal(o.canInteract(), false);
});
test('global menu/profile transitions replace dock markers and await fresh native ACK instead of reusing previous host height', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner, old = o.getSnapshot().target;
  assert.equal(f.hub.open(f.ticket), true); const overlay = f.hub.getSnapshot().overlay, hidden = o.getSnapshot().target;
  assert.notEqual(hidden, old); assert.equal(hidden.sizing.hostHeight, 75); assert.equal(o.getSnapshot().geometryReady, false); assert.equal(o.hubRequest(), null);
  o.bindDock({ tag: 12, nativeID: old.nativeID }, old); assert.equal(o.getSnapshot().geometryReady, false); f.bindDock(); await s.flush();
  assert.equal(o.getSnapshot().geometryReady, true); f.hub.close(overlay.id, overlay.generation); assert.equal(o.getSnapshot().target, hidden);
  const closing = f.hub.getSnapshot().overlay; f.hub.closed(closing.id, closing.generation, closing.motion); assert.notEqual(o.getSnapshot().target, hidden); assert.equal(o.getSnapshot().target.sizing.hostHeight, 199);
});
test('unavailable FAB renderer, unknown mode, and source-visible unavailable destinations hold presentation truthfully', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner; f.host(false); assert.equal(o.hostAvailable(o.hubRequest()), false); f.host(true);
  f.available(false); assert.equal(o.getSnapshot().target.primary.ready, false); f.bindDock(); await s.flush(); assert.equal(o.getSnapshot().geometryReady, true); assert.equal(o.hostAvailable(o.hubRequest()), false);
  o.source(f.ticket, null); assert.equal(o.getSnapshot().target, null); assert.equal(o.getSnapshot().native.dockHeight, null); assert.equal(o.getSnapshot().geometryReady, false);
});
test('only explicit original overlay capability may expose the ONE global overlay, independent of originating page blur', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner; f.hub.open(f.ticket); f.bindDock(); await s.flush(); f.focus(false); f.top(false);
  const request = o.hubRequest(); assert.equal(o.ownsOverlayTop(request), false); f.overlayTop(true); assert.equal(o.ownsOverlayTop(request), true); assert.equal(request.canOpenPrimary(), false);
  f.overlayTop(Promise.reject(Error('async own-top is not evidence'))); assert.equal(o.ownsOverlayTop(request), false); await s.flush();
});
test('native/owner cleanup and changed immutable callbacks fence old marker completions; Strict replay requires new generation ACKs', async t => {
  const f = s.fixture({ pending: true }); t.after(f.cleanup); const o = f.scaffoldOwner; f.viewport(); const generation = o.getSnapshot().generation; o.detach(); o.start(); o.source(f.ticket, true);
  f.settle(0); await s.flush(); assert.equal(o.getSnapshot().native, null); o.bindViewport({ tag: 11, nativeID: o.viewportID }, generation); assert.equal(f.calls.length, 1);
  f.viewport(); f.settle(1); await s.flush(); assert.ok(o.getSnapshot().target); o.commit({ ...f.props, isCurrent: () => true }); assert.equal(o.getSnapshot().retired, true); f.bindDock = () => {};
  assert.equal(o.current(), false); assert.equal(o.hubRequest(), null);
});
test('native original-window retirement and account loss cannot revive retained dock or overlay authority', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner, previous = o.hubRequest(), viewport = f.calls[0].result.initial;
  f.emit({ ...viewport, revision: 4, frame: 8, retired: true, viewport: null }); assert.equal(o.getSnapshot().retired, true); assert.equal(previous.isCurrent(), false); assert.equal(o.canInteract(), false);
  f.current(true); o.start(); assert.equal(o.getSnapshot().retired, true);
});
test('strict async and reentrant native host facts never authorize primary or overlay and stale render closures cannot adopt a new Hub state', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner, original = o.hubRequest();
  f.host(Promise.reject(Error('async host is not evidence'))); assert.equal(o.hostAvailable(original), false); assert.equal(original.canOpenPrimary(), false); await s.flush(); f.host(true);
  f.host(request => { o.hostAvailable(request); return true; }); assert.equal(o.hostAvailable(original), false); assert.equal(original.canOpenPrimary(), false); f.host(true);
  f.hub.refreshLocale(); assert.equal(original.isCurrent(), false); assert.equal(original.canOpenPrimary(), false);
});
test('immutable original host tuple cannot be retargeted by mutating a retained capability object, and captured native methods remain original', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner, captured = o.nativeHost().renderPrimary;
  f.props.hubNativeHost.renderPrimary = () => ({ type: 'ForeignReplacement', props: {} }); assert.equal(o.matches(f.props), false); assert.equal(o.nativeHost().renderPrimary, captured);
  o.commit(f.props); assert.equal(o.current(), false); assert.equal(o.getSnapshot().retired, true); assert.equal(o.hubRequest(), null);
});
test('one-level original interaction reentry rejects BOTH nested and outer commands while retaining independent read geometry', async t => {
  const f = s.fixture(); t.after(f.cleanup); await f.ready(); const o = f.scaffoldOwner; let reenter = true, nested;
  f.top(() => { if (reenter) { reenter = false; nested = o.canInteract(); } return true; }); assert.equal(o.canInteract(), false); assert.equal(nested, false);
  assert.equal(o.getSnapshot().geometryReady, true); assert.ok(o.hubRequest()); f.top(true); assert.equal(o.canInteract(), true);
});
test('ordinary replacement count/spinner updates keep native marker and measured dock lease while exposing latest presentation', async t => {
  const f = s.fixture(); t.after(f.cleanup); const first = { actual: 'selected count 1' }, second = { actual: 'selected count 2 saving' };
  f.hub.updatePrimary(f.ticket, { hasReplacement: true, replacement: first }); await f.ready(); const o = f.scaffoldOwner, old = o.getSnapshot().target, request = o.hubRequest(), calls = f.calls.length;
  assert.equal(old.primary.replacementValue, first); assert.equal(f.hub.updatePrimary(f.ticket, { hasReplacement: true, replacement: second }), true);
  const latest = o.getSnapshot().target; assert.notEqual(latest, old); assert.equal(latest.identity, old.identity); assert.equal(latest.nativeID, old.nativeID); assert.equal(latest.primary.replacementValue, second);
  assert.equal(o.getSnapshot().geometryReady, true); assert.equal(o.getSnapshot().native.dockHeight, 547 / 2.75); assert.equal(f.calls.length, calls); assert.equal(request.isCurrent(), false); assert.equal(o.hubRequest().primary.replacementValue, second);
});
test('original read projection never selects another ticket or grants focus/commands and checks membership after untrusted account callback', () => {
  let focused = false, account = true, callback = () => account;
  const hub = new s.hubDomain.AdminCreateHubController({ isCurrent: () => callback(), readiness: () => ({ ready: true, missingRoutes: [], hasPrimary: true }), actions: () => [], routeAvailable: () => true, openRoute() {}, nextFrame: () => () => {} }); hub.start();
  const ticket = hub.register({ isCurrent: () => true, isFocused: () => focused, canInteract: () => true }); assert.ok(hub.primaryFor(ticket)); assert.equal(hub.primary(), null); assert.equal(hub.open(ticket), false);
  assert.equal(hub.primaryFor({ ...ticket }), null); callback = () => { hub.unregister(ticket); return true; }; assert.equal(hub.primaryFor(ticket), null); account = false; hub.dispose();
});
