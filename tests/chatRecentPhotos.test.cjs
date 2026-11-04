/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

function libraryFixture(permission, requestedPermission = permission) {
  const calls = [];
  const assets = [1, 2, 3, 4].map(index => ({ id: `ph://photo-${index}`, filename: `photo-${index}.heic`, width: 100, height: 80 }));
  class Query {
    eq(...args) { calls.push(['eq', ...args]); return this; }
    orderBy(...args) { calls.push(['orderBy', ...args]); return this; }
    limit(...args) { calls.push(['limit', ...args]); return this; }
    async exeForMetadata() { calls.push(['query']); return assets; }
  }
  class Asset { constructor(id) { this.id = id; } async getUri() { calls.push(['uri', this.id]); return 'file:///cache/edited.jpg'; } }
  const api = load('chatRecentPhotos.ts', {
    'expo-media-library': {
      Asset, Query, AssetField: { MEDIA_TYPE: 'mediaType', CREATION_TIME: 'creationTime' }, MediaType: { IMAGE: 'image' },
      getPermissionsAsync: async () => { calls.push(['getPermission']); return permission; },
      requestPermissionsAsync: async () => { calls.push(['requestPermission']); return requestedPermission; },
    },
    './chatMedia': { prepareChatMedia: async asset => { calls.push(['prepare', asset]); return { uri: asset.uri }; } },
  });
  return { ...api, calls, assets };
}

test('recent photos are limited to four images ordered newest first', async () => {
  const f = libraryFixture({ granted: true, canAskAgain: true });
  const result = await f.recentChatPhotos();
  assert.equal(result.photos.length, 4);
  assert.deepEqual(f.calls, [
    ['getPermission'], ['eq', 'mediaType', 'image'], ['orderBy', { key: 'creationTime', ascending: false }], ['limit', 4], ['query'],
  ]);
  assert.equal(result.requested, false);
  await f.prepareRecentChatPhoto(result.photos[0]);
  assert.deepEqual(f.calls.at(-1), ['prepare', { uri: 'file:///cache/edited.jpg', type: 'image', fileName: 'rasm.jpg', width: 100, height: 80 }]);
});

test('permission is requested only for an explicit long press and limited access is respected', async () => {
  const f = libraryFixture({ granted: false, canAskAgain: true }, { granted: true, canAskAgain: true, accessPrivileges: 'limited' });
  const initial = await f.recentChatPhotos();
  assert.equal(initial.granted, false);
  assert.deepEqual(f.calls, [['getPermission']]);
  const allowed = await f.recentChatPhotos(true);
  assert.equal(allowed.requested, true);
  assert.equal(allowed.photos.length, 4);
  assert.equal(f.calls.filter(call => call[0] === 'requestPermission').length, 1);
  const denied = libraryFixture({ granted: false, canAskAgain: false });
  assert.equal((await denied.recentChatPhotos(true)).granted, false);
  assert.deepEqual(denied.calls, [['getPermission']]);
});

function gestureFixture(readPhotos) {
  const hooks = [];
  let cursor = 0;
  const react = { useRef(value) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: value }; return hooks[index]; }, useEffect() {} };
  function View() {}
  function Image() {}
  function Pressable() {}
  function Host() {}
  function Mask() {}
  Mask.Content = function MaskContent() {};
  function Rectangle() {}
  function VStack() {}
  const updates = [], selected = [], alerts = [];
  let taps = 0;
  const props = {
    enabled: true,
    rootRef: { current: { measure: callback => callback(0, 0, 375, 800, 0, 0) } },
    onTap: () => { taps++; }, onSelect: photo => selected.push(photo), onStripChange: strip => updates.push(strip),
  };
  const module = load('components/RecentChatPhotos.ios.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, nodeProps) => ({ type, props: nodeProps }), jsxs: (type, nodeProps) => ({ type, props: nodeProps }) },
    '@expo/ui/swift-ui': { Host, Mask, Rectangle, VStack },
    '@expo/ui/swift-ui/modifiers': { foregroundStyle: style => ({ style }), frame: dimensions => ({ dimensions }) },
    'expo-image': { Image },
    'expo-symbols': { SymbolView() {} },
    'react-native': { View, Pressable, Alert: { alert: (...args) => alerts.push(args) }, Linking: { openSettings: async () => {} },
      StyleSheet: { create: styles => styles, absoluteFill: {} }, useColorScheme: () => 'dark', useWindowDimensions: () => ({ width: 375 }) },
    '../chatRecentPhotos': { recentChatPhotos: readPhotos },
  });
  const tree = module.RecentChatPhotosButton(props);
  tree.props.ref.current = { measure: callback => callback(0, 0, 40, 40, 30, 400) };
  const event = (x, y) => ({ nativeEvent: { pageX: x, pageY: y } });
  return { tree, event, updates, selected, alerts, module, Image, Pressable, Mask, View, taps: () => taps };
}

const waitForLongPress = () => new Promise(resolve => setTimeout(resolve, 500));
const readyPhotos = { granted: true, canAskAgain: true, requested: false,
  photos: [0, 1, 2, 3].map(index => ({ id: `ph://${index}`, filename: `${index}.jpg`, width: 1, height: 1 })) };

test('a tap opens the menu without reading the photo library', () => {
  let reads = 0;
  const f = gestureFixture(async () => { reads++; return readyPhotos; });
  f.tree.props.onResponderGrant(f.event(50, 420));
  f.tree.props.onResponderRelease(f.event(50, 420));
  assert.equal(f.taps(), 1);
  assert.equal(reads, 0);
  assert.deepEqual(f.selected, []);
});

test('holding, sliding to a recent photo and releasing attaches exactly that photo', async () => {
  const f = gestureFixture(async () => readyPhotos);
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  const strip = f.updates.at(-1);
  assert.equal(strip.photos.length, 4);
  const x = strip.left + 8 + 2 * (strip.size + strip.gap) + strip.size / 2;
  const y = strip.top + 8 + strip.size / 2;
  f.tree.props.onResponderMove(f.event(x, y));
  assert.equal(f.updates.at(-1).selected, 2);
  f.tree.props.onResponderRelease(f.event(x, y));
  assert.deepEqual(f.selected, [readyPhotos.photos[2]]);
  assert.equal(f.updates.at(-1), null);
  assert.equal(f.taps(), 0);
});

test('recent thumbnails use the Expo photo loader with the full encoded asset identifier', () => {
  const f = gestureFixture(async () => readyPhotos);
  const strip = f.module.RecentChatPhotoStrip({ strip: { photos: [{ id: 'ph://ABC/L0/001' }], left: 0, top: 0, size: 70, gap: 8,
    selected: null, triggerLeft: 0, triggerTop: 100, onSelect() {} }, onClose() {} });
  const image = find(strip, node => node.type === f.Image);
  assert.equal(image.type, f.Image);
  assert.equal(image.props.source.uri, 'ph://ABC%2FL0%2F001');
  assert.equal(image.props.cachePolicy, 'memory');
  assert.ok(find(strip, node => node.type === f.Mask));
  const photoRow = find(strip, node => node.type === f.View && node.props.style?.[0]?.flexDirection === 'row');
  assert.equal(photoRow.props.style[0].backgroundColor, 'transparent');
});

test('releasing outside keeps the photos open for a later tap', async () => {
  const f = gestureFixture(async () => readyPhotos);
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  f.tree.props.onResponderRelease(f.event(5, 420));
  assert.deepEqual(f.selected, []);
  assert.equal(f.taps(), 0);
  const strip = f.updates.at(-1);
  assert.equal(strip.photos.length, 4);
  let closed = 0;
  const overlay = f.module.RecentChatPhotoStrip({ strip, onClose: () => { closed++; } });
  find(overlay, node => node.type === f.Pressable && node.props.accessibilityLabel === 'So‘nggi rasm 2').props.onPress();
  assert.equal(closed, 1);
  assert.deepEqual(f.selected, [readyPhotos.photos[1]]);
});

test('photos stay available when the finger lifts before the library query finishes', async () => {
  let resolvePhotos;
  const pending = new Promise(resolve => { resolvePhotos = resolve; });
  const f = gestureFixture(async () => pending);
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  f.tree.props.onResponderRelease(f.event(50, 420));
  resolvePhotos(readyPhotos);
  await new Promise(setImmediate);
  assert.equal(f.updates.at(-1).photos.length, 4);
  assert.equal(f.updates.at(-1).selected, null);
  assert.deepEqual(f.selected, []);
  assert.equal(f.taps(), 0);
});

test('cancelling a long press closes the photos without attaching one', async () => {
  const cancelled = gestureFixture(async () => readyPhotos);
  cancelled.tree.props.onResponderGrant(cancelled.event(50, 420));
  await waitForLongPress();
  cancelled.tree.props.onResponderTerminate(cancelled.event(50, 420));
  assert.deepEqual(cancelled.selected, []);
  assert.equal(cancelled.updates.at(-1), null);
});

test('a permission prompt that interrupts the hold asks the user to hold again', async () => {
  let resolvePermission;
  const requested = new Promise(resolve => { resolvePermission = resolve; });
  const f = gestureFixture(async ask => ask ? requested : { photos: [], granted: false, canAskAgain: true, requested: false });
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  f.tree.props.onResponderTerminate(f.event(50, 420));
  resolvePermission({ ...readyPhotos, requested: true });
  await new Promise(setImmediate);
  assert.match(f.alerts[0][1], /yana bosib turing/);
  assert.deepEqual(f.selected, []);
});
