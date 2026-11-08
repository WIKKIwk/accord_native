const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const tick = () => new Promise(resolve => setImmediate(resolve));
const message = sequence => ({ id: `m${sequence}`, conversationId: 'c1', sequence, clientMessageId: '',
  senderRole: 'customer', senderRef: 'other', body: 'Hello', timestamp: sequence });

function fixture(runtime = null, role = 'customer', policy = 'legacy', nativeAvailable = true) {
  const effects = [], focusEffects = [], calls = [];
  const appState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
  const react = {
    useState: initial => [typeof initial === 'function' ? initial() : initial, value => calls.push(['setState', value])],
    useRef: initial => ({ current: initial }),
    useCallback: callback => callback,
    useEffect: callback => { effects.push(callback); },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const filename = path.resolve(__dirname, '../src/useChatThread.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const mocks = {
    react,
    'expo-router': { useFocusEffect: callback => { focusEffects.push(callback); } },
    'react-native': { AppState: appState },
    './auth': { activeSessionToken: () => 'token' },
    './chatApi': { ChatRequestError: class ChatRequestError extends Error {},
      loadChatMessages: async (_session, _id, _signal, before) => ({ items: [message(before ? 1 : 2)], hasMore: true }),
      markChatRead: async (...args) => { calls.push(['directRead', ...args]); } },
    './chatLive': { subscribeChatLive: () => { calls.push(['existingLive']); return () => calls.push(['stopExistingLive']); } },
    './chatMedia': { sendChatMedia: async () => {} },
    './chatModel': { mergeChatMessages: (current, incoming) => [...current, ...incoming],
      reconcileChatRefresh: (current, incoming) => ({ items: [...current, ...incoming], droppedOlder: false }) },
    './chatOutbox': { chatDeviceId: async () => 'device-1', pendingChatTexts: async () => [], queueChatText: async () => ({}) },
    './chatOutboxDelivery': { flushChatOutbox: async () => {} },
    './shared/chat/chatUnreadRuntime': { existingChatUnreadRuntimeFor: () => runtime,
      subscribeChatUnreadRuntimeChanges: () => () => {} },
    './shared/chat/ChatLivePolicy': { useChatLivePolicy: () => policy },
    './shared/chat/chatSecureSocket': { SECURE_CHAT_UNAVAILABLE: 'development build required' },
    './shared/chat/secureChatLive': { subscribeSecureChatLive: () => {
      if (!nativeAvailable) throw new Error('development build required');
      calls.push(['secureLive']); return () => calls.push(['stopSecureLive']);
    } },
  };
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  const session = { profile: { role, ref: 'one' }, token: 'token' };
  const thread = loaded.exports.useChatThread(session, 'c1');
  let cleanups = [];
  return { thread, calls, session, mount() { cleanups = [...effects, ...focusEffects].map(effect => effect()).filter(Boolean); },
    unmount() { for (const cleanup of cleanups.reverse()) cleanup(); } };
}

test('without an opted-in runtime, the existing thread and direct read receipt remain unchanged', async () => {
  for (const role of ['aparatchi', 'tayyorlov_masteri']) {
    const f = fixture(null, role);
    f.mount();
    try {
      await tick(); await tick();
      const read = f.calls.find(call => call[0] === 'directRead');
      assert.equal(read[1], f.session);
      assert.equal(read[2], 'c1');
      assert.equal(read[3], 2);
      assert.equal(read[4], 'device-1');
      assert.ok(f.calls.some(call => call[0] === 'existingLive'));
    } finally { f.unmount(); }
  }
});

test('a secure thread never starts the legacy socket before runtime startup or in Expo Go', async () => {
  for (const available of [true, false]) {
    const f = fixture(null, 'customer', 'secure', available);
    f.mount();
    try {
      await tick(); await tick();
      assert.ok(!f.calls.some(call => call[0] === 'existingLive'));
      assert.equal(f.calls.some(call => call[0] === 'secureLive'), available);
      if (!available) assert.ok(f.calls.some(call => call[0] === 'setState' && call[1] === 'development build required'));
    } finally { f.unmount(); }
    if (available) assert.ok(f.calls.some(call => call[0] === 'stopSecureLive'));
  }
});

test('an opted-in runtime receives active thread and newest messages instead of a duplicate direct receipt', async () => {
  const events = [];
  let invalidate;
  const runtime = { setActiveConversation: id => events.push(['active', id]),
    rememberThreadMessages: async (id, items, markRead) => events.push(['messages', id, items.map(item => item.sequence), markRead]),
    subscribeInvalidation: callback => { invalidate = callback; events.push(['subscribe']); return () => { events.push(['unsubscribe']); invalidate = undefined; }; } };
  const f = fixture(runtime);
  f.mount();
  try {
    await tick(); await tick();
    assert.deepEqual(events.slice(0, 3), [['active', 'c1'], ['subscribe'], ['messages', 'c1', [2], undefined]]);
    assert.ok(!f.calls.some(call => call[0] === 'directRead'));
    assert.ok(!f.calls.some(call => call[0] === 'existingLive'));
    invalidate();
    await tick(); await tick();
    assert.equal(events.filter(event => event[0] === 'messages').length, 2);
    await f.thread.loadOlder();
    assert.deepEqual(events.at(-1), ['messages', 'c1', [1], false]);
  } finally { f.unmount(); }
  assert.ok(events.some(event => event[0] === 'unsubscribe'));
  assert.deepEqual(events.at(-1), ['active', '']);
});
