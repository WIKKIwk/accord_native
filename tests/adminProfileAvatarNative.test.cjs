/* global __dirname */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { load, strings } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function expand(node) { if (Array.isArray(node)) return node.map(expand); if (!node || typeof node !== 'object') return node; if (typeof node.type === 'function') return expand(node.type(node.props)); return { ...node, props: { ...node.props, children: expand(node.props?.children) } }; }
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate)); if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const byId = (tree, id) => nodes(tree, node => node.props.modifiers?.some(mod => ['testID', 'accessibilityIdentifier'].includes(mod.name) && mod.args[0] === id))[0];
const modifier = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
function fixture(platform, { uri = 'data:image/png;base64,AQ==', preview = true, current = true, displayName = 'AV', size = 92 } = {}) {
  let cursor = 0, valid = current; const slots = [], effects = [], animations = [], timings = [], styles = [], calls = [];
  const react = { useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; }, useLayoutEffect: (callback, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; }); } } };
  const shared = initial => { const ref = react.useRef(null); return ref.current ??= { value: initial, get() { return this.value; }, set(value) { this.value = value; } }; };
  const Easing = { linear: 'linear', cubic: 'cubic', out: value => ['out', value], in: value => ['in', value] };
  const model = { state: { phase: 'content', url: 'https://images.example/a', uri, loading: false, preview: preview ? { id: 5, url: 'https://images.example/a', uri, displayName } : null },
    size, fallbackText: 'AV', namespace: 'captured epoch namespace', generation: 3, semanticLabel: 'Profil rasmini kattalashtirish', closeLabel: 'Yopish', current: () => valid,
    previewCurrent: id => valid && model.state.preview?.id === id, imageCurrent: (slot, image) => valid && (slot === 'thumbnail' ? model.state.uri === image : model.state.preview?.id === slot && model.state.preview.uri === image),
    open: () => { if (valid) calls.push('open'); }, close: id => { if (model.previewCurrent(id)) { calls.push(['close', id]); model.state.preview = null; } }, imageFailed: (...args) => calls.push(['failed', ...args]) };
  const colors = { surface: '#111111', primaryContainer: '#222222', onPrimaryContainer: '#333333', surfaceContainer: '#444444', onSurface: '#555555', secondaryContainer: '#666666', onSecondaryContainer: '#777777' };
  const ui = new Proxy({ Shape: { RoundedCorner: value => value } }, { get: (target, name) => target[name] ?? String(name) });
  const mocks = { react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifier, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifier,
    'expo-image': { Image: 'ExpoImage' }, 'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', Modal: 'Modal', Pressable: 'Pressable', StyleSheet: { absoluteFill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, create: value => value }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, cancelAnimation: value => { calls.push(['cancelAnimation', value.get()]); }, Easing, useSharedValue: shared,
      useAnimatedStyle: callback => { styles.push(callback); return callback(); }, withTiming: (value, config, complete) => { timings.push([value, config]); if (complete) animations.push(complete); return value; } },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView', usePinchGesture: config => ({ type: 'pinch', config }), usePanGesture: config => ({ type: 'pan', config }), useSimultaneousGestures: (...gestures) => gestures },
    'react-native-worklets': { scheduleOnRN: fn => fn() }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 10, left: 0, right: 0 }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    './useAdminProfileAvatar': { useAdminProfileAvatar: () => model }, './adminProfileAvatarModel': load('admin/adminProfileAvatarModel', { './dartJsonString': strings }) };
  const compiled = new Map();
  function compile(relative) { if (compiled.has(relative)) return compiled.get(relative); const filename = path.resolve(__dirname, '../src/admin', relative), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./AdminProfileAvatar') ? compile(`${id.slice(2)}.tsx`) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); compiled.set(relative, mod.exports); return mod.exports; }
  const component = compile(`AdminProfileAvatar.${platform}.tsx`).AdminProfileAvatar;
  return { model, calls, timings, styles, render() { cursor = 0; const tree = expand(component({})); effects.splice(0).forEach(run => run()); return tree; }, valid: value => { valid = value; }, finish() { animations.splice(0).forEach(complete => complete(true)); }, cleanup() { slots.forEach(slot => slot?.cleanup?.()); } };
}
for (const platform of ['android', 'ios']) {
  test(`${platform} Admin avatar uses source92/5padding/23.92black initials and a native opening control`, () => {
    const f = fixture(platform, { preview: false }), tree = f.render(), control = byId(tree, 'admin-profile-avatar');
    assert.ok(control); control.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls, ['open']);
    const image = nodes(tree, n => n.type === 'ExpoImage')[0]; assert.equal(image.props.source.uri, 'data:image/png;base64,AQ=='); assert.equal(image.props.cachePolicy, 'memory'); assert.ok(image.props.source.cacheKey.includes('captured epoch namespace'));
    assert.ok(nodes(tree, n => n.type === 'View' && n.props.style?.width === 82 && n.props.style.height === 82 && n.props.style.borderRadius === 41 && n.props.style.backgroundColor === '#222222').length);
    const initial = nodes(tree, n => n.type === 'Text' && n.props.children === 'AV')[0];
    if (platform === 'android') { assert.equal(initial.props.style.fontSize, 23.92); assert.equal(initial.props.style.fontWeight, '900'); }
    else assert.ok(initial.props.modifiers.some(mod => mod.name === 'font' && mod.args[0].size === 23.92 && mod.args[0].weight === 'black'));
  });
  test(`${platform} preview geometry/source .72scrim/200ms cubic fade/44native close/28radius retain captured initials title`, () => {
    const f = fixture(platform), tree = f.render(), modal = nodes(tree, n => n.type === 'Modal')[0]; assert.equal(modal.props.transparent, true); assert.equal(modal.props.animationType, 'none');
    assert.ok(nodes(tree, n => n.type === 'Animated.View' && n.props.style?.[0]?.backgroundColor === 'rgba(0,0,0,.72)').length);
    assert.ok(nodes(tree, n => n.type === 'View' && n.props.style?.width === 368 && n.props.style.height === 460 && n.props.style.borderRadius === 28).length);
    assert.ok(f.timings.some(([value, config]) => value === 1 && config.duration === 200 && config.easing[0] === 'out'));
    const close = byId(tree, 'admin-profile-avatar-preview-close'); assert.ok(close); close.props[platform === 'android' ? 'onClick' : 'onPress'](); assert.deepEqual(f.calls, []);
    assert.ok(f.timings.some(([value, config]) => value === 0 && config.duration === 200 && config.easing[0] === 'in')); f.finish(); assert.deepEqual(f.calls, [['close', 5]]);
  });
  test(`${platform} native image never receives remote URL and stale display/error acknowledgements cannot change placeholder or cache state`, () => {
    const f = fixture(platform), tree = f.render(), images = nodes(tree, n => n.type === 'ExpoImage'); assert.equal(images.length, 2); for (const image of images) assert.ok(image.props.source.uri.startsWith('data:image/'));
    const before = f.timings.length; f.valid(false); for (const image of images) { image.props.onLoad({ cacheType: 'memory' }); image.props.onDisplay(); image.props.onError(); }
    assert.equal(f.timings.length, before); assert.deepEqual(f.calls, []); assert.equal(f.render(), null);
  });
  test(`${platform} source image fade180linear is skipped for synchronous memory hits and decoder failures retain original slot`, () => {
    const f = fixture(platform), images = nodes(f.render(), n => n.type === 'ExpoImage'), before = f.timings.length;
    images[0].props.onLoad({ cacheType: 'memory' }); images[0].props.onDisplay(); assert.equal(f.timings.length, before);
    images[1].props.onLoad({ cacheType: 'none' }); images[1].props.onDisplay(); assert.ok(f.timings.some(([value, config]) => value === 0 && config.duration === 180 && config.easing === 'linear'));
    images[0].props.onError(); images[1].props.onError(); assert.deepEqual(f.calls, [['failed', 'thumbnail', 'data:image/png;base64,AQ=='], ['failed', 5, 'data:image/png;base64,AQ==']]);
  });
  test(`${platform} fallback opens without any image request; preview uses source firstUTF16 code unit and U fallback`, () => {
    for (const [name, expected] of [['', 'U'], ['ß', 'SS'], ['😀', '\ud83d']]) { const f = fixture(platform, { uri: null, displayName: name }), tree = f.render();
      assert.equal(nodes(tree, n => n.type === 'ExpoImage').length, 0); assert.ok(nodes(tree, n => n.type === 'Text' && n.props.children === expected).length);
    }
  });
  test(`${platform} preview pinch/pan are bounded1to3 with80scene margin, preserve focal point and stop when dismiss starts`, () => {
    const f = fixture(platform), tree = f.render(), gesture = nodes(tree, n => n.type === 'GestureDetector')[0].props.gesture, pinch = gesture.find(g => g.type === 'pinch').config, pan = gesture.find(g => g.type === 'pan').config;
    assert.equal(pan.maxPointers, 1); const motion = () => f.styles.map(read => read()).find(style => style.transform).transform;
    pinch.onActivate({ focalX: 184, focalY: 230 }); pinch.onUpdate({ scale: 10, focalX: 184, focalY: 230 }); assert.equal(motion()[2].scale, 3);
    pan.onActivate(); pan.onUpdate({ translationX: 9000, translationY: 9000 }); assert.equal(motion()[0].translateX, 608); assert.equal(motion()[1].translateY, 700);
    pinch.onActivate({ focalX: 184, focalY: 230 }); pinch.onUpdate({ scale: .1, focalX: 184, focalY: 230 }); assert.equal(motion()[2].scale, 1); assert.equal(motion()[0].translateX, 80); assert.equal(motion()[1].translateY, 80);
    const close = byId(tree, 'admin-profile-avatar-preview-close'); close.props[platform === 'android' ? 'onClick' : 'onPress'](); const stopped = motion(); pan.onUpdate({ translationX: 0, translationY: 0 }); pinch.onUpdate({ scale: 2, focalX: 0, focalY: 0 }); assert.deepEqual(motion(), stopped);
  });
  test(`${platform} stale native dismiss completion cannot close a newer preview and repeated hardware/outside/close taps settle once`, () => {
    const f = fixture(platform), tree = f.render(), modal = nodes(tree, n => n.type === 'Modal')[0], outside = nodes(tree, n => n.type === 'Pressable')[0], close = byId(tree, 'admin-profile-avatar-preview-close');
    modal.props.onRequestClose(); outside.props.onPress(); close.props[platform === 'android' ? 'onClick' : 'onPress'](); nodes(tree, n => n.type === 'Animated.View' && n.props.onAccessibilityEscape)[0].props.onAccessibilityEscape();
    f.model.state.preview = { ...f.model.state.preview, id: 9 }; f.finish(); assert.deepEqual(f.calls, []);
    const g = fixture(platform), visible = g.render(), win = nodes(visible, n => n.type === 'Modal')[0]; win.props.onRequestClose(); win.props.onRequestClose(); g.finish(); assert.deepEqual(g.calls, [['close', 5]]);
  });
}
