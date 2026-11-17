const assert = require('node:assert/strict');
const test = require('node:test');
const { compile, frameModule, flattenStyle } = require('./adminShellFrameViewSupport.cjs');
const { nodes } = require('./adminSupplierDetailViewSupport.cjs');
const s = require('./adminSourceDockScaffoldSupport.cjs');
const projection = compile('AdminShellSourceWindowLayoutContext.tsx', { react: { createContext: value => ({ value }) } });
function facts(f, thin = true, available = true) {
  const owner = f.scaffoldOwner, snapshot = owner.getSnapshot();
  return projection.adminShellSourceWindowLayout(snapshot, thin, available, owner.current(snapshot.generation));
}
test('original viewport safe-area arrives independently of dock geometry, without inventing body metrics', async () => {
  const f = s.fixture();
  try {
    let value = facts(f); assert.equal(value.metrics, null); assert.equal(value.safeInsets, null); assert.equal(value.viewportWidth, null);
    f.viewport(); await s.flush(); value = facts(f); const viewport = f.scaffoldOwner.getSnapshot().native.viewport;
    assert.deepEqual(value.safeInsets, { top: viewport.safeTop, left: viewport.safeLeft, right: viewport.safeRight }); assert.equal(value.metrics, null); assert.equal(value.viewportWidth, viewport.rect.width);
    f.bindDock(); await s.flush(); value = facts(f); assert.equal(value.metrics, f.scaffoldOwner.getSnapshot().native.metrics); assert.equal(value.thinGestureBottom, true);
    assert.equal(facts(f, null).metrics, null); assert.equal(facts(f, true, false).metrics, null); assert.deepEqual(facts(f, null).safeInsets, value.safeInsets);
  } finally { f.cleanup(); }
});
test('retired or unavailable original window clears its safe-area and never adopts a replacement native scope', async () => {
  const f = s.fixture();
  try {
    await f.ready(); const snapshot = f.scaffoldOwner.getSnapshot(); assert.ok(facts(f).metrics);
    const unavailable = projection.adminShellSourceWindowLayout({ ...snapshot, native: { ...snapshot.native, phase: 'unavailable' } }, true, true, true);
    assert.equal(unavailable.safeInsets, null); assert.equal(unavailable.metrics, null); assert.equal(unavailable.viewportWidth, null);
    f.current(false); const retired = facts(f); assert.equal(retired.metrics, null); assert.equal(retired.safeInsets, null); assert.equal(retired.viewportWidth, null); f.current(true); assert.equal(facts(f).metrics, null);
  } finally { f.cleanup(); }
});
test('same-window body frame uses actual left/right insets and retains held children without inherited native SafeAreaView', async () => {
  const f = s.fixture();
  try {
    await f.ready(); let value = facts(f); const module = frameModule(undefined, () => ({ ...value, sourceWindow: true }));
    const child = { type: 'OriginalReadBody', props: {} }, render = () => module.AdminShellBodyFrame({ children: child, hasFooter: true, testID: 'original-window-frame' });
    let tree = render(); assert.equal(tree.type, 'View'); assert.equal(nodes(tree, node => node.type === 'SafeAreaView').length, 0);
    assert.equal(flattenStyle(tree.props.style).paddingLeft, value.safeInsets.left); assert.equal(flattenStyle(tree.props.style).paddingRight, value.safeInsets.right);
    value = { metrics: null, safeInsets: null, thinGestureBottom: null }; tree = render(); const body = nodes(tree, node => node.props.testID === 'original-window-frame')[0];
    assert.equal(body.props.pointerEvents, 'none'); assert.equal(flattenStyle(body.props.style).opacity, 0); assert.equal(body.props.children, child); assert.equal(flattenStyle(tree.props.style).paddingLeft, undefined);
  } finally { f.cleanup(); }
});
