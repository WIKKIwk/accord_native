const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

for (const basePath of ['/ios-preparation/chat', '/ios-worker/chat']) {
  test(`${basePath}: header opens the directory and a selected contact opens their conversation`, async () => {
    const calls = [];
    const peer = { role: 'worker', ref: 'person-1', displayName: 'Ali' };
    const conversation = { id: 'conversation-1', title: 'Ali', peer };
    const session = { imageCacheScope: 'account' };
    const navigator = { push: value => calls.push(['push', value]), replace: value => calls.push(['replace', value]) };
    const { createChatNavigation } = load('shared/chat/chatNavigation.ts');
    const navigation = createChatNavigation(basePath, navigator);
    const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    const toolbar = function Toolbar() {}; toolbar.Content = 'Toolbar.Content';
    const ui = new Proxy({ Toolbar: toolbar, useNativeState: value => ({ value }) }, { get: (target, name) => target[name] ?? name });
    const modifiers = new Proxy({ shapes: { rectangle: () => ({}), capsule: () => ({}) } }, { get: (target, name) => target[name] ?? (() => ({})) });
    const stackToolbar = function Toolbar() {}; stackToolbar.Button = 'Toolbar.Button';
    const sharedMocks = {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
      'expo-router': { Stack: { Screen: 'Stack.Screen', Toolbar: stackToolbar }, router: { back() {} } },
      'expo-symbols': { SymbolView: 'SymbolView' },
      'react-native': { PlatformColor: name => name, Pressable: 'Pressable', StyleSheet: { create: styles => styles } },
      '../chatModel': { filterChatConversations: items => items, chatTime: () => '' },
      '../profileModel': { profileRoleLabel: role => role },
      './ChatAvatar': { ChatAvatar: 'ChatAvatar' }, './useWorkerColors': { useWorkerColors: () => ({ background: 'background' }) },
    };
    const list = load('components/ChatConversationsScreen.ios.tsx', {
      ...sharedMocks,
      '../shared/chat/useChatConversations': { useChatConversations: () => ({ items: [], error: '', query: '', setQuery() {}, avatarToken: null, refresh() {} }) },
    }).ChatConversationsScreen({ session, navigation });
    const screen = find(list, node => node.type === 'Stack.Screen');
    assert.equal(screen.props.options.headerRight, undefined, 'a React headerRight view would swallow the search X');
    const newChat = find(list, node => node.type === 'Toolbar.Button' && node.props.accessibilityLabel === 'Yangi suhbat');
    newChat.props.onPress();
    assert.deepEqual(calls, [['push', `${basePath}/new`]]);

    let focus;
    const remembered = [];
    const directoryHook = load('shared/chat/useChatDirectory.ts', {
      'expo-router': { useFocusEffect: callback => { focus = callback; } },
      react: { useCallback: callback => callback, useRef: value => ({ current: value }),
        useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
      'react-native': { Alert: { alert: (...args) => { throw new Error(`Unexpected alert: ${args}`); } } },
      '../../auth': { activeSessionToken: () => 'token' },
      '../../chatApi': { loadChatDirectory: async () => ({ items: [], hasMore: false, count: 0 }),
        openChatConversation: async (_session, target) => { calls.push(['contact', target]); return conversation; } },
      '../../components/ChatMetadata': { useChatMetadata: () => ({ remember: value => remembered.push(value) }) },
    }).useChatDirectory(session, navigation.replaceConversation);
    const cleanup = focus();
    const directory = load('components/ChatDirectoryScreen.ios.tsx', {
      ...sharedMocks,
      '../shared/chat/useChatDirectory': { useChatDirectory: () => ({ ...directoryHook, items: [peer] }) },
    }).ChatDirectoryScreen({ session, onOpenConversation: navigation.replaceConversation });
    const row = find(directory, node => typeof node.type === 'function' && node.type.name === 'DirectoryRow');
    const button = row.type(row.props);
    button.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, [['push', `${basePath}/new`], ['contact', peer],
      ['replace', { pathname: `${basePath}/[conversationId]`, params: { conversationId: conversation.id, title: conversation.title } }]]);
    assert.deepEqual(remembered, [[conversation]]);
    cleanup();
  });
}
