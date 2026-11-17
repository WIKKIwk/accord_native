const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminRootPresentationSupport.cjs');
const { AdminRootNativeParentOwner } = s.load('admin/adminRootNativeParentOwner', { '../shared/camera/synchronousGuard': s.guard });
function fixture() {
  const f = s.fixture('ios'), original = { chain: f.chain, parent: f.chain.root, nativeIdentity: f.rootNative }, owner = new AdminRootNativeParentOwner(original), stop = owner.attach();
  return { ...f, owner, original, stop, view: {}, cleanup() { stop(); f.rootStop(); } };
}
test('real committed original marker provides resource identity without manufacturing shown readiness or interaction', async () => {
  const f = fixture(); try {
    assert.equal(f.owner.read(f.chain, f.chain.root), null);
    for (const tag of [null, 0, -1, 1.5, NaN, Infinity, 0x80000000]) assert.equal(f.owner.capture(f.view, tag), false);
    assert.equal(f.owner.capture(f.view, 41), true); const value = f.owner.read(f.chain, f.chain.root);
    assert.deepEqual(value.marker, { tag: 41, nativeID: f.chain.root.id }); assert.equal(value.isCurrent(), true); assert.equal(value.sourceCurrent(), true);
    assert.equal(f.chain.getSnapshot().rootReady, false); assert.equal(f.chain.canInteract(f.chain.root), false); assert.equal(f.open(), null);
    assert.equal(f.owner.read(f.chain, { ...f.chain.root }), null); assert.equal(f.owner.read({ ...f.chain }, f.chain.root), null); assert.equal(f.owner.read(f.chain, f.chain.root), value);
  } finally { f.cleanup(); await s.flush(); }
});
test('expected blur and retained retired Source parent keep original physical resource separately from Source authority', async () => {
  const f = fixture(); try {
    f.rootReady(); const original = f.open(), native = f.native(original.entry); native.ready();
    const owner = new AdminRootNativeParentOwner({ chain: f.chain, parent: original.entry, nativeIdentity: native.identity }), stop = owner.attach(), view = {};
    owner.capture(view, 42); const value = owner.read(f.chain, original.entry); assert.ok(value); const child = f.open(), childNative = f.native(child.entry); childNative.ready();
    assert.equal(f.chain.canInteract(original.entry), false); assert.equal(value.isCurrent(), true); assert.equal(value.sourceCurrent(), true);
    f.chain.cancel(original.entry); assert.equal(value.isCurrent(), true); assert.equal(value.sourceCurrent(), false); assert.equal(f.chain.retained(original.entry), true);
    assert.equal(f.chain.open({ ...f.request(), parent: original.entry }), null); stop(); childNative.stop(); native.stop();
  } finally { f.cleanup(); await s.flush(); }
});
test('foreign native lease and replaced actual native View/tag cannot retarget a previously returned marker', async () => {
  const f = fixture(); try {
    const foreign = new AdminRootNativeParentOwner({ ...f.original, nativeIdentity: {} }), off = foreign.attach(); assert.equal(foreign.capture({}, 50), false); assert.equal(foreign.read(f.chain, f.chain.root), null); off();
    f.owner.capture(f.view, 41); const value = f.owner.read(f.chain, f.chain.root); assert.equal(f.owner.capture(f.view, 41), true);
    assert.equal(f.owner.capture({}, 41), false); assert.equal(value.isCurrent(), false); assert.equal(f.owner.read(f.chain, f.chain.root), null); assert.equal(f.owner.capture(f.view, 41), false);
    assert.deepEqual(value.marker, { tag: 41, nativeID: f.chain.root.id });
  } finally { f.cleanup(); await s.flush(); }
});
test('provider tuple replacement retires old binding; consumer copied parents only reject their own read', async () => {
  for (const key of ['chain', 'parent', 'nativeIdentity']) {
    const f = fixture(); try {
      f.owner.capture(f.view, 41); const value = f.owner.read(f.chain, f.chain.root); f.owner.commit({ ...f.original, [key]: { ...f.original[key] } });
      assert.equal(value.isCurrent(), false); f.owner.commit(f.original); assert.equal(f.owner.read(f.chain, f.chain.root), null);
    } finally { f.cleanup(); await s.flush(); }
  }
});
test('Strict replay preserves only SAME mounted original marker, final cleanup and account retirement revoke queued bindings', async () => {
  const f = fixture(); f.owner.capture(f.view, 41); const value = f.owner.read(f.chain, f.chain.root);
  f.stop(); assert.equal(value.isCurrent(), false); const replay = f.owner.attach(); await s.flush(); assert.equal(f.owner.read(f.chain, f.chain.root), value);
  f.current(false); assert.equal(value.isCurrent(), false); f.current(true); assert.equal(value.isCurrent(), false); replay(); f.rootStop(); await s.flush(); assert.equal(f.owner.capture(f.view, 41), false);
});
test('actual original account callback unmounting slot or reentering resource read cannot authorize retained marker', async () => {
  for (const mode of ['unmount', 'reenter']) {
    let action = () => true; const f = s.fixture('ios', { isCurrent: () => action() }), owner = new AdminRootNativeParentOwner({ chain: f.chain, parent: f.chain.root, nativeIdentity: f.rootNative }), stop = owner.attach(), view = {};
    owner.capture(view, 41); const value = owner.read(f.chain, f.chain.root); action = () => { if (mode === 'unmount') stop(); else value.isCurrent(); return true; };
    assert.equal(value.isCurrent(), false); action = () => true; stop(); f.rootStop(); await s.flush(); assert.equal(value.isCurrent(), false);
  }
});
