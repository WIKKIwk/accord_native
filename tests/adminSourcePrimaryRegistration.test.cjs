/* global __dirname */
const assert = require('node:assert/strict'), path = require('node:path'), test = require('node:test');
const s = require('./adminSourceDockScaffoldSupport.cjs');
const guards = s.load('shared/profileSessionGuard');
const domain = s.load('admin/AdminSourcePrimaryRegistrationOwner', { '../shared/camera/synchronousGuard': s.strict, '../shared/profileSessionGuard': guards });
function fixture(t) {
  let valid = true, focused = true, top = true, account = () => true; const calls = [], frames = [], r = s.views.runtime();
  const hub = new s.hubDomain.AdminCreateHubController({ isCurrent: () => account(), readiness: () => ({ ready: true, missingRoutes: [], hasPrimary: true }),
    actions: () => [], routeAvailable: () => true, openRoute() {}, nextFrame: callback => { frames.push(callback); return () => {}; } }); hub.start();
  const props = { identity: {}, isCurrent: () => valid, canInteract: () => top }, exports = s.views.compile(path.resolve(__dirname, '../src/admin/useAdminCreateHubSourcePrimary.ts'), {
    react: r.react, 'expo-router': { useIsFocused: () => focused }, './AdminCreateHubProvider': { useAdminCreateHubSourceController: () => hub }, './AdminSourcePrimaryRegistrationOwner': domain });
  const render = () => r.render(() => exports.useAdminCreateHubSourcePrimary(props));
  t.after(() => { r.unmount(); hub.dispose(); }); return { hub, props, r, calls, frames, render, focus: value => { focused = value; }, top: value => { top = value; }, valid: value => { valid = value; }, account: value => { account = value; } };
}
test('genuine source registration returns no fabricated precommit ticket and retains SAME exact ticket through real page blur', t => {
  const f = fixture(t); assert.equal(f.render(), null); const ticket = f.render(); assert.ok(ticket); assert.equal(f.hub.primaryFor(ticket).ticket, ticket);
  f.focus(false); f.top(false); assert.equal(f.render(), ticket); assert.equal(f.hub.primary(), null); assert.equal(f.hub.primaryFor(ticket).ticket, ticket); assert.equal(f.hub.open(ticket), false);
  f.focus(true); f.top(true); assert.equal(f.render(), ticket); assert.equal(f.hub.open(ticket), true);
});
test('presentation rebuild updates Source custom actions and replacement while accepted overlay keeps original callbacks/arguments', t => {
  const f = fixture(t), old = { id: 'same', label: 'Original', icon: {}, onPress: () => f.calls.push('original') }, next = { ...old, label: 'Later', onPress: () => f.calls.push('later') };
  f.props.actions = [old]; f.render(); const ticket = f.render(); assert.equal(f.hub.open(ticket), true); const overlay = f.hub.getSnapshot().overlay;
  f.props.actions = [next]; assert.equal(f.render(), ticket); assert.equal(f.hub.getSnapshot().overlay, overlay); assert.equal(overlay.actions[0].label, 'Original');
  assert.equal(f.hub.select(overlay.id, overlay.generation, 'same'), true); f.frames.shift()(); assert.deepEqual(f.calls, ['original']);
  const replacement = { type: 'ActualMoveSelectionCountSpinnerFixture', props: { count: 2, saving: true } }; f.props.replacement = replacement; assert.equal(f.render(), ticket);
  assert.equal(f.hub.primaryFor(ticket).replacementValue, replacement); assert.equal(f.hub.open(ticket), false);
  delete f.props.replacement; f.render(); assert.equal(f.hub.open(ticket), true); assert.equal(f.hub.getSnapshot().overlay.actions[0].label, 'Later');
});
test('original command/read guard or identity replacement retires registration instead of retargeting retained callbacks', t => {
  const f = fixture(t); f.render(); const ticket = f.render(); f.props.canInteract = () => true; assert.equal(f.render(), null); assert.equal(f.hub.primaryFor(ticket), null); assert.equal(f.hub.open(ticket), false);
  const original = f.props.isCurrent; f.props.isCurrent = () => true; f.render(); f.props.isCurrent = original; assert.equal(f.render(), null);
});
test('Strict replay issues a fresh actual ticket and revokes old native intent while one global accepted overlay persists', t => {
  const f = fixture(t); f.props.actions = [{ id: 'old', label: 'Old', icon: {}, onPress: () => f.calls.push('accepted') }]; f.render(); const old = f.render(); f.hub.open(old); const overlay = f.hub.getSnapshot().overlay;
  f.r.replay(); const fresh = f.render(); assert.ok(fresh); assert.notEqual(fresh, old); assert.equal(f.hub.primaryFor(old), null); assert.equal(f.hub.open(old), false); assert.equal(f.hub.getSnapshot().overlay, overlay);
  f.hub.select(overlay.id, overlay.generation, 'old'); f.frames.shift()(); assert.deepEqual(f.calls, ['accepted']);
});
test('actual page retirement cannot revive original registration even if a later same-object guard returns true', t => {
  const f = fixture(t); f.render(); const ticket = f.render(); f.valid(false); assert.equal(f.hub.primaryFor(ticket), null); f.valid(true); assert.equal(f.hub.primaryFor(ticket), null); assert.equal(f.render(), null);
});
test('same Source presentation does not publish a rebuild loop; copied or unregistered ticket never updates another registration', t => {
  const f = fixture(t); f.render(); const ticket = f.render(), before = f.hub.getSnapshot(); f.render(); assert.equal(f.hub.getSnapshot(), before);
  assert.equal(f.hub.updatePrimary({ ...ticket }, { showPrimaryFab: false }), false); assert.equal(f.hub.getSnapshot(), before); f.hub.unregister(ticket); assert.equal(f.hub.updatePrimary(ticket, { showPrimaryFab: false }), false);
});
test('presentation getters/guards that throw, reenter or unregister fail without publishing new primary data', t => {
  const f = fixture(t); f.render(); const ticket = f.render(), before = f.hub.getSnapshot();
  assert.equal(f.hub.updatePrimary(ticket, { get actions() { throw Error('bad source presentation'); } }), false); assert.equal(f.hub.getSnapshot(), before);
  assert.equal(f.hub.updatePrimary(ticket, { get actions() { f.hub.updatePrimary(ticket, {}); return []; } }), false); assert.equal(f.hub.getSnapshot(), before);
  let once = true; f.account(() => { if (once) { once = false; f.hub.unregister(ticket); } return true; }); assert.equal(f.hub.updatePrimary(ticket, { showPrimaryFab: false }), false); assert.equal(f.hub.primaryFor(ticket), null);
});
test('passive source registration waits for genuine parent Hub layout start after child layout; an inactive parent never produces a ticket', t => {
  const r = s.views.runtime(), passive = [], hub = new s.hubDomain.AdminCreateHubController({ isCurrent: () => true,
    readiness: () => ({ ready: true, missingRoutes: [], hasPrimary: true }), actions: () => [], routeAvailable: () => true, openRoute() {}, nextFrame: () => () => {} });
  const react = { ...r.react, useEffect: (callback, deps) => r.react.useEffect(() => { let stop; passive.push(() => { stop = callback(); }); return () => stop?.(); }, deps) };
  const exports = s.views.compile(path.resolve(__dirname, '../src/admin/useAdminCreateHubSourcePrimary.ts'), { react, 'expo-router': { useIsFocused: () => true },
    './AdminCreateHubProvider': { useAdminCreateHubSourceController: () => hub }, './AdminSourcePrimaryRegistrationOwner': domain });
  const props = { identity: {}, isCurrent: () => true, canInteract: () => true }, render = () => r.render(() => exports.useAdminCreateHubSourcePrimary(props));
  assert.equal(render(), null); assert.equal(hub.primary(), null); assert.equal(passive.length, 1); hub.start(); passive.shift()(); const ticket = render(); assert.ok(ticket); assert.equal(hub.primaryFor(ticket).ticket, ticket);
  t.after(() => { r.unmount(); hub.dispose(); });
});
test('late genuine global Hub start retries real registration only after its valid lifecycle publication', t => {
  const hub = new s.hubDomain.AdminCreateHubController({ isCurrent: () => true, readiness: () => ({ ready: true, missingRoutes: [], hasPrimary: true }), actions: () => [], routeAvailable: () => true, openRoute() {}, nextFrame: () => () => {} });
  const owner = new domain.AdminSourcePrimaryRegistrationOwner({ identity: {}, controller: hub, isCurrent: () => true, canInteract: () => true }, {}); owner.commitFocus(true); owner.start(); assert.equal(owner.getSnapshot(), null);
  hub.start(); assert.ok(owner.getSnapshot()); assert.equal(hub.primaryFor(owner.getSnapshot()).ticket, owner.getSnapshot()); t.after(() => { owner.detach(); hub.dispose(); });
});
test('one-level original command guard reentry rejects both calls independently of global Hub trigger checks', t => {
  const f = fixture(t); let once = true, nested, owner;
  owner = new domain.AdminSourcePrimaryRegistrationOwner({ identity: {}, controller: f.hub, isCurrent: () => true,
    canInteract: () => { if (once) { once = false; nested = owner.canInteract(); } return true; } }, {}); owner.commitFocus(true); owner.start();
  assert.equal(owner.canInteract(), false); assert.equal(nested, false); assert.equal(owner.canInteract(), true); t.after(owner.detach);
});
test('registration captures a frozen custom action tuple and ordinary explicit new-array rebuild updates only future overlays', t => {
  const f = fixture(t), action = { id: 'captured', label: 'Original', icon: {}, onPress: () => f.calls.push('original') }; f.props.actions = [action]; f.render(); const ticket = f.render();
  action.label = 'Mutated'; action.onPress = () => f.calls.push('mutated'); assert.equal(f.hub.open(ticket), true); const overlay = f.hub.getSnapshot().overlay; assert.equal(overlay.actions[0].label, 'Original');
  f.hub.select(overlay.id, overlay.generation, 'captured'); f.frames.shift()(); assert.deepEqual(f.calls, ['original']); f.props.actions = [action]; f.render(); f.hub.open(ticket); assert.equal(f.hub.getSnapshot().overlay.actions[0].label, 'Mutated');
});
test('Source update rechecks actual membership after retained request getters on BOTH changed and no-op presentation paths', t => {
  const f = fixture(t);
  for (const changed of [false, true]) {
    let ticket, retire = false;
    const request = { isCurrent: () => true, isFocused: () => true, canInteract: () => true,
      get replacement() { if (retire) f.hub.unregister(ticket); return null; } };
    ticket = f.hub.register(request); retire = true; const before = f.hub.getSnapshot().version;
    assert.equal(f.hub.updatePrimary(ticket, { replacement: null, showPrimaryFab: changed ? false : undefined }), false);
    assert.equal(f.hub.getSnapshot().version, before + 1); assert.equal(f.hub.primaryFor(ticket), null);
  }
});
