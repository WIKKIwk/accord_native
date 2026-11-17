const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs');
const { compile, nodes } = require('./adminItemDetailViewsSupport.cjs');
for (const platform of ['android', 'ios']) {
  test(`${platform} real descriptor/providers start actual domain only after committed Source scene, sharing ONE original Scaffold with Reader and notices`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.renderDirty();
    assert.deepEqual({ create: f.counts.create, attach: f.counts.attach }, { create: 1, attach: 1 }); assert.ok(f.model()); assert.equal(f.calls.filter(value => value[0] === 'items').length, 1);
    assert.equal(f.scope().readScaffold().ticket, f.originalScaffold().ticket); assert.equal(f.leaf.notice.scaffold.ticket, f.originalScaffold().ticket); assert.equal(f.fixedHosts.at(-1).scaffold.ticket, f.originalScaffold().ticket);
    assert.equal(f.sourceOwner().getSnapshot().native, null); assert.equal(f.scope().getSnapshot().phase, 'active'); assert.equal(f.root.chain.getSnapshot().rootReady, false); assert.equal(f.model().nativeCurrent(), false);
    f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); assert.ok(f.sourceOwner().getSnapshot().native.metrics);
    assert.equal(f.observer.registerScaffold({ scaffold: f.originalScaffold().ticket, viewportMarker: { tag: 99, nativeID: 'copied-slot' }, isCurrent: () => true }), null);
  });
  test(`${platform} ordinary geometry unknown/known/unknown preserves same domain owner, drafts and original native callbacks while real Root blur blocks new commands`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.root.rootReady(); f.renderDirty(); f.model().openDialog(); f.renderDirty(); f.model().changeName('original draft'); f.renderDirty();
    const owner = f.model().owner, calls = f.calls.length, generation = f.scope().getSnapshot().generation, old = f.model();
    f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); f.renderDirty();
    const target = f.sourceOwner().getSnapshot().target; f.sourceOwner().bindDock({ tag: 32, nativeID: target.nativeID }, target); await s.flush(); f.renderDirty();
    const viewport = f.native.calls.find(value => value.kind === 'viewport').result.initial; f.native.emit({ ...viewport, revision: 8, frame: 12, viewport: null }); f.renderDirty();
    assert.equal(f.model().owner, owner); assert.equal(f.model().state.form.draft.name, 'original draft'); assert.equal(f.calls.length, calls); assert.equal(f.scope().getSnapshot().generation, generation);
    f.root.open(); f.commitFrame(); f.renderDirty(); assert.equal(old.current(), true); assert.equal(f.model().owner, owner); assert.equal(f.model().nativeCurrent(), false); old.changeName('blocked'); assert.equal(f.model().state.form.draft.name, 'original draft');
  });
  test(`${platform} Messenger-only banner/remove/accessibility updates reuse original ticket/model and never create another Scaffold or refetch`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.renderDirty(); const owner = f.model().owner, calls = f.calls.length, root = f.root.owner.getSnapshot(), geometry = f.sourceOwner().getSnapshot().native;
    const shown = f.show('same original Source message'); f.renderDirty(); const text = nodes(f.tree(), value => value.type === 'OriginalNativeNoticeTextFixture')[0]; assert.equal(text.props.banner, shown.banner); assert.equal(f.leaf.notice.scaffold.banner, shown.banner);
    assert.equal(f.model().owner, owner); assert.equal(f.calls.length, calls); assert.equal(f.root.owner.getSnapshot(), root); assert.equal(f.sourceOwner().getSnapshot().native, geometry); assert.equal(shown.isClosed(), false);
    f.accessible(true); f.render(); assert.equal(f.leaf.notice.scaffold.accessibleNavigation, true); assert.equal(f.model().owner, owner); f.messenger.removeCurrent(shown.banner); f.renderDirty(); assert.equal(f.leaf.notice.scaffold.banner, null);
    assert.deepEqual({ create: f.counts.create, attach: f.counts.attach }, { create: 1, attach: 1 });
  });
  test(`${platform} nativeScene-only Source scope excludes actual outlet even though window-layout contexts are physically inherited`, t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); assert.equal(f.leaf.outletScope, null); assert.ok(f.leaf.outletWindow); assert.ok(f.scope());
  });
  test(`${platform} full actual descriptor/SourceDock paints ONE outer dock with no page footer, including raw IME and unknown geometry`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); assert.equal(f.props.footer, undefined); f.render(); await s.flush(); f.renderDirty();
    assert.ok(f.model()); const owner = f.model().owner;
    f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); f.renderDirty();
    const target = f.sourceOwner().getSnapshot().target; f.sourceOwner().bindDock({ tag: 32, nativeID: target.nativeID }, target); await s.flush(); f.renderDirty();
    const assertOnlyOuterDock = () => {
      const scene = nodes(f.tree(), value => value.props.testID === 'admin-source-scaffold-scene')[0], marker = nodes(f.tree(), value => value.props.testID === 'admin-source-scaffold-dock-marker')[0];
      assert.equal(nodes(scene, value => value.type === 'ActualDockFixture').length, 0); assert.equal(nodes(f.tree(), value => value.type === 'ActualDockFixture').length, 1);
      assert.equal(nodes(marker, value => value.type === 'ActualDockFixture').length, 1); assert.equal(Object.assign({}, ...marker.props.style).bottom, 0);
    };
    assertOnlyOuterDock(); const dock = f.native.calls.find(value => value.kind === 'dock').result.initial;
    f.native.emit({ ...dock, revision: 3, frame: 8, dock: { ...dock.dock, viewport: { ...dock.dock.viewport, rawImeBottom: 350 } } }); f.renderDirty();
    assert.equal(f.sourceOwner().getSnapshot().bodyBottom, 350); assertOnlyOuterDock();
    // Runtime callers carrying an old legacy footer cannot paint it inside the original-window scene.
    f.props.footer = f.jsx.jsx('ForbiddenDuplicatePageDockFixture', {}); f.render(); assert.equal(nodes(f.tree(), value => value.type === 'ForbiddenDuplicatePageDockFixture').length, 0); assertOnlyOuterDock();
    const viewport = f.native.calls.find(value => value.kind === 'viewport').result.initial; f.native.emit({ ...viewport, revision: 4, frame: 9, viewport: null }); f.renderDirty();
    assert.equal(f.model().owner, owner); assert.equal(nodes(f.tree(), value => value.type === 'ActualDockFixture').length, 0); assert.equal(nodes(f.tree(), value => value.type === 'ForbiddenDuplicatePageDockFixture').length, 0);
  });
  test(`${platform} parent-first full Provider replay waits for real renderer and Source commits, revokes old scope generation and registers fresh genuine membership`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.renderDirty(); const old = f.model(), generation = f.scope().getSnapshot().generation, ticket = f.originalScaffold().ticket;
    f.replay(); f.renderDirty(); await s.flush(); f.renderDirty(); assert.equal(f.scope().getSnapshot().phase, 'active'); assert.notEqual(f.scope().getSnapshot().generation, generation);
    assert.equal(old.current(), false); assert.equal(f.model().current(), true); assert.equal(f.root.owner.hasScene(f.binding), true); assert.equal(f.originalScaffold().ticket, ticket); assert.equal(f.counts.create, 1);
  });
  test(`${platform} copied expected Root binding rejects before any actual domain hook or API read`, t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.expected({ ...f.binding }); assert.throws(f.render, /exact original Root/); assert.equal(f.counts.domain, 0); assert.deepEqual(f.calls, []);
  });
  test(`${platform} missing explicit binding or foreign logical ancestor cannot adopt an inherited native-scene scope`, t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.expected(undefined); assert.throws(f.render, /exact original Root/); assert.equal(f.counts.domain, 0); assert.deepEqual(f.calls, []);
    f.expected(f.binding); f.props.sourceScaffoldAncestor = {}; assert.throws(f.render, /exact original Root/); assert.equal(f.counts.domain, 0); assert.deepEqual(f.calls, []);
  });
  test(`${platform} replacing original account/command callbacks cannot mount a fresh domain or retarget old native handlers inside the same scene lifetime`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.renderDirty(); const old = f.model(), calls = f.calls.length;
    f.props.isCurrent = () => true; f.render(); assert.equal(old.current(), false); assert.equal(f.calls.length, calls); assert.equal(nodes(f.tree(), value => value.props.testID === 'admin-item-create-screen').length, 0);
  });
}
test('render-time actual Provider replacement holds before NEW child domain layout while native scene/header remain mounted', t => {
  const f = s.fixture(); f.commit(); const r = s.runtime(); let target = f.target, version = 0, available = true; const starts = []; let resourceMounts = 0, resourceUnmounts = 0;
  const context = compile('AdminSourceSceneScaffoldContext.tsx', { react: r.react, 'react/jsx-runtime': r.jsx,
    './AdminRootRouterContext': { useOptionalAdminRootRouterPage: () => f.rootContext }, './AdminTopNoticeProvider': { useAdminTopNoticeTarget: () => target }, './AdminSourceSceneScaffoldOwner': s.scene });
  function Domain({ value }) { r.react.useLayoutEffect(() => { starts.push(value); }, []); return r.jsx.jsx('ActualDomainFixture', {}); }
  function Gate({ value }) { const owner = context.useAdminSourceSceneScaffold(); r.react.useSyncExternalStore(owner?.subscribe ?? emptySubscribe, owner?.getSnapshot ?? emptySnapshot); return owner?.readCurrent() ? r.jsx.jsx(Domain, { value }, value) : null; }
  function NativeScene({ value }) { r.react.useLayoutEffect(() => { resourceMounts++; return () => { resourceUnmounts++; }; }, []); return r.jsx.jsxs('ActualNativeSceneAndHeaderFixture', { children: [r.jsx.jsx('GenuineNativeHeaderFixture', {}), r.jsx.jsx(Gate, { value })] }); }
  function render() { return r.render(r.jsx.jsx(context.AdminSourceSceneScaffoldProvider, { source: f.owner, binding: f.binding, available, children: r.jsx.jsx(NativeScene, { value: version }) })); }
  render(); assert.deepEqual(starts, [0]); target = { ...target, progress: { get: () => 1 } }; version = 1; render(); assert.deepEqual(starts, [0]); assert.equal(resourceMounts, 1); assert.equal(resourceUnmounts, 0);
  available = false; version = 2; render(); assert.deepEqual(starts, [0]); assert.equal(resourceMounts, 1); t.after(() => { r.cleanup(); f.cleanup(); });
});
const emptySubscribe = () => () => {}, emptySnapshot = () => null;
