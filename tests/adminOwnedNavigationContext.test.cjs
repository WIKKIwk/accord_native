/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
function fixture(platform = 'ios') {
  const runtime = s.runtime(), session = { token: 'real', baseUrl: 'https://original.example', profile: { role: 'admin', ref: 'ADMIN' }, capabilities: ['admin.access'] }, witness = { session }, pushes = [], listeners = new Set();
  let valid = true, providers, consumer = null;
  const auth = { activeSessionEpoch: () => 2, activeSessionToken: () => session.token, isSessionWitnessCurrent: value => value === witness && valid,
    subscribeSessionWitness: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
  const classes = s.load('admin/adminOwnedNavigationSession', { '../auth': auth, '../sessionReadScope': s.load('sessionReadScope'),
    '../shared/appRoutes': { canOpenRoute: () => true }, '../shared/camera/synchronousGuard': s.strict,
    './adminOwnedRoutes': { AdminOwnedRoutes: s.AdminOwnedRoutes }, './adminOwnedRemoval': { AdminOwnedRootRemoval: s.AdminOwnedRootRemoval }, './adminShellAccess': { adminShellMayEnter: () => true } });
  const shell = { session, witness, isCurrent: () => valid }, react = { ...runtime.react, createContext: value => ({ Provider: 'Context.Provider', value }), useContext: () => consumer };
  const component = s.compile(path.resolve(__dirname, '../src/admin/AdminOwnedNavigationContext.tsx'), { react, 'react-native': { Platform: { OS: platform } },
    'expo-router': { router: { push: url => pushes.push(url) } }, '../auth': auth, '../shared/camera/synchronousGuard': s.strict,
    './adminOwnedNavigationSession': classes, './AdminShellContext': { useAdminShell: () => shell } });
  const render = () => runtime.render(() => component.AdminOwnedNavigationProvider({ providers, children: 'real-shell' }));
  return { runtime, session, witness, pushes, component, render, providers: value => { providers = value; }, consumer: value => { consumer = value; },
    retire() { valid = false; for (const listener of [...listeners]) listener(); }, get listeners() { return listeners.size; } };
}
test('real provider has no default primary/chat callbacks and never admits held private pages', async () => {
  const f = fixture(), before = f.render(); assert.equal(before.props.children, null); const tree = f.render(), context = tree.props.value;
  assert.equal(tree.props.children, 'real-shell'); assert.equal(context.current(), true); assert.equal(context.providers, null); assert.equal(context.ready(), false);
  assert.equal(await context.owner.registry.open({ kind: 'profile' }, { isCurrent: () => true, canInteract: () => true }), false); assert.deepEqual(f.pushes, []);
  assert.throws(() => f.component.useAdminOwnedNavigation(), /unavailable/); f.consumer(context); assert.equal(f.component.useAdminOwnedNavigation(), context); f.runtime.unmount();
});
for (const platform of ['android', 'ios']) test(`${platform} real provider pushes only opaque owned id while original DTO and witness remain in memory`, async () => {
  const f = fixture(platform); f.providers({ primaryAvailable: () => true, renderPrimaryAction: () => ({ type: 'RealPrimaryRegistration', props: {} }) }); f.render(); const context = f.render().props.value;
  const item = s.entry(' Private Ref ', 'Private Name'), ticket = { item, routeName: s.model.adminUserDetailRoute(item) };
  const result = context.owner.registry.open({ kind: 'user', ticket }, { isCurrent: context.current, canInteract: () => true });
  assert.match(f.pushes[0], new RegExp(`^/${platform}-admin/owned/[0-9]+$`)); assert.equal(f.pushes[0].includes('Private'), false);
  const id = f.pushes[0].split('/').at(-1); assert.equal(context.owner.registry.get(id).target.ticket.item, item); assert.equal(context.owner.current(), true);
  f.runtime.unmount(); assert.equal(await result, false);
});
test('real provider replay retires captured context callbacks and account witness notification scrubs actual private entries', async () => {
  const f = fixture(); f.providers({ primaryAvailable: () => true, renderPrimaryAction: () => ({ type: 'RealPrimaryRegistration' }) }); f.render(); const old = f.render().props.value;
  const pending = old.owner.registry.open({ kind: 'profile' }, { isCurrent: old.current, canInteract: () => true }); f.runtime.replay(); assert.equal(await pending, false);
  const fresh = f.render().props.value; assert.equal(old.current(), false); assert.equal(fresh.current(), true); assert.equal(f.listeners, 1);
  const latest = fresh.owner.registry.open({ kind: 'profile' }, { isCurrent: fresh.current, canInteract: () => true }); f.retire(); assert.equal(await latest, false); assert.equal(f.render().props.children, null); f.runtime.unmount(); assert.equal(f.listeners, 0);
});
