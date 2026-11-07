const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${id}.ts`)), mocks);
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}

const navigation = load('shared/chat/chatNavigation.ts');
for (const base of ['/ios-worker/chat', '/ios-preparation/chat', '/android-preparation/chat', '/android-chat', '/ios-another-role/chat/']) {
  test(`chat routes stay in the supplied workspace: ${base}`, () => {
    const calls = [];
    const nav = navigation.createChatNavigation(base, { push: value => calls.push(['push', value]), replace: value => calls.push(['replace', value]) });
    const conversation = { id: 'opaque/id?x=1', title: 'A conversation' };
    nav.openDirectory(); nav.openConversation(conversation); nav.replaceConversation(conversation);
    const clean = base.replace(/\/$/, '');
    assert.deepEqual(calls, [
      ['push', `${clean}/new`],
      ['push', { pathname: `${clean}/[conversationId]`, params: { conversationId: conversation.id, title: conversation.title } }],
      ['replace', { pathname: `${clean}/[conversationId]`, params: { conversationId: conversation.id, title: conversation.title } }],
    ]);
  });
}

test('preparation provides its real machine tabs without inheriting worker completed/action tabs', () => {
  const { visibleOrdersTabs } = load('shared/orders/ordersWorkspaceTypes.ts');
  const { getWorkerTabs } = load('components/workerTabModel.ts');
  const machines = [{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }];
  assert.equal(visibleOrdersTabs(machines), machines);
  assert.deepEqual(getWorkerTabs(machines).map(item => item.id), ['one', 'completed', 'two']);
  assert.deepEqual(visibleOrdersTabs([]), [{ id: '', name: 'Apparat' }]);
  for (const platform of ['ios', 'android', 'web']) {
    const suffix = platform === 'web' ? 'tsx' : `${platform}.tsx`;
    const { WorkerTabs } = load(`components/WorkerTabs.${suffix}`, { '../shared/orders/OrdersWorkspace': { OrdersWorkspace: 'SharedOrders' } });
    const page = WorkerTabs({ machines, selected: 'two', children: 'rows' });
    assert.equal(page.type, 'SharedOrders');
    assert.deepEqual(page.props.tabs.map(item => item.id), ['one', 'completed', 'two']);
    assert.equal(page.props.children, 'rows');
  }
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: chat pages consume arbitrary role sessions and scoped conversation metadata`, () => {
    const closes = [];
    let canGoBack = true;
    const session = { imageCacheScope: 'preparation-account', token: 'example' };
    const peer = { role: 'customer', ref: 'customer-id', displayName: 'Customer' };
    const nav = { openDirectory() {}, openConversation() {}, replaceConversation() {} };
    const api = load(`shared/chat/ChatPages.${platform}.tsx`, {
      'expo-router': { useLocalSearchParams: () => ({ conversationId: 'conversation', title: 'Fallback title' }), useFocusEffect: () => {},
        router: { canGoBack: () => canGoBack, back: () => closes.push('back'), replace: value => closes.push(value) } },
      react: { useCallback: callback => callback },
      'react-native': {}, '../../auth': {}, '../../appLock': {}, '../../chatApi': {},
      '../../components/ChatConversationsScreen': { ChatConversationsScreen: 'Conversations' },
      '../../components/ChatDirectoryScreen': { ChatDirectoryScreen: 'Directory' },
      '../../components/ChatThreadScreen': { ChatThreadScreen: 'Thread' },
      '../../components/ChatMetadata': { useChatMetadata: () => ({ conversations: new Map([['conversation', { title: 'Actual title', peer }]]), remember() {} }) },
      '../../components/WorkerSecurity': {},
      './ChatRouteContext': { useChatRoute: () => ({ session, navigation: nav, basePath: '/any-role/chat' }) },
    });
    assert.equal(api.ChatListPage().props.session, session);
    assert.equal(api.ChatListPage().props.navigation, nav);
    assert.equal(api.ChatDirectoryPage().props.onOpenConversation, nav.replaceConversation);
    if (platform === 'ios') {
      api.ChatDirectoryPage().props.onClose();
      canGoBack = false;
      api.ChatDirectoryPage().props.onClose();
      assert.deepEqual(closes, ['back', '/any-role/chat']);
    }
    const thread = api.ChatThreadPage();
    assert.equal(thread.props.session, session);
    assert.equal(thread.props.peer, peer);
    assert.equal(thread.props.title, 'Actual title');
    assert.equal(thread.key, 'preparation-account:conversation');
  });
}

test('a conversation-list request completing after leaving the role cannot write old account data', async t => {
  let focus, request, resolve, remembered = 0, stopped = 0, removed = 0;
  const writes = [];
  const api = load('shared/chat/useChatConversations.ts', {
    'expo-router': { useFocusEffect: callback => { focus = callback; } },
    react: { useCallback: callback => callback, useRef: value => ({ current: value }),
      useState: initial => [typeof initial === 'function' ? initial() : initial, value => writes.push(value)] },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove: () => removed++ }) } },
    '../../auth': { activeSessionToken: () => 'example' },
    '../../chatApi': { loadChatConversations: (_session, signal) => { request = signal; return new Promise(done => { resolve = done; }); } },
    '../../chatLive': { subscribeChatLive: () => () => stopped++ },
    '../../components/ChatMetadata': { useChatMetadata: () => ({ remember: () => remembered++ }) },
  });
  api.useChatConversations({ imageCacheScope: 'old-account' });
  const cleanup = focus();
  t.after(() => cleanup());
  assert.equal(request.aborted, false);
  cleanup();
  assert.equal(request.aborted, true);
  resolve({ items: [{ id: 'old-private-conversation' }] });
  await new Promise(done => setImmediate(done));
  assert.equal(remembered, 0);
  assert.equal(stopped, 1);
  assert.equal(removed, 1);
  assert.deepEqual(writes, []);
});
