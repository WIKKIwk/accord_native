const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs');
const { compile } = require('./adminItemDetailViewsSupport.cjs');
function producer(f, changes = {}) { const generation = f.scope.getSnapshot().generation; return new s.primaryDomain.AdminSourcePrimaryRegistrationOwner({ identity: f.binding.identity, controller: f.native.hub,
  isCurrent: () => f.scope.readCurrent(generation), canInteract: () => f.scope.canInteract(generation), ...changes }, {}); }
test('only exact issued original Scope, Root binding and controller/identity owner can connect; copied/mutated witness and second owner cannot inject a ticket', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const generation = f.scope.getSnapshot().generation, original = f.registration(), ticket = original.getSnapshot();
  assert.equal(f.scope.connectPrimary({ ...original }, generation), null); assert.equal(f.owner.connectPrimary(original, { ...f.binding }), null);
  const second = producer(f); second.commitFocus(true); second.start(); assert.equal(f.scope.connectPrimary(second, generation), null); assert.equal(f.owner.connectPrimary(second, f.binding), null); second.detach();
  f.dropPrimary(); const foreign = producer(f, { identity: {} }); foreign.commitFocus(true); foreign.start(); assert.equal(f.scope.connectPrimary(foreign, generation), null); foreign.detach();
  const other = s.fixture(); t.after(other.cleanup); other.commit(); const foreignHub = producer(f, { controller: other.native.hub }); assert.equal(f.scope.connectPrimary(foreignHub, generation), null);
  assert.equal(s.primaryDomain.adminSourcePrimaryRegistrationTransport({ ...original }), null); assert.equal(f.native.hub.primaryFor(ticket), null);
});
test('captured transport projection keeps actual original ticket/subscription even if public owner methods are replaced', async t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const registration = f.registration(), ticket = registration.getSnapshot(), original = s.primaryDomain.adminSourcePrimaryRegistrationTransport(registration);
  registration.getSnapshot = () => ({ ...ticket }); registration.subscribe = () => { throw Error('foreign subscription'); }; registration.sourceWitness = () => ({ identity: {}, controller: {} });
  assert.equal(original.getSnapshot(), ticket); f.viewport(); await s.flush(); f.bindDock(); await s.flush(); assert.equal(f.owner.getSnapshot().target.primary.ticket, ticket);
  registration.update({ showPrimaryFab: false }); assert.equal(f.owner.getSnapshot().target.primary.ticket, ticket); assert.equal(f.owner.getSnapshot().target.primary.visible, false);
});
test('Scope generation suspension releases original channel immediately and old lease cleanup cannot clear a fresh real producer', async t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const oldGeneration = f.scope.getSnapshot().generation, old = f.registration(), ticket = old.getSnapshot(); f.viewport(); await s.flush(); f.bindDock(); await s.flush();
  f.owner.detach(); assert.equal(f.scope.getSnapshot().phase, 'pending'); assert.equal(f.scope.connectPrimary(old, oldGeneration), null); f.startSource(); const fresh = f.connectPrimary();
  assert.notEqual(fresh.getSnapshot(), ticket); assert.equal(f.scope.connectPrimary(old, oldGeneration), null); old.detach(); f.viewport(); await s.flush(); f.bindDock(); await s.flush(); assert.equal(f.owner.getSnapshot().target.primary.ticket, fresh.getSnapshot());
});
test('actual scope/account retirement revokes original Source target before a later producer event can retarget it', async t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const registration = f.registration(); f.viewport(); await s.flush(); f.bindDock(); await s.flush();
  f.current(false); assert.equal(f.scope.readCurrent(), false); assert.equal(f.scope.getSnapshot().phase, 'retired'); assert.equal(f.owner.getSnapshot().target, null);
  f.current(true); registration.update({ showPrimaryFab: false }); assert.equal(f.scope.readCurrent(), false); assert.equal(f.owner.getSnapshot().target, null);
});
test('actual sibling Primary hooks reject a second Scope producer BEFORE its passive start can issue an orphan global ticket', t => {
  const f = s.fixture(), r = s.runtime(); t.after(() => { r.cleanup(); f.cleanup(); }); f.commit(); f.dropPrimary(); const owners = [];
  const common = compile('useAdminCreateHubSourcePrimary.ts', { react: r.react, 'expo-router': { useIsFocused: () => true }, './AdminCreateHubProvider': { useAdminCreateHubSourceController: () => f.native.hub }, './AdminSourcePrimaryRegistrationOwner': s.primaryDomain });
  const hook = compile('useAdminSourceScenePrimary.ts', { react: r.react, '../shared/profileSessionGuard': s.guards, './AdminSourceSceneScaffoldContext': { useAdminSourceSceneScaffold: () => f.scope }, './AdminSourceSceneScaffoldOwner': s.scene,
    './useAdminCreateHubSourcePrimary': { useAdminCreateHubSourcePrimaryRegistration: props => { const value = common.useAdminCreateHubSourcePrimaryRegistration(props); owners.push(value.owner); return value; } } });
  let registrations = 0; const register = f.native.hub.register.bind(f.native.hub); f.native.hub.register = request => { registrations++; return register(request); };
  const props = { isCurrent: () => f.scope.readCurrent(), canInteract: () => f.scope.canInteract() };
  function Producer() { hook.useAdminSourceScenePrimary(props); return null; }
  r.render(r.jsx.jsxs('Fragment', { children: [r.jsx.jsx(Producer, {}, 'first'), r.jsx.jsx(Producer, {}, 'second')] }));
  assert.equal(registrations, 1); assert.ok(owners[0].getSnapshot()); assert.equal(owners[1].getSnapshot(), null); owners[1].start(); assert.equal(registrations, 1);
});
