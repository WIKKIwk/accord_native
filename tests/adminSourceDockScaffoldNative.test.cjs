/* global __dirname */
const assert = require('node:assert/strict'), path = require('node:path'), test = require('node:test');
const s = require('./adminSourceDockScaffoldSupport.cjs');
function fixture(t, options) {
  const f = s.fixture(options), r = s.views.runtime(), context = { value: null }, tags = [];
  const react = { ...r.react, createContext: () => ({ Provider: 'ActualBodyScope.Provider' }), useContext: () => context.value };
  const exports = s.views.compile(path.resolve(__dirname, '../src/admin/AdminSourceDockScaffold.tsx'), { react,
    'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } }, findNodeHandle: ref => { tags.push(ref); return ref?.actualTag ?? null; } },
    './AdminCreateHubProvider': { AdminCreateHubSourceLayout: 'ActualSourceLayout.Provider' },
    './AdminShellSourceWindowLayoutContext': { AdminShellSourceWindowLayout: 'ActualOriginalWindowShellScope' },
    './useAdminSourceDockScaffold': { useAdminSourceDockScaffold: props => ({ owner: f.scaffoldOwner, state: f.scaffoldOwner.getSnapshot(), matches: f.scaffoldOwner.matches(props) }) } });
  const render = () => r.render(() => exports.AdminSourceDockScaffold(f.props));
  const id = (tree, value) => s.views.nodes(tree, node => node.props.testID === value)[0];
  const body = tree => { context.value = s.views.nodes(tree, node => node.type === 'ActualBodyScope.Provider')[0].props.value; return exports.AdminSourceDockBody({ children: f.props.nativeScene }); };
  t.after(() => { r.unmount(); f.cleanup(); }); return { ...f, r, exports, render, id, body, tags, context };
}
const style = node => Object.assign({}, ...(Array.isArray(node.props.style) ? node.props.style : [node.props.style]));
test('full original viewport retains actual native scene/header and outlet while only the explicit descriptor body is held', t => {
  const f = fixture(t, { pending: true }), tree = f.render(), scene = f.id(tree, 'admin-source-scaffold-scene'), viewport = f.id(tree, 'admin-source-scaffold-viewport');
  assert.equal(tree.props.layout.metrics, null); assert.equal(tree.props.layout.hostHeight, null); assert.equal(scene.props.pointerEvents, 'box-none'); assert.equal(style(scene).opacity, undefined);
  assert.equal(s.views.nodes(scene, node => node === f.props.nativeScene).length, 1); assert.equal(viewport.props.children.at(-1), f.props.outlet);
  const body = f.body(tree); assert.equal(body.props.children, f.props.nativeScene); assert.equal(body.props.pointerEvents, 'none'); assert.equal(style(body).opacity, 0); assert.equal(body.props.importantForAccessibility, 'no-hide-descendants');
  f.context.value = null; assert.throws(() => f.exports.AdminSourceDockBody({ children: f.props.nativeScene }), /body scope/);
});
test('actual View marker callbacks supply native tags; semantic dock target bootstraps without acknowledging onLayout as measurement', async t => {
  const f = fixture(t, { pending: true }); let tree = f.render(), viewport = f.id(tree, 'admin-source-scaffold-viewport');
  viewport.props.ref.current = { actualTag: 41 }; viewport.props.onLayout({ nativeEvent: { layout: { height: 9999 } } }); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].args[0].tag, 41);
  f.settle(0); await s.flush(); tree = f.render(); const dock = f.id(tree, 'admin-source-scaffold-dock-marker'); assert.equal(style(dock).height, 199); assert.equal(style(dock).opacity, 0);
  dock.props.ref.current = { actualTag: 42 }; dock.props.onLayout({ nativeEvent: { layout: { height: 199 } } }); assert.equal(f.calls[1].args[1].tag, 42); assert.equal(f.scaffoldOwner.getSnapshot().geometryReady, false);
  f.settle(1); await s.flush(); tree = f.render(); assert.equal(tree.props.layout.hostHeight, 547 / 2.75); assert.equal(f.body(tree).props.pointerEvents, 'auto'); assert.equal(style(f.body(tree)).opacity, 1);
  assert.equal(s.views.nodes(tree, node => node.type === 'ActualPrimaryFixture').length, 1); assert.equal(f.id(tree, 'admin-source-scaffold-global-overlay'), undefined);
});
test('retained body becomes inert on real top loss while header remains usable; actual overlay stays a full-window sibling outside dock/body', async t => {
  const f = fixture(t); await f.ready(); let tree = f.render(); f.top(false); f.focus(false); tree = f.render(); assert.equal(f.body(tree).props.pointerEvents, 'none'); assert.equal(style(f.body(tree)).opacity, 1);
  assert.equal(f.id(tree, 'admin-source-scaffold-scene').props.pointerEvents, 'box-none'); f.top(true); f.focus(true); f.hub.open(f.ticket); f.bindDock(); await s.flush(); f.overlayTop(true); f.top(false); f.focus(false); tree = f.render();
  const viewport = f.id(tree, 'admin-source-scaffold-viewport'), overlay = f.id(tree, 'admin-source-scaffold-global-overlay'), dock = f.id(tree, 'admin-source-scaffold-dock-marker');
  assert.ok(overlay); assert.ok(viewport.props.children.includes(overlay)); assert.equal(s.views.nodes(dock, node => node.type === 'ActualOverlayFixture').length, 0); assert.equal(style(overlay).bottom, 0); assert.equal(style(overlay).top, 0);
});
test('Strict replay rebinds the actual still-mounted viewport ref without needing another onLayout or inventing a tag', async t => {
  const f = fixture(t); let tree = f.render(), viewport = f.id(tree, 'admin-source-scaffold-viewport'); viewport.props.ref.current = { actualTag: 51 }; viewport.props.onLayout(); await s.flush();
  const old = f.scaffoldOwner.getSnapshot().generation; f.scaffoldOwner.detach(); f.scaffoldOwner.start(); f.scaffoldOwner.source(f.ticket, true); tree = f.render(); await s.flush();
  assert.equal(f.calls.filter(call => call.kind === 'viewport').length, 2); assert.equal(f.calls.at(-1).args[0].tag, 51); assert.ok(f.scaffoldOwner.getSnapshot().generation > old);
});
test('same-height replacement before first dock layout uses the actual retained ref to bind latest target without waiting for another native layout event', async t => {
  const f = fixture(t, { pending: true }); let tree = f.render(), viewport = f.id(tree, 'admin-source-scaffold-viewport'); viewport.props.ref.current = { actualTag: 61 }; viewport.props.onLayout(); f.settle(0); await s.flush();
  tree = f.render(); const old = f.id(tree, 'admin-source-scaffold-dock-marker'); old.props.ref.current = { actualTag: 62 }; const first = f.scaffoldOwner.getSnapshot().target;
  f.hub.updatePrimary(f.ticket, { hasReplacement: true, replacement: { type: 'ActualCountUpdateFixture', props: { count: 3 } } }); const latest = f.scaffoldOwner.getSnapshot().target;
  assert.notEqual(latest, first); assert.equal(latest.nativeID, first.nativeID); old.props.onLayout(); assert.equal(f.calls.length, 1);
  tree = f.render(); assert.equal(f.calls.length, 2); assert.equal(f.calls[1].args[1].tag, 62); f.settle(1); await s.flush(); assert.equal(f.scaffoldOwner.getSnapshot().geometryReady, true);
  const before = f.calls.length; f.hub.updatePrimary(f.ticket, { hasReplacement: true, replacement: { type: 'ActualCountUpdateFixture', props: { count: 4 } } }); f.render(); assert.equal(f.calls.length, before);
});
