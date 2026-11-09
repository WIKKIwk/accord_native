const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}, animationFrames) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.xml') ? id : require(id);
  mod.animationFrames = animationFrames;
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  mod._compile((animationFrames ? 'const { requestAnimationFrame, cancelAnimationFrame } = module.animationFrames;\n' : '') + compiled, filename);
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
  const frames = new Map(); let frameId = 0;
  const animationFrames = { requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id) };
  const flushFrames = () => { const next = [...frames.values()]; frames.clear(); next.forEach(fn => fn()); };
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
      useMaterialColors: () => ({ surface: 'surface', surfaceContainerLow: 'page', surfaceContainerHighest: 'disabled',
        onSurface: 'text', onSurfaceVariant: 'secondary', primary: 'primary', onPrimary: 'white' }),
      useNativeState: initial => react.useRef({ get: () => initial, set: value => { initial = value; } }).current },
    '@expo/ui/jetpack-compose/modifiers': new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) }),
    'expo-document-picker': {}, 'expo-image-picker': {}, 'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', FlatList: 'FlatList', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
      ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: value => value }, Alert: { alert: (...args) => calls.push(['alert', ...args]) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    '../chatComposer': { draftAfterSending }, '../chatMedia': { discardChatMedia() {} }, '../chatModel': { chatTimeline: () => [] },
    '../useChatThread': { useChatThread: () => thread }, './ChatMediaPreview': {},
  }, animationFrames);
  const render = () => { cursor = 0; effects.length = 0; const tree = ChatThreadScreen({ session: {}, conversationId: 'conversation', title: 'Chat' });
    effects.forEach(effect => effect()); return tree; };
  const input = tree => nodes(tree, node => node.type === field)[0];
  const button = tree => nodes(tree, node => node.type === 'FilledIconButton')[0];
  return { calls, thread, render, input, button, flushFrames };
}

test('Android composer keeps native text and send controls visible while the message list flexes with resize', () => {
  const x = fixture(), tree = x.render();
  assert.equal(tree.type, 'View');
  const composer = nodes(tree, node => node.type === 'Host')[0];
  assert.equal(composer.props.matchContents.vertical, true); assert.equal(composer.props.style.flexShrink, 0);
  const list = nodes(tree, node => node.type === 'FlatList')[0];
  assert.equal(list.props.style.flex, 1); assert.equal(list.props.style.minHeight, 0);
  assert.equal(x.input(tree).props.maxLines, 4); assert.equal(x.input(tree).props.textStyle.textAlign, 'left');
  assert.equal(x.input(tree).props.textStyle.color, 'text'); assert.equal(x.input(tree).props.colors.focusedTextColor, 'text');
  assert.equal(x.input(tree).props.colors.unfocusedTextColor, 'text');
  assert.equal(x.button(tree).props.enabled, false);
  // Shape.Circle({}) defaults to radius=0 on Android and clips the whole button.
  assert.equal(x.button(tree).props.shape, undefined);
  assert.equal(x.button(tree).props.colors.disabledContainerColor, 'disabled');
  assert.equal(nodes(composer, node => node.type === 'IconButton').length, 1);
  assert.equal(nodes(composer, node => node.type === 'FilledIconButton').length, 1);
  const sendIcon = nodes(x.button(tree), node => node.type === 'Icon')[0];
  assert.equal(sendIcon.props.tint, 'secondary');
});

test('typing appears in the native state and send clears only a successfully queued message', async () => {
  const x = fixture(); let tree = x.render();
  x.input(tree).props.onValueChange('Salom'); tree = x.render();
  assert.equal(x.input(tree).props.value.get(), 'Salom'); assert.equal(x.button(tree).props.enabled, true);
  assert.equal(nodes(x.button(tree), node => node.type === 'Icon')[0].props.tint, 'white');
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

test('sending keeps the native input enabled and preserves text typed for the next message', async () => {
  let finish; const x = fixture(() => new Promise(resolve => { finish = resolve; })); let tree = x.render();
  const nativeInput = x.input(tree).props.value;
  x.input(tree).props.onValueChange('Birinchi xabar'); tree = x.render();
  x.button(tree).props.onClick(); x.thread.queueing = true; tree = x.render();
  assert.equal(x.button(tree).props.enabled, false);
  assert.notEqual(x.input(tree).props.enabled, false);
  assert.equal(x.input(tree).props.value, nativeInput);
  x.input(tree).props.onValueChange('Keyingi xabar'); tree = x.render();
  assert.equal(nativeInput.get(), 'Keyingi xabar');
  x.thread.queueing = false; finish(true); await tick(); tree = x.render();
  assert.deepEqual(x.calls, [['send', 'Birinchi xabar']]);
  assert.equal(nativeInput.get(), 'Keyingi xabar');
  assert.notEqual(x.input(tree).props.enabled, false);
  assert.equal(x.button(tree).props.enabled, true);
});

const scrollEvent = (offset, contentHeight = 1000, viewportHeight = 300) => ({ nativeEvent: {
  contentOffset: { y: offset }, contentSize: { height: contentHeight }, layoutMeasurement: { height: viewportHeight },
} });
function scrollFixture() {
  const x = fixture(), tree = x.render(), list = nodes(tree, node => node.type === 'FlatList')[0], offsets = [];
  const native = { contentHeight: 900, viewportHeight: 400 };
  list.props.ref.current = { getScrollResponder: () => ({ scrollToEnd: options => {
    assert.equal(options.animated, false); offsets.push(Math.max(0, native.contentHeight - native.viewportHeight));
  } }) };
  list.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
  list.props.onContentSizeChange(360, 900); x.flushFrames(); offsets.length = 0;
  return { ...x, tree, list, offsets, native };
}

test('new messages and keyboard resizing follow the measured bottom without scroll events disabling it', () => {
  const x = scrollFixture();
  // Native resize/content events can report the old offset before JS scrolls.
  x.list.props.onScroll(scrollEvent(500, 1200, 300));
  x.native.viewportHeight = 300; x.native.contentHeight = 1200;
  x.list.props.onLayout({ nativeEvent: { layout: { height: 300 } } });
  x.list.props.onContentSizeChange(360, 1200);
  assert.deepEqual(x.offsets, []); x.flushFrames();
  assert.equal(x.offsets.at(-1), 900);
  // Native can finish a taller layout than the last JS content-size event.
  x.native.contentHeight = 1400;
  x.list.props.onContentSizeChange(360, 1380);
  x.flushFrames(); assert.equal(x.offsets.at(-1), 1100);
});

test('manual history scrolling keeps its position, then resumes following when the user reaches the bottom', () => {
  const x = scrollFixture();
  x.list.props.onScrollBeginDrag(scrollEvent(200));
  x.list.props.onScroll(scrollEvent(100));
  x.list.props.onScrollEndDrag(scrollEvent(100));
  x.list.props.onMomentumScrollBegin();
  x.list.props.onScroll(scrollEvent(50));
  x.list.props.onMomentumScrollEnd(scrollEvent(50));
  x.list.props.onContentSizeChange(360, 1200);
  x.list.props.onLayout({ nativeEvent: { layout: { height: 300 } } });
  x.flushFrames();
  assert.deepEqual(x.offsets, []);
  x.list.props.onScrollBeginDrag(scrollEvent(900, 1200));
  x.list.props.onScrollEndDrag(scrollEvent(900, 1200));
  x.native.contentHeight = 1300; x.native.viewportHeight = 300;
  x.list.props.onContentSizeChange(360, 1300);
  x.flushFrames();
  assert.equal(x.offsets.at(-1), 1000);
});

test('sending from older messages follows the newly appended message', async () => {
  const x = scrollFixture();
  x.list.props.onScrollBeginDrag(scrollEvent(100));
  x.list.props.onScrollEndDrag(scrollEvent(100));
  x.list.props.onMomentumScrollBegin();
  x.input(x.tree).props.onValueChange('Yangi xabar');
  x.button(x.render()).props.onClick();
  x.native.contentHeight = 1100;
  x.list.props.onContentSizeChange(360, 1100);
  x.flushFrames();
  assert.equal(x.offsets.at(-1), 700);
  await tick();
});
