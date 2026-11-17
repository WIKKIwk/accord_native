const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminRootRouterSupport.cjs');
const { compile } = require('./adminItemDetailViewsSupport.cjs');
const { AdminRootRouterSceneMembership } = compile('useAdminRootRouterSceneMembership.ts', { react: {} });
test('real committed child descriptor waits for actual parent renderer and joins its publication without manufacturing native readiness', t => {
  const f = s.fixture('android', { attachBase: false }), binding = f.owner.rootScene().binding; f.detachRenderer(); const owner = new AdminRootRouterSceneMembership(f.owner, binding);
  owner.commit(true); const detach = owner.attach(); assert.equal(f.owner.hasScene(binding), false); const stop = f.owner.attachRenderer(f.render); assert.equal(f.owner.hasScene(binding), true);
  assert.equal(f.owner.canInteract(binding), false); assert.equal(f.chain.getSnapshot().rootReady, false); t.after(() => { detach(); stop(); f.owner.dispose(); f.rootStop(); });
});
test('controller scene appearing later cannot create phantom membership until actual NativeScene render commits', t => {
  const f = s.fixture('ios', { attachBase: false }), binding = f.owner.rootScene().binding, owner = new AdminRootRouterSceneMembership(f.owner, binding); owner.commit(false); const detach = owner.attach();
  f.commit(); assert.ok(f.owner.scene(binding)); assert.equal(f.owner.hasScene(binding), false); owner.commit(true); assert.equal(f.owner.hasScene(binding), true);
  owner.commit(false); assert.equal(f.owner.hasScene(binding), false); f.commit(); assert.equal(f.owner.hasScene(binding), false); t.after(() => { detach(); f.owner.dispose(); f.rootStop(); });
});
test('parent-first cleanup and child-first reconnect acquire a fresh actual scene lease after renderer restart', t => {
  const f = s.fixture('android', { attachBase: false }), binding = f.owner.rootScene().binding, owner = new AdminRootRouterSceneMembership(f.owner, binding); owner.commit(true); let detach = owner.attach();
  assert.equal(f.owner.hasScene(binding), true); f.detachRenderer(); detach(); owner.commit(true); detach = owner.attach(); assert.equal(f.owner.hasScene(binding), false);
  const stop = f.owner.attachRenderer(f.render); assert.equal(f.owner.hasScene(binding), true); t.after(() => { detach(); stop(); f.owner.dispose(); f.rootStop(); });
});
test('same-route real descriptor/search updates preserve original membership; copied binding and actual account retirement cannot acquire it', t => {
  const f = s.fixture('ios', { attachBase: false }), binding = f.owner.rootScene().binding, owner = new AdminRootRouterSceneMembership(f.owner, binding); owner.commit(true); const detach = owner.attach();
  for (let i = 0; i < 3; i++) { f.commit(); owner.commit(true); assert.equal(f.owner.hasScene(binding), true); }
  const copy = new AdminRootRouterSceneMembership(f.owner, { ...binding }); copy.commit(true); const leave = copy.attach(); assert.equal(f.owner.hasScene({ ...binding }), false);
  f.account(false); f.commit(); assert.equal(f.owner.hasScene(binding), false); t.after(() => { leave(); detach(); f.owner.dispose(); f.rootStop(); });
});
test('actual original callbacks detaching the renderer reject BOTH root and owned-page scene membership in the same read', () => {
  for (const kind of ['root', 'page']) {
    let detach = false, f;
    f = s.fixture('android', { rootOptions: { isCurrent: () => { if (detach) { detach = false; f.detachRenderer(); } return true; } } });
    let binding = f.owner.rootScene().binding, stop;
    if (kind === 'page') { f.rootReady(); const page = f.open(); binding = f.bind(page); stop = f.owner.attachScene(binding); }
    assert.equal(f.owner.hasScene(binding), true); detach = true; assert.equal(f.owner.hasScene(binding), false); assert.equal(f.owner.hasScene(binding), false);
    stop?.(); f.owner.dispose(); f.rootStop();
  }
});
