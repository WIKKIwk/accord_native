const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

test('route policy is selected before nested Chat children render and pushes stay nested', () => {
  const jsx = (type, props) => ({ type, props });
  const route = load('shared/chat/ChatRouteContext.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { createContext: () => ({ Provider: 'RouteContext' }), useContext: () => null, useMemo: fn => fn() },
    'expo-router': { router: {} }, '../../components/ChatMetadata': { ChatMetadataProvider: 'Metadata' },
    './chatNavigation': { createChatNavigation: () => ({}) }, './ChatLivePolicy': { ChatLivePolicyProvider: 'Policy' },
  });
  const base = { session: { imageCacheScope: 'synthetic' }, basePath: '/ios-customer/chat', children: 'child' };
  assert.equal(route.ChatRouteProvider({ ...base, livePolicy: 'secure' }).props.policy, 'secure');
  assert.equal(route.ChatRouteProvider(base).props.policy, 'legacy');
  const navigation = load('shared/chat/chatNavigation.ts', {});
  const calls = [];
  const nav = navigation.createChatNavigation('/ios-customer/chat', { push: value => calls.push(value), replace: value => calls.push(value) });
  nav.openDirectory(); nav.openConversation({ id: 'conversation', title: 'title' });
  assert.equal(calls[0], '/ios-customer/chat/new');
  assert.equal(calls[1].pathname, '/ios-customer/chat/[conversationId]');
});

function unreadFixture(available) {
  let current = null, transport, liveCallback, count = 0;
  const effects = [];
  const session = { baseUrl: 'https://erp.example', token: 'synthetic', profile: { role: 'customer', ref: 'a' } };
  const runtime = { subscribe: () => () => {}, getSnapshot: () => count, start: async () => {} };
  const api = load('shared/chat/useSecureChatUnreadState.ts', {
    react: { useEffect: callback => effects.push(callback), useSyncExternalStore: (_subscribe, get) => get() },
    '../../auth': { activeSessionToken: candidate => candidate === session ? session.token : null },
    './chatLocalStore': { chatCacheScope: () => 'scope' },
    './chatUnreadRuntime': { existingChatUnreadRuntimeFor: (_session, policy) => policy === 'secure' ? current : null,
      subscribeChatUnreadRuntimeChanges: () => () => {}, chatUnreadRuntimeFor: (_session, options) => { current = runtime; transport = options; return runtime; } },
    './chatSecureSocket': { secureChatAvailable: () => available, SECURE_CHAT_UNAVAILABLE: 'development build required' },
    './secureChatLive': { subscribeSecureChatLive: (_session, _onInvalidate, _onEvent, onState) => { liveCallback = onState; return () => {}; } },
  });
  return { ...api, session, effects, getTransport: () => transport, setCount: value => { count = value; },
    live: state => liveCallback(state) };
}

test('secure unread reports missing native module, never an invented zero', () => {
  const f = unreadFixture(false);
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: null, status: 'unavailable', message: 'development build required' });
  f.effects[0]();
  assert.equal(f.getTransport(), undefined);
});

test('secure unread exposes a count only after a real list result and marks loss of live sync', () => {
  const f = unreadFixture(true);
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: null, status: 'loading' });
  f.effects[0]();
  const transport = f.getTransport();
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: null, status: 'loading' });
  transport.onConversationsFailed();
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: null, status: 'unavailable' });
  f.setCount(3);
  transport.onConversationsLoaded();
  transport.subscribeLive(() => {}, () => {});
  f.live('ready');
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: 3, status: 'ready' });
  f.live('unavailable');
  assert.deepEqual(f.useSecureChatUnreadState(f.session), { count: 3, status: 'degraded' });
});
