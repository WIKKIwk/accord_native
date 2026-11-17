const assert = require('node:assert/strict'), test = require('node:test');
const s = require('./adminSourceSceneScaffoldSupport.cjs'), { nodes } = require('./adminItemDetailViewsSupport.cjs');
const { flattenStyle } = require('./adminShellFrameViewSupport.cjs'), style = node => flattenStyle(node.props.style);
const id = (tree, value) => nodes(tree, node => node.props.testID === value)[0];
for (const platform of ['android', 'ios']) {
  test(`${platform} genuine local native primary is a held viewport sibling; real ref starts native pair and onLayout cannot acknowledge geometry/global readiness`, async t => {
    const f = s.nativeFixture(platform); t.after(f.cleanup); f.render(); await s.flush(); f.root.rootReady(); f.renderDirty(); const model = f.model(), reads = f.calls.length;
    f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); f.renderDirty();
    let held = id(f.tree(), 'admin-source-hub-local-held'), marker = id(f.tree(), 'admin-create-hub-primary-marker'), dock = id(f.tree(), 'admin-source-scaffold-dock-marker'); assert.ok(marker);
    assert.equal(held.props.pointerEvents, 'none'); assert.equal(held.props.accessibilityElementsHidden, true); assert.equal(style(held).opacity, 0); assert.equal(style(held).top, 0); assert.equal(style(held).bottom, 0);
    assert.equal(style(marker).width, 80); assert.equal(style(marker).height, 80); assert.equal(style(marker).borderRadius, 22); assert.equal(style(marker).end, 16); assert.equal(style(marker).bottom, 89);
    assert.equal(nodes(dock, value => value.props.testID === 'admin-create-hub-primary-marker').length, 0); assert.equal(nodes(id(f.tree(), 'admin-source-scaffold-scene'), value => value.props.testID === 'admin-source-hub-local-held').length, 0);
    marker.props.ref.current = { tag: 81 }; marker.props.onLayout({ nativeEvent: { layout: { width: 9999, height: 9999 } } }); assert.equal(f.leaf.localPlacement.placement(), null); assert.equal(f.native.calls.filter(value => value.kind === 'pair').length, 0);
    const target = f.sourceOwner().getSnapshot().target; f.sourceOwner().bindDock({ tag: 32, nativeID: target.nativeID }, target); assert.equal(f.leaf.localPlacement.placement(), null); await s.flush(); f.renderDirty();
    const receipt = f.leaf.localPlacement.placement(), call = f.native.calls.find(value => value.kind === 'pair'); assert.ok(receipt); assert.equal(call.args[2].tag, 81); assert.equal(call.args[2].nativeID, marker.props.nativeID); assert.equal(receipt.frame.height, call.result.initial.pair.fixed.height); assert.notEqual(receipt.frame.height, 9999);
    assert.equal(f.sourceOwner().hostAvailable(f.sourceOwner().hubRequest()), false); assert.equal(f.scope().readCurrent(), true); assert.equal(f.model().owner, model.owner); assert.equal(f.calls.length, reads); assert.ok(f.leaf.header); assert.equal(id(f.tree(), 'admin-item-create-body-frame').props.pointerEvents, 'none');
    held = id(f.tree(), 'admin-source-hub-local-held'); assert.equal(style(held).opacity, 0); assert.equal(id(f.tree(), 'admin-source-scaffold-global-overlay'), undefined);
  });
  test(`${platform} existing explicit full native-host slot never gets a second hidden local primary renderer`, async t => {
    const f = s.nativeFixture(platform, { controlledPrimaryPlacement: true }); t.after(f.cleanup); f.render(); await s.flush(); f.renderDirty(); f.sourceOwner().bindViewport({ tag: 31, nativeID: f.sourceOwner().viewportID }); await s.flush(); f.renderDirty();
    assert.equal(id(f.tree(), 'admin-source-hub-local-held'), undefined); assert.equal(id(f.tree(), 'admin-create-hub-primary-marker'), undefined); assert.equal(f.counts.register, 1);
  });
}
