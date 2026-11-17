const fs = require('node:fs'), Module = require('node:module');
const s = require('./adminRootPresentationSupport.cjs');
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter');
const { extendRouter } = require('../node_modules/expo-router/build/react-navigation/routers/extendRouter');
const { RouterActionHandling } = require('../node_modules/expo-router/build/react-navigation/routers/types');
const overridePath = require.resolve('../node_modules/expo-router/build/layouts/stack-router'), overrides = new Module(overridePath, module); overrides.filename = overridePath; overrides.paths = module.paths;
const original = overrides.require.bind(overrides); overrides.require = id => id === '../react-navigation/native' ? { StackRouter, extendRouter, RouterActionHandling } : original(id); overrides._compile(fs.readFileSync(overridePath, 'utf8'), overridePath);
const core = s.load('admin/adminRootRouterController', { '../shared/camera/synchronousGuard': s.guard, './adminPresentationWindowTicket': s.tickets });
function fixture(platform = 'ios', options = {}) {
  const native = s.fixture(platform), actions = [], rendered = [], backs = [], containers = [], router = overrides.exports.stackRouterOverride(StackRouter({})); let account = true;
  const base = { key: 'actual-home-key', name: 'home' }, names = ['home', 'owned/[id]'];
  let state = { type: 'stack', key: 'actual-stack', routeKeySeq: 1, index: 0, stale: false, routeNames: names, routes: [base] };
  let beforeDispatch = value => value, shouldThrow = false;
  const navigation = { getState: () => state, dispatch(action) { actions.push(action); if (shouldThrow) throw Error('controlled dispatch'); state = beforeDispatch(state, action); const next = router.getStateForAction(state, action, { routeNames: names, routeGetIdList: {} }); if (next?.state) state = next.state; }, setOptions() {}, isFocused: () => true, getParent: () => undefined };
  const makeContainer = kind => props => { containers.push({ kind, ...props }); return { type: 'ActualSourceSceneContainerFixture', props: { kind, originalAncestor: props.sourceScaffoldAncestor, children: [props.nativeScene, props.outlet] } }; };
  const rootOptions = { chain: native.chain, rootRouteName: 'home', isCurrent: () => account, onRequestClose: () => backs.push('root'), sourceScaffoldAncestor: null, renderSceneContainer: makeContainer('root'), ...options.rootOptions };
  const owner = new core.AdminRootRouterController(rootOptions);
  const render = (binding, outlet, value) => ({ type: 'ActualDescriptorRendererFixture', props: { binding, state: value, children: [owner.scene(binding)?.descriptor.render(), outlet] } });
  const detachRenderer = owner.attachRenderer(render); let descriptors;
  function frame(changes = {}) {
    descriptors = Object.fromEntries(state.routes.map(route => [route.key, { route, navigation, options: { title: route.name }, render: () => { rendered.push(route.key); return { type: 'ActualRouteBodyFixture', props: { route } }; } }]));
    return { state, navigation, descriptors, emit: event => actions.push(['event', event]), isPreloaded: key => state.routes.findIndex(route => route.key === key) > state.index,
      isRemovalPrevented: key => !!options.removalPrevented?.includes(key), ...changes };
  }
  const commit = changes => owner.commitFrame(frame(changes)); commit(); const stopBaseScene = options.attachBase === false ? null : owner.attachScene(owner.rootScene().binding);
  function open(changes = {}) { return owner.openPage({ parent: native.chain.top(), identity: {}, routeName: 'owned/[id]', presentation: s.presentation,
    isCurrent: () => account, onRequestClose: () => backs.push('page'), sourceScaffoldAncestor: null, renderSceneContainer: makeContainer('page'), ...changes }); }
  function bind(page) { commit(); const binding = owner.binding(page); if (!binding) throw Error('actual route failed to bind'); return binding; }
  function shown(page) { const value = native.native(page.native); value.ready(); return value; }
  return { ...native, owner, actions, rendered, backs, containers, rootOptions, navigation, frame, commit, open, bind, shown, render, detachRenderer, stopBaseScene,
    account: value => { account = value; }, state: () => state, stateTo: value => { state = value; }, beforeDispatch: fn => { beforeDispatch = fn; }, throwDispatch: value => { shouldThrow = value; }, descriptors: () => descriptors };
}
module.exports = { ...s, core, fixture };
