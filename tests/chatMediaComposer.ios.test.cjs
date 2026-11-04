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

function fixture(pickerResult) {
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
  for (const name of ['Button', 'Host', 'HStack', 'Image', 'ProgressView', 'RNHostView', 'ScrollView', 'Spacer', 'Text', 'TextField', 'VStack']) {
    ui[name] = function () {};
    ui[name].displayName = name;
  }
  ui.useNativeState = initial => {
    const index = slot({ value: initial, get() { return this.value; } });
    return hooks[index];
  };
  const modifiers = new Proxy({
    shapes: { circle: () => ({}), roundedRectangle: () => ({}) },
    accessibilityLabel: value => ({ type: 'label', value }),
  }, { get: (target, name) => target[name] ?? (() => ({})) });
  const selected = { uri: 'file:///selected', kind: 'image', filename: 'photo.jpg' };
  const pickerCalls = [], sent = [], discarded = [];
  const thread = {
    storageReady: true, queueing: false, mediaSending: false, mediaProgress: '', mediaError: '',
    clearMediaError() {}, send: async () => true,
    sendMedia: async (draft, caption) => { sent.push({ draft, caption }); return true; },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { Fragment: Symbol('Fragment'), jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-image-picker': { UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
      launchImageLibraryAsync: async options => { pickerCalls.push(options); return pickerResult; } },
    'expo-router': { Stack: { Screen() {} } },
    'react-native': { Alert: { alert() {} }, Platform: { Version: 26 }, StyleSheet: { create: styles => styles }, useColorScheme: () => 'dark', View() {} },
    'react-native-reanimated': { useReducedMotion: () => false },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'react-native-worklets': { scheduleOnUI: fn => fn(), scheduleOnRN: (fn, ...args) => fn(...args) },
    '../chatComposer': { draftAfterSending: (sentValue, current) => sentValue === current ? '' : current },
    '../chatMedia': { prepareChatMedia: async () => selected, discardChatMedia: draft => discarded.push(draft) },
    '../chatModel': {},
    '../useChatThread': { useChatThread: () => thread },
    './ChatThreadHeader.ios': { CHAT_HEADER_CONTENT_HEIGHT: 0, ChatThreadHeader() {} },
    './ChatMediaPreview.ios': { SelectedChatMediaPreview() {}, ChatMediaThumbnail() {}, openChatMedia() {} },
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
  assert.ok(composer);
  hooks.length = 0;
  const render = () => { cursor = 0; return composer.type(composer.props); };
  const button = (tree, label) => {
    const result = find(tree, node => node.type === ui.Button && node.props.modifiers?.some(modifier => modifier.type === 'label' && modifier.value === label));
    assert.ok(result, `${label} button was not found`);
    return result;
  };
  return { render, button, ui, selected, pickerCalls, sent, discarded };
}

test('the plus selects media without sending until the user presses send', async () => {
  const app = fixture({ canceled: false, assets: [{ uri: 'file:///selected', type: 'image' }] });
  app.button(app.render(), 'Rasm yoki video tanlash').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(app.pickerCalls[0].mediaTypes, ['images', 'videos']);
  assert.equal(app.sent.length, 0);

  let tree = app.render();
  assert.ok(find(tree, node => node.type?.name === 'SelectedChatMediaPreview'));
  const field = find(tree, node => node.type === app.ui.TextField);
  field.props.text.value = 'Izoh';
  field.props.onTextChange('Izoh');
  tree = app.render();
  app.button(tree, 'Xabarni yuborish').props.onPress();
  await new Promise(setImmediate);
  assert.deepEqual(app.sent, [{ draft: app.selected, caption: 'Izoh' }]);
  assert.deepEqual(app.discarded, [app.selected]);
  assert.equal(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'), null);
});

test('closing the picker without selecting does not create or send an attachment', async () => {
  const app = fixture({ canceled: true, assets: null });
  app.button(app.render(), 'Rasm yoki video tanlash').props.onPress();
  await new Promise(setImmediate);
  assert.equal(app.sent.length, 0);
  assert.equal(find(app.render(), node => node.type?.name === 'SelectedChatMediaPreview'), null);
});
