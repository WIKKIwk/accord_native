const source = require('./adminSourceDockScaffoldSupport.cjs'), routes = require('./adminRootRouterSupport.cjs');
const guards = source.load('shared/profileSessionGuard');
const localPlacement = source.load('admin/AdminSourceCreateHubPlacementOwner', { './adminPresentationWindowTicket': routes.tickets });
const scene = source.load('admin/AdminSourceSceneScaffoldOwner', { '../shared/profileSessionGuard': guards });
const readerDomain = source.load('admin/adminFixedSnackBarReader', { '../../modules/accord-admin-layout/src/AccordAdminScaffoldLayout': source.protocol,
  '../shared/camera/synchronousGuard': source.strict, './adminPresentationWindowTicket': routes.tickets });
function fixture(options = {}) {
  const native = source.fixture(), root = routes.fixture('android', { attachBase: false }), binding = root.owner.rootScene().binding;
  native.scaffoldOwner.detach(); let current = true, top = true, stopScene = null;
  const messenger = options.messenger ?? native.target, progress = options.progress ?? { get: () => 1 }, target = { messenger, progress }, counts = { create: options.messenger ? 0 : 1, attach: options.messenger ? 0 : 1 };
  const create = messenger.createScaffold.bind(messenger), attach = messenger.attachScaffold.bind(messenger);
  messenger.createScaffold = (...args) => { counts.create++; return create(...args); }; messenger.attachScaffold = (...args) => { counts.attach++; return attach(...args); };
  const ticket = options.messenger ? messenger.createScaffold({}, null) : native.scaffold, stopScaffold = options.messenger ? messenger.attachScaffold(ticket) : null;
  const scaffold = { messenger, progress, ticket, banner: messenger.bannerFor(ticket), accessibleNavigation: messenger.getSnapshot().accessibleNavigation };
  const reader = new readerDomain.AdminFixedSnackBarReaderOwner({ observer: native.native, messenger, isCurrent: () => true });
  const props = { ...native.props, identity: binding.identity, rootBinding: binding, reader, scaffold,
    isCurrent: () => typeof current === 'function' ? current() : current, canInteract: () => top };
  delete props.primaryTicket;
  const owner = new source.domain.AdminSourceDockScaffoldOwner(props, native.hub); owner.source(undefined, true);
  const rootContext = { controller: root.owner, binding, isCurrent: () => root.owner.readCurrent(binding), canInteract: () => root.owner.canInteract(binding) };
  const original = { root: rootContext, binding, source: owner, target }, scope = new scene.AdminSourceSceneScaffoldOwner(original);
  const detach = scope.attach(); scope.start();
  const commitScene = () => { stopScene ??= root.owner.attachScene(binding); };
  let registration, stopPrimary;
  const startSource = () => { owner.start(); owner.source(undefined, true); };
  const connectPrimary = () => { const generation = scope.getSnapshot().generation; registration = new source.primaryDomain.AdminSourcePrimaryRegistrationOwner({ identity: binding.identity, controller: native.hub, isCurrent: () => scope.readCurrent(generation), canInteract: () => scope.canInteract(generation) }, {}); stopPrimary = scope.connectPrimary(registration, generation); registration.commitFocus(true); registration.start(); return registration; };
  const commit = () => { commitScene(); startSource(); scope.start(); connectPrimary(); };
  const viewport = () => owner.bindViewport({ tag: 31, nativeID: owner.viewportID });
  const bindDock = () => { const value = owner.getSnapshot().target; owner.bindDock({ tag: 32, nativeID: value.nativeID }, value); };
  return { native, root, binding, messenger, progress, target, scaffold, reader, props, owner, rootContext, original, scope, counts, commit, commitScene, startSource, viewport, bindDock, connectPrimary, registration: () => registration,
    dropPrimary: () => { stopPrimary?.(); registration?.detach(); stopPrimary = null; registration = null; },
    current: value => { current = value; }, top: value => { top = value; }, dropScene: () => { stopScene?.(); stopScene = null; }, detach,
    cleanup: () => { stopPrimary?.(); registration?.detach(); detach(); scope.invalidate(); owner.detach(); reader.dispose(); stopScene?.(); stopScaffold?.(); root.owner.dispose(); root.rootStop(); native.cleanup(); messenger.createScaffold = create; messenger.attachScaffold = attach; } };
}
/** Controlled React effect/context harness; ONLY production Providers issue the values consumed by these scenes. */
function runtime() {
  const instances = new Map(), ids = new WeakMap(); let serial = 0, active, pending, visited, dirty = false, root, tree;
  const equal = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const effect = (create, deps, kind) => { const index = active.cursor++, old = active.slots[index]; if (!old || !equal(old.deps, deps)) { old?.cleanup?.(); const value = { create, deps, kind, depth: active.depth }; active.slots[index] = value; pending.push(value); } };
  const react = {
    createContext(initial) { const context = { current: initial }; context.Provider = { context }; return context; }, useContext: context => context.current,
    useMemo(create, deps) { const index = active.cursor++, old = active.slots[index]; if (!old || !equal(old.deps, deps)) active.slots[index] = { value: create(), deps }; return active.slots[index].value; },
    useRef(value) { const index = active.cursor++; return (active.slots[index] ??= { value: { current: value } }).value; },
    useState(initial) { const index = active.cursor++, instance = active; const slot = instance.slots[index] ??= { state: typeof initial === 'function' ? initial() : initial };
      return [slot.state, next => { const value = typeof next === 'function' ? next(slot.state) : next; if (!Object.is(value, slot.state)) { slot.state = value; instance.dirty = true; dirty = true; } }]; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); }, useLayoutEffect: (create, deps) => effect(create, deps, 'layout'), useEffect: (create, deps) => effect(create, deps, 'passive'),
    useSyncExternalStore(subscribe, get) { const index = active.cursor++, instance = active, old = instance.slots[index]; if (!old || old.subscribe !== subscribe) { old?.cleanup?.(); instance.slots[index] = { subscribe, cleanup: subscribe(() => { instance.dirty = true; dirty = true; }) }; } return get(); },
    isValidElement: value => !!value?.type,
  };
  const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props: props ?? {}, key }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key }) };
  function expand(node, position) {
    if (Array.isArray(node)) return node.map((value, index) => expand(value, `${position}/${value?.key ?? index}`));
    if (!node || typeof node !== 'object') return node;
    if (node.type?.context) { const context = node.type.context, previous = context.current; context.current = node.props.value; try { return { type: 'ActualContext.Provider', props: { ...node.props, children: expand(node.props.children, position + '/context') } }; } finally { context.current = previous; } }
    if (typeof node.type === 'function') {
      if (!ids.has(node.type)) ids.set(node.type, ++serial); const key = `${position}/${ids.get(node.type)}:${node.key ?? ''}`; let instance = instances.get(key);
      if (!instance) instances.set(key, instance = { slots: [], depth: key.split('/').length }); visited.add(key);
      if (instance.dirty || instance.props !== node.props) { const previous = active; active = instance; active.cursor = 0; instance.dirty = false; instance.props = node.props; instance.output = node.type(node.props); active = previous; }
      return expand(instance.output, key + '/out');
    }
    return { ...node, props: { ...node.props, children: expand(node.props?.children, position + '/children') } };
  }
  function render(value = root) {
    root = value;
    for (let i = 0; i < 40; i++) {
      dirty = false; pending = []; visited = new Set(); tree = expand(root, 'root');
      for (const [key, instance] of instances) if (!visited.has(key)) { instance.slots.forEach(value => value.cleanup?.()); instances.delete(key); }
      for (const kind of ['layout', 'passive']) pending.filter(value => value.kind === kind).sort((a, b) => b.depth - a.depth).forEach(value => { value.cleanup = value.create(); });
      if (!dirty) return tree;
    }
    throw Error('Original Source scene fixture did not settle');
  }
  return { react, jsx, render, dirty: () => dirty, tree: () => tree, cleanup() { for (const instance of instances.values()) instance.slots.forEach(value => value.cleanup?.()); instances.clear(); },
    replay() { const effects = [...instances.values()].flatMap(value => value.slots).filter(value => value.create); effects.slice().sort((a, b) => a.depth - b.depth).forEach(value => value.cleanup?.()); for (const kind of ['layout', 'passive']) effects.filter(value => value.kind === kind).sort((a, b) => b.depth - a.depth).forEach(value => { value.cleanup = value.create(); }); } };
}
/** Production Root descriptor -> SourceDock -> SAME-ticket ItemCreate, with controlled native/device/API edges. */
function nativeFixture(platform = 'android', options = {}) {
  const base = require('./adminItemDetailViewsSupport.cjs'), session = require('./adminItemCreateSessionSupport.cjs'), notices = require('./adminTopNoticeSupport.cjs');
  const domain = session.fixture(options), native = source.fixture(), r = runtime(), { react, jsx } = r, leaf = {}, nodes = base.nodes, counts = { create: 0, attach: 0, descriptor: 0, domain: 0, register: 0 };
  const clock = source.scheduler(), service = new notices.service.AdminTopNoticeService({ setTimer: clock.set, clearTimer: clock.clear }), authListeners = new Set(), frames = new Map();
  const messenger = new notices.messenger.AdminTopNoticeMessenger({ isCurrent: domain.owner.current }), create = messenger.createScaffold.bind(messenger), attach = messenger.attachScaffold.bind(messenger);
  messenger.createScaffold = (...args) => { counts.create++; return create(...args); }; messenger.attachScaffold = (...args) => { counts.attach++; return attach(...args); };
  const observer = new readerDomain.AdminFixedSnackBarReaderOwner({ observer: native.native, messenger, isCurrent: domain.owner.current });
  const oldRaf = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame; let serial = 0; global.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; }; global.cancelAnimationFrame = id => frames.delete(id);
  const animations = [], reanimated = { __esModule: true, default: { View: 'Animated.View' }, Easing: { linear: value => value, bezierFn: () => value => value },
    useAnimatedStyle: callback => callback(), useSharedValue: initial => react.useRef({ value: initial, get() { return this.value; }, set(value) { if (value?.animation) animations.push(value); else this.value = value; } }).current,
    withTiming: (target, configuration, callback) => ({ animation: true, target, configuration, callback }), cancelAnimation() {} };
  const rn = { View: 'View', Pressable: 'Pressable', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
    findNodeHandle: view => view?.tag ?? null, Platform: { OS: platform }, Keyboard: { dismiss() {}, addListener() { throw Error('No Activity keyboard subscription'); } }, BackHandler: { addEventListener: () => ({ remove() {} }) },
    AppState: { addEventListener() { throw Error('No Activity subscription'); } }, useWindowDimensions: () => ({ width: 9999, height: 7777, scale: 1 }) };
  const safe = react.createContext({ top: 999, left: 888, right: 777, bottom: 666 }), safeModule = { SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: safe, useSafeAreaInsets: () => react.useContext(safe) };
  const auth = { activeSessionEpoch: () => domain.authority.epoch, activeSessionToken: () => domain.authority.token, isSessionWitnessCurrent: value => value === domain.witness && domain.authority.witness,
    subscribeSessionWitness: callback => { authListeners.add(callback); return () => authListeners.delete(callback); } };
  const localeListeners = new Set(), locale = { locale: 'uz', addListener: listener => { localeListeners.add(listener); return () => localeListeners.delete(listener); } }, l10n = source.l10n, shellPolicy = source.load('admin/adminShellLayoutPolicy');
  const compile = (name, mocks = {}) => base.compile(name, { react, 'react/jsx-runtime': jsx, 'react-native': rn, 'react-native-safe-area-context': safeModule,
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: source.views.colors }) }, ...mocks });
  const rootContext = compile('AdminRootRouterContext.tsx'), noticeProvider = compile('AdminTopNoticeProvider.tsx', { 'react-native-reanimated': reanimated,
    'react-native-worklets': { scheduleOnRN: () => {} }, './adminTopNoticeModel': source.noticeModel });
  const dockModel = source.load('admin/adminDockModel', { '../shared/appRoutes': source.routes, '../shared/localization': l10n });
  const hubModel = source.load('admin/adminCreateHubModel', { './adminDockModel': dockModel, '../shared/camera/synchronousGuard': source.strict });
  const hubSession = source.load('admin/adminCreateHubSession', { '../auth': auth, '../sessionReadScope': { sessionReadScope: () => domain.authority.scope }, '../shared/camera/synchronousGuard': source.strict,
    './adminCreateHubController': source.hubDomain, './adminCreateHubModel': hubModel });
  const hub = compile('AdminCreateHubProvider.tsx', { 'expo-router': { useIsFocused: () => focused() }, '../auth': auth, '../shared/localization': l10n, '../shared/localization/runtime': { localeController: locale },
    './AdminCreateHubHost': { AdminCreateHubHost: 'LegacyHostMustNotPaint' }, './adminCreateHubModel': hubModel, './adminCreateHubSession': hubSession,
    './useAdminShellLayout': { useAdminShellLayout() { throw Error('No legacy Activity layout'); } } });
  const sourceContext = compile('AdminSourceSceneScaffoldContext.tsx', { './AdminRootRouterContext': rootContext, './AdminTopNoticeProvider': noticeProvider, './AdminSourceSceneScaffoldOwner': scene });
  const shellContext = compile('AdminShellSourceWindowLayoutContext.tsx'), inline = compile('AdminShellInlineSafeArea.tsx', { './AdminShellSourceWindowLayoutContext': shellContext });
  const shellHook = compile('useAdminShellLayout.ts', { './AdminShellSourceWindowLayoutContext': shellContext, './adminShellLayoutPolicy': shellPolicy,
    './adminShellLayoutRuntime': { AdminShellLayoutController: class { constructor() { throw Error('No Activity controller'); } } }, '../../modules/accord-admin-layout/src/AccordAdminLayoutModule': { subscribeAdminSystemInsets() { throw Error('No Activity metrics'); } } });
  const frame = compile('AdminShellBodyFrame.tsx', { './useAdminShellLayout': shellHook, './adminShellLayoutPolicy': shellPolicy });
  const bodyLayout = source.load('admin/adminItemCreateNativeLayout', { './adminSupplierScaffoldLayout': source.load('admin/adminSupplierScaffoldLayout') });
  const itemScaffold = compile('AdminItemCreateScaffold.tsx', { './AdminCreateHubProvider': hub, './AdminShellBodyFrame': frame, './adminItemCreateNativeLayout': bodyLayout });
  const sourceHook = compile('useAdminSourceDockScaffold.ts', { './AdminCreateHubProvider': hub, './AdminSourceDockScaffoldOwner': source.domain });
  const localHostExports = {};
  const sourceView = compile('AdminSourceDockScaffold.tsx', { './AdminCreateHubProvider': hub, './AdminShellSourceWindowLayoutContext': shellContext, './useAdminSourceDockScaffold': sourceHook, './AdminSourceSceneScaffoldContext': sourceContext, './AdminSourceCreateHubHost': localHostExports });
  const primary = compile('useAdminCreateHubSourcePrimary.ts', { 'expo-router': { useIsFocused: () => focused() }, './AdminCreateHubProvider': hub,
    './AdminSourcePrimaryRegistrationOwner': source.primaryDomain });
  const scopedPrimary = compile('useAdminSourceScenePrimary.ts', { '../shared/profileSessionGuard': guards, './useAdminCreateHubSourcePrimary': primary, './AdminSourceSceneScaffoldContext': sourceContext, './AdminSourceSceneScaffoldOwner': scene });
  const itemPrimaryHook = compile('useAdminItemCreatePrimaryAction.ts', { './AdminSourceSceneScaffoldContext': sourceContext });
  const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) }), compose = new Proxy({ Shape: { Pill: value => value, RoundedCorner: value => value } }, { get: (target, name) => target[name] ?? String(name) });
  const nativePrimary = compile(`AdminItemCreatePrimaryAction.${platform}.tsx`, { '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '@expo/ui/swift-ui': compose, '@expo/ui/swift-ui/modifiers': modifiers, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminTypography.android': { AdminText: 'Text' }, './AdminItemCreateNative.android': { ItemCreateIcon: 'Icon', itemCreateRounded: radius => ({ radius }) },
    './useAdminItemCreatePrimaryAction': itemPrimaryHook, './AdminSourceSceneScaffoldContext': sourceContext, './useAdminSourceScenePrimary': scopedPrimary });
  const localHook = compile('useAdminSourceCreateHubPlacement.ts', { './AdminSourceCreateHubPlacementOwner': localPlacement, '../shared/localization': l10n, '../shared/localization/runtime': { localeController: locale } });
  const floating = compile('AdminCreateHubFloating.tsx', { 'react-native-reanimated': reanimated, 'react-native-worklets': { scheduleOnRN() {} }, './adminCreateHubModel': hubModel,
    './useAdminCreateHubMotion': { useAdminCreateHubMotion() { throw Error('A held local primary cannot render a global overlay'); } } });
  const platformHub = compile(`AdminCreateHubHost.${platform}.tsx`, { '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': modifiers,
    '@expo/ui/swift-ui': compose, '@expo/ui/swift-ui/modifiers': modifiers, 'expo-symbols': { SymbolView: 'SymbolView' }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    './AdminTypography.android': { AdminText: 'Text' }, './AdminCreateHubFloating': floating });
  Object.assign(localHostExports, compile(`AdminSourceCreateHubHost.${platform}.tsx`, { [`./AdminCreateHubHost.${platform}`]: platformHub, './useAdminSourceCreateHubPlacement': {
    useAdminSourceCreateHubPlacement: sourceOwner => { const value = localHook.useAdminSourceCreateHubPlacement(sourceOwner); leaf.localPlacement = value.owner; return value; } } }));
  const scaffoldHook = compile('useAdminTopNoticeScaffold.ts', { './AdminTopNoticeProvider': noticeProvider });
  const boundary = compile('adminItemCreateScreenBoundary.ts', { '../shared/camera/synchronousGuard': source.strict, './AdminSourceSceneScaffoldOwner': scene });
  const gate = compile('AdminItemCreateSourceScene.tsx', { '../shared/profileSessionGuard': guards, './AdminRootRouterContext': rootContext, './AdminSourceSceneScaffoldContext': sourceContext,
    './AdminShellSourceWindowLayoutContext': shellContext, './AdminSourceSceneScaffoldOwner': scene, './adminItemCreateScreenBoundary': boundary, './useAdminTopNoticeScaffold': scaffoldHook });
  const itemHook = compile('useAdminItemCreate.ts', { 'expo-router': { useIsFocused: () => focused(), useFocusEffect: callback => react.useEffect(callback, [callback]) }, '../auth': auth,
    '../shared/profileSessionGuard': guards, '../shared/localization': l10n, '../shared/localization/runtime': { localeController: locale }, './AdminOwnedBackContext': { useAdminOwnedBack() {} },
    './adminItemCreateSession': domain.factory, './dartJsonString': source.strings });
  const noticeBridge = compile('useAdminItemCreateNoticePresentation.ts', { '../shared/localization': l10n, '../shared/localization/runtime': { localeController: locale }, '../shared/camera/synchronousGuard': source.strict, './adminTopNoticeRuntime': { adminTopNoticeService: service } });
  const noticeHost = compile('AdminTopNoticeHost.tsx', { 'react-native-reanimated': reanimated, './adminTopNoticeModel': source.noticeModel,
    './AdminTopNoticeContent': { AdminTopNoticeContent: ({ banner }) => jsx.jsx('OriginalNativeNoticeTextFixture', { banner, children: banner.message }) } });
  let model, sourceOwner, scopedOwner, originalScaffold, accessible = false, expectedOverride, expectedProvided = false, descriptorScene = true, screenProps;
  const nativeLeaf = (name, field) => props => { leaf[field] = props; return jsx.jsx(name, props); };
  // Explicitly controlled native placement edge for command protocol tests; never a production/default capability.
  const placements = new Set(), primaryHost = options.controlledPrimaryPlacement ? { identity: {}, isAvailable: request => placements.has(request.windowIdentity) && request.isCurrent(), ownsOverlayTop: () => false,
    renderPrimary: request => jsx.jsx('ControlledOriginalPrimaryHostFixture', { request, children: request.primary.replacement ? request.primary.replacementValue : jsx.jsx('ControlledNativeFabFixture', { onPress: () => { if (request.canOpenPrimary()) request.controller.open(request.ticket); } }) }),
    renderOverlay: request => jsx.jsx('ControlledOriginalOverlayHostFixture', { request }) } : null;
  const itemScreen = compile(`AdminItemCreateScreen.${platform}.tsx`, { 'expo-router': { Stack: { Screen: 'Stack.Screen' } }, './AdminCreateHubProvider': hub, './AdminShellInlineSafeArea': inline,
    './AdminItemCreateSourceScene': gate, './AdminItemCreateScaffold': itemScaffold, './AdminTopNoticeHost': { AdminTopNoticeHost: props => { leaf.notice = props; return jsx.jsx(noticeHost.AdminTopNoticeHost, props); } },
    './adminItemCreateScreenBoundary': boundary, './useAdminItemCreateNoticePresentation': noticeBridge,
    './useAdminItemCreate': { useAdminItemCreate: props => { counts.domain++; model = itemHook.useAdminItemCreate(props); return model; } },
    [`./AdminItemCreateHeader.${platform}`]: { AdminItemCreateHeader: nativeLeaf('ActualNativeHeaderFixture', 'header') }, [`./AdminItemCreateList.${platform}`]: { AdminItemCreateList: nativeLeaf('ActualNativeListFixture', 'list') },
    [`./AdminItemCreateOverlays.${platform}`]: { AdminItemCreateOverlays: nativeLeaf('ActualNativeOverlaysFixture', 'overlays') }, [`./AdminItemCreatePrimaryAction.${platform}`]: nativePrimary });
  function SourceContainer(props) {
    const scaffold = scaffoldHook.useAdminTopNoticeScaffold(props.sourceScaffoldAncestor);
    originalScaffold = scaffold;
    return jsx.jsx(sourceView.AdminSourceDockScaffold, { identity: props.binding.identity, rootBinding: props.binding, reader: observer, scaffold, sourceScaffoldAncestor: props.sourceScaffoldAncestor,
      isCurrent: props.isCurrent, canInteract: props.canInteract, thinGestureBottom: true, nativeScene: props.nativeScene, outlet: props.outlet, renderDock: () => jsx.jsx('ActualDockFixture', {}), hubNativeHost: primaryHost });
  }
  const root = routes.fixture(platform, { attachBase: false, rootOptions: { isCurrent: domain.owner.current, renderSceneContainer: props => jsx.jsx(SourceContainer, props) } }), binding = root.owner.rootScene().binding;
  function focused() { const state = root.state(); return state.routes[state.index]?.key === binding.routeKey; }
  const membership = compile('useAdminRootRouterSceneMembership.ts');
  const rootScene = compile(`AdminRootRouterScene.${platform}.tsx`, { './AdminRootRouterContext': rootContext, './useAdminRootRouterSceneMembership': membership,
    'expo-router': { NativeStackView: props => props.state.routes.map(route => props.descriptors[route.key].render()) } });
  const fixed = [], fixedHosts = [], outlet = jsx.jsx(function OutletProbe() { leaf.outletScope = sourceContext.useAdminSourceSceneScaffold(); leaf.outletWindow = shellContext.useAdminShellSourceWindowLayout(); return jsx.jsx('ActualOriginalOutletFixture', {}); }, {});
  screenProps = { ...domain.props, canInteract: () => true, backLabel: 'Back', topNoticeDismissLabel: 'Yopish', profileAction: jsx.jsx('ActualProfileFixture', {}), sourceScaffoldAncestor: null,
    renderPrimaryAction: value => jsx.jsx('ActualPrimaryRendererFixture', value), fixedSnackBars: { isAvailable: () => true, enqueue: value => fixed.push(value), render: props => { fixedHosts.push(props); return jsx.jsx('OriginalFixedHostFixture', props); } },
    dialogPortal: { isAvailable: () => true, render: value => jsx.jsx('OriginalDialogPortalFixture', value) }, windowObserver: { arm() {}, waitForDetach() {}, cancelPending() {}, cancel() {} } };
  delete screenProps.footer;
  delete screenProps.renderPrimaryAction;
  const renderDescriptor = () => { counts.descriptor++; return jsx.jsx(itemScreen.AdminItemCreateScreen, { ...screenProps, expectedRootBinding: expectedProvided ? expectedOverride : binding }); };
  const commitFrame = () => { const frameValue = root.frame(); frameValue.descriptors[binding.routeKey].render = renderDescriptor; return root.owner.commitFrame(frameValue); }; commitFrame(); root.detachRenderer();
  function SceneProbe() { sourceOwner = sourceContext.useAdminSourceSceneScaffold(); return null; }
  // Actual Source view owner is exposed through its Provider for assertions; no fabricated read lease is installed.
  const actualSourceProvider = sourceContext.AdminSourceSceneScaffoldProvider;
  sourceContext.AdminSourceSceneScaffoldProvider = props => { scopedOwner = props.source; return jsx.jsx(actualSourceProvider, { ...props, children: jsx.jsxs('Fragment', { children: [props.children, jsx.jsx(SceneProbe, {})] }) }); };
  // Recompile the view once to bind the instrumented real Provider export, not a substitute context.
  const viewWithProbe = compile('AdminSourceDockScaffold.tsx', { './AdminCreateHubProvider': hub, './AdminShellSourceWindowLayoutContext': shellContext, './useAdminSourceDockScaffold': sourceHook, './AdminSourceSceneScaffoldContext': sourceContext, './AdminSourceCreateHubHost': localHostExports });
  sourceView.AdminSourceDockScaffold = viewWithProbe.AdminSourceDockScaffold;
  function RendererHost() { react.useLayoutEffect(() => root.owner.attachRenderer(root.render), []); return descriptorScene ? jsx.jsx(rootScene.AdminRootRouterScene, { controller: root.owner, binding, outlet, state: { interactive: true, retained: false, retired: false } }) : null; }
  let globalHub; const seenHubs = new WeakSet();
  function HubProbe() { globalHub = hub.useAdminCreateHubSourceController(); if (!seenHubs.has(globalHub)) { seenHubs.add(globalHub); const register = globalHub.register.bind(globalHub); globalHub.register = request => { counts.register++; return register(request); }; } return null; }
  function App() { return jsx.jsx(noticeProvider.AdminTopNoticeProvider, { messenger, accessibleNavigation: accessible, children: jsx.jsx(hub.AdminCreateHubProvider, {
    session: domain.session, witness: domain.witness, isCurrent: domain.owner.current, isRouteAvailable: unavailable, onOpenRoute: noRoute, profileOnStack: false, sourceWindows: true,
    children: jsx.jsxs('Fragment', { children: [jsx.jsx(HubProbe, {}), jsx.jsx(RendererHost, {})] }) }) }); }
  function unavailable() { return false; } function noRoute() { throw Error('No unavailable destination can open'); }
  const render = () => r.render(jsx.jsx(App, {}));
  return { ...domain, ...r, root, binding, messenger, service, clock, observer, native, counts, leaf, fixed, fixedHosts, sourceContext, rootContext, compile, render,
    renderDirty: () => r.render(), commitFrame, model: () => model, scope: () => sourceOwner, sourceOwner: () => scopedOwner, originalScaffold: () => originalScaffold, props: screenProps, hub: () => globalHub,
    accessible: value => { accessible = value; }, expected: value => { expectedProvided = true; expectedOverride = value; }, descriptorScene: value => { descriptorScene = value; },
    runFrames: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    locale: value => { locale.locale = value; localeListeners.forEach(listener => listener()); },
    acknowledgePrimaryPlacement: () => { const request = scopedOwner.hubRequest(); if (!request) throw Error('An actual Reader window request is required'); placements.add(request.windowIdentity); },
    show: message => service.show(messenger, { message, tone: 'success' }), notify: () => authListeners.forEach(callback => callback()),
    cleanup: () => { r.cleanup(); observer.dispose(); root.owner.dispose(); root.rootStop(); native.cleanup(); messenger.retire(); global.requestAnimationFrame = oldRaf; global.cancelAnimationFrame = oldCancel; } };
}
module.exports = { ...source, routes, guards, scene, localPlacement, fixture, runtime, nativeFixture };
