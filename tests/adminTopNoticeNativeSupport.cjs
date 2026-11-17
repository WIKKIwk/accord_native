/* global __dirname */
const path = require('node:path'), s = require('./adminTopNoticeSupport.cjs'), view = require('./adminSupplierDetailViewSupport.cjs');
const { flattenStyle } = require('./adminShellFrameViewSupport.cjs');
const Bezier = view.compile(path.resolve(__dirname, '../node_modules/react-native-reanimated/src/Bezier.ts'), {}).Bezier;
const Easing = view.compile(path.resolve(__dirname, '../node_modules/react-native-reanimated/src/Easing.ts'), { './Bezier': { Bezier } }).Easing;
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
function fixture(platform = 'android', accessibleNavigation = false, retainChildrenWhileUnresolved = false) {
  const f = s.fixture(), r = view.runtime(), animations = [], tasks = [], values = [], contexts = [];
  let activeRuntime = r;
  const react = new Proxy({ createContext(initial) { const context = { current: initial }; context.Provider = ({ value, children }) => { context.current = value; return children; }; contexts.push(context); return context; }, useContext: context => context.current }, { get: (target, name) => target[name] ?? activeRuntime.react[name] });
  const shared = initial => { const holder = activeRuntime.react.useRef(null); if (!holder.current) { holder.current = { value: initial, get() { return this.value; }, set(value) { if (value?.animation) { value.state = this; animations.push(value); } else this.value = value; } }; values.push(holder.current); } return holder.current; };
  const reanimated = { __esModule: true, default: { View: 'Animated.View' }, Easing, useSharedValue: shared, useAnimatedStyle: callback => callback(),
    withTiming: (target, options, callback) => ({ animation: true, target, options, callback }), cancelAnimation: state => { animations.filter(value => value.state === state && !value.finished).forEach(value => { value.cancelled = true; }); } };
  const provider = view.compile(path.resolve(__dirname, '../src/admin/AdminTopNoticeProvider.tsx'), { react, 'react-native-reanimated': reanimated,
    'react-native-worklets': { scheduleOnRN: (callback, ...args) => tasks.push(() => callback(...args)) }, './adminTopNoticeModel': s.noticeModel });
  const hosts = [];
  const makeHost = ancestor => {
    const hostRuntime = view.runtime(), native = new Proxy({}, { get: (_target, name) => String(name) });
    const theme = { colors: { onSurface: '#111111' }, direction: 'leftToRight' }, hostReact = { ...hostRuntime.react, useContext: context => context.current };
    const content = view.compile(path.resolve(__dirname, `../src/admin/AdminTopNoticeContent.${platform}.tsx`), {
      '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
      'expo-symbols': { SymbolView: 'NativeMaterialSymbol' },
      'react-native': { Text: 'RNText', StyleSheet: { create: value => value } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
      '../components/useBaseTheme': { useBaseTheme: () => theme }, './adminFontFamily.android': { adminFontNames: { regular: 'ActualRegisteredAdminRegular' } }, './AdminTypography.android': { useAdminFontsReady: () => true }, './adminTopNoticeModel': s.noticeModel,
    });
    const hook = view.compile(path.resolve(__dirname, '../src/admin/useAdminTopNoticeScaffold.ts'), { react: hostReact, './AdminTopNoticeProvider': provider });
    const host = view.compile(path.resolve(__dirname, '../src/admin/AdminTopNoticeHost.tsx'), { react: hostReact, 'react-native': { View: 'View', StyleSheet: { create: value => value } },
      'react-native-reanimated': reanimated, './AdminTopNoticeContent': content, './adminTopNoticeModel': s.noticeModel });
    const state = { runtime: hostRuntime, binding: null, insets: { left: 0, right: 0 }, dismissLabel: 'Yopish', theme, render() { return hostRuntime.render(() => { state.binding = hook.useAdminTopNoticeScaffold(ancestor); return view.expand(host.AdminTopNoticeHost({ scaffold: state.binding, inlineInsets: state.insets, dismissLabel: state.dismissLabel })); }); } };
    hosts.push(state); return state;
  };
  let accessible = accessibleNavigation;
  const renderWith = (runtime, children) => { activeRuntime = runtime; try { return runtime.render(() => view.expand(provider.AdminTopNoticeProvider({ messenger: f.target, accessibleNavigation: accessible, children, retainChildrenWhileUnresolved }))); } finally { activeRuntime = r; } };
  const render = () => { const child = { type: 'GenuineStackContent', props: {} }; renderWith(r, child); return renderWith(r, child); };
  const makeDuplicateProvider = () => { const runtime = view.runtime(), stats = { mountedChildren: 0 }, child = { type: () => { stats.mountedChildren++; return { type: 'DuplicateStack', props: {} }; }, props: {} };
    return { runtime, stats, render: () => { renderWith(runtime, child); return renderWith(runtime, child); } }; };
  const finish = (animation = animations.at(-1), success = true) => { if (success) { animation.state.value = animation.target; animation.finished = true; } animation.callback(success); };
  return { ...f, r, animations, tasks, values, contexts, provider, hosts, makeHost, makeDuplicateProvider, render, finish, accessible: value => { accessible = value; }, ack: () => { while (tasks.length) tasks.shift()(); },
    content: platform, cleanup: () => { hosts.forEach(host => host.runtime.unmount()); r.unmount(); f.target.retire(); } };
}
module.exports = { ...s, ...view, fixture, flattenStyle, Easing };
