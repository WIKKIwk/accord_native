const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function fixture(options = {}) {
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiImage.tsx'), loaded = new Module(filename, module);
  const values = [], writes = []; let pinch, pan;
  const makeValue = initial => { let value = initial; const item = { get: () => value, set: next => { value = next; } }; values.push(item); return item; };
  const mocks = {
    'react/jsx-runtime': jsx, react: { useEffect() {}, useRef: value => ({ current: value }), useState: value => [value, next => writes.push(next)] },
    'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View',
      useWindowDimensions: () => ({ width: 200, height: 400 }), StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView',
      usePinchGesture: config => { pinch = config; return config; }, usePanGesture: config => { pan = config; return config; },
      useSimultaneousGestures: (...gestures) => gestures },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: makeValue, useAnimatedStyle: fn => fn() },
    '../orderImageApi': { cachedOrderImageBytes: async () => null }, '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../workerControlsApi': { WorkerControlException: class extends Error {} }, './returnedPaintPhoto': {},
    './useBoyoqchiText': { useBoyoqchiText: () => value => value },
  };
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const tree = loaded.exports.BoyoqchiImage({ session: { imageCacheScope: 's' }, image: { image_url: '', image_mime: '' }, ...options });
  return { pinch, pan, values, writes, open: () => nodes(tree, node => node.type === 'Pressable')[0].props.onPress(),
    close: () => nodes(tree, node => node.type === 'Modal')[0].props.onRequestClose() };
}

test('pinch zoom-out reclamps prior pan offsets to the new bounds and reset clears the transform', () => {
  const f = fixture(), [scale, , x, y] = f.values;
  f.pinch.onActivate(); f.pinch.onUpdate({ scale: 3 });
  f.pan.onActivate(); f.pan.onUpdate({ translationX: 1000, translationY: -1000 });
  assert.equal(scale.get(), 3); assert.equal(x.get(), 200); assert.equal(y.get(), -400);
  f.pinch.onActivate(); f.pinch.onUpdate({ scale: 0.5 });
  assert.equal(scale.get(), 1.5); assert.equal(x.get(), 50); assert.equal(y.get(), -100);
  f.pinch.onActivate(); f.pinch.onUpdate({ scale: 2 / 3 });
  assert.equal(scale.get(), 1); assert.equal(x.get(), 0); assert.equal(y.get(), 0);
  f.pinch.onActivate(); f.pinch.onUpdate({ scale: 3 });
  f.pan.onActivate(); f.pan.onUpdate({ translationX: -60, translationY: 90 });
  f.close(); assert.equal(scale.get(), 1); assert.equal(x.get(), 0); assert.equal(y.get(), 0);
});


test('locked or disabled preview cannot open, including a stale callback', () => {
  let locked = false; const f = fixture({ isLocked: () => locked });
  f.open(); assert.deepEqual(f.writes, [true]);
  locked = true; f.open(); assert.deepEqual(f.writes, [true]);
  const disabled = fixture({ disabled: true }); disabled.open(); assert.deepEqual(disabled.writes, []);
});
