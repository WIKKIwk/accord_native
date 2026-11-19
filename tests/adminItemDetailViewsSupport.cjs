const { adminShellThemeFixture } = require('./support/adminShellTheme.cjs');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const s = require('./adminItemDetailDecisionSupport.cjs'), combos = require('./adminItemDetailComboSupport.cjs');
function compile(name, mocks) {
  const filename = path.resolve(__dirname, '../src/admin', name), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] :
    id === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : require(id); mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const date = s.load('dailyWork', { './apparatusApi': {}, './workerProgressModel': {}, './workerProgressApi': {}, './workerControlsApi': {} });
const presentation = compile('AdminItemDetailReadPresentation.ts', { '../dailyWork': date, './adminItemDetailModel': s.model, './dartJsonString': s.strings });
function runtime() {
  const instances = new Map(); let active, pending, visited, dirty = false, root, tree;
  const equal = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  function effect(create, deps, kind) { const index = active.cursor++, instance = active; let value = instance.slots[index]; if (!value || !equal(value.deps, deps)) { value?.cleanup?.(); instance.slots[index] = value = { create, deps, kind, depth: instance.depth }; pending.push(value); } }
  const react = {
    useMemo(create, deps) { const index = active.cursor++; let value = active.slots[index]; if (!value || !equal(value.deps, deps)) active.slots[index] = value = { value: create(), deps }; return value.value; },
    useRef(value) { const index = active.cursor++; if (!active.slots[index]) active.slots[index] = { value: { current: value } }; return active.slots[index].value; },
    useState(initial) { const index = active.cursor++, instance = active; if (!instance.slots[index]) instance.slots[index] = { state: typeof initial === 'function' ? initial() : initial }; const value = instance.slots[index]; return [value.state, next => { const state = typeof next === 'function' ? next(value.state) : next; if (!Object.is(state, value.state)) { value.state = state; instance.dirty = true; dirty = true; } }]; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useLayoutEffect(create, deps) { effect(create, deps, 'layout'); }, useEffect(create, deps) { effect(create, deps, 'passive'); },
    useSyncExternalStore(subscribe, get) { const index = active.cursor++, instance = active; let value = active.slots[index]; if (!value || value.subscribe !== subscribe) { value?.cleanup?.(); active.slots[index] = value = { subscribe, cleanup: subscribe(() => { instance.dirty = true; dirty = true; }) }; } return get(); },
    isValidElement: value => !!value && typeof value === 'object' && !!value.type,
  };
  const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props: props ?? {}, key }), jsxs: (type, props, key) => ({ type, props: props ?? {}, key }) };
  function expand(node, position, force = false) {
    if (Array.isArray(node)) return node.map((value, index) => expand(value, `${position}/${value?.key ?? index}`, force));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const key = `${position}/${node.type.name}:${node.key ?? ''}`; let instance = instances.get(key); if (!instance) instances.set(key, instance = { slots: [], depth: key.split('/').length }); visited.add(key);
      if (force || instance.dirty || instance.props !== node.props) { const previous = active; active = instance; active.cursor = 0; instance.dirty = false; instance.props = node.props; instance.output = node.type(node.props); active = previous; }
      return expand(instance.output, `${key}/out`);
    } return { ...node, props: { ...node.props, children: expand(node.props.children, `${position}/children`, force) } };
  }
  function render(value = root, forceRoot = true) {
    root = value;
    for (let i = 0; i < 18; i++) {
      dirty = false; pending = []; visited = new Set(); tree = expand(root, 'root', forceRoot && i === 0);
      for (const [key, instance] of instances) if (!visited.has(key)) { instance.slots.forEach(value => value.cleanup?.()); instances.delete(key); }
      for (const kind of ['layout', 'passive']) pending.filter(value => value.kind === kind).sort((a, b) => b.depth - a.depth).forEach(value => { value.cleanup = value.create(); });
      if (!dirty) return tree;
    } throw Error('Item detail native fixture did not settle');
  }
  return { react, jsx, render, renderDirty: () => render(root, false), tree: () => tree,
    replay() { const effects = [...instances.values()].flatMap(instance => instance.slots).filter(value => value.create).sort((a, b) => b.depth - a.depth); effects.forEach(value => value.cleanup?.()); for (const kind of ['layout', 'passive']) effects.filter(value => value.kind === kind).forEach(value => { value.cleanup = value.create(); }); },
    cleanup() { for (const instance of instances.values()) instance.slots.forEach(value => value.cleanup?.()); instances.clear(); },
  };
}
function nodes(tree, match, output = []) { if (Array.isArray(tree)) tree.forEach(value => nodes(value, match, output)); else if (tree && typeof tree === 'object') { if (match(tree)) output.push(tree); nodes(tree.props?.children, match, output); } return output; }
function id(node, key) { return node.props?.testID === key || node.props?.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.type) && value.args[0] === key); }
const byID = (tree, key) => nodes(tree, value => id(value, key))[0];
function text(tree) { if (tree == null || typeof tree === 'boolean') return ''; if (typeof tree !== 'object') return String(tree); if (Array.isArray(tree)) return tree.map(text).join('|'); return text(tree.props?.children); }
function fixture(platform, options = {}) {
  const r = runtime(), { react, jsx } = r, calls = [], subscribers = new Set(), colors = { surface: '#FFFFFF', surfaceContainerHigh: '#EEEEEE', surfaceContainerHighest: '#DDDDDD', onSurface: '#111111', onSurfaceVariant: '#666666', secondaryContainer: '#C0C0FF', onSecondaryContainer: '#111166', primary: '#3344CC', onPrimary: '#FFFFFF', error: '#BB2222' };
  const session = options.session ?? { token: 'original', baseUrl: 'https://erp.example', profile: { role: 'admin', ref: 'A' } }, witness = options.witness ?? { session };
  let current = true, interactive = true, epoch = 1, scope = 'scope', allowed = true, detail = options.detail ?? s.detail(), detailRead = options.read ?? (() => Promise.resolve(detail)), comboEntry = options.comboEntry ?? combos.entry(), comboRead = options.comboRead ?? (() => Promise.resolve(comboEntry)), comboAllowed = options.comboAllowed ?? true, productRead = options.productRead ?? (() => Promise.resolve('Resolved product'));
  const auth = { activeSessionEpoch: value => value === session ? epoch : null, activeSessionToken: value => value === session ? session.token : null, isSessionWitnessCurrent: value => value === witness,
    subscribeSessionWitness: callback => { subscribers.add(callback); return () => subscribers.delete(callback); } };
  const api = { adminItemDetail: async (value, code, request, guard, readWitness) => { guard(); if (!readWitness()) throw Error('witness'); calls.push(['read', code, request]); const result = await detailRead(); guard(); return result; },
    adminUpdateItemDetail: async (value, draft, guard) => { guard(); calls.push(['rename', draft]); return s.detail({ ...detail, code: draft.code, name: draft.name }); },
    adminDeleteItemDetail: async (value, code, guard) => { guard(); calls.push(['delete', code]); },
    adminItemDetailGroups: async (value, guard, readWitness) => { guard(); readWitness(); calls.push(['groups']); return ['A', 'B']; } };
  const sessionModule = s.load('admin/adminItemDetailDecisionSession', { '../auth': auth, '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminItemDetail: '/item-detail' }, canOpenRoute: () => allowed }, '../shared/camera/synchronousGuard': s.sync, './adminItemDetailApi': api, './adminItemDetailDecisionController': s.decisions });
  const comboModule = s.load('admin/adminItemDetailComboSession', { '../auth': auth, '../sessionReadScope': { sessionReadScope: () => scope }, '../shared/appRoutes': { appRoutes: { adminItemDetail: '/item-detail' }, canOpenRoute: () => allowed }, '../shared/camera/synchronousGuard': s.sync,
    './adminItemDetailComboController': combos.controllers, './adminItemDetailComboApi': { canReadAdminItemDetailCombo: () => comboAllowed, adminItemDetailCombo: async (value, code, guard, readWitness) => { guard(); readWitness(); calls.push(['combo', code]); const result = await comboRead(); guard(); return result; }, adminItemDetailComboProductName: async (value, code, guard, readWitness) => { guard(); readWitness(); calls.push(['product', code]); const result = await productRead(); guard(); return result; } } });
  const TopAppBar = Object.assign(props => jsx.jsx('TopAppBar', props), { NavigationIcon: 'NavigationIcon', Title: 'Title' });
  const modifiers = new Proxy({}, { get: (target, type) => (...args) => ({ type, args }) }), shape = { RoundedCorner: value => ({ type: 'rounded', value }) }, ui = new Proxy({ Shape: shape, TopAppBar }, { get: (target, key) => key in target ? target[key] : String(key) });
  const theme = () => ({ colors, mode: 'light', seed: '#3344CC', direction: options.direction ?? 'ltr' });
  const baseAndroid = options.actualBaseHost ? compile('../components/BaseHost.android.tsx', { 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': ui, './useBaseThemeConfig': { useBaseThemeConfig: theme } }) : { BaseHost: 'BaseHost' };
  const profileGuard = s.load('shared/profileSessionGuard');
  const loaded = new Map(), mocks = { './AdminTopBar.android': require('./support/adminChrome.cjs'), react, 'react/jsx-runtime': jsx,
    'react-native': { Image: 'NativeImage', View: 'View', ScrollView: 'ScrollView', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, Easing: { linear: 'linear' }, useSharedValue: value => react.useRef({ value, set(next) { this.value = next; } }).current, useAnimatedStyle: create => create(), withTiming: (value, config) => { calls.push(['fade', value, config]); return value; } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, '../auth': auth,
    '../components/BaseHost.android': baseAndroid, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: theme },
    '../shared/localization': { adminText: key => key, localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } }, '../shared/profileSessionGuard': profileGuard, '../shared/camera/synchronousGuard': s.sync,
    './AdminTypography.android': { AdminText: 'Text' }, './AdminShellBodyFrame': options.frameFacts ? require('./adminShellFrameViewSupport.cjs').frameModule(colors, options.frameFacts) : { AdminShellBodyFrame: 'BodyFrame' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' },
    './adminItemDetailDecisionSession': sessionModule, './adminItemDetailComboSession': comboModule, './adminItemDetailComboPresentation': combos.presentation,
    './adminItemDetailImagePresentation': s.load('admin/adminItemDetailImagePresentation', { '../orderImageUri': s.load('orderImageUri'), './dartJsonString': s.strings }),
    './adminItemDetailImageProvider': { createAdminItemDetailImageProvider: options.imageProvider ?? (() => { throw Error('A real controlled image provider is required for this test'); }) },
    '../dailyWork': date, './adminItemDetailModel': s.model, './dartJsonString': s.strings,
  };
  function moduleFor(name) { if (loaded.has(name)) return loaded.get(name); const filename = path.resolve(__dirname, '../src/admin', name), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = value => Object.hasOwn(mocks, value) ? mocks[value] :
      value === './useAdminShellTheme' ? adminShellThemeFixture(mocks, filename) : value.startsWith('./AdminItemDetail') ? moduleFor(value.slice(2) + (fs.existsSync(path.resolve(__dirname, '../src/admin', value.slice(2) + '.tsx')) ? '.tsx' : '.ts')) : require(value);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); loaded.set(name, mod.exports); return mod.exports;
  }
  const ownerModule = moduleFor('AdminItemDetailReadOwner.ts'), read = moduleFor(`AdminItemDetailRead.${platform}.tsx`).AdminItemDetailRead;
  let model;
  function OwnerHarness(props) { model = ownerModule.useAdminItemDetailRead(props); return jsx.jsx('Model', { model }); }
  let props = { session, witness, pageIdentity: {}, itemCode: ' Route code ', isCurrent: () => current, canInteract: () => interactive, onBack: changed => calls.push(['back', changed]), backLabel: 'Back', footer: jsx.jsx('RealDock', {}),
    presentations: { render: context => { model = context; return jsx.jsx('ActualPresenterFixture', { context }); }, onActions: (...args) => calls.push(['actions', ...args]) }, renderNativeHeader: header => jsx.jsx('RealNativeHeaderFixture', { header, children: header.backAction }) };
  return { ...r, calls, colors, session, witness, jsx, moduleFor, ownerModule, read, model: () => model, props: changes => { props = { ...props, ...changes }; },
    renderRead: () => r.render(jsx.jsx(read, props)), renderOwner: () => { const tree = r.render(jsx.jsx(OwnerHarness, props)); return model; },
    current: value => { current = value; }, interactive: value => { interactive = value; }, epoch: value => { epoch = value; }, scope: value => { scope = value; }, allowed: value => { allowed = value; }, notify: () => subscribers.forEach(callback => callback()),
    detail: value => { detail = value; }, detailRead: value => { detailRead = value; }, comboRead: value => { comboRead = value; }, comboAllowed: value => { comboAllowed = value; }, productRead: value => { productRead = value; }, propsValue: () => props,
  };
}
module.exports = { s, combos, compile, presentation, runtime, fixture, nodes, byID, text };
