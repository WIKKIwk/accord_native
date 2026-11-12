const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { hooks, tick, defer, jsx } = require('./support/workerPaddonHarness.cjs');

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}

function fixture(loadImage) {
  const runner = hooks();
  const filename = path.resolve(__dirname, '../src/boyoqchi/BoyoqchiImage.tsx');
  const loaded = new Module(filename, module);
  const sharedValue = initial => runner.react.useMemo(() => {
    let value = initial;
    return { get: () => value, set: next => { value = next; } };
  }, []);
  const mocks = {
    'react/jsx-runtime': jsx, react: runner.react,
    'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View',
      useWindowDimensions: () => ({ width: 200, height: 400 }), StyleSheet: { create: value => value, absoluteFill: {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView',
      usePinchGesture: config => config, usePanGesture: config => config, useSimultaneousGestures: (...gestures) => gestures },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: sharedValue, useAnimatedStyle: fn => fn() },
    '../orderImageApi': { cachedOrderImageBytes: loadImage }, '../components/useWorkerColors': { useWorkerColors: () => ({}) },
    '../workerControlsApi': { WorkerControlException: class extends Error {} }, './returnedPaintPhoto': {},
    './useBoyoqchiText': { useBoyoqchiText: () => value => value },
  };
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const session = { imageCacheScope: 'worker' };
  return {
    render(image) {
      runner.begin();
      const tree = loaded.exports.BoyoqchiImage({ session, image });
      runner.flush();
      return tree;
    },
    dispose: runner.dispose,
  };
}

test('returned paint sheet displays uploaded image bytes and updates after replacement', async () => {
  const pendingOld = defer();
  const f = fixture((_session, url) => url === '/old' ? pendingOld.promise : Promise.resolve(Uint8Array.of(255, 216, 255, 217)));
  const oldImage = { image_url: '/old', image_mime: 'image/jpeg' };
  const newImage = { image_url: '/new', image_mime: 'image/jpeg' };
  f.render(oldImage);
  f.render(newImage);
  await tick();
  let images = nodes(f.render(newImage), node => node.type === 'Image');
  assert.equal(images.length, 2);
  assert.equal(images[0].props.source.uri, 'data:image/jpeg;base64,/9j/2Q==');
  assert.equal(images[1].props.source.uri, 'data:image/jpeg;base64,/9j/2Q==');
  pendingOld.resolve(Uint8Array.of(1, 2, 3));
  await tick();
  images = nodes(f.render(newImage), node => node.type === 'Image');
  assert.equal(images[0].props.source.uri, 'data:image/jpeg;base64,/9j/2Q==');
  f.dispose();
});
