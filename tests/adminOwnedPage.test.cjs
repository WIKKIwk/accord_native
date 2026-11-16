const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
function fixture(kind = 'user') {
  let valid = true, ready = true, focused = true, parent = true, inner = true, innerFocus = true; const pushes = [], pending = [];
  const registry = new s.AdminOwnedRoutes({ isCurrent: () => valid, canOpen: () => true, push: id => pushes.push(id), defer: callback => pending.push(callback) }); registry.start();
  const current = () => valid, context = { current, ready: () => valid && ready, generation: 1, providers: {}, owner: { registry, rootRemoval: new s.AdminOwnedRootRemoval(current) } };
  const item = s.entry(' supplier ref '), ticket = { item, routeName: s.model.adminUserDetailRoute(item) }, target = kind === 'user' ? { kind, ticket } : { kind };
  const result = registry.open(target, { isCurrent: () => parent, canInteract: () => true }), id = pushes[0], route = s.owned(id), native = s.native(s.stack([s.home, s.users, route]));
  const runtime = s.runtime(), authority = s.load('admin/useAdminPageAuthority', { react: runtime.react, '../shared/camera/synchronousGuard': s.strict });
  let params = { id }, renderedRoute = route, prevent;
  const hook = s.load('admin/useAdminOwnedPage', { react: runtime.react,
    'expo-router': { useNavigation: () => native.navigation, useRoute: () => renderedRoute, useLocalSearchParams: () => params, useIsFocused: () => focused,
      usePreventRemove: (enabled, callback) => { prevent = { enabled, callback }; } },
    './adminOwnedRemoval': { AdminOwnedRemoval: s.AdminOwnedRemoval }, './AdminOwnedNavigationContext': { useAdminOwnedNavigation: () => context }, './useAdminPageAuthority': authority });
  const render = () => runtime.render(() => hook.useAdminOwnedPage()), settle = () => { let value; for (let count = 0; count < 4; count++) value = render(); return value; };
  const lifetime = { isCurrent: () => inner, canInteract: () => innerFocus };
  return { runtime, registry, context, native, route, id, ticket, result, pushes, lifetime, render, settle, get prevent() { return prevent; }, flush: () => pending.splice(0).forEach(fn => fn()),
    valid: value => { valid = value; }, ready: value => { ready = value; }, focus: value => { focused = value; }, parent: value => { parent = value; },
    params: value => { params = value; }, routeProp: value => { renderedRoute = value; }, inner: value => { inner = value; }, innerFocus: value => { innerFocus = value; } };
}
test('actual owned hook gates genuine descendants until native attachment and real source PopScope is registered only for user detail', () => {
  const f = fixture(), first = f.render(); assert.equal(first.admitted, false); const admitted = f.settle();
  assert.equal(admitted.admitted, true); assert.equal(admitted.entry.target.ticket.item, f.ticket.item); assert.equal(f.prevent.enabled, true); assert.equal(typeof admitted.registerBack, 'function');
  const profile = fixture('profile'); profile.settle(); assert.equal(profile.prevent.enabled, false); profile.runtime.unmount(); f.runtime.unmount();
});
test('actual native back calls the current detail model; accepted changed result waits for genuine last detach', async () => {
  const f = fixture(), page = f.settle(); let backs = 0, settled = false; f.result.then(() => { settled = true; });
  page.registerBack(() => { backs++; page.back(true); }); f.native.navigation.dispatch = action => {
    if (f.prevent.enabled) f.prevent.callback({ data: { action }, repeat: () => { f.native.setState(s.stack([s.home, s.users])); } });
  };
  f.prevent.callback({ data: { action: { type: 'GO_BACK' } }, repeat: () => assert.fail('generic Back must not repeat') });
  assert.equal(backs, 1); await s.tick(); assert.equal(settled, false); assert.equal(page.current(), false);
  f.runtime.unmount(); f.flush(); assert.equal(await f.result, true);
});
test('accepted async back uses original native key through blur and never acquires authority over a newer queued page', async () => {
  const f = fixture(), page = f.settle(); f.focus(false); f.native.setState(s.stack([s.home, s.users, f.route, s.newer])); f.render();
  assert.equal(page.current(), true); assert.equal(page.interactive(), false); page.back(true);
  assert.equal(f.native.applied.length, 1); assert.equal(f.native.applied[0].source, f.route.key); assert.deepEqual(f.native.state.routes.map(route => route.key), [s.home.key, s.users.key, s.newer.key]);
  f.runtime.unmount(); f.flush(); assert.equal(await f.result, true);
});
test('StrictMode native attachment reconnect preserves pending result while original view callbacks stay retired', async () => {
  const f = fixture(), old = f.settle(); let settled = false; f.result.then(() => { settled = true; }); f.runtime.replay(); f.flush(); await s.tick();
  assert.equal(settled, false); const fresh = f.settle(); assert.equal(fresh.current(), true); assert.equal(old.current(), false); old.back(true); await old.open({ kind: 'profile' }); assert.equal(f.native.actions.length, 0); assert.equal(f.pushes.length, 1);
  fresh.back(true); f.runtime.unmount(); f.flush(); assert.equal(await f.result, true);
});
test('mutated URL/native key/account/readiness cannot retarget original owned arguments or retained callbacks', async () => {
  for (const change of ['params', 'native-id', 'route-key', 'stack-key', 'account', 'readiness']) {
    const f = fixture(), page = f.settle();
    if (change === 'params') f.params({ id: 'other' }); if (change === 'route-key') f.routeProp({ ...f.route, key: 'other' });
    if (change === 'native-id') f.native.setState(s.stack([s.home, s.users, { ...f.route, params: { id: 'other' } }]));
    if (change === 'stack-key') f.native.setState({ ...f.native.state, key: 'other-stack' }); if (change === 'account') f.valid(false); if (change === 'readiness') f.ready(false);
    f.render(); page.back(true); await page.open({ kind: 'profile' }); assert.equal(f.native.actions.length, 0, change); assert.equal(f.pushes.length, 1, change);
    f.runtime.unmount(); f.flush(); assert.equal(await f.result, false);
  }
});
function usersFixture() {
  const f = fixture('profile'); f.native.setState(s.stack([s.home, s.users])); f.routeProp(s.users);
  const r = s.runtime(), authority = s.load('admin/useAdminPageAuthority', { react: r.react, '../shared/camera/synchronousGuard': s.strict }), replacements = [];
  let focused = true;
  const usersOpen = s.load('admin/useAdminUsersOwnedOpen', { react: r.react, '../shared/camera/synchronousGuard': s.strict,
    './AdminOwnedNavigationContext': { useAdminOwnedNavigation: () => f.context } });
  const hook = s.load('admin/useAdminUsersPage', { react: r.react, '../shared/camera/synchronousGuard': s.strict,
    'expo-router': { useNavigation: () => f.native.navigation, useRoute: () => s.users, useIsFocused: () => focused, router: { replace: path => replacements.push(path) } },
    'react-native': { Platform: { OS: 'ios' } }, './AdminOwnedNavigationContext': { useAdminOwnedNavigation: () => f.context }, './useAdminPageAuthority': authority, './useAdminUsersOwnedOpen': usersOpen });
  const render = () => r.render(() => hook.useAdminUsersPage()); render();
  return { ...f, r, render, replacements, focus: value => { focused = value; } };
}
test('Users host passes original inner controller authority to real owned detail and background return survives parent blur', async () => {
  const f = usersFixture(), page = f.render(), result = page.openUser(f.ticket, f.lifetime), id = f.pushes.at(-1), entry = f.registry.get(id);
  assert.equal(entry.target.ticket.item, f.ticket.item); f.focus(false); f.render(); assert.equal(entry.isCurrent(), true); assert.equal(page.current(), true); assert.equal(page.interactive(), false);
  f.inner(false); assert.equal(f.registry.get(id), null); assert.equal(await result, false); f.r.unmount(); f.registry.dispose();
});
test('Users host rejects stale controller lifetime and queued new top route before opening, profiling or Back', async () => {
  const f = usersFixture(), page = f.render(), before = f.pushes.length; f.innerFocus(false); assert.equal(await page.openUser(f.ticket, f.lifetime), false);
  f.innerFocus(true); f.native.setState(s.stack([s.home, s.users, s.newer])); page.back(); page.openProfile(); assert.equal(await page.openUser(f.ticket, f.lifetime), false);
  assert.equal(f.pushes.length, before); assert.equal(f.native.actions.length, 0); assert.deepEqual(f.replacements, []); f.r.unmount(); f.registry.dispose();
});
test('Users host StrictMode replay retires old handlers; fresh Back targets original stack/key once', () => {
  const f = usersFixture(), old = f.render(); f.r.replay(); const fresh = f.render(); old.back(); old.openProfile(); assert.equal(f.native.actions.length, 0);
  fresh.back(); fresh.back(); assert.deepEqual(f.native.applied, [{ type: 'POP', payload: { count: 1 }, source: s.users.key, target: 'original-stack' }]); f.r.unmount(); f.registry.dispose();
});
