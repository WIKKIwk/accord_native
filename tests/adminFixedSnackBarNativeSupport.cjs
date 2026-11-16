/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript'), s = require('./adminFixedSnackBarSupport.cjs'), view = require('./adminSupplierDetailViewSupport.cjs');
const { Easing, flattenStyle } = require('./adminTopNoticeNativeSupport.cjs');
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
function compileWithKeys(filename, mocks) {
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function fixture(platform = 'android', options = {}) {
  const f = s.fixture({ driver: false, geometry: false, ...options }), providerRuntime = view.runtime(), animations = [], tasks = [], values = [], gestures = [], frames = [], observations = [];
  let activeRuntime = providerRuntime, readerAvailable = true, top = true, ticker = true, alive = true, serial = 0, frameTime = 0;
  const visibilityListeners = new Set(), reader = { isAvailable: () => readerAvailable, observe(request, receive) { const item = { request, receive, stopped: false }; observations.push(item); return () => { item.stopped = true; }; } };
  const visibility = { subscribe(listener) { visibilityListeners.add(listener); return () => visibilityListeners.delete(listener); }, canInteract: () => top, tickerEnabled: () => ticker };
  const react = new Proxy({ createContext(initial) { const context = { current: initial }; context.Provider = ({ value, children }) => { context.current = value; return children; }; return context; }, useContext: context => context.current }, { get: (target, name) => target[name] ?? activeRuntime.react[name] });
  const shared = initial => { const holder = activeRuntime.react.useRef(null); if (!holder.current) { holder.current = { value: initial, get() { return this.value; }, set(value) { if (value?.animation) { value.state = this; animations.push(value); } else this.value = value; } }; values.push(holder.current); } return holder.current; };
  const reanimated = { __esModule: true, default: { View: 'Animated.View' }, Easing, ReduceMotion: { Never: 'never' }, useSharedValue: shared, useAnimatedStyle: callback => callback(),
    useFrameCallback: callback => { frames.push(callback); }, withTiming: (target, config, callback) => ({ animation: true, target, config, callback }),
    cancelAnimation: state => animations.filter(item => item.state === state && !item.finished).forEach(item => { item.cancelled = true; }) };
  const ticket = { createAdminPresentationWindowTicket: () => `real-random-test-ticket-${++serial}` };
  const membership = view.compile(path.resolve(__dirname, '../src/admin/adminFixedSnackBarMembership.ts'), { './adminPresentationWindowTicket': ticket });
  const readiness = view.compile(path.resolve(__dirname, '../src/admin/adminFixedSnackBarNativeReadiness.ts'), { '../shared/camera/synchronousGuard': s.strict });
  const native = new Proxy({}, { get: (_target, name) => String(name) }), theme = { direction: 'leftToRight' };
  const content = view.compile(path.resolve(__dirname, `../src/admin/AdminFixedSnackBarContent.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Text: 'RNText', StyleSheet: { create: value => value } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => theme }, './AdminTypography.android': { useAdminFontsReady: () => true }, './adminFontFamily.android': { adminFontNames: { regular: 'ActualAdminRegular' } },
  });
  const HostPlaceholder = props => ({ type: 'FixedHost', props });
  const provider = view.compile(path.resolve(__dirname, '../src/admin/AdminFixedSnackBarProvider.tsx'), { react, 'react-native-reanimated': reanimated,
    'react-native-worklets': { scheduleOnRN: (callback, ...args) => tasks.push(() => callback(...args)) }, '../shared/camera/synchronousGuard': s.strict,
    './AdminFixedSnackBarHost': { AdminFixedSnackBarHost: HostPlaceholder }, './AdminTopNoticeProvider': { useAdminTopNoticeTarget: () => ({ messenger: f.target }) },
    './adminFixedSnackBarModel': s.fixedModel, './adminFixedSnackBarNativeReadiness': readiness, './adminFixedSnackBarRuntime': { adminFixedSnackBarController: messenger => { if (messenger !== f.target) throw Error('wrong actual Messenger'); return f.queue; } } });
  const rn = { View: 'View', StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }, findNodeHandle: node => node?.actualNativeTag };
  const sharedMocks = { react, 'react-native': rn, 'react-native-reanimated': reanimated, '../shared/camera/synchronousGuard': s.strict,
    './AdminFixedSnackBarProvider': provider, './adminFixedSnackBarMembership': membership, './adminPresentationWindowTicket': ticket };
  const hostExports = compileWithKeys(path.resolve(__dirname, '../src/admin/AdminFixedSnackBarHost.tsx'), { ...sharedMocks, './AdminFixedSnackBarMotion': { AdminFixedSnackBarMotion: 'FixedMotion' } });
  const motionExports = view.compile(path.resolve(__dirname, '../src/admin/AdminFixedSnackBarMotion.tsx'), { ...sharedMocks,
    'react-native-worklets': { scheduleOnRN: (callback, ...args) => tasks.push(() => callback(...args)) },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView', usePanGesture: config => { gestures.push(config); return config; } },
    './AdminFixedSnackBarContent': content, './adminFixedSnackBarModel': s.fixedModel });
  const props = { reader, visibility, palette: { inverseSurface: '#242424', onInverseSurface: '#FAFAFA' }, dismissLabel: 'Dismiss real message', disableAnimations: false, children: { type: 'ActualNativeStack', props: {} } };
  const withRuntime = (runtime, callback) => { activeRuntime = runtime; try { return runtime.render(callback); } finally { activeRuntime = providerRuntime; } };
  const renderWith = runtime => withRuntime(runtime, () => view.expand(provider.AdminFixedSnackBarProvider(props)));
  const render = () => { renderWith(providerRuntime); return renderWith(providerRuntime); };
  const binding = { messenger: f.target, ticket: f.scaffold }, sourceLayout = { metrics: {}, hostHeight: 199 }, current = () => alive;
  const makeHost = () => { const runtime = view.runtime(), hostProps = { scaffold: binding, sourceLayout, isCurrent: current }; return { runtime, props: hostProps, render: () => withRuntime(runtime, () => view.expand(hostExports.AdminFixedSnackBarHost(hostProps))) }; };
  const makeMotion = (entry = f.queue.getSnapshot().head, patch = {}) => { const runtime = view.runtime(), geometry = s.geometry.adminFixedSnackBarGeometry(f.facts), motionProps = { host: f.host, scaffold: f.scaffold, entry, geometry, isCurrent: current, ...patch };
    return { runtime, props: motionProps, render: () => withRuntime(runtime, () => view.expand(motionExports.AdminFixedSnackBarMotion(motionProps))) }; };
  const finish = (animation = animations.at(-1), success = true) => { if (success) { animation.state.value = animation.target; animation.finished = true; } animation.callback(success); };
  const ack = () => { while (tasks.length) tasks.shift()(); };
  const visibilityChange = patch => { if ('top' in patch) { top = patch.top; f.top(top); } if ('ticker' in patch) ticker = patch.ticker; visibilityListeners.forEach(listener => listener()); };
  return { ...f, props, provider, providerRuntime, render, renderWith, makeHost, makeMotion, finish, ack, animations, observations, gestures, frames, tasks, values, theme, content, membership,
    readerAvailable: value => { readerAvailable = value; }, visibilityChange, alive: value => { alive = value; }, target: () => provider.useAdminFixedSnackBarTarget(),
    frame: (delta, index = frames.length - 1) => { frameTime += delta; frames[index]({ timestamp: frameTime, timeSincePreviousFrame: delta }); }, contentTree: entry => view.expand(content.AdminFixedSnackBarContent({ entry, palette: props.palette, safeLeft: 11, safeRight: 23 })),
    cleanup: () => { providerRuntime.unmount(); f.cleanup(); } };
}
module.exports = { ...s, ...view, fixture, flattenStyle };
