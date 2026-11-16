/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const s = require('./adminSupplierDetailViewSupport.cjs');
const dock = s.load('admin/adminDockModel', { '../shared/appRoutes': s.routes, '../shared/localization': s.l10n });
const model = s.load('admin/adminCreateHubModel', { '../shared/camera/synchronousGuard': s.strict, './adminDockModel': dock });
const domain = s.load('admin/adminCreateHubController', { '../shared/camera/synchronousGuard': s.strict });
function fixture(t) {
  const parent = s.runtime(), page = s.runtime(), read = s.runtime(), frames = new Map(), calls = []; let activeRuntime = parent, context = null, focused = true, current = true, available = true, epoch = 1, valid = true, notify;
  let metrics = { dockBottomInset: 15 }, serial = 0; const originalRaf = global.requestAnimationFrame, originalCancel = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => { const id = ++serial; frames.set(id, callback); return id; }; global.cancelAnimationFrame = id => frames.delete(id);
  const session = { token: 'original', baseUrl: 'https://one', capabilities: ['admin.access', 'party.supplier.manage', 'catalog.item.create'], profile: { role: 'admin', ref: 'one' } }, witness = { session, generation: 1 };
  const auth = { activeSessionEpoch: () => epoch, activeSessionToken: () => session.token, isSessionWitnessCurrent: candidate => candidate === witness && valid,
    subscribeSessionWitness: callback => { notify = callback; return () => { notify = null; }; } };
  const sessionFactory = s.load('admin/adminCreateHubSession', { '../auth': auth, '../sessionReadScope': { sessionReadScope: () => 'original scope' },
    '../shared/camera/synchronousGuard': s.strict, './adminCreateHubController': domain, './adminCreateHubModel': model });
  const react = Object.fromEntries(Object.keys(parent.react).map(key => [key, (...args) => activeRuntime.react[key](...args)])); react.createContext = () => ({ Provider: 'RealHubContext.Provider' }); react.useContext = () => context;
  const provider = s.compile(path.resolve(__dirname, '../src/admin/AdminCreateHubProvider.tsx'), { react, 'expo-router': { useIsFocused: () => focused },
    'react-native': { View: 'View', StyleSheet: { create: value => value } }, '../auth': auth, '../shared/localization': s.l10n,
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, './AdminCreateHubHost': { AdminCreateHubHost: 'RealNativeRootHost' },
    './adminCreateHubModel': model, './adminCreateHubSession': sessionFactory, './useAdminShellLayout': { useAdminShellLayout: () => metrics } });
  const child = { type: 'GenuineNativeStackWithItsOriginalBackHandlers', props: {} }, props = { children: child, session, witness, isCurrent: () => true, profileOnStack: false,
    isRouteAvailable: () => available, onOpenRoute: route => calls.push(route) }, pageProps = { isCurrent: () => current, canInteract: () => focused };
  const render = () => { activeRuntime = parent; const tree = parent.render(() => provider.AdminCreateHubProvider(props)); context = tree.props.value; return tree; };
  const register = () => { activeRuntime = page; return page.render(() => provider.AdminPrimaryAction(pageProps)); };
  const readWith = callback => { activeRuntime = read; return read.render(callback); };
  t.after(() => { page.unmount(); parent.unmount(); read.unmount(); global.requestAnimationFrame = originalRaf; global.cancelAnimationFrame = originalCancel; });
  return { provider, parent, page, frames, calls, child, props, pageProps, render, register, readWith, owner: () => context,
    focus: value => { focused = value; }, pageCurrent: value => { current = value; }, available: value => { available = value; }, metrics: value => { metrics = value; },
    retire: () => { valid = false; epoch++; notify?.(); }, run: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); } };
}
test('actual provider keeps the genuine stack mounted, paints one root sibling host and exposes held default destinations without fake providers', t => {
  const f = fixture(t); f.available(false); let tree = f.render(); assert.equal(tree.type, 'RealHubContext.Provider'); assert.equal(tree.props.children.props.children[0], f.child);
  f.register(); tree = f.render(); const host = tree.props.children.props.children[1]; assert.equal(host.type, 'RealNativeRootHost'); assert.equal(host.props.primary.ready, false); assert.equal(host.props.layout.hostHeight, 199);
  const readiness = f.readWith(() => f.provider.useAdminCreateHubReadiness()); assert.equal(readiness.ready, false); assert.equal(readiness.missingRoutes.length, 5); assert.equal(readiness.hasPrimary, true);
  f.metrics({ dockBottomInset: null }); assert.equal(f.render().props.children.props.children[1].props.layout.hostHeight, null); assert.equal(f.render().props.children.props.children[0], f.child);
});
test('actual primary registration follows real focus/profile facts and source hostheight keeps menu-open state through animated closing', t => {
  const f = fixture(t); f.render(); f.register(); const owner = f.owner(), ticket = owner.controller.primary().ticket;
  assert.equal(f.readWith(() => f.provider.useAdminCreateHubHostHeight()), 199); owner.controller.open(ticket); const overlay = owner.controller.getSnapshot().overlay;
  assert.equal(f.readWith(() => f.provider.useAdminCreateHubHostHeight()), 75); owner.controller.close(overlay.id, overlay.generation); assert.equal(f.readWith(() => f.provider.useAdminCreateHubHostHeight()), 75);
  const closing = owner.controller.getSnapshot().overlay; owner.controller.closed(closing.id, closing.generation, closing.motion); assert.equal(f.readWith(() => f.provider.useAdminCreateHubHostHeight()), 199);
  f.props.profileOnStack = true; f.render(); assert.equal(f.readWith(() => f.provider.useAdminCreateHubHostHeight()), 75);
  f.props.profileOnStack = false; f.render(); f.focus(false); f.register(); assert.equal(owner.controller.primary(), null); assert.equal(owner.controller.open(ticket), false);
});
test('accepted original root command survives page unregister/focus loss, while provider replay cancels old RAF and fences native tickets', t => {
  const f = fixture(t); f.render(); f.register(); const owner = f.owner(), ticket = owner.controller.primary().ticket;
  owner.controller.open(ticket); let overlay = owner.controller.getSnapshot().overlay; owner.controller.select(overlay.id, overlay.generation, overlay.actions[0].id);
  f.focus(false); f.register(); f.pageCurrent(false); f.run(); assert.equal(f.calls.length, 1);
  const closing = owner.controller.getSnapshot().overlay; owner.controller.closed(closing.id, closing.generation, closing.motion); f.focus(true); f.pageCurrent(true); f.register();
  const latest = owner.controller.primary().ticket; owner.controller.open(latest); overlay = owner.controller.getSnapshot().overlay; owner.controller.select(overlay.id, overlay.generation, overlay.actions[0].id); assert.equal(f.frames.size, 1);
  f.parent.replay(); f.page.replay(); assert.equal(f.frames.size, 0); f.run(); assert.equal(f.calls.length, 1); assert.equal(owner.controller.open(latest), false); assert.equal(owner.controller.overlayCurrent(overlay.id, overlay.generation), false);
});
test('witness retirement removes original root overlay and cancels accepted next-frame commands without recapturing a new account', t => {
  const f = fixture(t); f.render(); f.register(); const owner = f.owner(); owner.controller.open(owner.controller.primary().ticket);
  const overlay = owner.controller.getSnapshot().overlay; owner.controller.select(overlay.id, overlay.generation, overlay.actions[0].id); f.retire(); assert.equal(f.frames.size, 0); f.run();
  assert.deepEqual(f.calls, []); assert.equal(owner.controller.getSnapshot().overlay, null); assert.equal(owner.current(), false);
});
