const test = require('node:test'), assert = require('node:assert/strict');
const s = require('./adminRootRouterSupport.cjs');

test('actual SDK stack PUSH waits for real descriptor binding and native readiness; no membership fallback', async () => {
  const f = s.fixture('android'); assert.equal(f.open(), null); f.rootReady(); const page = f.open(); assert.ok(page); assert.equal(f.owner.mayMount(page.native), false);
  assert.equal(f.actions[0].type, 'PUSH'); assert.deepEqual(f.actions[0].payload, { name: 'owned/[id]', params: { id: page.id } }); assert.equal(f.actions[0].source, 'actual-home-key');
  const binding = f.bind(page), detach = f.owner.attachScene(binding); assert.equal(f.owner.canInteract(binding), false); const win = f.native(page.native); win.shown(); assert.equal(f.owner.canInteract(binding), false); win.armed(); assert.equal(f.owner.canInteract(binding), true);
  f.owner.requestBack(binding); assert.deepEqual(f.backs, ['page']); detach(); f.owner.dispose(); f.rootStop(); await s.flush();
});
test('dual close waits actual native removal, exact source POP, route commit absence AND actual scene detach', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), detach = f.owner.attachScene(binding), win = f.shown(page);
  let result; page.closed.then(value => { result = value; }); assert.equal(f.owner.closePage(page), page.closed); assert.equal(f.owner.canInteract(binding), false); await s.flush(); assert.equal(result, undefined); assert.equal(f.actions.length, 1);
  assert.equal(win.removed(), true); await s.flush(); assert.equal(result, undefined); assert.deepEqual(f.actions.at(-1), { type: 'POP', payload: { count: 1 }, source: binding.routeKey, target: binding.navigatorKey });
  f.commit(); await s.flush(); assert.equal(result, undefined); detach(); await s.flush(); assert.equal(await page.closed, 'closed'); f.owner.dispose();
});
test('actual scene detach/StrictMode replay never acknowledges native removal', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page); let detach = f.owner.attachScene(binding); f.shown(page);
  detach(); detach = f.owner.attachScene(binding); await s.flush(); assert.equal(f.owner.canInteract(binding), true); let result; page.closed.then(value => { result = value; }); detach(); await s.flush(); assert.equal(result, undefined); assert.equal(f.owner.canInteract(binding), false); f.owner.cancel(page); assert.equal(await page.closed, 'retired'); f.owner.dispose();
});
test('genuine renderer StrictMode reconnect preserves original actual route/window and stale detach is idempotent', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), sceneStop = f.owner.attachScene(binding); f.shown(page);
  f.detachRenderer(); const stop = f.owner.attachRenderer(f.render); await s.flush(); assert.equal(f.owner.readCurrent(binding), true); assert.equal(f.owner.canInteract(binding), true); f.detachRenderer(); await s.flush(); assert.equal(f.owner.readCurrent(binding), true);
  sceneStop(); stop(); await s.flush(); assert.equal(await page.closed, 'retired'); assert.equal(f.owner.rootScene(), null);
});
test('late source POP preserves a newer actual route using installed Expo reducer, not focused back', async () => {
  const f = s.fixture(); f.rootReady(); const a = f.open(), aBinding = f.bind(a), detachA = f.owner.attachScene(aBinding), nativeA = f.shown(a);
  f.owner.closePage(a); const newer = { key: 'queued-successor', name: 'owned/[id]', params: { id: 'another-original-page' } };
  f.beforeDispatch((state, action) => action.type === 'POP' ? { ...state, routes: [...state.routes.slice(0, state.index + 1), newer], index: state.index + 1 } : state);
  nativeA.removed(); await s.flush(); assert.deepEqual(f.state().routes.map(route => route.key), ['actual-home-key', 'queued-successor']); f.commit(); detachA(); await s.flush(); assert.equal(await a.closed, 'closed'); f.owner.dispose();
});
test('source retirement/target stack replacement before queued POP never pops a successor or returns success', async () => {
  for (const kind of ['missing', 'replacement', 'preload']) {
    const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), stop = f.owner.attachScene(binding), win = f.shown(page); f.owner.closePage(page);
    const old = f.state(), successor = { key: 'survivor', name: 'owned/[id]', params: { id: 'survivor' } };
    f.beforeDispatch((state, action) => action.type !== 'POP' ? state : kind === 'missing' ? { ...state, routes: [state.routes[0], successor], index: 1 }
      : kind === 'replacement' ? { ...state, key: 'new-stack', routes: [state.routes[0], successor], index: 1 } : { ...state, routes: [state.routes[0], successor, old.routes[1]], index: 1 });
    win.removed(); await s.flush(); assert.ok(f.state().routes.some(route => route.key === 'survivor')); f.commit(); stop(); f.owner.dispose(); assert.equal(await page.closed, 'retired');
  }
});
test('real route replaced with same opaque URL can never adopt an original native window or reader', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page); f.owner.attachScene(binding); f.shown(page);
  f.stateTo({ ...f.state(), routes: [f.state().routes[0], { ...f.state().routes[1], key: 'replacement-key' }] }); f.commit(); assert.equal(await page.closed, 'retired'); assert.equal(f.owner.readCurrent(binding), false); assert.equal(f.owner.mayMount(page.native), true); // Only the retained original inert shell may be removed.
  f.owner.dispose();
});
test('preloaded/ambiguous/malformed descriptors never acquire page scenes or native-ready authority', async () => {
  for (const kind of ['preload', 'duplicate', 'descriptor', 'params']) {
    const f = s.fixture(); f.rootReady(); const page = f.open(), current = f.state();
    if (kind === 'preload') f.stateTo({ ...current, index: 0 });
    if (kind === 'duplicate') f.stateTo({ ...current, routes: [...current.routes, { ...current.routes[1], key: 'duplicate' }], index: 2 });
    if (kind === 'params') f.stateTo({ ...current, routes: [current.routes[0], { ...current.routes[1], params: { id: [page.id] } }] });
    const frame = f.frame(); if (kind === 'descriptor') frame.descriptors[current.routes[1].key] = { render() { throw Error('must not render'); }, options: {} };
    f.owner.commitFrame(frame); assert.equal(f.owner.binding(page), null); assert.equal(f.owner.mayMount(page.native), false); f.owner.dispose(); assert.equal(await page.closed, 'retired');
  }
});
test('live descriptor/header updates retain exact immutable binding and original route instance', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), first = f.owner.scene(binding); const frame = f.frame(); frame.descriptors[binding.routeKey].options.title = 'actual changed header'; f.owner.commitFrame(frame);
  const next = f.owner.scene(binding); assert.equal(next.binding, binding); assert.notEqual(next.descriptor, first.descriptor); assert.equal(next.descriptor, frame.descriptors[binding.routeKey]); assert.equal(next.descriptor.options.title, 'actual changed header'); f.owner.dispose(); assert.equal(await page.closed, 'retired');
});
test('original account retirement while native closes cancels all results and prevents actual POP', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), stop = f.owner.attachScene(binding), win = f.shown(page); f.owner.closePage(page); f.account(false); win.removed(); await s.flush(); assert.equal(await page.closed, 'retired'); assert.equal(f.actions.length, 1); stop(); f.owner.dispose();
});
test('PUSH failure/reentrant account retirement do not leave an unmounted pending page or invented result', async () => {
  const f = s.fixture(); f.rootReady(); f.throwDispatch(true); assert.equal(f.open(), null); assert.equal(f.chain.getSnapshot().entries.length, 0); f.owner.dispose();
  const g = s.fixture(); g.rootReady(); g.owner.subscribe(() => { if (g.chain.getSnapshot().entries.length) g.account(false); }); assert.equal(g.open(), null); assert.equal(g.chain.getSnapshot().entries.length, 0); assert.equal(g.actions.length, 0); g.owner.dispose();
});
test('new ordered pages use actual current top while original read authority survives genuine blur', async () => {
  const f = s.fixture(); f.rootReady(); const a = f.open(), bindingA = f.bind(a), stopA = f.owner.attachScene(bindingA); f.shown(a); const b = f.open(), bindingB = f.bind(b), stopB = f.owner.attachScene(bindingB); f.shown(b);
  assert.equal(f.owner.readCurrent(bindingA), true); assert.equal(f.owner.canInteract(bindingA), false); assert.equal(f.owner.canInteract(bindingB), true); f.owner.requestBack(bindingA); assert.deepEqual(f.backs, []);
  f.owner.closePage(b); const identity = f.chain.nativeCurrent(b.native); assert.equal(identity, true); stopB(); stopA(); f.owner.dispose(); assert.equal(await a.closed, 'retired'); assert.equal(await b.closed, 'retired');
});
test('actual navigator mutation before React commit suppresses original read/back without inventing focused context', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page); f.owner.attachScene(binding); f.shown(page); const before = f.state();
  f.stateTo({ ...before, routes: [...before.routes, { key: 'other-real-key', name: 'owned/[id]', params: { id: 'other' } }], index: 2 });
  assert.equal(f.owner.readCurrent(binding), true); assert.equal(f.owner.canInteract(binding), false); f.owner.requestBack(binding); assert.deepEqual(f.backs, []);
  f.stateTo({ ...f.state(), routes: [before.routes[0], f.state().routes[2]], index: 1 }); assert.equal(f.owner.readCurrent(binding), false); f.owner.dispose(); assert.equal(await page.closed, 'retired');
});
test('accepted POP request with no actual removal cannot manufacture native+logical success', async () => {
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page), stop = f.owner.attachScene(binding), win = f.shown(page); let result; page.closed.then(value => { result = value; });
  f.beforeDispatch((state, action) => action.type === 'POP' ? { ...state, key: 'retired-target-before-dispatch' } : state); f.owner.closePage(page); win.removed(); await s.flush(); stop(); await s.flush(); assert.equal(result, undefined);
  f.commit(); assert.equal(await page.closed, 'retired'); f.owner.dispose();
});
test('Root ready in another window/constructor cannot replace actual original descriptor-body membership', async () => {
  const f = s.fixture('ios', { attachBase: false }); f.rootReady(); assert.equal(f.chain.getSnapshot().rootReady, true); assert.equal(f.open(), null);
  const stop = f.owner.attachScene(f.owner.rootScene().binding); assert.ok(f.open()); stop(); assert.equal(f.open(), null); f.owner.dispose();
});
test('malformed live stack/index and reflected binding cannot authorize PUSH, read or native Back', async () => {
  for (const change of [{ index: undefined }, { index: -1 }, { index: 100 }, { routes: null }, { key: 42 }]) {
    const f = s.fixture(); f.rootReady(); f.stateTo({ ...f.state(), ...change }); assert.equal(f.open(), null); assert.equal(f.actions.length, 0); f.owner.dispose();
  }
  const f = s.fixture(); f.rootReady(); const page = f.open(), binding = f.bind(page); f.owner.attachScene(binding); f.shown(page);
  for (const value of [null, undefined, {}, { ...binding }, new Proxy(binding, {})]) { assert.equal(f.owner.scene(value), null); assert.equal(f.owner.readCurrent(value), false); assert.equal(f.owner.canInteract(value), false); f.owner.requestBack(value); }
  assert.deepEqual(f.backs, []); f.owner.dispose(); assert.equal(await page.closed, 'retired');
});
test('Source selector identity is never reused and native route URL contains only its new opaque id', () => {
  const f = s.fixture(); f.rootReady(); const identity = { privateSourceFixture: 'never-in-url' }, page = f.open({ identity }); assert.equal(page.sourceIdentity, identity);
  assert.equal(JSON.stringify(f.actions).includes('never-in-url'), false); assert.equal(f.open({ identity }), null); f.owner.dispose();
});
test('original Root/page Source container and explicit ancestor are required before opening actual windows/routes', () => {
  for (const rootOptions of [{ renderSceneContainer: undefined }, { sourceScaffoldAncestor: undefined }]) assert.throws(() => s.fixture('ios', { rootOptions }), TypeError);
  const f = s.fixture(); f.rootReady(); for (const input of [{ renderSceneContainer: undefined }, { sourceScaffoldAncestor: undefined }, { sourceScaffoldAncestor: [] }]) assert.equal(f.open(input), null);
  assert.equal(f.actions.length, 0); f.owner.dispose();
});
test('original container/Source ancestor are shallow-captured per identity and never retarget to later callback replacements', () => {
  const f = s.fixture(), rootOriginal = f.owner.container(f.owner.rootScene().binding); f.rootOptions.renderSceneContainer = () => { throw Error('replacement Root'); }; f.rootOptions.sourceScaffoldAncestor = {};
  assert.equal(f.owner.container(f.owner.rootScene().binding).render, rootOriginal.render); assert.equal(f.owner.container(f.owner.rootScene().binding).sourceScaffoldAncestor, null);
  f.rootReady(); const ancestor = {}, original = props => ({ type: 'ActualOriginalSourceWrapperFixture', props }), request = { identity: {}, parent: f.chain.top(), routeName: 'owned/[id]', presentation: s.presentation, isCurrent: () => true, onRequestClose: () => f.backs.push('actual'), sourceScaffoldAncestor: ancestor, renderSceneContainer: original };
  const page = f.owner.openPage(request), binding = f.bind(page); request.renderSceneContainer = () => { throw Error('replacement page'); }; request.sourceScaffoldAncestor = {};
  assert.equal(f.owner.container(binding).render, original); assert.equal(f.owner.container(binding).sourceScaffoldAncestor, ancestor); f.owner.dispose();
});
test('Source/account retirement retains immutable original descriptor/container/native mapping until genuine resource release', async () => {
  const f = s.fixture('ios'); f.rootReady(); const page = f.open(), binding = f.bind(page), native = f.shown(page), root = f.owner.resourceRootScene();
  const scene = f.owner.resourceScene(binding), container = f.owner.container(binding), actions = f.actions.length;
  f.account(false); assert.equal(f.owner.current(), false); assert.equal(await page.closed, 'retired');
  assert.equal(f.owner.rootScene(), null); assert.equal(f.owner.scene(binding), null); assert.equal(f.owner.readCurrent(binding), false); assert.equal(f.owner.hasScene(binding), false);
  assert.equal(f.owner.resourceRootScene(), root); assert.equal(f.owner.resourceScene(binding), scene); assert.equal(f.owner.container(binding).render, container.render); assert.equal(f.owner.nativeParent(binding), page.native);
  assert.equal(f.owner.canInteract(binding), false); f.owner.requestBack(binding); assert.equal(f.actions.length, actions);
  assert.equal(f.chain.nativeResourceRemoved(page.native, native.identity), true); assert.equal(f.owner.resourceScene(binding), null); assert.equal(f.owner.nativeParent(binding), null);
  assert.equal(f.chain.nativeResourceRemoved(f.chain.root, f.rootNative), true); assert.equal(f.owner.resourceRootScene(), null); assert.equal(await page.closed, 'retired');
});
test('Router split epochs synchronously publish real scene/member facts and forward original chain authority/resource changes', () => {
  const f = s.fixture('ios', { attachBase: false }), binding = f.owner.rootScene().binding; let source = 0, resource = 0;
  f.owner.subscribeSource(() => source++); f.owner.subscribeResource(() => resource++);
  const originalSource = f.owner.sourceStamp(), originalResource = f.owner.resourceStamp(), stop = f.owner.attachScene(binding);
  assert.equal(f.owner.sourceStamp(), originalSource); assert.notEqual(f.owner.resourceStamp(), originalResource); assert.equal(source, 0); assert.equal(resource, 1);
  const attached = f.owner.resourceStamp(); stop(); assert.notEqual(f.owner.resourceStamp(), attached); assert.equal(resource, 2);
  f.rootReady(); assert.equal(source, 0); const detach = f.owner.attachScene(binding), beforeOpen = f.owner.sourceStamp(); const page = f.open(); assert.ok(page); assert.notEqual(f.owner.sourceStamp(), beforeOpen);
  const sourceBeforeRetire = f.owner.sourceStamp(), resourceBeforeRetire = f.owner.resourceStamp(); f.chain.retire();
  assert.notEqual(f.owner.sourceStamp(), sourceBeforeRetire); assert.notEqual(f.owner.resourceStamp(), resourceBeforeRetire); detach(); f.owner.dispose();
});
test('original Source lifetime survives transient renderer/scene absence while actual admission and commands remain held', async () => {
  const f = s.fixture('ios'); f.rootReady(); const page = f.open(), binding = f.bind(page), root = f.owner.rootScene().binding;
  const stop = f.owner.attachScene(binding); f.detachRenderer(); stop(); f.stopBaseScene();
  assert.equal(f.owner.sourceCurrent(root), true); assert.equal(f.owner.sourceCurrent(binding), true); assert.equal(f.owner.hasScene(binding), false); assert.equal(f.owner.readCurrent(binding), false);
  assert.equal(f.owner.sourceCurrent({ ...binding }), false); const render = f.owner.attachRenderer(f.render), scene = f.owner.attachScene(binding);
  assert.equal(f.owner.sourceCurrent(binding), true); assert.equal(f.owner.hasScene(binding), true); scene(); render(); f.account(false);
  assert.equal(f.owner.sourceCurrent(binding), false); assert.equal(f.owner.sourceCurrent(root), false); await s.flush(); assert.equal(await page.closed, 'retired');
});
test('final original Source lifetime checks reject actual retirement inside captured request or navigation callbacks', () => {
  const f = s.fixture('ios'); f.rootReady(); let retire = false, page;
  page = f.open({ isCurrent: () => { if (retire) f.chain.cancel(page.native); return true; } }); const binding = f.bind(page); retire = true;
  assert.equal(f.owner.sourceCurrent(binding), false); assert.equal(f.chain.sourceOutcome(page.native), 'retired'); f.owner.dispose();
  const g = s.fixture('ios'), root = g.owner.rootScene().binding, state = g.navigation.getState(); g.navigation.getState = () => { g.owner.dispose(); return state; };
  assert.equal(g.owner.sourceCurrent(root), false);
});
test('native-close phase publishes Source epoch/lifetime rejection even when original POP is a no-op and emits no frame', async () => {
  const f = s.fixture('ios'); f.rootReady(); const page = f.open(), binding = f.bind(page), stop = f.owner.attachScene(binding), native = f.shown(page); let result;
  page.closed.then(value => { result = value; }); f.navigation.dispatch = action => { f.actions.push(action); }; f.owner.closePage(page); const observed = [];
  f.owner.subscribeSource(() => observed.push(f.owner.sourceCurrent(binding))); native.removed(); const beforePhase = f.owner.sourceStamp(); await s.flush();
  assert.notEqual(f.owner.sourceStamp(), beforePhase); assert.equal(observed.includes(false), true); assert.equal(f.owner.sourceCurrent(binding), false);
  assert.equal(f.state().routes.some(route => route.key === binding.routeKey), true); assert.equal(result, undefined); stop(); f.owner.dispose(); assert.equal(await page.closed, 'retired');
});
