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

function hookHost() {
  let active = null;
  const next = create => {
    const index = active.cursor++;
    if (!(index in active.slots)) active.slots[index] = create();
    return active.slots[index];
  };
  const react = {
    useRef: value => next(() => ({ current: value })),
    useState(value) {
      const cell = next(() => ({ value: typeof value === 'function' ? value() : value }));
      return [cell.value, update => { cell.value = typeof update === 'function' ? update(cell.value) : update; }];
    },
    useEffect(effect, deps) {
      const cell = next(() => ({}));
      if (cell.deps && deps && deps.every((dep, index) => dep === cell.deps[index])) return;
      cell.deps = deps;
      active.effects.push(() => { cell.cleanup?.(); cell.cleanup = effect(); });
    },
  };
  const mount = component => {
    const instance = { slots: [], cursor: 0, effects: [] };
    return { render(props) {
      const previous = active;
      active = instance;
      instance.cursor = 0;
      const tree = component(props);
      active = previous;
      instance.effects.splice(0).forEach(run => run());
      return tree;
    } };
  };
  return { react, next, mount };
}

function gestureFixture(readPhotos, capture = async () => 'data:image/jpeg;base64,c25hcHNob3Q=') {
  const host = hookHost();
  function View() {}
  function Image() {}
  function Pressable() {}
  function Host() {}
  function Mask() {}
  Mask.Content = function MaskContent() {};
  function Rectangle() {}
  function RNHostView() {}
  function VStack() {}
  function AnimatedView() {}
  const shared = initial => ({ value: initial, get() { return this.value; },
    set(next) { this.value = next !== null && typeof next === 'object' ? next.to : next; } });
  const updates = [], selected = [], alerts = [], captures = [], haptics = [], holds = [];
  let taps = 0;
  const props = {
    enabled: true, stripOpen: false, composer: { height: 0, attachments: 0 }, onHoldChange: holding => holds.push(holding),
    rootRef: { current: { measure: callback => callback(0, 0, 375, 800, 0, 0) } },
    onTap: () => { taps++; }, onSelect: photo => { selected.push(photo); }, onStripChange: strip => updates.push(strip),
  };
  const motion = load('chatRecentPhotoMotion.ts', {});
  const module = load('components/RecentChatPhotos.ios.tsx', {
    react: host.react,
    'react/jsx-runtime': { jsx: (type, nodeProps) => ({ type, props: nodeProps }), jsxs: (type, nodeProps) => ({ type, props: nodeProps }) },
    '@expo/ui/swift-ui': { Host, Mask, Rectangle, RNHostView, VStack },
    '@expo/ui/swift-ui/modifiers': { foregroundStyle: style => ({ style }), frame: dimensions => ({ dimensions }) },
    'expo-haptics': { ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' }, impactAsync: async style => { haptics.push(style); },
      selectionAsync: async () => { haptics.push('selection'); } },
    'expo-image': { Image },
    'expo-symbols': { SymbolView() {} },
    'react-native': { View, Pressable, Alert: { alert: (...args) => alerts.push(args) }, Linking: { openSettings: async () => {} },
      StyleSheet: { create: styles => styles, absoluteFill: {} }, useColorScheme: () => 'dark', useWindowDimensions: () => ({ width: 375, height: 800 }) },
    'react-native-reanimated': { __esModule: true, default: { View: AnimatedView }, Easing: { out: value => value, quad() {} },
      useAnimatedStyle: worklet => worklet(), useReducedMotion: () => false, useSharedValue: initial => host.next(() => shared(initial)),
      withDelay: (delay, animation) => ({ ...animation, delay }), withSpring: (to, config) => ({ to, config }), withTiming: (to, config) => ({ to, config }) },
    'react-native-view-shot': { captureRef: (view, options) => { captures.push({ view, options }); return capture(); } },
    '../chatRecentPhotoMotion': motion,
    '../chatRecentPhotos': { recentChatPhotos: readPhotos },
  });
  const tree = host.mount(module.RecentChatPhotosButton).render(props);
  tree.props.ref.current = { measure: callback => callback(0, 0, 40, 40, 30, 400) };
  const event = (x, y) => ({ nativeEvent: { pageX: x, pageY: y } });
  const overlay = () => host.mount(module.RecentChatPhotoStrip);
  const tile = (rendered, index) => {
    const element = find(rendered, node => node.type?.name === 'RecentPhotoTile' && node.props.index === index);
    const view = host.mount(element.type);
    view.render(element.props);
    return view.render(element.props);
  };
  const tilePress = (rendered, index) => find(tile(rendered, index), node => node.type === Pressable).props.onPress;
  const closeButton = rendered => find(rendered, node => node.type === Pressable && node.props.accessibilityLabel === 'So‘nggi rasmlarni yopish'
    && Array.isArray(node.props.style) && node.props.style[0].width === 40);
  return { tree, event, updates, selected, alerts, captures, haptics, holds, module, motion, overlay, tile, tilePress, closeButton, Image, Pressable, Mask, AnimatedView, taps: () => taps };
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitForLongPress = () => pause(500);
const readyPhotos = { granted: true, canAskAgain: true, requested: false,
  photos: [0, 1, 2, 3].map(index => ({ id: `ph://${index}`, filename: `${index}.jpg`, width: 1, height: 1 })) };
const stripFixture = (extra = {}) => ({ id: 1, photos: readyPhotos.photos, left: 12, top: 280, size: 81.75, gap: 8, blurTop: 280, selected: null, exit: null,
  triggerLeft: 15, triggerTop: 400, landing: { left: 23, top: 300, size: 96 }, backdrop: Promise.resolve(null), onSelect() {}, ...extra });
const tileX = (strip, index) => strip.left + index * (strip.size + strip.gap) + strip.size / 2;
const tileY = strip => strip.top + strip.size / 2;

test('a tap opens the menu without reading the photo library', () => {
  let reads = 0;
  const f = gestureFixture(async () => { reads++; return readyPhotos; });
  f.tree.props.onResponderGrant(f.event(50, 420));
  f.tree.props.onResponderRelease(f.event(50, 420));
  assert.equal(f.taps(), 1);
  assert.equal(reads, 0);
  assert.equal(f.captures.length, 0);
  assert.deepEqual(f.haptics, []);
  assert.deepEqual(f.selected, []);
  assert.deepEqual(f.updates, []);
});

test('a hold prepares the photos and the snapshot before the row opens, and a short release discards them', async () => {
  let reads = 0;
  const f = gestureFixture(async () => { reads++; return readyPhotos; });
  f.tree.props.onResponderGrant(f.event(50, 420));
  await pause(f.motion.RECENT_PREWARM_MS + 40);
  assert.equal(reads, 1);
  assert.equal(f.captures.length, 1);
  assert.deepEqual(f.updates, []);
  assert.deepEqual(f.holds, [true]);
  f.tree.props.onResponderRelease(f.event(50, 420));
  assert.equal(f.holds.at(-1), false);
  await pause(f.motion.RECENT_HOLD_MS);
  assert.equal(f.taps(), 1);
  assert.deepEqual(f.updates, []);
  assert.equal(reads, 1);
});

test('a finger that moves away before the hold finishes reads nothing and does not tap', async () => {
  let reads = 0;
  const f = gestureFixture(async () => { reads++; return readyPhotos; });
  f.tree.props.onResponderGrant(f.event(50, 420));
  f.tree.props.onResponderMove(f.event(90, 420));
  await waitForLongPress();
  f.tree.props.onResponderRelease(f.event(90, 420));
  assert.equal(reads, 0);
  assert.equal(f.taps(), 0);
  assert.deepEqual(f.updates, []);
  assert.ok(!f.holds.includes(true), 'a quick swipe from the plus must still be able to go back');
});

test('holding, sliding to a recent photo and releasing attaches exactly that photo and starts its landing', async () => {
  const f = gestureFixture(async () => readyPhotos);
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  const strip = f.updates.at(-1);
  assert.equal(strip.photos.length, 4);
  assert.equal(strip.exit, null);
  assert.deepEqual(f.holds, [true, false]);
  assert.deepEqual(f.haptics, ['light']);
  assert.equal(f.captures.length, 1);
  assert.equal(f.captures[0].options.result, 'data-uri');
  const y = tileY(strip);
  f.tree.props.onResponderMove(f.event(tileX(strip, 0), y));
  f.tree.props.onResponderMove(f.event(tileX(strip, 0) + 2, y));
  assert.deepEqual(f.haptics, ['light', 'selection']);
  // The midpoint of a gap does not flicker away from the held photo.
  f.tree.props.onResponderMove(f.event(strip.left + strip.size + strip.gap / 2, y));
  assert.equal(f.updates.at(-1).selected, 0);
  f.tree.props.onResponderMove(f.event(tileX(strip, 1), y));
  f.tree.props.onResponderMove(f.event(tileX(strip, 2), y));
  assert.equal(f.updates.at(-1).selected, 2);
  f.tree.props.onResponderRelease(f.event(tileX(strip, 2), y));
  assert.deepEqual(f.selected, [readyPhotos.photos[2]]);
  assert.equal(f.updates.at(-1).exit.index, 2);
  assert.equal(f.updates.at(-1).selected, 2);
  assert.equal(f.taps(), 0);
  assert.deepEqual(f.haptics, ['light', 'selection', 'selection', 'selection']);
});

test('a photo already under the finger when the row opens gives selection feedback once', async () => {
  let resolvePhotos;
  const f = gestureFixture(() => new Promise(resolve => { resolvePhotos = resolve; }));
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  const layout = f.motion.recentPhotoLayout(375, 30, 400, { height: 0, attachments: 0 });
  const x = layout.left + layout.size / 2;
  const y = layout.top + layout.size / 2;
  f.tree.props.onResponderMove(f.event(x, y));
  resolvePhotos(readyPhotos);
  await new Promise(setImmediate);
  assert.equal(f.updates.at(-1).selected, 0);
  assert.deepEqual(f.haptics, ['selection']);
  f.tree.props.onResponderRelease(f.event(x, y));
  assert.deepEqual(f.selected, [readyPhotos.photos[0]]);
  assert.deepEqual(f.haptics, ['selection']);
});

test('the close button retracts the photos once, ignores more taps and closes after the animation', async () => {
  const f = gestureFixture(async () => readyPhotos);
  let closed = 0;
  let selected = 0;
  const exits = [];
  const strip = stripFixture({ onSelect: () => { selected++; } });
  const props = { strip, onDismiss: exit => exits.push(exit), onClose: () => { closed++; } };
  const view = f.overlay();
  const rendered = view.render(props);
  f.closeButton(rendered).props.onPress();
  f.closeButton(rendered).props.onPress();
  f.tilePress(rendered, 0)();
  assert.equal(exits.length, 1);
  assert.equal(exits[0].index, null);
  assert.equal(selected, 0);
  view.render({ ...props, strip: { ...strip, exit: exits[0] } });
  assert.equal(closed, 0);
  await pause(f.motion.RECENT_RETRACT_MS + 40);
  assert.equal(closed, 1);
  assert.deepEqual(f.haptics, []);

  const reduced = f.overlay();
  const reducedProps = { ...props, reduceMotion: true };
  const reducedTree = reduced.render(reducedProps);
  f.closeButton(reducedTree).props.onPress();
  assert.equal(exits.length, 2);
  reduced.render({ ...reducedProps, strip: { ...strip, exit: exits[1] } });
  assert.equal(closed, 2);
});

test('a chosen photo holds its slot until the real preview is ready', async () => {
  const f = gestureFixture(async () => readyPhotos);
  let closed = 0;
  let resolvePreview;
  const settled = new Promise(resolve => { resolvePreview = resolve; });
  const strip = stripFixture({ selected: 1, exit: { index: 1, settled } });
  f.overlay().render({ strip, onDismiss() {}, onClose: () => { closed++; } });
  await pause(f.motion.RECENT_FLIGHT_MS + 60);
  assert.equal(closed, 0);
  assert.deepEqual(f.haptics, ['soft']);
  resolvePreview();
  await pause(150);
  assert.equal(closed, 1);
});

test('a failed preview still lets the chosen photo finish and close', async () => {
  const f = gestureFixture(async () => readyPhotos);
  let closed = 0;
  const strip = stripFixture({ selected: 0, exit: { index: 0, settled: Promise.reject(new Error('no preview')) } });
  f.overlay().render({ strip, onDismiss() {}, onClose: () => { closed++; } });
  await pause(f.motion.RECENT_FLIGHT_MS + 150);
  assert.equal(closed, 1);
});

test('only the chosen tile flies to its slot while the others return to the plus', () => {
  const f = gestureFixture(async () => readyPhotos);
  const strip = stripFixture({ selected: 2, exit: { index: 2, settled: Promise.resolve() } });
  const rendered = f.overlay().render({ strip, onDismiss() {}, onClose() {} });
  const motionOf = index => f.tile(rendered, index).props.style.at(-1);
  const chosen = f.motion.recentTileGeometry(strip, 2);
  const chosenMotion = motionOf(2);
  assert.equal(chosenMotion.opacity, 1);
  assert.equal(chosenMotion.transform[0].translateX, chosen.landX);
  assert.equal(chosenMotion.transform[1].translateY, chosen.landY);
  assert.equal(chosenMotion.transform[3].scale, chosen.landScale);
  const other = f.motion.recentTileGeometry(strip, 0);
  const otherMotion = motionOf(0);
  assert.equal(otherMotion.opacity, 0);
  assert.equal(otherMotion.transform[0].translateX, other.fromX - f.motion.RECENT_NUDGE);
  assert.equal(otherMotion.transform[1].translateY, other.fromY);
});

test('recent thumbnails use the Expo photo loader with the full encoded asset identifier', async () => {
  const f = gestureFixture(async () => readyPhotos);
  let backdropErrors = 0;
  const strip = stripFixture({ photos: [{ id: 'ph://ABC/L0/001' }],
    backdrop: Promise.resolve({ uri: 'data:image/jpeg;base64,c25hcHNob3Q=', width: 375, height: 800 }) });
  const props = { strip, onDismiss() {}, onClose() {}, onBackdropError: () => { backdropErrors++; } };
  const view = f.overlay();
  assert.equal(find(view.render(props), node => node.type === f.Mask), null);
  await new Promise(setImmediate);
  const rendered = view.render(props);
  const image = find(f.tile(rendered, 0), node => node.type === f.Image);
  assert.equal(image.props.source.uri, 'ph://ABC%2FL0%2F001');
  assert.equal(image.props.cachePolicy, 'memory');
  assert.ok(find(rendered, node => node.type === f.Mask));
  const blurred = find(rendered, node => node.type === f.Image && node.props.source.uri.startsWith('data:image/'));
  assert.ok(blurred.props.blurRadius > 0);
  assert.equal(blurred.props.cachePolicy, 'none');
  blurred.props.onError();
  assert.equal(backdropErrors, 1);
  const photoRow = find(rendered, node => node.type === f.AnimatedView && node.props.style?.[0]?.flexDirection === 'row');
  assert.equal(photoRow.props.style[0].backgroundColor, 'transparent');
});

test('a missing snapshot asks the chat to blur itself instead', async () => {
  const f = gestureFixture(async () => readyPhotos);
  let backdropErrors = 0;
  f.overlay().render({ strip: stripFixture(), onDismiss() {}, onClose() {}, onBackdropError: () => { backdropErrors++; } });
  await new Promise(setImmediate);
  assert.equal(backdropErrors, 1);
});

test('a slow or failed background capture does not delay the photo row', async () => {
  let resolveCapture;
  const pending = new Promise(resolve => { resolveCapture = resolve; });
  const f = gestureFixture(async () => readyPhotos, () => pending);
  f.tree.props.onResponderGrant(f.event(50, 420));
  await waitForLongPress();
  const strip = f.updates.at(-1);
  assert.equal(strip.photos.length, 4);
  f.tree.props.onResponderRelease(f.event(50, 420));
  resolveCapture('data:image/jpeg;base64,c25hcHNob3Q=');
  assert.equal((await strip.backdrop).uri, 'data:image/jpeg;base64,c25hcHNob3Q=');
  const failed = gestureFixture(async () => readyPhotos, async () => { throw new Error('capture failed'); });
  failed.tree.props.onResponderGrant(failed.event(50, 420));
  await waitForLongPress();
  assert.equal(await failed.updates.at(-1).backdrop, null);
  assert.equal(failed.updates.at(-1).photos.length, 4);
  failed.tree.props.onResponderTerminate(failed.event(50, 420));
  const stalled = gestureFixture(async () => readyPhotos, () => new Promise(() => {}));
  stalled.tree.props.onResponderGrant(stalled.event(50, 420));
  await waitForLongPress();
  assert.equal(stalled.updates.at(-1).photos.length, 4);
  assert.equal(await stalled.updates.at(-1).backdrop, null);
  stalled.tree.props.onResponderTerminate(stalled.event(50, 420));
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
  assert.equal(strip.exit, null);
  const exits = [];
  const rendered = f.overlay().render({ strip, onDismiss: exit => exits.push(exit), onClose() {} });
  f.tilePress(rendered, 1)();
  assert.equal(exits[0].index, 1);
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

test('cancelling a long press retracts the photos without attaching one', async () => {
  const cancelled = gestureFixture(async () => readyPhotos);
  cancelled.tree.props.onResponderGrant(cancelled.event(50, 420));
  await waitForLongPress();
  cancelled.tree.props.onResponderTerminate(cancelled.event(50, 420));
  assert.deepEqual(cancelled.selected, []);
  assert.equal(cancelled.updates.at(-1).exit.index, null);
  const early = gestureFixture(async () => readyPhotos);
  early.tree.props.onResponderGrant(early.event(50, 420));
  early.tree.props.onResponderTerminate(early.event(50, 420));
  assert.equal(early.updates.at(-1), null);
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
  assert.deepEqual(f.haptics, []);
  assert.deepEqual(f.selected, []);
});

const motion = load('chatRecentPhotoMotion.ts', {});

test('the back swipe is refused while the plus is held, using the setting read when a swipe begins', () => {
  const open = motion.recentBackGesture(false);
  assert.equal(open.gestureEnabled, true);
  assert.equal(open.gestureResponseDistance, undefined);
  const blocked = motion.recentBackGesture(true);
  assert.equal(blocked.gestureEnabled, false);
  // react-native-screens refuses a swipe whose x is below `start`, so no point on any screen qualifies.
  assert.ok(blocked.gestureResponseDistance.start > 10000);
});

test('the row spans the composer and keeps its place above the plus however tall the composer grows', () => {
  const single = motion.recentPhotoLayout(375, 15, 700, { height: 62, attachments: 0 });
  assert.equal(single.left, 12);
  assert.equal(single.left + 4 * single.size + 3 * single.gap, 375 - 12);
  const surfaceTop = 700 - 3;
  assert.equal(single.top + single.size, surfaceTop - 14);
  assert.equal(single.blurTop, single.top);
  const withTray = motion.recentPhotoLayout(375, 15, 700, { height: 170, attachments: 1 });
  assert.equal(withTray.top, single.top);
  const withLines = motion.recentPhotoLayout(375, 15, 700, { height: 128, attachments: 0 });
  assert.equal(withLines.top, single.top);
  // Whatever rises above the row still ends up under the full blur.
  const trayedSurfaceTop = 700 + 40 + 11 - 170 + 8;
  assert.ok(withTray.blurTop < trayedSurfaceTop && trayedSurfaceTop < withTray.top);
  assert.equal(motion.recentPhotoLayout(375, 15, 60, { height: 170, attachments: 1 }).blurTop, 0);
  const wide = motion.recentPhotoLayout(820, 15, 700, { height: 62, attachments: 0 });
  assert.equal(wide.size, 96);
  assert.equal(wide.left, 12);
});

test('an image preview has no opaque layer behind a landing photo and reports when it has loaded', () => {
  function View() {}
  function Image() {}
  const preview = load('components/chatMediaPreviewShared.tsx', {
    react: { useEffect() {}, useState() {} },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'expo-image': { Image }, 'expo-symbols': { SymbolView() {} }, 'expo-web-browser': {},
    'react-native': { Alert: {}, View, StyleSheet: { create: styles => styles, absoluteFill: {} } },
    '../chatMedia': { chatMediaTicket() {} },
  });
  const flat = node => Object.assign({}, ...node.props.style);
  let settled = 0;
  const image = preview.SelectedChatMediaPreview({ draft: { kind: 'image', uri: 'file:///a.jpg' }, onImageSettled: () => { settled++; } });
  assert.equal(flat(image).backgroundColor, undefined);
  const loaded = find(image, node => node.type === Image);
  loaded.props.onLoad();
  loaded.props.onError();
  assert.equal(settled, 2);
  assert.equal(flat(preview.SelectedChatMediaPreview({ draft: { kind: 'video', uri: 'file:///a.mov' } })).backgroundColor, '#e5e5ea');
});

test('a landing targets the slot the next attachment preview will fill', () => {
  const first = motion.recentPhotoLayout(375, 15, 700, { height: 62, attachments: 0 });
  assert.deepEqual(first.landing, { left: 23, top: 700 - 108 + 8, size: 96 });
  const second = motion.recentPhotoLayout(375, 15, 700, { height: 170, attachments: 1 });
  assert.deepEqual(second.landing, { left: 23 + 104, top: 700 - 108 + 8, size: 96 });
  const third = motion.recentPhotoLayout(375, 15, 700, { height: 170, attachments: 2 });
  assert.equal(third.landing.left, 23 + 208);
  // From the fourth photo on, the tray has scrolled its newest slot to its trailing edge.
  for (const attachments of [3, 4, 9]) {
    const full = motion.recentPhotoLayout(375, 15, 700, { height: 170, attachments });
    assert.equal(full.landing.left + full.landing.size, 375 - 15 - 8);
    assert.ok(full.landing.left >= third.landing.left - 104 + 96 + 8, 'the photo lands clear of the previous slot');
  }
  const wide = motion.recentPhotoLayout(820, 15, 700, { height: 170, attachments: 3 });
  assert.equal(wide.landing.left, 23 + 312);
});

test('finger tracking has no dead gaps, ignores the plus and resists flicker', () => {
  const strip = { photos: [1, 2, 3, 4], left: 12, top: 100, size: 80, gap: 8 };
  const root = { x: 0, y: 0 };
  assert.equal(motion.recentPhotoIndex(strip, root, 12 + 80 + 3, 140), 0);
  assert.equal(motion.recentPhotoIndex(strip, root, 12 + 80 + 5, 140), 1);
  assert.equal(motion.recentPhotoIndex(strip, root, 12 + 80 + 7, 140, 0), 0);
  assert.equal(motion.recentPhotoIndex(strip, root, 12 + 80 + 20, 140, 0), 1);
  assert.equal(motion.recentPhotoIndex(strip, root, 40, 100 + 80 + 40), null);
  assert.equal(motion.recentPhotoIndex(strip, root, 40, 100 + 80 + 18), null);
  assert.equal(motion.recentPhotoIndex(strip, root, 40, 100 + 80 + 18, 0), 0);
  assert.equal(motion.recentPhotoIndex(strip, root, 500, 140), null);
});

test('a tile starts inside the plus, rests untransformed and ends exactly on the preview slot', () => {
  const strip = { photos: [1, 2, 3, 4], ...motion.recentPhotoLayout(375, 15, 700, { height: 62, attachments: 0 }), triggerLeft: 15, triggerTop: 700 };
  const geometry = motion.recentTileGeometry(strip, 3);
  const start = motion.recentTileFrame(0, 0, 0, 0, 0, geometry);
  assert.equal(start.opacity, 0);
  assert.equal(start.scale, 0.3);
  assert.equal(start.translateX, geometry.fromX);
  assert.equal(start.translateY, geometry.fromY);
  assert.ok(geometry.fromX < 0 && geometry.fromY > 0);
  const rest = motion.recentTileFrame(1, 1, 0, 0, 0, geometry);
  assert.deepEqual([rest.opacity, rest.translateX, rest.translateY, rest.rotate, rest.scale, rest.ring], [1, 0, 0, 0, 1, 0]);
  const held = motion.recentTileFrame(1, 1, 1, 0, 0, geometry);
  assert.ok(held.scale > 1 && held.translateY < 0 && held.ring === 1);
  const dimmed = motion.recentTileFrame(1, 1, -1, 4, 0, geometry);
  assert.ok(dimmed.scale < 1 && dimmed.opacity < 1 && dimmed.translateX === 4);
  const landed = motion.recentTileFrame(1, 1, 1, 0, 1, geometry);
  const slotX = strip.left + 3 * (strip.size + strip.gap) + strip.size / 2 + landed.translateX;
  const slotY = strip.top + strip.size / 2 + landed.translateY;
  assert.ok(Math.abs(slotX - (strip.landing.left + 48)) < 1e-9);
  assert.ok(Math.abs(slotY - (strip.landing.top + 48)) < 1e-9);
  assert.ok(Math.abs(strip.size * landed.scale - 96) < 1e-9);
  assert.ok(Math.abs(landed.radius * landed.scale - 12) < 1e-9);
  assert.ok(Math.abs(landed.rotate) < 1e-9 && landed.ring === 0);
  // Mid-flight the path is an arc: the tile has risen further than it has crossed.
  const mid = motion.recentTileFrame(0.5, 0.5, 0, 0, 0, geometry);
  assert.ok(mid.translateX / geometry.fromX > mid.translateY / geometry.fromY);
});

test('the spring settings keep the far tile on screen and finish inside their time budgets', () => {
  const ratio = ({ stiffness, damping, mass }) => damping / (2 * Math.sqrt(stiffness * mass));
  const overshoot = spring => Math.exp(-Math.PI * ratio(spring) / Math.sqrt(1 - ratio(spring) ** 2));
  const width = 375;
  const strip = { photos: [1, 2, 3, 4], ...motion.recentPhotoLayout(width, 15, 700, { height: 62, attachments: 0 }), triggerLeft: 15, triggerTop: 700 };
  const far = motion.recentTileGeometry(strip, 3);
  const peak = 1 + overshoot(motion.recentSprings.travel);
  const peakFrame = motion.recentTileFrame(peak, 1 + overshoot(motion.recentSprings.bloom), 0, 0, 0, far);
  const center = strip.left + 3 * (strip.size + strip.gap) + strip.size / 2 + peakFrame.translateX;
  assert.ok(center + strip.size * peakFrame.scale / 2 <= width, 'the far tile overshoots the screen edge');
  assert.ok(peakFrame.scale < 1.06, 'the pop is too large');
  const retract = motion.recentSprings.retract;
  assert.ok(Math.abs(ratio(retract) - 1) < 1e-9);
  const omega = Math.sqrt(retract.stiffness);
  const time = (motion.RECENT_RETRACT_MS - 3 * motion.RECENT_RETRACT_STAGGER_MS) / 1000;
  assert.ok((1 + omega * time) * Math.exp(-omega * time) < 0.02, 'a tile is still visible when the strip closes');
  const land = motion.recentSprings.land;
  assert.ok(Math.exp(-ratio(land) * Math.sqrt(land.stiffness) * motion.RECENT_FLIGHT_MS / 1000) < 0.01, 'the flight is unfinished at the hand-off');
});
