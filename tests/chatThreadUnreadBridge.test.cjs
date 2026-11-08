const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const tick = () => new Promise(resolve => setImmediate(resolve));
const message = sequence => ({ id: `m${sequence}`, conversationId: 'c1', sequence, clientMessageId: '',
  senderRole: 'customer', senderRef: 'other', body: 'Hello', timestamp: sequence });

function fixture(runtime = null, role = 'customer') {
  const effects = [], focusEffects = [], calls = [];
  const appState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
  const react = {
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
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

test('an opted-in runtime receives active thread and newest messages instead of a duplicate direct receipt', async () => {
  const events = [];
  const runtime = { setActiveConversation: id => events.push(['active', id]),
    rememberThreadMessages: async (id, items, markRead) => events.push(['messages', id, items.map(item => item.sequence), markRead]) };
  const f = fixture(runtime);
  f.mount();
  try {
    await tick(); await tick();
    assert.deepEqual(events.slice(0, 2), [['active', 'c1'], ['messages', 'c1', [2], undefined]]);
    assert.ok(!f.calls.some(call => call[0] === 'directRead'));
    await f.thread.loadOlder();
    assert.deepEqual(events.at(-1), ['messages', 'c1', [1], false]);
  } finally { f.unmount(); }
  assert.deepEqual(events.at(-1), ['active', '']);
});
