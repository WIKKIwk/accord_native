const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminOwnedNavigationSupport.cjs');
function fixture({ sdk = false } = {}) {
  let valid = true, interactive = true, parentFocus = true;
  const pushes = [], pending = [], registry = new s.AdminOwnedRoutes({ isCurrent: () => valid, canOpen: () => true, push: id => pushes.push(id), defer: fn => pending.push(fn) }); registry.start();
  const item = s.entry(' raw supplier '), ticket = { item, routeName: s.model.adminUserDetailRoute(item) }, result = registry.open({ kind: 'user', ticket }, { isCurrent: () => valid, canInteract: () => parentFocus });
  const id = pushes[0], route = s.owned(id), detach = registry.mount(id, route.key), entry = registry.get(id), native = s.native(s.stack([s.home, s.users, route]));
  const root = new s.AdminOwnedRootRemoval(() => valid), hooks = { canInteract: () => interactive && entry.canInteract(), pop: (navigation, changed) => registry.pop(id, route.key, navigation, changed) },
    deps = { id, routeKey: route.key, navigatorKey: native.state.key, isCurrent: () => valid && entry.isCurrent(),
      canInteract: () => hooks.canInteract(), navigation: native.navigation, rootRemoval: root, pop: (navigation, changed) => hooks.pop(navigation, changed) };
  const owner = new s.AdminOwnedRemoval(deps); owner.activate(); const prevention = sdk ? s.sdkPrevention(native, owner) : null;
  return { registry, owner, root, deps, hooks, native, prevention, route, id, result, detach, flush: () => pending.splice(0).forEach(fn => fn()),
    valid: value => { valid = value; }, interactive: value => { interactive = value; }, parentFocus: value => { parentFocus = value; } };
}
test('installed SDK generic back invokes the real source handler, repeats only the exact accepted POP, and awaits native detach', async () => {
  const f = fixture({ sdk: true }); let modelBacks = 0, settled = false; f.result.then(() => { settled = true; });
  f.owner.register(() => { modelBacks++; f.owner.pop(true); });
  const generic = { type: 'GO_BACK' }; f.native.navigation.dispatch(generic);
  assert.equal(modelBacks, 1); assert.equal(f.native.applied.length, 1); const [actual] = f.native.applied;
  assert.deepEqual(actual, { type: 'POP', payload: { count: 1 }, source: f.route.key, target: 'original-stack' });
  assert.equal(f.native.actions[1], actual); assert.equal(f.native.actions[2], actual); assert.notEqual(actual, generic);
  assert.deepEqual(f.native.state.routes.map(route => route.key), [s.home.key, s.users.key]);
  await s.tick(); assert.equal(settled, false); f.prevention.render(); f.detach(); f.flush(); assert.equal(await f.result, true); f.prevention.unmount();
});
test('an accepted async result survives parent blur and a queued newer route; real router removes only original source and retains preloads', async () => {
  const f = fixture({ sdk: true }), preload = s.owned('preload'); let first = true;
  f.parentFocus(false); f.native.navigation.beforeDispatch = action => { if (first && action.type === 'POP') { first = false; f.native.setState(s.stack([s.home, s.users, f.route, s.newer], [preload])); } };
  assert.equal(f.owner.pop(true), true); assert.equal(f.native.applied.length, 1);
  assert.deepEqual(f.native.state.routes.map(route => route.key), [s.home.key, s.users.key, s.newer.key, preload.key]); assert.equal(f.native.state.index, 2);
  f.detach(); f.flush(); assert.equal(await f.result, true); f.prevention.render(); f.prevention.unmount();
});
test('malformed or unrelated native actions cannot consume source Back or acquire a repeat permit', () => {
  for (const action of [{ type: 'RESET' }, { type: 'POP', payload: { count: 2 } }, { type: 'GO_BACK', source: 'newer-key' },
    { type: 'GO_BACK', target: 'other-stack' }, { type: 'POP_TO', payload: { name: 'users' } }]) {
    const f = fixture(); let backs = 0, repeats = 0; f.owner.register(() => backs++);
    assert.equal(f.owner.blocked(action, () => repeats++), false); assert.equal(backs, 0); assert.equal(repeats, 0); assert.equal(f.owner.getSnapshot().permitRemove, false);
  }
});
test('generic back is denied under a newer native page, stale id/stack/key, preloading, or failed interaction guard', () => {
  for (const state of ['newer', 'id', 'stack', 'key', 'preload', 'interaction']) {
    const f = fixture(); let backs = 0; f.owner.register(() => backs++);
    if (state === 'newer') f.native.setState(s.stack([s.home, f.route, s.newer]));
    if (state === 'id') f.native.setState(s.stack([s.home, { ...f.route, params: { id: 'other' } }]));
    if (state === 'stack') f.native.setState({ ...f.native.state, key: 'other-stack' });
    if (state === 'key') f.native.setState(s.stack([s.home, { ...f.route, key: 'other' }]));
    if (state === 'preload') f.native.setState(s.stack([s.home], [f.route]));
    if (state === 'interaction') f.interactive(false);
    assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => assert.fail('unaccepted repeat')), false); assert.equal(backs, 0);
  }
});
test('native registration cleanup never clears a later model and StrictMode replay invalidates old actions', () => {
  const f = fixture(), before = f.owner.getSnapshot().generation; let old = 0, fresh = 0;
  const cleanup = f.owner.register(() => old++); f.owner.register(() => fresh++); cleanup();
  assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => {}), true); assert.equal(old, 0); assert.equal(fresh, 1);
  f.owner.detach(); f.owner.activate(); f.owner.register(() => fresh++);
  assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => {}, before), false); assert.equal(f.owner.pop(true, before), false);
  assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => {}), true); assert.equal(fresh, 2); assert.equal(f.native.actions.length, 0);
});
test('accepted decision publishes its fence before listeners and never repeats after observer retirement', () => {
  const f = fixture(); let repeats = 0; f.native.navigation.dispatch = action => {
    f.owner.subscribe(() => { if (f.owner.getSnapshot().permitRemove) f.owner.detach(); });
    assert.equal(f.owner.blocked(action, () => repeats++), false);
  };
  f.owner.pop(true); assert.equal(repeats, 0); assert.equal(f.owner.getSnapshot().active, false);
});
test('throwing observers cannot consume accepted decision, duplicate native events repeat once, and reentrant Back is blocked', () => {
  const f = fixture(); let repeats = 0, backs = 0; f.owner.subscribe(() => { throw new Error('observer'); });
  f.owner.register(() => { backs++; assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => {}), false); f.owner.pop(true); });
  f.native.navigation.dispatch = action => { assert.equal(f.owner.blocked(action, () => repeats++), true); assert.equal(f.owner.blocked(action, () => repeats++), false); };
  assert.equal(f.owner.blocked({ type: 'GO_BACK' }, () => assert.fail('generic repeat')), true); assert.equal(backs, 1); assert.equal(repeats, 1);
});
test('interaction callbacks that retire the original owner cannot issue a registry decision', () => {
  const f = fixture(); let pops = 0; f.hooks.pop = () => { pops++; return true; }; f.hooks.canInteract = () => { f.owner.detach(); return true; };
  assert.equal(f.owner.pop(true), false); assert.equal(pops, 0); assert.equal(f.native.actions.length, 0);
});
test('source dock release accepts only its captured root action and only original descendants once', () => {
  const f = fixture(), actions = []; f.native.navigation.dispatch = action => actions.push(action);
  assert.equal(f.root.dispatch('users', f.native.navigation, { routeKey: f.route.key, navigatorKey: 'original-stack' }), true); const action = actions[0];
  assert.deepEqual(action, { type: 'POP_TO', payload: { name: 'users' }, source: f.route.key, target: 'original-stack' });
  assert.equal(f.root.accept({ ...action, target: 'other' }, f.route.key, 'original-stack', f.native.navigation), false);
  assert.equal(f.root.accept(action, s.users.key, 'original-stack', f.native.navigation), false);
  assert.equal(f.root.accept(action, f.route.key, 'original-stack', f.native.navigation), true); assert.equal(f.root.accept(action, f.route.key, 'original-stack', f.native.navigation), false);
});
test('dock ancestor release repeats actual POP_TO without invoking changed Back; user result stays false', async () => {
  const f = fixture({ sdk: true }); f.owner.register(() => assert.fail('dock must not invoke changed Back'));
  assert.equal(f.root.dispatch('users', f.native.navigation, { routeKey: f.route.key, navigatorKey: 'original-stack' }), true);
  assert.deepEqual(f.native.state.routes.map(route => route.key), [s.home.key, s.users.key]);
  f.detach(); f.flush(); assert.equal(await f.result, false); f.prevention.render(); f.prevention.unmount();
});
test('queued successor, changed prefix, retired root and old native binding cannot reuse a root removal permit', () => {
  for (const change of ['newer', 'prefix', 'account', 'clear']) {
    const f = fixture(), actions = []; f.native.navigation.dispatch = action => actions.push(action);
    assert.equal(f.root.dispatch('users', f.native.navigation, { routeKey: f.route.key, navigatorKey: 'original-stack' }), true);
    if (change === 'newer') f.native.setState(s.stack([s.home, s.users, f.route, s.newer]));
    if (change === 'prefix') f.native.setState(s.stack([{ ...s.home, key: 'replaced' }, s.users, f.route]));
    if (change === 'account') f.valid(false); if (change === 'clear') f.root.clear();
    assert.equal(f.root.accept(actions[0], f.route.key, 'original-stack', f.native.navigation), false);
  }
  const f = fixture(); assert.equal(f.root.dispatch('users', f.native.navigation, { routeKey: 'old-key', navigatorKey: 'original-stack' }), false); assert.equal(f.native.actions.length, 0);
});
