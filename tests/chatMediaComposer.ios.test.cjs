/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitForMediaToLeave = () => pause(180);
const FLIGHT_MS = 50;
const waitForLanding = () => pause(FLIGHT_MS + 30);

function findAll(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, matches)); return matches; }
  if (predicate(node)) matches.push(node);
  findAll(node.props?.children, predicate, matches);
  return matches;
}

const pendingSlot = (tree, app) => find(tree, node => node.type === app.ui.Rectangle && node.props.modifiers.some(modifier => modifier.type === 'id'));
const flight = node => node.props.modifiers.find(modifier => modifier.type === 'matched');
const sentRow = { key: 'outgoing:a', body: 'Salom', timestamp: 0, mine: true, pending: true };

function fixture(pickerResult, cameraAllowed = true) {
  const hooks = [];
  let cursor = 0;
  const slot = initial => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return index;
  };
  const react = {
    useState(initial) { const index = slot(initial); return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = slot({ current: initial }); return hooks[index]; },
    useEffect() {},
    useCallback(fn) { return fn; },
    useId() { return 'chat-namespace'; },
  };
  const ui = {};
  for (const name of ['Button', 'Host', 'HStack', 'Image', 'Namespace', 'Popover', 'ProgressView', 'Rectangle', 'RNHostView', 'ScrollView', 'Spacer', 'Text', 'TextField', 'VStack', 'ZStack']) {
    ui[name] = function () {};
    ui[name].displayName = name;
  }
  const animations = [];
  ui.withAnimation = (animation, body) => { animations.push(animation); body(); };
  ui.Popover.Trigger = function () {};
  ui.Popover.Content = function () {};
  ui.useNativeState = initial => {
    const index = slot({ value: initial, get() { return this.value; } });
    return hooks[index];
  };
  const modifiers = new Proxy({
    Animation: { easeOut: options => ({ ...options, delay: delay => ({ ...options, delay }) }), spring: options => options },
    matchedGeometryEffect: (id, namespaceId, options) => ({ type: 'matched', id, namespaceId, ...options }),
    offset: value => ({ type: 'offset', ...value }),
    onAppear: run => ({ type: 'appear', run }),
    zIndex: value => ({ type: 'zIndex', value }),
    shapes: { circle: () => ({}), rectangle: () => ({}), roundedRectangle: () => ({}) },
    accessibilityLabel: value => ({ type: 'label', value }),
    blur: radius => ({ type: 'blur', radius }),
    disabled: value => ({ type: 'disabled', value }),
    frame: value => ({ type: 'frame', ...value }),
    glassEffect: () => ({ type: 'glass-surface' }),
    id: value => ({ type: 'id', value }),
    opacity: value => ({ type: 'opacity', value }),
    scrollPosition: (state, options) => ({ type: 'scrollPosition', state, options }),
  }, { get: (target, name) => target[name] ?? (() => ({})) });
  const selected = { uri: 'file:///selected', kind: 'image', filename: 'photo.jpg', clientMessageId: 'media-1' };
  let rows = [];
  const pickerCalls = [], sent = [], discarded = [], prepared = [], alerts = [], sendResults = [];
  let preparationCount = 0;
  let preparationFails = false;
  let preparationDelay = 0;
  const prepare = async asset => {
    if (preparationDelay) await pause(preparationDelay);
    if (preparationFails) throw new Error('Rasmni o‘qib bo‘lmadi.');
    prepared.push(asset);
    preparationCount++;
    return preparationCount === 1 ? selected : { ...selected, uri: `file:///selected-${preparationCount}`, clientMessageId: `media-${preparationCount}` };
  };
  function RecentChatPhotosButton() {}
  const thread = {
    messages: [], pending: [], storageReady: true, queueing: false, mediaSending: false, mediaProgress: '', mediaError: '',
    clearMediaError() {}, send: async () => true,
    sendMedia: async (draft, caption) => { sent.push({ draft, caption }); return sendResults.length ? sendResults.shift() : true; },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { Fragment: Symbol('Fragment'), jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-image-picker': { UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
      requestCameraPermissionsAsync: async () => ({ granted: cameraAllowed }),
      launchCameraAsync: async options => { pickerCalls.push({ source: 'camera', options }); return pickerResult; },
      launchImageLibraryAsync: async options => { pickerCalls.push({ source: 'library', options }); return pickerResult; } },
    'expo-document-picker': { getDocumentAsync: async options => { pickerCalls.push({ source: 'file', options }); return pickerResult; } },
    'expo-router': { Stack: { Screen() {} } },
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, Platform: { Version: 26 }, StyleSheet: { create: styles => styles }, useColorScheme: () => 'dark', useWindowDimensions: () => ({ width: 375, height: 800 }), View() {} },
    'react-native-reanimated': { useReducedMotion: () => false },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'react-native-worklets': { scheduleOnUI: fn => fn(), scheduleOnRN: (fn, ...args) => fn(...args) },
    '../chatComposer': { draftAfterSending: (sentValue, current) => sentValue === current ? '' : current },
    '../chatMedia': { prepareChatMedia: prepare, prepareChatDocument: prepare, discardChatMedia: draft => discarded.push(draft) },
    '../chatRecentPhotoMotion': { RECENT_FLIGHT_MS: FLIGHT_MS, recentBackGesture: blocked => ({ backBlocked: blocked }) },
    '../chatRecentPhotos': { prepareRecentChatPhoto: prepare },
    '../chatModel': { chatTimeline: () => rows, outgoingMessageKey: id => `outgoing:${id}` },
    '../useChatThread': { useChatThread: () => thread },
    './ChatThreadHeader.ios': { CHAT_HEADER_CONTENT_HEIGHT: 0, ChatThreadHeader() {} },
    './ChatMediaPreview.ios': { SelectedChatMediaPreview() {}, ChatMediaThumbnail() {}, openChatMedia() {} },
    './RecentChatPhotos.ios': { RecentChatPhotosButton, RecentChatPhotoStrip() {} },
  };
  const filename = path.resolve(__dirname, '../src/components/ChatThreadScreen.ios.tsx');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const screen = loaded.exports.ChatThreadScreen({ session: {}, conversationId: 'c1', title: '', peer: null });
  const composer = find(screen, node => node.type?.name === 'Composer');
  const body = find(screen, node => node.type?.name === 'ConversationBody');
  assert.ok(composer);
  const mediaCounts = [];
  composer.props.onMediaCountChange = count => mediaCounts.push(count);
  hooks.length = 0;
  const render = () => { cursor = 0; return composer.type(composer.props); };
  const renderBubble = (nextRows, bodyProps) => {
    rows = nextRows;
    hooks.length = 0; cursor = 0;
    const list = body.type({ ...body.props, ...bodyProps });
    const element = find(list, node => node.type?.name === 'MessageBubble');
    hooks.length = 0;
    return { list, element, render: () => { cursor = 0; return element.type(element.props); } };
  };
  const renderBody = blurFallback => { hooks.length = 0; cursor = 0; return body.type({ ...body.props, blurFallback }); };
  const button = (tree, label) => {
    const result = find(tree, node => node.type === ui.Button && node.props.modifiers?.some(modifier => modifier.type === 'label' && modifier.value === label));
    assert.ok(result, `${label} button was not found`);
    return result;
  };
  const menu = tree => {
    const result = find(tree, node => node.type === ui.Popover);
    assert.ok(result, 'media menu was not found');
    return result;
  };
  const tapPlus = tree => {
    const result = find(tree, node => node.type === RecentChatPhotosButton);
    assert.ok(result, 'media button was not found');
    result.props.onTap();
  };
  const choose = label => {
    tapPlus(render());
    const tree = render();
    assert.equal(menu(tree).props.isPresented, true);
    button(menu(tree), label).props.onPress();
  };
  return { screen, render, renderBody, renderBubble, animations, button, menu, choose, tapPlus, ui, selected, pickerCalls, sent, discarded, prepared, alerts, composer, RecentChatPhotosButton, sendResults, mediaCounts, failPreparation: () => { preparationFails = true; }, delayPreparation: ms => { preparationDelay = ms; } };
}

test('the chat itself blurs when a backdrop capture is unavailable', () => {
  const app = fixture({ canceled: true, assets: [] });
  assert.ok(app.renderBody(true).props.modifiers.some(modifier => modifier.type === 'blur' && modifier.radius > 0));
  assert.ok(app.renderBody(false).props.modifiers.some(modifier => modifier.type === 'blur' && modifier.radius === 0));
});

test('the plus offers sources and library selection waits for the user to press send', async () => {
  const app = fixture({ canceled: false, assets: [{ uri: 'file:///selected', type: 'image' }] });
  let tree = app.render();
  const field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Izoh';
  field.props.onTextChange('Izoh');
  app.tapPlus(app.render());
  tree = app.render();
  const menu = app.menu(tree);
  assert.equal(menu.props.isPresented, true);
  assert.equal(find(tree, node => node.type === app.ui.TextField).props.text.value, 'Izoh');
  for (const label of ['Kamera', 'Rasmlar', 'Fayllar']) {
    const icon = find(app.button(menu, label), node => node.type === app.ui.Image);
    assert.equal(icon.props.size, 18);
  }
  assert.equal(app.pickerCalls.length, 0);
  app.button(menu, 'Rasmlar').props.onPress();
  tree = app.render();
  assert.equal(app.menu(tree).props.isPresented, false);
  assert.equal(app.pickerCalls.length, 0);
  assert.equal(app.button(tree, 'Xabarni yuborish').props.modifiers.find(modifier => modifier.type === 'disabled').value, true);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(app.pickerCalls[0].source, 'library');
  assert.deepEqual(app.pickerCalls[0].options.mediaTypes, ['images', 'videos']);
  assert.equal(app.sent.length, 0);

  tree = app.render();
  const surface = find(tree, node => node.type === app.ui.VStack && node.props.modifiers?.some(modifier => modifier.type === 'glass-surface'));
  assert.ok(surface);
  assert.ok(find(surface, node => node.type?.name === 'SelectedChatMediaPreview'));
  assert.ok(find(surface, node => node.type === app.ui.TextField));
  const remove = app.button(surface, 'Media faylni olib tashlash');
  assert.equal(remove.props.label, undefined);
  assert.equal(find(remove, node => node.type === app.ui.Image).props.systemName, 'xmark');
  app.button(tree, 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(app.sent, [{ draft: app.selected, caption: 'Izoh' }]);
  assert.deepEqual(app.discarded, [app.selected]);
  assert.equal(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'), null);
});

test('the attachment can be removed inside the composer and upload status remains visible', async () => {
  const app = fixture({ canceled: false, assets: [{ uri: 'file:///selected', type: 'image' }] });
  app.choose('Rasmlar');
  await new Promise(resolve => setTimeout(resolve, 450));
  let tree = app.render();
  const field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Izoh';
  field.props.onTextChange('Izoh');

  app.composer.props.mediaSending = true;
  app.composer.props.mediaProgress = 'Yuklanmoqda…';
  tree = app.render();
  assert.ok(find(tree, node => node.type === app.ui.ProgressView));
  assert.ok(find(tree, node => node.type === app.ui.Text && node.props.children === 'Yuklanmoqda…'));
  app.composer.props.mediaSending = false;
  app.composer.props.mediaError = 'Qayta urinib ko‘ring';
  tree = app.render();
  assert.ok(find(tree, node => node.type === app.ui.Text && node.props.children === 'Qayta urinib ko‘ring'));
  app.button(tree, 'Media faylni olib tashlash').props.onPress();
  await waitForMediaToLeave();
  tree = app.render();
  assert.equal(find(tree, node => node.type?.name === 'SelectedChatMediaPreview'), null);
  assert.equal(find(tree, node => node.type === app.ui.TextField).props.text.value, 'Izoh');
  assert.deepEqual(app.discarded, [app.selected]);
});

test('closing the picker without selecting does not create or send an attachment', async () => {
  const app = fixture({ canceled: true, assets: null });
  app.choose('Rasmlar');
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(app.sent.length, 0);
  assert.equal(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'), null);
});

test('camera and files open their native pickers for images and videos', async () => {
  const camera = fixture({ canceled: false, assets: [{ uri: 'file:///camera', type: 'video' }] });
  camera.choose('Kamera');
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(camera.pickerCalls[0].source, 'camera');
  assert.deepEqual(camera.pickerCalls[0].options.mediaTypes, ['images', 'videos']);
  assert.equal(camera.pickerCalls[0].options.videoMaxDuration, 600);
  assert.equal(camera.prepared[0].uri, 'file:///camera');
  assert.equal(camera.sent.length, 0);

  const fileAsset = { uri: 'file:///document', name: 'video.mov', mimeType: 'video/quicktime' };
  const files = fixture({ canceled: false, assets: [fileAsset] });
  files.choose('Fayllar');
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(files.pickerCalls[0].source, 'file');
  assert.deepEqual(files.pickerCalls[0].options.type, ['image/*', 'video/*']);
  assert.equal(files.pickerCalls[0].options.copyToCacheDirectory, true);
  assert.deepEqual(files.prepared, [fileAsset]);
  assert.equal(files.sent.length, 0);
});

test('denied camera permission does not launch the camera', async () => {
  const app = fixture({ canceled: true, assets: null }, false);
  app.choose('Kamera');
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(app.pickerCalls.length, 0);
  assert.match(app.alerts[0][1], /Kameradan foydalanishga ruxsat/);
});

test('dismissing the menu leaves the composer and its draft in place', () => {
  const app = fixture({ canceled: true, assets: null });
  const field = find(app.render(), node => node.type === app.ui.TextField);
  field.props.text.value = 'Saqlangan matn';
  field.props.onTextChange('Saqlangan matn');
  app.tapPlus(app.render());
  let tree = app.render();
  assert.equal(app.menu(tree).props.isPresented, true);
  assert.equal(find(tree, node => node.type === app.ui.TextField).props.text.value, 'Saqlangan matn');
  app.menu(tree).props.onIsPresentedChange(false);
  tree = app.render();
  assert.equal(app.menu(tree).props.isPresented, false);
  assert.equal(find(tree, node => node.type === app.ui.TextField).props.text.value, 'Saqlangan matn');
  assert.equal(app.pickerCalls.length, 0);
});

test('a recent photo is attached as a draft without sending a message', async () => {
  const app = fixture({ canceled: true, assets: null });
  const photo = { id: 'ph://newest', filename: 'recent.jpg', width: 100, height: 100 };
  const trigger = find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger.props.onSelect(photo);
  await new Promise(setImmediate);
  const tree = app.render();
  assert.deepEqual(app.prepared, [photo]);
  assert.equal(app.sent.length, 0);
  assert.ok(find(tree, node => node.type?.name === 'SelectedChatMediaPreview'));
});

test('a landing recent photo is released only when its real preview has loaded or been removed', async () => {
  const app = fixture({ canceled: true, assets: null });
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  const preview = () => find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview');
  let loaded = false;
  trigger().props.onSelect({ id: 'ph://one' }).then(() => { loaded = true; });
  await new Promise(setImmediate);
  assert.ok(preview());
  assert.equal(trigger().props.enabled, true);
  assert.equal(loaded, false);
  preview().props.onImageSettled();
  await new Promise(setImmediate);
  assert.equal(loaded, true);

  let removed = false;
  trigger().props.onSelect({ id: 'ph://two' }).then(() => { removed = true; });
  await waitForLanding();
  assert.equal(removed, false);
  const removeButtons = findAll(app.render(), node => node.type === app.ui.Button && node.props.modifiers?.some(modifier => modifier.type === 'label' && modifier.value === 'Media faylni olib tashlash'));
  removeButtons.at(-1).props.onPress();
  await waitForMediaToLeave();
  assert.equal(removed, true);
});

test('a removed photo fades out first, cannot be sent meanwhile and only then shrinks the composer', async () => {
  const app = fixture({ canceled: true, assets: null });
  const previews = () => findAll(app.render(), node => node.type?.name === 'SelectedChatMediaPreview');
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  await waitForLanding();
  const before = app.mediaCounts.length;
  assert.equal(app.mediaCounts.at(-1), 1);
  assert.equal(app.button(app.render(), 'Xabarni yuborish').props.modifiers.find(modifier => modifier.type === 'disabled').value, false);

  app.button(app.render(), 'Media faylni olib tashlash').props.onPress();
  assert.equal(previews().length, 1);
  assert.equal(app.mediaCounts.length, before);
  assert.deepEqual(app.discarded, []);
  const tree = app.render();
  assert.equal(find(tree, node => node.type === app.ui.Button && node.props.modifiers?.some(modifier => modifier.value === 'Media faylni olib tashlash')), null);
  assert.equal(app.button(tree, 'Xabarni yuborish').props.modifiers.find(modifier => modifier.type === 'disabled').value, true);

  await waitForMediaToLeave();
  assert.equal(previews().length, 0);
  assert.equal(app.mediaCounts.at(-1), 0);
  assert.deepEqual(app.discarded, [app.selected]);
  assert.equal(app.sent.length, 0);
});

test('a chosen photo opens its slot at once and the real preview takes that slot over', async () => {
  const app = fixture({ canceled: true, assets: null });
  const slot = () => pendingSlot(app.render(), app);
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger().props.onSelect({ id: 'ph://one' });
  assert.ok(slot());
  assert.equal(app.mediaCounts.at(-1), 1);
  assert.equal(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'), null);
  assert.ok(slot().props.modifiers.some(modifier => modifier.type === 'id'));
  await new Promise(setImmediate);
  assert.equal(slot(), null);
  assert.equal(app.mediaCounts.at(-1), 1);
  assert.ok(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'));
  const tray = find(app.render(), node => node.type === app.ui.ScrollView && node.props.axes === 'horizontal');
  assert.equal(tray.props.modifiers.find(modifier => modifier.type === 'scrollPosition').options.anchor, 'trailing');
  const item = find(tray, node => node.type === app.ui.ZStack);
  assert.equal(item.props.modifiers.find(modifier => modifier.type === 'id').value, app.selected.clientMessageId);
});

test('a chosen photo stays hidden until the flying photo has arrived', async () => {
  const app = fixture({ canceled: true, assets: null });
  const item = () => find(app.render(), node => node.type === app.ui.ZStack);
  const shown = () => item().props.modifiers.find(modifier => modifier.type === 'opacity').value;
  const mark = () => find(item(), node => node.type === app.ui.Button);
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  assert.ok(find(item(), node => node.type?.name === 'SelectedChatMediaPreview'));
  assert.equal(shown(), 0);
  assert.equal(mark(), null);
  await waitForLanding();
  assert.equal(shown(), 1);
  assert.ok(mark());
});

test('a photo that takes longer than the flight is shown as soon as it is ready', async () => {
  const app = fixture({ canceled: true, assets: null });
  app.delayPreparation(FLIGHT_MS + 30);
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  await pause(FLIGHT_MS + 60);
  const item = find(app.render(), node => node.type === app.ui.ZStack);
  assert.equal(item.props.modifiers.find(modifier => modifier.type === 'opacity').value, 1);
  assert.ok(find(item, node => node.type === app.ui.Button));
});

test('with reduced motion nothing flies, so the photo is never hidden', async () => {
  const app = fixture({ canceled: true, assets: null });
  app.composer.props.reduceMotion = true;
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  const item = find(app.render(), node => node.type === app.ui.ZStack);
  assert.equal(item.props.modifiers.find(modifier => modifier.type === 'opacity'), undefined);
  assert.ok(find(item, node => node.type === app.ui.Button));
});

test('a photo that cannot be prepared closes its slot again', async () => {
  const app = fixture({ canceled: true, assets: null });
  app.failPreparation();
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  assert.ok(pendingSlot(app.render(), app));
  await new Promise(setImmediate);
  assert.equal(pendingSlot(app.render(), app), null);
  assert.equal(app.mediaCounts.at(-1), 0);
  assert.match(app.alerts[0][1], /o‘qib bo‘lmadi/);
  assert.equal(find(app.render(), node => node.type === app.ui.ScrollView && node.props.axes === 'horizontal'), null);
});

test('the remove mark stays small but its tap target meets the iOS minimum', async () => {
  const app = fixture({ canceled: true, assets: null });
  find(app.render(), node => node.type === app.RecentChatPhotosButton).props.onSelect({ id: 'ph://one' });
  await waitForLanding();
  const mark = find(app.button(app.render(), 'Media faylni olib tashlash'), node => node.type === app.ui.Image);
  const frames = mark.props.modifiers.filter(modifier => modifier.type === 'frame');
  assert.deepEqual([frames[0].width, frames[0].height], [24, 24]);
  assert.ok(frames.at(-1).width >= 44 && frames.at(-1).height >= 44);
  assert.equal(frames.at(-1).alignment, 'topTrailing');
});

test('a sent text starts on the words in the field, then lands in its own place', () => {
  const app = fixture({ canceled: true, assets: null });
  const landed = [];
  const bubble = app.renderBubble([sentRow], { newKey: 'outgoing:a', onSendLanded: key => landed.push(key) });
  const text = tree => find(tree, node => node.type === app.ui.Text && node.props.children === 'Salom');
  const time = tree => findAll(tree, node => node.type === app.ui.Text).at(-1);
  const opacityOf = node => node.props.modifiers.find(modifier => modifier.type === 'opacity').value;
  let tree = bubble.render();
  const start = flight(text(tree));
  assert.equal(start.isSource, false);
  assert.equal(start.properties, 'position');
  assert.equal(start.anchor, 'leading');
  assert.equal(text(tree).props.modifiers.find(modifier => modifier.type === 'offset').x, -14);
  assert.equal(opacityOf(time(tree)), 0);
  assert.ok(opacityOf(tree) > 0, 'the bubble is visible from the first frame');

  const composerApp = fixture({ canceled: true, assets: null });
  const marker = find(composerApp.render(), node => node.type === composerApp.ui.Rectangle);
  assert.equal(flight(marker).id, start.id);
  assert.equal(flight(marker).namespaceId, start.namespaceId);
  assert.equal(flight(marker).anchor, start.anchor);
  assert.ok(find(app.screen, node => node.type === app.ui.Namespace && node.props.id === start.namespaceId));

  tree.props.modifiers.find(modifier => modifier.type === 'appear').run();
  assert.deepEqual(landed, ['outgoing:a']);
  tree = bubble.render();
  assert.equal(flight(text(tree)).isSource, true);
  assert.equal(text(tree).props.modifiers.find(modifier => modifier.type === 'offset').x, 0);
  assert.equal(opacityOf(time(tree)), 1);
  assert.equal(opacityOf(tree), 1);
});

test('the field marker is the flight origin only while a bubble is leaving it', () => {
  const app = fixture({ canceled: true, assets: null });
  const marker = () => flight(find(app.render(), node => node.type === app.ui.Rectangle));
  assert.equal(marker().isSource, false);
  app.composer.props.sendFlying = true;
  assert.equal(marker().isSource, true);
});

test('only the newest sent text flies; older, incoming, media and reduced-motion bubbles do not', () => {
  const text = (app, tree, body) => find(tree, node => node.type === app.ui.Text && node.props.children === body);
  const older = fixture({ canceled: true, assets: null });
  assert.equal(flight(text(older, older.renderBubble([sentRow], { newKey: 'outgoing:b' }).render(), 'Salom')), undefined);
  const incoming = fixture({ canceled: true, assets: null });
  assert.equal(flight(text(incoming, incoming.renderBubble([{ ...sentRow, mine: false }], { newKey: 'outgoing:a' }).render(), 'Salom')), undefined);
  const reduced = fixture({ canceled: true, assets: null });
  assert.equal(flight(text(reduced, reduced.renderBubble([sentRow], { newKey: 'outgoing:a', reduceMotion: true }).render(), 'Salom')), undefined);
  const media = fixture({ canceled: true, assets: null });
  const photo = media.renderBubble([{ ...sentRow, attachment: { kind: 'image', mediaId: 'm' } }], { newKey: 'outgoing:a' }).render();
  assert.equal(find(photo, node => node.props?.modifiers?.some(modifier => modifier.type === 'matched')), null);
  assert.equal(photo.props.modifiers.find(modifier => modifier.type === 'offset').y, 16);
});

test('the list rises above the composer only while a new bubble crosses it', async () => {
  const app = fixture({ canceled: true, assets: null });
  const layer = bodyProps => app.renderBubble([sentRow], bodyProps).list.props.modifiers.find(modifier => modifier.type === 'zIndex').value;
  assert.equal(layer({ newKey: null }), 0);
  assert.equal(layer({ newKey: 'outgoing:a' }), 1);
  assert.equal(layer({ newKey: 'outgoing:a', reduceMotion: true }), 0);
});

test('sending clears the field inside an animation, keeping text typed since', async () => {
  const app = fixture({ canceled: true, assets: null });
  const field = () => find(app.render(), node => node.type === app.ui.TextField);
  field().props.text.value = 'Salom';
  field().props.onTextChange('Salom');
  app.button(app.render(), 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.equal(field().props.text.value, '');
  assert.equal(app.animations.length, 1);
  assert.equal(app.animations[0].response, 0.42);

  const reduced = fixture({ canceled: true, assets: null });
  reduced.composer.props.reduceMotion = true;
  const reducedField = () => find(reduced.render(), node => node.type === reduced.ui.TextField);
  reducedField().props.text.value = 'Salom';
  reducedField().props.onTextChange('Salom');
  reduced.button(reduced.render(), 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(reduced.animations, [null]);
});

test('the chat allows the back swipe until the plus is held', () => {
  const app = fixture({ canceled: true, assets: null });
  assert.equal(find(app.screen, node => node.props?.options).props.options.backBlocked, false);
  assert.equal(typeof app.composer.props.onRecentHoldChange, 'function');
});

test('repeated selections add attachments and removal affects only the chosen one', async () => {
  const app = fixture({ canceled: true, assets: null });
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger().props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  trigger().props.onSelect({ id: 'ph://two' });
  await waitForLanding();
  let tree = app.render();
  assert.equal(findAll(tree, node => node.type?.name === 'SelectedChatMediaPreview').length, 2);
  const removeButtons = findAll(tree, node => node.type === app.ui.Button && node.props.modifiers?.some(modifier => modifier.type === 'label' && modifier.value === 'Media faylni olib tashlash'));
  removeButtons[0].props.onPress();
  await waitForMediaToLeave();
  tree = app.render();
  const remaining = findAll(tree, node => node.type?.name === 'SelectedChatMediaPreview');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].props.draft.clientMessageId, 'media-2');
  assert.deepEqual(app.discarded, [app.selected]);
});

test('partial multi-photo delivery retains only unsent items and does not repeat the caption', async () => {
  const app = fixture({ canceled: true, assets: null });
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger().props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  trigger().props.onSelect({ id: 'ph://two' });
  await new Promise(setImmediate);
  let tree = app.render();
  const field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Izoh';
  field.props.onTextChange('Izoh');
  app.sendResults.push(true, false, true);
  app.button(app.render(), 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(app.sent.map(item => [item.draft.clientMessageId, item.caption]), [['media-1', 'Izoh'], ['media-2', '']]);
  tree = app.render();
  assert.deepEqual(findAll(tree, node => node.type?.name === 'SelectedChatMediaPreview').map(node => node.props.draft.clientMessageId), ['media-2']);
  assert.equal(find(tree, node => node.type === app.ui.TextField).props.text.value, '');
  app.button(tree, 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(app.sent.map(item => [item.draft.clientMessageId, item.caption]), [['media-1', 'Izoh'], ['media-2', ''], ['media-2', '']]);
  assert.equal(findAll(app.render(), node => node.type?.name === 'SelectedChatMediaPreview').length, 0);
});

test('text typed during a multi-photo upload remains in the composer', async () => {
  const app = fixture({ canceled: true, assets: null });
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger().props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  trigger().props.onSelect({ id: 'ph://two' });
  await new Promise(setImmediate);
  let tree = app.render();
  let field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Birinchi izoh';
  field.props.onTextChange('Birinchi izoh');
  let completeFirst;
  app.sendResults.push(new Promise(resolve => { completeFirst = resolve; }), true);
  app.button(app.render(), 'Xabarni yuborish').props.onPress();
  tree = app.render();
  field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Keyingi xabar';
  field.props.onTextChange('Keyingi xabar');
  completeFirst(true);
  await new Promise(setImmediate);
  assert.deepEqual(app.sent.map(item => item.caption), ['Birinchi izoh', '']);
  assert.equal(find(app.render(), node => node.type === app.ui.TextField).props.text.value, 'Keyingi xabar');
});
