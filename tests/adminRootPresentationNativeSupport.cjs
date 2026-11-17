const { load, core, guard, tickets, presentation, deferred, flush } = require('./adminRootPresentationSupport.cjs');
function nodes(tree, match, output = []) {
  if (Array.isArray(tree)) tree.forEach(value => nodes(value, match, output));
  else if (tree && typeof tree === 'object') { if (match(tree)) output.push(tree); nodes(tree.props?.children, match, output); } return output;
}
async function nativeFixture(platform) {
  const calls = [], native = new Map(); let sequence = 0, tags = 100, current = true, tree, dirty = false, active, pending = [], visited, copies = 1;
  const raw = { capabilities: async () => ({ protocol: 1, platform: 'android', guarantee: 'window-tree-detach' }),
    arm: (viewTag, ticket) => { calls.push(['arm', viewTag, ticket]); const value = { protocol: 1, guarantee: 'window-tree-detach', handle: `root-window-${++sequence}`, ticket, viewTag, state: 'armed' }, arm = deferred(), detach = deferred(); native.set(ticket, { value, arm, detach }); return arm.promise; },
    waitForDetach: (handle, ticket) => { calls.push(['wait', handle, ticket]); return native.get(ticket).detach.promise; },
    cancelPending: async ticket => { calls.push(['pending-cancel', ticket]); return true; }, cancel: async (handle, ticket) => { calls.push(['cancel', handle, ticket]); return true; } };
  const adapter = load('admin/adminPresentationWindow', { expo: { requireOptionalNativeModule: () => raw } }), capability = await adapter.readAdminPresentationWindowCapability('android'), observer = capability.observer;
  const instances = new Map(), markers = new Map(), equal = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext(value) { const context = { value }; context.Provider = { context }; return context; },
    useContext(context) { return context.value; },
    useState(create) { const index = active.cursor++; if (!active.slots[index]) active.slots[index] = { value: typeof create === 'function' ? create() : create }; return [active.slots[index].value, value => { active.slots[index].value = value; dirty = true; }]; },
    useMemo(create, deps) { const index = active.cursor++; let value = active.slots[index]; if (!value || !equal(value.deps, deps)) active.slots[index] = value = { value: create(), deps }; return value.value; },
    useRef(value) { const index = active.cursor++; if (!active.slots[index]) active.slots[index] = { value: { current: value } }; return active.slots[index].value; },
    useLayoutEffect(create, deps) { const index = active.cursor++; let value = active.slots[index]; if (!value || !equal(value.deps, deps)) { value?.cleanup?.(); active.slots[index] = value = { create, deps, cleanup: null }; pending.push(() => { value.cleanup = create(); }); } },
    useSyncExternalStore(subscribe, get) { const index = active.cursor++; let value = active.slots[index]; if (!value || value.subscribe !== subscribe) { value?.cleanup?.(); active.slots[index] = value = { subscribe, cleanup: subscribe(() => { dirty = true; }) }; } return get(); },
  };
  const jsx = { jsx: (type, props, key) => ({ type, props: props ?? {}, key }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key }) };
  const windowOwner = load('admin/adminPresentationWindowOwner', { '../shared/camera/synchronousGuard': guard });
  const hook = load('admin/useAdminPresentationWindow', { react, './adminPresentationWindowOwner': windowOwner });
  const parentOwner = load('admin/adminRootNativeParentOwner', { '../shared/camera/synchronousGuard': guard });
  const parentContext = load('admin/AdminRootNativeParentContext.tsx', { react, 'react/jsx-runtime': jsx,
    'react-native': { View: 'View', StyleSheet: { create: value => value }, findNodeHandle: value => value?.tag ?? null }, './adminRootNativeParentOwner': parentOwner });
  const component = load(`admin/AdminRootPresentation.${platform}.tsx`, { react, 'react/jsx-runtime': jsx,
    'react-native': { Modal: 'Modal', View: 'View', StyleSheet: { create: value => value }, findNodeHandle: value => value?.tag },
    './adminRootPresentationChain': core, './adminPresentationWindowTicket': tickets, './useAdminPresentationWindow': hook, './AdminRootNativeParentContext': parentContext });
  const rootIdentity = {}, chain = new core.AdminRootPresentationChain({ platform, rootIdentity, isCurrent: () => current });
  const body = name => (outlet, state) => jsx.jsxs('RealBody', { name, state, children: [jsx.jsx('NativeControlFixture', { name }), outlet] });
  let props = { chain, rootIdentity, presentation, renderContent: body('root'), onRequestClose: () => calls.push('root-back'), windowObserver: observer };
  function expand(node, path) {
    if (Array.isArray(node)) return node.map((value, index) => expand(value, `${path}/${value?.key ?? index}`));
    if (!node || typeof node !== 'object') return node;
    if (node.type?.context) {
      const context = node.type.context, previous = context.value; context.value = node.props.value;
      try { return { ...node, props: { ...node.props, children: expand(node.props.children, `${path}/provider`) } }; }
      finally { context.value = previous; }
    }
    if (typeof node.type === 'function') {
      const key = `${path}/${node.type.name}:${node.key ?? ''}`; let instance = instances.get(key); if (!instance) instances.set(key, instance = { slots: [] }); visited.add(key); const previous = active; active = instance; active.cursor = 0;
      const output = node.type(node.props); active = previous; return expand(output, `${key}/out`);
    }
    if (node.type === 'View' && node.props.nativeID) { if (!markers.has(node.props.nativeID)) markers.set(node.props.nativeID, { tag: ++tags }); if (node.props.ref) node.props.ref.current = markers.get(node.props.nativeID); }
    return { ...node, props: { ...node.props, children: node.type === 'Modal' && !node.props.visible ? null : expand(node.props.children, `${path}/children`) } };
  }
  function render() {
    for (let i = 0; i < 12; i++) {
      dirty = false; pending = []; visited = new Set(); tree = expand(Array.from({ length: copies }, (_, index) => jsx.jsx(component.AdminRootPresentationRootCarrier, props, `host-${index}`)), 'root');
      for (const [key, instance] of instances) if (!visited.has(key)) { instance.slots.forEach(slot => slot.cleanup?.()); instances.delete(key); }
      pending.splice(0).forEach(run => run()); if (!dirty) return tree;
    } throw Error('Native Root fixture did not settle');
  }
  const modals = () => nodes(tree, value => value.type === 'Modal');
  function marker(index) { const modal = modals()[index]; return nodes(modal.props.children, value => value.type === 'View' && value.props.nativeID && value.props.testID !== 'admin-root-native-parent-slot')[0]; }
  const layout = index => { const value = marker(index); value.props.onLayout(); return value.props.nativeID; };
  const ack = async index => { const ticket = marker(index).props.nativeID, value = native.get(ticket); value.arm.resolve(value.value); await flush(); render(); };
  const detach = async ticket => { const value = native.get(ticket); value.detach.resolve({ ...value.value, state: 'detached' }); await flush(); render(); };
  const readyRoot = async () => { render(); if (platform === 'android') { layout(0); await ack(0); } modals()[0].props.onShow(); render(); };
  const open = (name, changes = {}) => chain.open({ parent: chain.top(), identity: {}, kind: 'dialog', renderContent: body(name), presentation: { ...presentation, transparent: true, presentationStyle: 'overFullScreen' }, isCurrent: () => current, onRequestClose: () => calls.push(['close', name]), ...changes });
  const replay = () => { const effects = [...instances.values()].flatMap(value => value.slots).filter(value => value.create); effects.forEach(value => value.cleanup?.()); effects.forEach(value => { value.cleanup = value.create(); }); };
  const cleanup = () => { for (const instance of instances.values()) instance.slots.forEach(value => value.cleanup?.()); instances.clear(); };
  return { chain, rootIdentity, calls, native, observer, component, parentContext, jsx, props: value => { props = { ...props, ...value }; }, copies: value => { copies = value; }, render, modals, layout, ack, detach, readyRoot, open, replay, cleanup, current: value => { current = value; }, tree: () => tree };
}
module.exports = { nativeFixture, nodes };
