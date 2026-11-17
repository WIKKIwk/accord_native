/* global __dirname */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function fixture(platform) {
  const calls = [], subscribers = new Set(), instances = new Map();
  let active, pending, visited, dirty, tree, binding, resource = false, lifecycle = {}, current = true, interactive = false, retired = false, acceptedClose = null;
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(create) { const instance = active, index = instance.cursor++; instance.slots[index] ??= { value: typeof create === 'function' ? create() : create }; const slot = instance.slots[index]; return [slot.value, value => { const next = typeof value === 'function' ? value(slot.value) : value; if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; } }]; },
    useLayoutEffect(create, deps) { const index = active.cursor++, instance = active, old = instance.slots[index]; if (!old || !same(old.deps, deps)) { old?.cleanup?.(); const slot = instance.slots[index] = { create, deps }; pending.push(() => { slot.cleanup = create(); }); } },
    useSyncExternalStore(subscribe, get) { const index = active.cursor++; let slot = active.slots[index]; if (!slot || slot.subscribe !== subscribe) { slot?.cleanup?.(); active.slots[index] = slot = { subscribe, cleanup: subscribe(() => { dirty = true; }) }; } return get(); },
  };
  const jsx = { jsx: (type, props, key) => ({ type, props: props ?? {}, key }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key }) };
  const parent = { id: 'actual-parent', kind: 'page' }, entry = { id: 'original-sheet', kind: 'sheet' }, outlet = jsx.jsx('ActualChildOutlet', {}), identity = {};
  const content = (child, state) => { calls.push(['content', state]); return jsx.jsxs('ActualSourceBody', { state, children: [jsx.jsx('ActualControl', {}), child] }); };
  const options = platform === 'android' ? { platform, heightPoints: 410, cornerRadius: 28, barrierOpacity: 0.2 } : { platform, heightPoints: 410, cornerRadius: 28 };
  const presentation = { options, nativeCapability: { status: 'available', platform, NativeView: 'ActualOwnedNativePortal' }, retirementCapability: { status: 'available', platform } };
  let actualPresentation = presentation, actualContent = content;
  const chain = {
    platform, subscribe: callback => { subscribers.add(callback); return () => subscribers.delete(callback); }, getSnapshot: () => 0,
    parent: value => value === entry ? parent : null, content: () => actualContent, sheetPresentation: () => actualPresentation,
    attachSheet(value, nativeIdentity, originalParent) { assert.equal(value, entry); assert.equal(originalParent, originalBinding); resource = true; calls.push(['attach', nativeIdentity, originalParent]); for (const changed of subscribers) changed(); return () => { calls.push(['detach', nativeIdentity]); }; },
    hasSheetResource: (value, nativeIdentity) => value === entry && resource && calls.some(call => call[0] === 'attach' && call[1] === nativeIdentity),
    sheetLifecycle: () => lifecycle, sheetAcceptedClose: () => acceptedClose,
    receiveSheetEvent: (value, nativeIdentity, raw) => { calls.push(['event', value, nativeIdentity, raw]); return true; },
    canInteract: () => interactive, isCurrent: () => current, isRetired: () => retired, retained: () => retired,
  };
  const originalBinding = { identity, chain, parent, marker: { tag: 41, nativeID: 'actual-parent-marker' }, isCurrent: () => true, sourceCurrent: () => current };
  binding = originalBinding;
  const protocol = load('modules/accord-admin-presentation/src/AccordAdminOwnedSheet.ts', { expo: {} });
  const component = load('src/admin/AdminRootOwnedSheetCarrier.tsx', { react, 'react/jsx-runtime': jsx,
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    '../../modules/accord-admin-presentation/src/AccordAdminOwnedSheet': protocol,
    './AdminRootNativeParentContext': { useAdminRootNativeParent: (actualChain, actualParent) => { assert.equal(actualChain, chain); assert.equal(actualParent, parent); return binding; }, AdminRootNativeParentSlot: 'ActualNativeParentSlot' },
  });
  let props = { chain, entry, outlet };
  function expand(node, position) {
    if (Array.isArray(node)) return node.map((value, index) => expand(value, position + '/' + index));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') { const key = position + '/' + node.type.name; let instance = instances.get(key); if (!instance) instances.set(key, instance = { slots: [] }); visited.add(key); const old = active; active = instance; instance.cursor = 0; const result = node.type(node.props); active = old; return expand(result, key); }
    return { ...node, props: { ...node.props, children: expand(node.props.children, position + '/children') } };
  }
  function render() {
    for (let i = 0; i < 12; i++) { dirty = false; pending = []; visited = new Set(); tree = expand(jsx.jsx(component.AdminRootOwnedSheetCarrier, props), 'root');
      for (const [key, instance] of instances) if (!visited.has(key)) { instance.slots.forEach(slot => slot.cleanup?.()); instances.delete(key); }
      pending.splice(0).forEach(run => run()); if (!dirty) return tree;
    } throw Error('Owned sheet carrier did not settle');
  }
  const cleanup = () => { for (const instance of instances.values()) instance.slots.forEach(slot => slot.cleanup?.()); instances.clear(); };
  return { calls, chain, parent, entry, outlet, originalBinding, render, cleanup, tree: () => tree,
    binding: value => { binding = value; }, resource: value => { resource = value; }, lifecycle: value => { lifecycle = value; },
    current: value => { current = value; }, interactive: value => { interactive = value; }, retired: value => { retired = value; }, close: value => { acceptedClose = value; },
    props: value => { props = { ...props, ...value }; }, presentation: value => { actualPresentation = value; }, content: value => { actualContent = value; },
    replay: () => { const effects = [...instances.values()].flatMap(instance => instance.slots).filter(slot => slot.create); effects.forEach(slot => slot.cleanup?.()); effects.forEach(slot => { slot.cleanup = slot.create(); }); },
  };
}
function find(tree, type) { if (Array.isArray(tree)) return tree.flatMap(node => find(node, type)); if (!tree || typeof tree !== 'object') return []; return [...(tree.type === type ? [tree] : []), ...find(tree.props.children, type)]; }

for (const platform of ['android', 'ios']) {
  test(`${platform}: waits for actual parent marker, then mounts one original owned portal without a synthetic shown event`, () => {
    const f = fixture(platform); f.binding(null); assert.equal(f.render(), null); assert.equal(f.calls.length, 0);
    f.binding(f.originalBinding); const portal = f.render(); assert.equal(portal.type, 'ActualOwnedNativePortal'); assert.equal(f.calls.filter(call => call[0] === 'attach').length, 1);
    assert.equal(portal.props.layoutRoot, true); assert.equal(portal.props.dismissalEnabled, false); assert.equal(portal.props.acceptedClose, null);
    assert.deepEqual(portal.props.configuration, { presentationTicket: f.entry.id, parentTicket: f.parent.id, parentViewTag: 41, parentNativeID: 'actual-parent-marker', heightPoints: 410, cornerRadius: 28, ...(platform === 'android' ? { barrierOpacity: 0.2 } : {}) });
    const slot = find(portal, 'ActualNativeParentSlot')[0]; assert.equal(slot.props.chain, f.chain); assert.equal(slot.props.parent, f.entry); assert.equal(slot.props.children.type, f.outlet.type);
    assert.equal(find(portal, 'ActualSourceBody').length, 1); assert.equal(f.calls.some(call => call[0] === 'event'), false); f.cleanup();
  });
  test(`${platform}: forwards only actual native events using the exact original identity and live interaction guards`, () => {
    const f = fixture(platform), original = f.render(), attached = f.calls.find(call => call[0] === 'attach'), state = f.calls.find(call => call[0] === 'content')[1];
    f.interactive(true); assert.equal(state.canInteract(), true); f.current(false); assert.equal(state.isCurrent(), false); f.current(true);
    const raw = { kind: 'shown', sequence: 7 }, envelope = { nativeEvent: raw }; original.props.onSheetEvent(envelope);
    assert.deepEqual(f.calls.at(-1), ['event', f.entry, attached[1], raw]);
    const close = { presentationTicket: f.entry.id, closeTicket: 'accepted-source-close', transaction: null }; f.close(close);
    const shown = f.render(); assert.equal(shown.props.dismissalEnabled, true); assert.equal(shown.props.acceptedClose, close); f.cleanup();
  });
  test(`${platform}: retains original native content/outlet through parent-read loss, source retirement and prop changes until real resource removal`, () => {
    const f = fixture(platform), original = f.render(), attached = f.calls.find(call => call[0] === 'attach');
    f.binding(null); f.current(false); f.retired(true); f.presentation(null); f.content(() => { throw Error('must not replace original source content'); }); f.props({ outlet: { type: 'ForeignOutlet', props: {} } });
    const retained = f.render(); assert.equal(retained.type, 'ActualOwnedNativePortal'); assert.equal(retained.props.configuration, original.props.configuration); assert.equal(retained.props.dismissalEnabled, false);
    assert.equal(find(retained, 'ActualNativeParentSlot')[0].props.children.type, f.outlet.type); assert.equal(find(retained, 'ForeignOutlet').length, 0); assert.equal(find(retained, 'ActualNativeParentSlot')[0].props.nativeIdentity, attached[1]);
    assert.equal(retained.props.children.props.pointerEvents, 'none'); assert.equal(retained.props.children.props.style[1].opacity, 0);
    f.resource(false); assert.equal(f.render(), null); assert.equal(f.calls.some(call => call[0] === 'event'), false); f.cleanup();
    assert.equal(f.calls.filter(call => call[0] === 'detach').length, 1);
  });
  test(`${platform}: StrictMode membership replay preserves original portal identity and never manufactures native completion`, () => {
    const f = fixture(platform), original = f.render(), first = f.calls.find(call => call[0] === 'attach'); f.replay(); const replayed = f.render();
    const attaches = f.calls.filter(call => call[0] === 'attach'); assert.equal(attaches.length, 2); assert.equal(attaches[1][1], first[1]); assert.equal(attaches[1][2], first[2]);
    assert.equal(replayed.props.configuration, original.props.configuration); assert.equal(f.calls.some(call => call[0] === 'event'), false); f.cleanup();
  });
}
test('foreign parent binding and unavailable configuration never attach or render a native portal', () => {
  const f = fixture('ios'); f.binding({ ...f.originalBinding, parent: { ...f.parent } }); assert.equal(f.render(), null); assert.equal(f.calls.length, 0); f.cleanup();
  const g = fixture('android'); g.binding({ ...g.originalBinding, marker: { tag: 0, nativeID: 'invalid-marker' } }); assert.equal(g.render(), null); assert.equal(g.calls.length, 0); g.cleanup();
});

for (const platform of ['android', 'ios']) test(`${platform}: actual platform Outlet mounts the real chain sheet carrier and resolves only original joined native close`, async () => {
  const s = require('./adminRootPresentationSupport.cjs'), native = require('./adminRootPresentationNativeSupport.cjs');
  const f = await native.nativeFixture(platform), capability = await s.sheetCapability(platform), source = new Set();
  try {
    await f.readyRoot();
    const opened = f.open('owned-source-body', { kind: 'sheet', ...capability,
      presentation: { platform, heightPoints: 426, cornerRadius: 24, ...(platform === 'android' ? { barrierOpacity: 0.32 } : {}) },
      subscribeCurrent: changed => { source.add(changed); return () => source.delete(changed); } });
    assert.ok(opened); assert.equal(source.size, 1); assert.equal(f.chain.canInteract(opened.entry), false);
    f.render();
    const portals = () => native.nodes(f.tree(), node => node.type === 'OriginalOwnedSheetView');
    assert.equal(portals().length, 1); assert.equal(f.modals().length, 1);
    const original = portals()[0], config = original.props.configuration;
    assert.equal(config.presentationTicket, opened.entry.id); assert.equal(config.parentTicket, f.chain.root.id);
    const parent = native.nodes(f.tree(), node => node.props.testID === 'admin-root-native-parent-slot' && node.props.nativeID === f.chain.root.id)[0];
    assert.equal(config.parentViewTag, parent.props.ref.current.tag); assert.equal(config.parentNativeID, parent.props.nativeID);
    assert.equal(native.nodes(parent, node => node.type === 'OriginalOwnedSheetView').length, 1);
    assert.equal(native.nodes(original, node => node.type === 'RealBody' && node.props.name === 'owned-source-body').length, 1);
    assert.equal(original.props.dismissalEnabled, false); assert.equal(f.chain.canInteract(opened.entry), false);
    let sequence = 0;
    const event = (kind, extra = {}) => original.props.onSheetEvent({ nativeEvent: { protocol: 1, kind, sequence: ++sequence,
      presentationTicket: opened.entry.id, parentTicket: f.chain.root.id, transaction: null, acceptedClose: null, reason: null, ...extra } });
    event('shown'); f.render(); assert.equal(f.chain.canInteract(opened.entry), true); assert.equal(portals()[0].props.dismissalEnabled, true);
    assert.equal(f.chain.requestClose(opened.entry), true); f.render();
    const accepted = portals()[0].props.acceptedClose; assert.ok(accepted); assert.equal(accepted.transaction, null);
    assert.equal(portals()[0].props.configuration, config); assert.equal(portals()[0].props.dismissalEnabled, false);
    const close = { transaction: 'original-native-close', acceptedClose: accepted.closeTicket };
    event('closeAccepted', close); f.render(); event('didDismiss', close); f.render();
    assert.equal(f.chain.sourceOutcome(opened.entry), null); assert.equal(portals().length, 1); assert.equal(source.size, 1);
    event('closeJoined', close); f.render();
    assert.equal(await opened.closed, 'closed'); assert.equal(portals().length, 0); assert.equal(source.size, 0);
    assert.equal(capability.calls.length, 0); assert.equal(f.chain.getSnapshot().resources.length, 0); assert.equal(f.chain.canInteract(f.chain.root), true);
    event('didDismiss', close); assert.equal(f.chain.sourceOutcome(opened.entry), 'closed');
  } finally { f.cleanup(); await s.flush(); }
});
