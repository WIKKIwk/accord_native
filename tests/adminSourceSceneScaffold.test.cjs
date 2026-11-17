const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs');
test('actual Root descriptor and committed Source membership activate only after genuine parent commit; no native shown or geometry fact is invented', t => {
  const f = s.fixture(); t.after(f.cleanup); assert.equal(f.scope.getSnapshot().phase, 'pending'); assert.equal(f.scope.readCurrent(), false); assert.equal(f.scope.readScaffold(), null);
  f.commitScene(); assert.equal(f.root.owner.hasScene(f.binding), true); assert.equal(f.scope.readCurrent(), false); f.startSource(); assert.equal(f.scope.getSnapshot().phase, 'active');
  assert.equal(f.scope.readCurrent(), true); assert.equal(f.owner.getSnapshot().geometryReady, false); assert.equal(f.scope.canInteract(), false); assert.equal(f.native.calls.length, 0);
  const scaffold = f.scope.readScaffold(); assert.equal(scaffold.ticket, f.scaffold.ticket); assert.equal(scaffold.messenger, f.messenger); assert.equal(scaffold.progress, f.progress); assert.deepEqual(f.counts, { create: 1, attach: 1 });
});
test('same Source ticket reaches actual Reader while geometry loss preserves read lease and generation; actual Root blur blocks commands only', async t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); f.root.rootReady(); const generation = f.scope.getSnapshot().generation; assert.equal(f.scope.canInteract(), true);
  f.viewport(); await s.flush(); f.bindDock(); await s.flush(); assert.equal(f.owner.getSnapshot().geometryReady, true); assert.equal(f.reader.registerScaffold({ scaffold: f.scaffold.ticket, viewportMarker: { tag: 99, nativeID: 'duplicate' }, isCurrent: () => true }), null);
  const viewport = f.native.calls[0].result.initial; f.native.emit({ ...viewport, revision: 4, frame: 8, viewport: null }); assert.equal(f.owner.getSnapshot().geometryReady, false); assert.equal(f.scope.getSnapshot().phase, 'active'); assert.equal(f.scope.getSnapshot().generation, generation); assert.equal(f.scope.readCurrent(), true);
  f.root.open(); f.root.commit(); assert.equal(f.scope.readCurrent(), true); assert.equal(f.scope.canInteract(), false); assert.equal(f.scope.readScaffold().ticket, f.scaffold.ticket); assert.deepEqual(f.counts, { create: 1, attach: 1 });
});
test('copied or foreign actual binding/ancestor/controller cannot be adopted by an inherited physical Source scope', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit();
  assert.equal(f.scope.accepts(f.rootContext, f.binding, null), true); assert.equal(f.scope.accepts(f.rootContext, { ...f.binding }, null), false);
  assert.equal(f.scope.accepts(f.rootContext, f.binding, {}), false); assert.equal(f.scope.accepts({ ...f.rootContext, controller: {} }, f.binding, null), false);
  assert.equal(s.scene.isAdminSourceSceneScaffoldOwner({ ...f.scope }), false);
  f.root.rootReady(); const page = f.root.open(); const other = f.root.bind(page); assert.equal(f.scope.accepts({ ...f.rootContext, binding: other }, other, null), false);
});
test('Source native/route/account lifetime loss retires original lease and retained callbacks cannot revive it', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const generation = f.scope.getSnapshot().generation; f.current(false); assert.equal(f.scope.readCurrent(), false); assert.equal(f.scope.getSnapshot().phase, 'retired');
  f.current(true); f.owner.start(); f.scope.start(); assert.equal(f.scope.readCurrent(generation), false); assert.equal(f.scope.readScaffold(), null);
});
test('actual descriptor unmount cannot preserve a Source read lease simply because its logical route remains in the stack', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); f.dropScene(); assert.equal(f.root.owner.readCurrent(f.binding), true); assert.equal(f.scope.readCurrent(), false); assert.equal(f.scope.getSnapshot().phase, 'retired');
});
test('Strict same-parent effect detach is pending, then fresh committed original membership fences old generation without recapturing Source metadata', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const generation = f.scope.getSnapshot().generation; f.owner.detach(); assert.equal(f.scope.getSnapshot().phase, 'pending');
  assert.equal(f.scope.readCurrent(generation), false); f.dropScene(); f.commitScene(); f.startSource(); assert.equal(f.scope.getSnapshot().phase, 'active'); assert.notEqual(f.scope.getSnapshot().generation, generation);
  assert.equal(f.scope.readCurrent(generation), false); assert.equal(f.scope.readCurrent(), true); assert.deepEqual(f.counts, { create: 1, attach: 1 });
});
test('only real Messenger changes update live original banner/accessibility through the same Source ticket without root/geometry/model changes', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); const initial = f.scope.getSnapshot(), native = f.owner.getSnapshot(), root = f.root.owner.getSnapshot(), seen = [];
  f.scope.subscribe(() => seen.push(f.scope.readScaffold())); const shown = f.native.show('actual same root notice'); assert.equal(f.scope.readScaffold().banner, shown.banner); assert.ok(seen.some(value => value?.banner === shown.banner));
  f.messenger.setAccessibleNavigation(f.native.driver, true); assert.equal(f.scope.readScaffold().accessibleNavigation, true); f.messenger.removeCurrent(shown.banner); assert.equal(f.scope.readScaffold().banner, null);
  assert.equal(f.scope.getSnapshot().generation, initial.generation); assert.equal(f.owner.getSnapshot().native, native.native); assert.equal(f.root.owner.getSnapshot(), root); assert.deepEqual(f.counts, { create: 1, attach: 1 });
});
test('coherent Source metadata is read only after final untrusted guard callbacks, from one actual Messenger snapshot', t => {
  const f = s.fixture(); t.after(f.cleanup); f.commit(); let once = true;
  f.current(() => { if (once) { once = false; f.native.show('changed during original guard'); } return true; });
  // Reentrant account publication is conservatively rejected rather than manufacturing a mixed binding.
  const result = f.scope.readScaffold(); assert.equal(result, null); assert.equal(f.scope.getSnapshot().phase, 'retired');
});
