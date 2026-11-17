const test = require('node:test'), assert = require('node:assert/strict');
const s = require('./adminRootRouterNativeSupport.cjs');

for (const platform of ['android', 'ios']) {
  test(`${platform}: actual descriptor body renders once, original outlet remains INSIDE its real carrier content`, async () => {
    const f = s.fixture(platform), page = f.bindPage(), tree = f.render(), binding = f.binding();
    assert.ok(f.rendered.length > 0 && f.rendered.every(key => key === binding.routeKey)); assert.equal(s.nodes(tree, node => node.type === 'ActualOriginalOutletFixture').length, 1); assert.equal(s.nodes(tree, node => node.type === 'ActualRouteBodyFixture').length, 1);
    assert.equal(f.chain.canInteract(page.native), false); f.ready(); assert.equal(f.owner.canInteract(binding), true);
    if (platform === 'android') assert.equal(f.calls.length, 0); else { const props = f.calls[0][1], actual = f.owner.scene(binding); assert.deepEqual(props.state.routes, [actual.route]); assert.equal(props.state.routes[0], actual.route); assert.equal(props.state.index, 0); assert.equal(props.descriptors[binding.routeKey], actual.descriptor); assert.equal(Object.keys(props.descriptors).length, 1); }
    f.cleanup(); f.owner.dispose(); await s.flush();
  });
  test(`${platform}: read authority remains original through covered logical page, live native authority rejects stale captured snapshot`, async () => {
    const f = s.fixture(platform), page = f.bindPage(); f.render(); f.ready(); const tree = f.render(), value = s.nodes(tree, node => node.type === 'ActualRootAuthorityProvider')[0].props.value;
    assert.equal(value.isCurrent(), true); assert.equal(value.canInteract(), true); const next = f.open(); f.commit(); assert.ok(next); assert.equal(value.isCurrent(), true); assert.equal(value.canInteract(), false); f.owner.requestBack(f.binding()); assert.deepEqual(f.backs, []);
    f.account(false); assert.equal(value.isCurrent(), false); assert.equal(value.canInteract(), false); f.cleanup(); f.owner.dispose(); assert.equal(await page.closed, 'retired');
  });
  test(`${platform}: same actual binding gets live original descriptor options/body without remounting a foreign route`, async () => {
    const f = s.fixture(platform); f.bindPage(); f.render(); f.ready(); const binding = f.binding(), frame = f.frame(); frame.descriptors[binding.routeKey].options.headerSearchBarOptions = { placeholder: 'Source original search', ref: { current: 'actual-native-search-reference-fixture' } };
    f.owner.commitFrame(frame); f.render(); const scene = f.owner.scene(binding); assert.equal(scene.descriptor, frame.descriptors[binding.routeKey]);
    if (platform === 'ios') { const native = f.calls.at(-1)[1]; assert.equal(native.descriptors[binding.routeKey].options.headerSearchBarOptions.ref, scene.descriptor.options.headerSearchBarOptions.ref); }
    assert.equal(f.owner.binding(f.page()), binding); f.cleanup(); f.owner.dispose();
  });
  test(`${platform}: public standard navigator factory forwards actual SDK state/descriptors/helpers and forces retained Source effects`, () => {
    const f = s.fixture(platform); let content, options;
    function StandardNavigator(props) { return { type: 'ActualStandardNavigatorFixture', props }; }
    StandardNavigator.Screen = 'SDKScreen'; StandardNavigator.Protected = 'SDKProtected';
    const ui = f.compile(`AdminRootRouter.${platform}.tsx`, { 'expo-router': { StackRouter: 'installedStackRouterFixture', createStandardRouterNavigator: (component, router, value) => { content = component; options = value; assert.equal(router, 'installedStackRouterFixture'); return StandardNavigator; } },
      [`./AdminRootPresentation.${platform}`]: { AdminRootPresentationRootCarrier: 'ActualRootCarrierFixture' }, './useAdminRootRouterHost': { useAdminRootRouterHost: (owner, frame) => { assert.equal(owner, f.owner); assert.equal(frame.state, facts.actualState); assert.equal(frame.descriptors, descriptors); assert.equal(frame.navigation, f.navigation); assert.equal(frame.isPreloaded, facts.isPreloaded); assert.equal(frame.isRemovalPrevented, facts.isRemovalPrevented); return { renderContent: 'original-renderer-fixture', onRequestClose: 'original-back-fixture' }; } } });
    const raw = f.frame(), facts = options.createProps({ state: raw.state, navigation: raw.navigation, isPreloaded: raw.isPreloaded, isRemovalPrevented: raw.isRemovalPrevented }), descriptors = raw.descriptors;
    const nativeRoot = { rootIdentity: f.rootIdentity, presentation: s.presentation };
    const wrapped = ui.AdminRootRouter({ controller: f.owner, nativeRoot, activityEnabled: true, windowObserver: { original: true } }); assert.equal(wrapped.props.activityEnabled, false); assert.equal(ui.AdminRootRouter.Screen, StandardNavigator.Screen);
    // Invoke the real component through the runtime so its memoized frame contains the exact SDK objects.
    f.renderElement(f.jsx.jsx(content, { controller: f.owner, nativeRoot, ...facts, descriptors, emitter: { emit: raw.emit }, windowObserver: { original: true } })); f.cleanup(); f.owner.dispose();
  });
  test(`${platform}: required original Source wrapper surrounds the FULL native scene/header and preserves descriptor once`, () => {
    const f = s.fixture(platform), ancestor = Object.freeze({ actualSourceAncestorFixture: true }); f.bindPage({ sourceScaffoldAncestor: ancestor }); const tree = f.render(), container = f.containers.at(-1);
    assert.equal(container.sourceScaffoldAncestor, ancestor); assert.equal(container.binding, f.binding()); assert.equal(container.nativeParent, f.page().native); assert.ok(f.containers.every(value => value.binding === f.binding())); assert.ok(f.rendered.length > 0 && f.rendered.every(key => key === f.binding().routeKey));
    const outer = s.nodes(tree, node => node.type === 'ActualRootAuthorityProvider')[0], wrapped = s.nodes(outer, node => node.type === 'ActualSourceSceneContainerFixture')[0]; assert.ok(wrapped); assert.equal(wrapped.props.originalAncestor, ancestor); assert.equal(s.nodes(wrapped, node => node.type === 'ActualRouteBodyFixture').length, 1); assert.equal(s.nodes(wrapped, node => node.type === 'ActualOriginalOutletFixture').length, 1);
    assert.equal(container.isCurrent(), true); assert.equal(container.canInteract(), false); assert.equal(f.chain.getSnapshot().entries.length, 1); f.cleanup(); f.owner.dispose();
  });
  test(`${platform}: retired Source caller retains its original wrapper/ancestor/native scene/outlet while real descendant closes`, async () => {
    const f = s.fixture(platform), ancestor = {}, calls = []; let live = true;
    const wrapper = props => { calls.push(props); return f.jsx.jsxs('OriginalRetainedSourceScaffoldFixture', { children: [props.nativeScene, props.outlet] }); };
    f.bindPage({ sourceScaffoldAncestor: ancestor, renderSceneContainer: wrapper, isCurrent: () => live }); f.render(); f.ready(); const child = f.chain.open({ parent: f.page().native, identity: {}, kind: 'dialog', presentation: { ...s.presentation, transparent: true, presentationStyle: 'overFullScreen' }, renderContent: s.content, isCurrent: () => true, onRequestClose: () => f.backs.push('actual-child-back') });
    const childNative = f.shown({ native: child.entry }); live = false; assert.equal(f.owner.readCurrent(f.binding()), false); assert.equal(await f.page().closed, 'retired'); const tree = f.render(), retained = calls.at(-1);
    assert.equal(retained.retired, true); assert.equal(retained.retained, true); assert.equal(retained.isCurrent(), false); assert.equal(retained.canInteract(), false); assert.equal(retained.sourceScaffoldAncestor, ancestor);
    assert.equal(s.nodes(tree, node => node.type === 'OriginalRetainedSourceScaffoldFixture').length, 1); assert.equal(s.nodes(tree, node => node.type === 'ActualRouteBodyFixture').length, 1); assert.equal(s.nodes(tree, node => node.type === 'ActualOriginalOutletFixture').length, 1); assert.ok(f.rendered.every(key => key === f.binding().routeKey));
    f.chain.requestClose(child.entry); childNative.removed(); assert.equal(await child.closed, 'closed'); f.cleanup(); f.owner.dispose();
  });
  test(`${platform}: wrapper invocation alone and dropped native scene cannot grant actual scene membership/readiness`, () => {
    const f = s.fixture(platform); f.bindPage({ renderSceneContainer: props => f.jsx.jsx('ActualWrapperMissingSceneFixture', { children: props.outlet }) }); const tree = f.render();
    assert.equal(f.rendered.length, 0); assert.equal(s.nodes(tree, node => node.type === 'ActualOriginalOutletFixture').length, 1); f.ready(); assert.equal(f.chain.canInteract(f.page().native), true); assert.equal(f.owner.canInteract(f.binding()), false); f.cleanup(); f.owner.dispose();
  });
}

test('iOS original native event/pop callbacks cannot dispatch from another route, blur, closing or retired owner', async () => {
  const f = s.fixture('ios'); f.bindPage(); f.render(); f.ready(); f.render(); const p = f.calls.at(-1)[1], key = f.binding().routeKey;
  p.pop(2, key); p.pop(1, 'foreign-key'); assert.deepEqual(f.backs, []); p.pop(1, key); assert.deepEqual(f.backs, ['page']);
  p.emit({ type: 'transitionEnd', target: 'foreign-key', data: { closing: false } }); assert.equal(f.actions.filter(value => Array.isArray(value)).length, 0);
  p.emit({ type: 'transitionEnd', target: key, data: { closing: false } }); assert.equal(f.actions.filter(value => Array.isArray(value)).length, 1);
  const untargeted = { type: 'gestureCancel' }; p.emit(untargeted); assert.equal(f.actions.at(-1)[1], untargeted); assert.equal(Object.hasOwn(untargeted, 'target'), false); // Public emit permits undefined target; do not manufacture one.
  f.owner.closePage(f.page()); p.pop(1, key); assert.deepEqual(f.backs, ['page']); f.account(false); p.emit({ type: 'transitionEnd', target: key, data: { closing: false } }); assert.equal(f.actions.filter(value => Array.isArray(value)).length, 2); f.cleanup(); f.owner.dispose();
});
test('installed SDK58 descriptor.render retains ORIGINAL NavigationProvider/SceneView/removal tree, not hand-copied navigation contexts', () => {
  const runtime = require('./adminItemDetailViewsSupport.cjs').runtime(), { react, jsx } = runtime, f = s.fixture(); let output;
  react.use = context => context.value;
  react.createContext = value => ({ value, Provider: 'SDKProvider' });
  const originalSceneView = s.loadSDK('react-navigation/core/SceneView', { react, 'react/jsx-runtime': jsx,
    '../../global-state/removalPrevention': {}, './EnsureSingleNavigator': {}, './IsPreloadedContext': {}, './NavigationFocusedRouteStateContext': {}, './NavigationStateContext': {}, './StaticContainer': {}, './useOptionsGetters': {} }).SceneView;
  const ActualSDKNavigationProvider = s.loadSDK('react-navigation/core/NavigationProvider', { react, 'react/jsx-runtime': jsx }).NavigationProvider;
  const hook = s.loadSDK('react-navigation/core/useDescriptors', { react, 'react/jsx-runtime': jsx,
    '../../views/NavigationActivityContext': { NavigationActivityProvider: 'SDKNavigationActivityProvider' }, './NavigationBuilderContext': { NavigationBuilderContext: { value: { handleAction: f.navigation.dispatch, resetNavigator: f.navigation.getState }, Provider: 'SDKNavigationBuilderProvider' } },
    './NavigationProvider': { NavigationProvider: ActualSDKNavigationProvider }, './SceneView': { SceneView: originalSceneView }, './theming/ThemeContext': { ThemeContext: { value: {} } },
    './useNavigationCache': { useNavigationCache: () => () => f.navigation }, './useRouteCache': { useRouteCache: routes => routes } }).useDescriptors;
  const frame = f.frame(), routes = frame.state.routes, screens = { home: { props: { name: 'home', component: function ActualFilePage() { return jsx.jsx('OriginalActualFilePageFixture', {}); }, options: { title: 'Source title' } } } };
  function Harness() { output = hook({ routes, routeNames: frame.state.routeNames, screens, activityEnabled: false, navigation: f.navigation, state: frame.state, addListener: f.owner.subscribe, router: {}, emitter: { emit: frame.emit } }); return null; }
  runtime.render(jsx.jsx(Harness, {})); const actual = output.descriptors[routes[0].key], wrapped = actual.render();
  assert.equal(wrapped.type, 'SDKNavigationActivityProvider'); assert.equal(wrapped.props.activityThreshold, undefined);
  const nav = wrapped.props.children.props.children; assert.equal(nav.type, ActualSDKNavigationProvider); assert.equal(nav.props.navigation, f.navigation); assert.equal(nav.props.route, routes[0]); assert.equal(nav.props.children.type, originalSceneView); assert.equal(nav.props.children.props.navigation, f.navigation);
  frame.descriptors = output.descriptors; assert.equal(f.owner.commitFrame(frame), true); assert.equal(f.owner.rootScene().descriptor, actual); runtime.cleanup(); f.owner.dispose();
});
