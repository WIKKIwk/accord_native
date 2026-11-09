const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.xml') ? id : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const { draftAfterSending } = load('chatComposer.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(send = async () => true) {
  const calls = [], slots = [], effects = []; let cursor = 0;
  const react = {
    useState: value => { const slot = cursor++; if (!(slot in slots)) slots[slot] = value;
      return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }]; },
    useRef: value => { const slot = cursor++; return slots[slot] ??= { current: value }; },
    useEffect: fn => effects.push(fn),
  };
  const thread = { messages: [], pending: [], storageReady: true, queueing: false, mediaSending: false,
    send: async value => { calls.push(['send', value]); return send(value); }, clearMediaError() {}, refresh: async () => {}, retry() {} };
  const field = Object.assign(function OutlinedTextField() {}, { Placeholder: 'Placeholder' });
  const { ChatThreadScreen } = load('components/ChatThreadScreen.android.tsx', {
    react, '@expo/ui/jetpack-compose': { Host: 'Host', Row: 'Row', Icon: 'Icon', IconButton: 'IconButton', FilledIconButton: 'FilledIconButton',
      CircularProgressIndicator: 'Progress', Text: 'ComposeText', Shape: { RoundedCorner: props => jsx.jsx('RoundedCorner', props), Circle: props => jsx.jsx('Circle', props) }, OutlinedTextField: field,
      useMaterialColors: () => ({ surface: 'surface', surfaceContainerLow: 'page', primary: 'primary', onPrimary: 'white' }),
      useNativeState: initial => react.useRef({ get: () => initial, set: value => { initial = value; } }).current },
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) }),
    'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
      ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: value => value }, Alert: { alert: (...args) => calls.push(['alert', ...args]) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../chatComposer': { draftAfterSending }, '../chatMedia': { discardChatMedia() {} }, '../chatModel': { chatTimeline: () => [] },
    '../useChatThread': { useChatThread: () => thread }, './ChatMediaPreview': {},
  });
  const render = () => { cursor = 0; effects.length = 0; const tree = ChatThreadScreen({ session: {}, conversationId: 'conversation', title: 'Chat' });
    effects.forEach(effect => effect()); return tree; };
  const input = tree => nodes(tree, node => node.type === field)[0];
  const button = tree => nodes(tree, node => node.type === 'FilledIconButton')[0];
  return { calls, thread, render, input, button };
}

test('Android composer reserves its own native row while only the message list flexes with resize', () => {
  const x = fixture(), tree = x.render();
  assert.equal(tree.type, 'View'); assert.equal(nodes(tree, node => node.type === 'KeyboardAvoidingView').length, 0);
  const host = nodes(tree, node => node.type === 'Host')[0];
  assert.equal(host.props.matchContents.vertical, true); assert.equal(host.props.style.flexShrink, 0);
  const list = nodes(tree, node => node.type === 'FlatList')[0];
  assert.equal(list.props.style.flex, 1); assert.equal(list.props.style.minHeight, 0);
  assert.equal(x.input(host).props.maxLines, 4); assert.equal(x.input(host).props.textStyle.textAlign, 'left');
  assert.equal(x.button(host).props.enabled, false);
  assert.equal(nodes(host, node => node.type === 'IconButton').length, 1);
  assert.equal(nodes(host, node => node.type === 'FilledIconButton').length, 1);
});

test('typing appears in the native state and send clears only a successfully queued message', async () => {
  const x = fixture(); let tree = x.render();
  x.input(tree).props.onValueChange('Salom'); tree = x.render();
  assert.equal(x.input(tree).props.value.get(), 'Salom'); assert.equal(x.button(tree).props.enabled, true);
  x.button(tree).props.onClick(); await tick(); tree = x.render();
  assert.deepEqual(x.calls, [['send', 'Salom']]); assert.equal(x.input(tree).props.value.get(), ''); assert.equal(x.button(tree).props.enabled, false);
  const failed = fixture(async () => false); tree = failed.render();
  failed.input(tree).props.onValueChange('Saqlansin'); tree = failed.render(); failed.button(tree).props.onClick(); await tick();
  assert.equal(failed.input(failed.render()).props.value.get(), 'Saqlansin');
});

test('native send blocks duplicate taps and storage-not-ready sends, retaining attachment actions', async () => {
  let finish; const x = fixture(() => new Promise(resolve => { finish = resolve; })); let tree = x.render();
  nodes(tree, node => node.type === 'IconButton')[0].props.onClick();
  assert.deepEqual(x.calls[0][3].map(action => action.text), ['Kamera', 'Rasmlar', 'Fayl']);
  x.input(tree).props.onValueChange('Hello'); tree = x.render();
  x.button(tree).props.onClick(); x.button(tree).props.onClick();
  assert.equal(x.calls.filter(call => call[0] === 'send').length, 1);
  tree = x.render(); assert.equal(x.button(tree).props.enabled, false); assert.equal(nodes(tree, node => node.type === 'Progress').length, 1);
  finish(true); await tick(); x.thread.storageReady = false; tree = x.render();
  x.input(tree).props.onValueChange('Draft'); tree = x.render(); assert.equal(x.button(tree).props.enabled, false);
  x.button(tree).props.onClick(); assert.equal(x.calls.filter(call => call[0] === 'send').length, 1);
});
