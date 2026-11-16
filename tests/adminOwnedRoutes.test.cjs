const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const test = require('node:test');
const { load, model, routes, tick } = require('./adminUsersSupport.cjs');
const sync = load('shared/camera/synchronousGuard');
const { AdminOwnedRoutes } = load('admin/adminOwnedRoutes', { '../shared/appRoutes': routes, '../shared/camera/synchronousGuard': sync, './adminUsersModel': model });
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter');
const { extendRouter } = require('../node_modules/expo-router/build/react-navigation/routers/extendRouter');
const { RouterActionHandling } = require('../node_modules/expo-router/build/react-navigation/routers/types');
const overridePath = require.resolve('../node_modules/expo-router/build/layouts/stack-router');
const overrideModule = new Module(overridePath, module); overrideModule.filename = overridePath; overrideModule.paths = module.paths;
const originalRequire = overrideModule.require.bind(overrideModule);
overrideModule.require = id => id === '../react-navigation/native' ? { StackRouter, extendRouter, RouterActionHandling } : originalRequire(id);
overrideModule._compile(fs.readFileSync(overridePath, 'utf8'), overridePath);
const { stackRouterOverride } = overrideModule.exports;
const home = { key: 'home-key', name: 'home' }, newer = { key: 'newer-key', name: 'profile' }, preload = { key: 'preload-key', name: 'owned/[id]', params: { id: 'preloaded' } };
const owned = (id, routeKey = `owned-${id}`) => ({ key: routeKey, name: 'owned/[id]', params: { id } });
const stack = (active, preloaded = []) => ({ type: 'stack', key: 'stack-key', routeKeySeq: 5, stale: false, index: active.length - 1, routeNames: ['home', 'owned/[id]', 'profile'], routes: [...active, ...preloaded] });
const options = { routeNames: ['home', 'owned/[id]', 'profile'], routeGetIdList: {} };
function navigation(initial, beforeDispatch = state => state) {
  const router = stackRouterOverride(StackRouter({})); let state = initial; const actions = [];
  return { getState: () => state, dispatch(action) { actions.push(action); state = beforeDispatch(state); const result = router.getStateForAction(state, action, options); if (result?.state) state = result.state; },
    actions, get current() { return state; } };
}
const user = (kind = 'supplier') => model.adminUserListEntryFromJson({ id: ` Original ${kind} `, name: ' Original name ', principal_role: kind === 'worker' ? 'aparatchi' : kind, source: kind });
const target = (item = user()) => ({ kind: 'user', ticket: { routeName: model.adminUserDetailRoute(item), item } });
function fixture() {
  let account = true, parentCurrent = true, focused = true, allowed = true;
  const pushes = [], deferred = [], calls = [], reads = { account: () => account, parent: () => parentCurrent, interact: () => focused, allowed: () => allowed }, hooks = { push: () => {} };
  const deps = { isCurrent: () => reads.account(), canOpen: route => { calls.push(route); return reads.allowed(route); }, push: id => { pushes.push(id); hooks.push(id); }, defer: fn => deferred.push(fn) };
  const owner = new AdminOwnedRoutes(deps), parent = { isCurrent: () => reads.parent(), canInteract: () => reads.interact() }; owner.start();
  const open = (...args) => { const value = args.length ? args[0] : target(), givenParent = args.length > 1 ? args[1] : parent;
    const result = owner.open(value, givenParent), id = pushes.at(-1); let settled = false, changed; result.then(value => { settled = true; changed = value; }); return { result, id, get settled() { return settled; }, get changed() { return changed; } }; };
  const flush = () => { deferred.splice(0).forEach(fn => fn()); };
  return { owner, parent, deps, pushes, deferred, calls, reads, hooks, open, flush, account: value => { account = value; }, parentCurrent: value => { parentCurrent = value; }, focus: value => { focused = value; }, allowed: value => { allowed = value; } };
}
test('source argument containers are immutable snapshots while the original user entry identity is preserved', async () => {
  const f = fixture(), item = user(), value = target(item), request = f.open(value), captured = f.owner.get(request.id);
  assert.notEqual(captured.target, value); assert.notEqual(captured.target.ticket, value.ticket); assert.equal(captured.target.ticket.item, item); assert.ok(Object.isFrozen(captured.target)); assert.ok(Object.isFrozen(captured.target.ticket));
  value.kind = 'profile'; value.ticket.item = user('customer'); value.ticket.routeName = '/wrong'; f.parent.isCurrent = () => false;
  assert.equal(captured.target.kind, 'user'); assert.equal(captured.target.ticket.item, item); assert.equal(captured.isCurrent(), true);
  const cleanup = f.owner.mount(request.id, 'native'); cleanup(); f.flush(); assert.equal(await request.result, false);
});
test('all source user branches retain exact arguments and only user details can return changed true', async () => {
  for (const kind of ['worker', 'werka', 'customer', 'supplier', 'material_taminotchi', 'qolipchi']) {
    const f = fixture(), item = user(kind), request = f.open(target(item)), entry = f.owner.get(request.id), route = owned(request.id);
    assert.equal(entry.routeName, model.adminUserDetailRoute(item)); assert.equal(entry.target.ticket.item, item); const detach = f.owner.mount(request.id, route.key);
    assert.equal(f.owner.pop(request.id, route.key, navigation(stack([home, route])), true), true); detach(); f.flush(); assert.equal(await request.result, true);
  }
  const item = user('worker');
  for (const value of [{ kind: 'supplier-items', mode: 'view', supplierRef: ' Supplier ' }, { kind: 'supplier-items', mode: 'add', supplierRef: 'Supplier' }, { kind: 'worker-profile', entry: item }, { kind: 'profile' }]) {
    const f = fixture(), request = f.open(value), entry = f.owner.get(request.id), route = owned(request.id); const detach = f.owner.mount(request.id, route.key);
    if (value.kind === 'worker-profile') assert.equal(entry.target.entry, item);
    if (value.kind === 'supplier-items') assert.equal(entry.target.supplierRef, value.supplierRef);
    if (value.kind === 'profile') assert.equal(entry.routeName, routes.appRoutes.profile);
    assert.equal(f.owner.pop(request.id, route.key, navigation(stack([home, route])), true), true); detach(); f.flush(); assert.equal(await request.result, false);
  }
});
test('opening requires a synchronous focused event, but a mounted child keeps reads and result authority through parent blur', async () => {
  const f = fixture(); f.focus(false); assert.equal(await f.open().result, false); assert.deepEqual(f.pushes, []); f.focus(true);
  const request = f.open(), route = owned(request.id), entry = f.owner.get(request.id); assert.equal(entry.canInteract(), false); const detach = f.owner.mount(request.id, route.key);
  f.focus(false); assert.equal(entry.isCurrent(), true); assert.equal(entry.canInteract(), true); const nav = navigation(stack([home, route])); assert.equal(f.owner.pop(request.id, route.key, nav, true), true);
  assert.equal(entry.isCurrent(), true); assert.equal(entry.canInteract(), false); await tick(); assert.equal(request.settled, false); detach(); f.flush(); assert.equal(await request.result, true); assert.equal(entry.isCurrent(), false);
});
test('real Expo router POP removes the original lower owned page and retains newer routes and preloads', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id), detach = f.owner.mount(request.id, route.key), nav = navigation(stack([home, route, newer], [preload]));
  assert.equal(f.owner.pop(request.id, route.key, nav, true), true); assert.deepEqual(nav.actions, [{ type: 'POP', payload: { count: 1 }, source: route.key, target: 'stack-key' }]);
  assert.deepEqual(nav.current.routes.map(row => row.key), [home.key, newer.key, preload.key]); assert.equal(nav.current.index, 1); await tick(); assert.equal(request.settled, false);
  detach(); f.flush(); assert.equal(await request.result, true);
});
test('queued source retirement, source preloading and replaced target never pop a successor; native completion remains separate', async () => {
  const cases = [(_state, route) => stack([home, newer]), (_state, route) => stack([home, newer], [route]), (_state, route) => ({ ...stack([home, route, newer]), key: 'replacement-stack' }),
    (_state, route) => stack([home, { ...route, key: 'replacement-source' }, newer])];
  for (const change of cases) {
    const f = fixture(), request = f.open(), route = owned(request.id), detach = f.owner.mount(request.id, route.key), nav = navigation(stack([home, route, newer]), state => change(state, route));
    assert.equal(f.owner.pop(request.id, route.key, nav, true), true); assert.ok(nav.current.routes.some(row => row.key === newer.key)); await tick(); assert.equal(request.settled, false, 'dispatch success cannot assert native removal');
    detach(); f.flush(); assert.equal(await request.result, true);
  }
});
test('a newly queued successor survives source-target POP and a still-mounted no-op cannot settle the result', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id), detach = f.owner.mount(request.id, route.key), nav = navigation(stack([home, route]), () => stack([home, route, newer]));
  assert.equal(f.owner.pop(request.id, route.key, nav, true), true); assert.deepEqual(nav.current.routes.map(row => row.key), [home.key, newer.key]); await tick(); assert.equal(request.settled, false); detach(); f.flush(); await request.result;
  const g = fixture(), pending = g.open(), page = owned(pending.id), clean = g.owner.mount(pending.id, page.key);
  assert.equal(g.owner.pop(pending.id, page.key, { getState: () => stack([home, page]), dispatch() {} }, true), true); await tick(); assert.equal(pending.settled, false); assert.equal(g.owner.get(pending.id).canInteract(), false); clean(); g.flush(); assert.equal(await pending.result, true);
});
test('StrictMode detach/reconnect keeps the same native key and settles only after the genuine last attachment is gone', async () => {
  const f = fixture(), request = f.open(), entry = f.owner.get(request.id), first = f.owner.mount(request.id, 'native'); first(); first();
  assert.equal(entry.canInteract(), false); const second = f.owner.mount(request.id, 'native'); assert.equal(entry.canInteract(), true); assert.equal(f.owner.mount(request.id, 'replacement'), null);
  f.flush(); await tick(); assert.equal(request.settled, false); const third = f.owner.mount(request.id, 'native'); second(); f.flush(); assert.equal(request.settled, false); third(); f.flush(); assert.equal(await request.result, false); assert.equal(f.owner.get(request.id), null);
});
test('stale native cleanup and false decisions cannot alter another page or a later true result decision', async () => {
  const f = fixture(), first = f.open(), route = owned(first.id), clean = f.owner.mount(first.id, route.key), nav = navigation(stack([home, route]));
  assert.equal(f.owner.pop(first.id, route.key, nav, true), true); assert.equal(f.owner.pop(first.id, route.key, nav, false), false); clean(); f.flush(); assert.equal(await first.result, true);
  const second = f.open(), page = owned(second.id), clean2 = f.owner.mount(second.id, page.key); clean(); f.flush(); assert.ok(f.owner.get(second.id)); assert.equal(f.owner.pop(first.id, route.key, navigation(stack([home, page])), true), false); clean2(); f.flush(); await second.result;
});
test('malformed runtime targets and parents fail without push or thrown errors', async () => {
  const f = fixture(), good = target();
  for (const value of [null, undefined, 1, [], {}, { kind: 'unknown' }, { kind: 'user' }, { kind: 'user', ticket: null }, { kind: 'user', ticket: { ...good.ticket, routeName: '/other' } },
    { kind: 'user', ticket: { routeName: good.ticket.routeName, item: { ...good.ticket.item, kind: 'unknown' } } }, { kind: 'worker-profile', entry: null }, { kind: 'supplier-items', mode: 'bad', supplierRef: 'A' },
    { kind: 'user', ticket: { routeName: good.ticket.routeName, item: { ...good.ticket.item, principal_role: 'unknown' } } },
    { kind: 'supplier-items', mode: 'add', supplierRef: 4 }, { kind: 'supplier-items', mode: 'add', supplierRef: ' ' }, Object.defineProperty({}, 'kind', { get() { throw Error('invalid'); } })]) assert.equal(await f.open(value).result, false);
  for (const parent of [null, undefined, [], {}, { isCurrent: true, canInteract() { return true; } }, Object.defineProperty({}, 'isCurrent', { get() { throw Error('invalid'); } })]) assert.equal(await f.open(good, parent).result, false);
  assert.deepEqual(f.pushes, []);
});
test('malformed native IDs/keys/states, root/preload routes and nonmatching names/params never dispatch', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id);
  for (const bad of [undefined, null, '', ' ', 1, [], {}]) { assert.equal(f.owner.get(bad), null); assert.equal(f.owner.mount(bad, route.key), null); assert.equal(f.owner.mount(request.id, bad), null); assert.equal(f.owner.pop(bad, route.key, {}), false); assert.equal(f.owner.pop(request.id, bad, {}), false); }
  const detach = f.owner.mount(request.id, route.key);
  for (const state of [undefined, null, { ...stack([home, route]), key: 5 }, { ...stack([home, route]), key: '' }, { ...stack([home, route]), type: 'tab' }, { ...stack([home, route]), index: -1 }, { ...stack([home, route]), index: 99 },
    { ...stack([home, route]), index: .5 }, stack([route]), stack([home], [route]), stack([home, { ...route, name: 'other' }]), stack([home, { ...route, params: { id: ['wrong'] } }]), stack([home, { ...route, params: [] }]),
    stack([home, { ...route, params: Object.create({ id: request.id }) }]), stack([home, route, { ...route }]), { ...stack([home, route]), routes: [null, route] }]) {
    const actions = []; assert.equal(f.owner.pop(request.id, route.key, { getState: () => state, dispatch: value => actions.push(value) }, true), false); assert.deepEqual(actions, []);
  }
  assert.equal(f.owner.pop(request.id, route.key, { getState() { throw Error('gone'); } }, true), false); detach(); f.flush(); await request.result;
});
test('dispatch failure resets the original decision; a later successful pop can decide its result', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id), detach = f.owner.mount(request.id, route.key), entry = f.owner.get(request.id);
  assert.equal(f.owner.pop(request.id, route.key, { getState: () => stack([home, route]), dispatch() { throw Error('unmounted'); } }, true), false); assert.equal(entry.canInteract(), true);
  assert.equal(f.owner.pop(request.id, route.key, navigation(stack([home, route])), false), true); detach(); f.flush(); assert.equal(await request.result, false);
});
test('invalid parent/permission observation settles pending results false and can never revive them', async () => {
  for (const key of ['parent', 'allowed']) {
    const f = fixture(), request = f.open(), entry = f.owner.get(request.id), detach = f.owner.mount(request.id, 'native'); f.reads[key] = () => false;
    assert.equal(f.owner.get(request.id), null); assert.equal(await request.result, false); f.reads[key] = () => true; assert.equal(entry.isCurrent(), false); assert.equal(f.owner.mount(request.id, 'native'), null); detach(); f.flush(); assert.equal(request.changed, false);
  }
});
test('account retirement disposes every result and remains sticky across start; ordinary dispose permits fresh owners only', async () => {
  const f = fixture(), first = f.open(), second = f.open(); f.account(false); assert.equal(f.owner.get(first.id), null); assert.equal(await first.result, false); assert.equal(await second.result, false); f.account(true); f.owner.start(); assert.equal(await f.open().result, false);
  const g = fixture(), old = g.open(), stale = g.owner.get(old.id); g.owner.dispose(); g.owner.start(); assert.equal(await old.result, false); assert.equal(stale.isCurrent(), false); const fresh = g.open(); assert.ok(g.owner.get(fresh.id)); g.owner.dispose(); assert.equal(await fresh.result, false);
});
test('async rejected authorization callbacks never authorize or produce unhandled rejections', async () => {
  for (const field of ['account', 'parent', 'interact', 'allowed']) { const f = fixture(); f.reads[field] = () => Promise.reject(Error('async')); assert.equal(await f.open().result, false); assert.deepEqual(f.pushes, []); }
  const f = fixture(), request = f.open(); f.reads.parent = () => Promise.reject(Error('async mounted')); assert.equal(f.owner.get(request.id), null); assert.equal(await request.result, false); await tick();
});
test('open captures its original generation through target/parent/permission callbacks and prevents reentrant pushes', async () => {
  for (const field of ['parent', 'interact', 'allowed']) {
    const f = fixture(); f.reads[field] = () => { f.owner.dispose(); f.owner.start(); return true; }; assert.equal(await f.open().result, false); assert.deepEqual(f.pushes, []);
  }
  const f = fixture(); let nested; f.hooks.push = () => { nested = f.open().result; }; const request = f.open(); assert.equal(await nested, false); assert.equal(f.pushes.length, 1); f.owner.dispose(); assert.equal(await request.result, false);
  const g = fixture(); g.hooks.push = () => { throw Error('push failed'); }; const failed = g.open(); assert.equal(await failed.result, false); assert.equal(g.owner.get(failed.id), null);
});
test('reentrant current checks, get disposal and mount observers cannot strand or admit retired entries', async () => {
  const f = fixture(), request = f.open(); f.reads.parent = () => { f.owner.get(request.id); return true; }; assert.equal(f.owner.get(request.id), null); assert.equal(await request.result, false);
  const g = fixture(), pending = g.open(); g.reads.parent = () => { g.owner.dispose(); g.owner.start(); return true; }; assert.equal(g.owner.get(pending.id), null); assert.equal(await pending.result, false);
  const h = fixture(), mounted = h.open(), unsubscribe = h.owner.subscribe(() => h.owner.dispose()); assert.equal(h.owner.mount(mounted.id, 'native'), null); unsubscribe(); assert.equal(await mounted.result, false);
});
test('finish rechecks exact entry after current callbacks dispose/restart and cannot overwrite the false result', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id), detach = f.owner.mount(request.id, route.key); assert.equal(f.owner.pop(request.id, route.key, navigation(stack([home, route])), true), true);
  let fresh, version; f.reads.parent = () => { f.owner.dispose(); f.owner.start(); f.reads.parent = () => true; fresh = f.open(); version = f.owner.getSnapshot(); return true; };
  detach(); f.flush(); assert.equal(await request.result, false); assert.equal(f.owner.get(request.id), null); assert.equal(f.owner.getSnapshot(), version); assert.ok(f.owner.get(fresh.id)); f.owner.dispose(); assert.equal(await fresh.result, false);
});
test('throwing observers and deferred schedulers cannot prevent completion of removed original routes', async () => {
  const f = fixture(), request = f.open(), detach = f.owner.mount(request.id, 'native'); f.owner.subscribe(() => { throw Error('observer'); }); detach(); f.flush(); assert.equal(await request.result, false);
  let id; const owner = new AdminOwnedRoutes({ isCurrent: () => true, canOpen: () => true, push(value) { id = value; }, defer() { throw Error('scheduler'); } }); owner.start();
  const result = owner.open(target(), { isCurrent: () => true, canInteract: () => true }), remove = owner.mount(id, 'native'); remove(); await tick(); assert.equal(await result, false); assert.equal(owner.get(id), null);
});
test('constructor authority functions are captured and target access cannot migrate an old event into a restarted owner', async () => {
  const f = fixture(); f.deps.isCurrent = () => true; f.account(false); assert.equal(await f.open().result, false);
  const g = fixture(), bad = Object.defineProperty({}, 'kind', { get() { g.owner.dispose(); g.owner.start(); return 'profile'; } }); assert.equal(await g.open(bad).result, false); assert.deepEqual(g.pushes, []);
});
test('reentrant dispatch rejects a second decision and a throwing push cannot preserve an earlier true decision', async () => {
  const f = fixture(), request = f.open(), route = owned(request.id), remove = f.owner.mount(request.id, route.key); let second;
  const nav = { getState: () => stack([home, route]), dispatch() { second = f.owner.pop(request.id, route.key, nav, false); } };
  assert.equal(f.owner.pop(request.id, route.key, nav, true), true); assert.equal(second, false); remove(); f.flush(); assert.equal(await request.result, true);
  const g = fixture(); let detach; g.hooks.push = id => { const page = owned(id); detach = g.owner.mount(id, page.key); g.owner.pop(id, page.key, navigation(stack([home, page])), true); throw Error('push failed after dispatch'); };
  const failed = g.open(); assert.equal(await failed.result, false); detach(); g.flush(); assert.equal(g.owner.get(failed.id), null);
});
test('native interaction rechecks membership after callbacks and opening loses focus only after its original push', async () => {
  const f = fixture(), request = f.open(), entry = f.owner.get(request.id), remove = f.owner.mount(request.id, 'native'); f.reads.parent = () => { remove(); return true; };
  assert.equal(entry.isCurrent(), true); assert.equal(entry.canInteract(), false); f.flush(); assert.equal(await request.result, false);
  const g = fixture(); g.reads.allowed = () => { g.focus(false); return true; }; assert.equal(await g.open().result, false); assert.deepEqual(g.pushes, []);
  const h = fixture(); h.hooks.push = () => h.focus(false); const opened = h.open(); assert.ok(h.owner.get(opened.id)); h.owner.dispose(); assert.equal(await opened.result, false);
  const i = fixture(); i.hooks.push = () => i.parentCurrent(false); const abandoned = i.open(); assert.equal(await abandoned.result, false); assert.equal(i.owner.get(abandoned.id), null);
});
test('nested owned child authority traverses the real original parent entry without treating legitimate reads as reentrancy', async () => {
  const f = fixture(), item = user('worker'), parent = f.open(target(item)), parentRoute = owned(parent.id), detachParent = f.owner.mount(parent.id, parentRoute.key), parentEntry = f.owner.get(parent.id);
  let parentFocused = true; const child = f.open({ kind: 'worker-profile', entry: item }, { isCurrent: parentEntry.isCurrent, canInteract: () => parentFocused }), childRoute = owned(child.id), detachChild = f.owner.mount(child.id, childRoute.key), childEntry = f.owner.get(child.id);
  parentFocused = false; assert.equal(childEntry.isCurrent(), true); assert.equal(parentEntry.isCurrent(), true);
  const nav = navigation(stack([home, parentRoute, childRoute])); assert.equal(f.owner.pop(child.id, childRoute.key, nav), true); detachChild(); f.flush(); assert.equal(await child.result, false); assert.equal(parentEntry.isCurrent(), true);
  assert.equal(f.owner.pop(parent.id, parentRoute.key, nav, true), true); detachParent(); f.flush(); assert.equal(await parent.result, true);
  const g = fixture(), issuer = g.open(), removeIssuer = g.owner.mount(issuer.id, 'issuer'), original = g.owner.get(issuer.id), nested = g.open({ kind: 'profile' }, { isCurrent: original.isCurrent, canInteract: () => true }), removeNested = g.owner.mount(nested.id, 'nested');
  removeIssuer(); g.flush(); assert.equal(await issuer.result, false); assert.equal(g.owner.get(nested.id), null); assert.equal(await nested.result, false); removeNested(); g.flush();
});
