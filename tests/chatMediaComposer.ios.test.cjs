/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function findAll(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (Array.isArray(node)) { node.forEach(child => findAll(child, predicate, matches)); return matches; }
  if (predicate(node)) matches.push(node);
  findAll(node.props?.children, predicate, matches);
  return matches;
}

function fixture(pickerResult, cameraAllowed = true) {
  const hooks = [];
  let cursor = 0;
  const slot = initial => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return index;
  };
  const react = {
    useState(initial) { const index = slot(initial); return [hooks[index], value => { hooks[index] = value; }]; },
    useRef(initial) { const index = slot({ current: initial }); return hooks[index]; },
    useEffect() {},
    useCallback(fn) { return fn; },
  };
  const ui = {};
  for (const name of ['Button', 'Host', 'HStack', 'Image', 'Popover', 'ProgressView', 'RNHostView', 'ScrollView', 'Spacer', 'Text', 'TextField', 'VStack', 'ZStack']) {
    ui[name] = function () {};
    ui[name].displayName = name;
  }
  ui.Popover.Trigger = function () {};
  ui.Popover.Content = function () {};
  ui.useNativeState = initial => {
    const index = slot({ value: initial, get() { return this.value; } });
    return hooks[index];
  };
  const modifiers = new Proxy({
    shapes: { circle: () => ({}), rectangle: () => ({}), roundedRectangle: () => ({}) },
    accessibilityLabel: value => ({ type: 'label', value }),
    blur: radius => ({ type: 'blur', radius }),
    disabled: value => ({ type: 'disabled', value }),
    glassEffect: () => ({ type: 'glass-surface' }),
  }, { get: (target, name) => target[name] ?? (() => ({})) });
  const selected = { uri: 'file:///selected', kind: 'image', filename: 'photo.jpg', clientMessageId: 'media-1' };
  const pickerCalls = [], sent = [], discarded = [], prepared = [], alerts = [], sendResults = [];
  let preparationCount = 0;
  const prepare = async asset => {
    prepared.push(asset);
    preparationCount++;
    return preparationCount === 1 ? selected : { ...selected, uri: `file:///selected-${preparationCount}`, clientMessageId: `media-${preparationCount}` };
  };
  function RecentChatPhotosButton() {}
  const thread = {
    storageReady: true, queueing: false, mediaSending: false, mediaProgress: '', mediaError: '',
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
    'react-native': { Alert: { alert: (...args) => alerts.push(args) }, Platform: { Version: 26 }, StyleSheet: { create: styles => styles }, useColorScheme: () => 'dark', View() {} },
    'react-native-reanimated': { useReducedMotion: () => false },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'react-native-worklets': { scheduleOnUI: fn => fn(), scheduleOnRN: (fn, ...args) => fn(...args) },
    '../chatComposer': { draftAfterSending: (sentValue, current) => sentValue === current ? '' : current },
    '../chatMedia': { prepareChatMedia: prepare, prepareChatDocument: prepare, discardChatMedia: draft => discarded.push(draft) },
    '../chatRecentPhotos': { prepareRecentChatPhoto: prepare },
    '../chatModel': { chatTimeline: () => [] },
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
  hooks.length = 0;
  const render = () => { cursor = 0; return composer.type(composer.props); };
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
  return { render, renderBody, button, menu, choose, tapPlus, ui, selected, pickerCalls, sent, discarded, prepared, alerts, composer, RecentChatPhotosButton, sendResults };
}

test('the chat itself blurs when a backdrop capture is unavailable', () => {
  const app = fixture({ canceled: true, assets: [] });
  assert.ok(app.renderBody(true).props.modifiers.some(modifier => modifier.type === 'blur' && modifier.radius > 0));
  assert.ok(!app.renderBody(false).props.modifiers.some(modifier => modifier.type === 'blur'));
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

test('repeated selections add attachments and removal affects only the chosen one', async () => {
  const app = fixture({ canceled: true, assets: null });
  const trigger = () => find(app.render(), node => node.type === app.RecentChatPhotosButton);
  trigger().props.onSelect({ id: 'ph://one' });
  await new Promise(setImmediate);
  trigger().props.onSelect({ id: 'ph://two' });
  await new Promise(setImmediate);
  let tree = app.render();
  assert.equal(findAll(tree, node => node.type?.name === 'SelectedChatMediaPreview').length, 2);
  const removeButtons = findAll(tree, node => node.type === app.ui.Button && node.props.modifiers?.some(modifier => modifier.type === 'label' && modifier.value === 'Media faylni olib tashlash'));
  removeButtons[0].props.onPress();
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
