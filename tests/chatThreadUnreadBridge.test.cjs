const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const tick = () => new Promise(resolve => setImmediate(resolve));
const message = sequence => ({ id: `m${sequence}`, conversationId: 'c1', sequence, clientMessageId: '',
  senderRole: 'customer', senderRef: 'other', body: 'Hello', timestamp: sequence });

function fixture(runtime = null, role = 'customer', conversationId = 'c1') {
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
  const thread = loaded.exports.useChatThread(session, conversationId);
  let cleanups = [], focusCleanups = [];
  const focus = () => { focusCleanups = focusEffects.map(effect => effect()).filter(Boolean); };
  const blur = () => { for (const cleanup of focusCleanups.reverse()) cleanup(); focusCleanups = []; };
  return { thread, calls, session, focus, blur, mount() { cleanups = effects.map(effect => effect()).filter(Boolean); focus(); },
    unmount() { blur(); for (const cleanup of cleanups.reverse()) cleanup(); } };
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

test('a retained thread releases its active conversation on blur and cannot clear the next thread on unmount', async () => {
  let active = '';
  const runtime = { setActiveConversation: id => { active = id; }, rememberThreadMessages: async () => {}, subscribeInvalidation: () => () => {} };
  const first = fixture(runtime), second = fixture(runtime, 'customer', 'c2');
  first.mount(); await tick(); assert.equal(active, 'c1');
  first.blur(); assert.equal(active, '', 'leaving a retained route must stop marking its unseen messages read');
  second.mount(); await tick(); assert.equal(active, 'c2');
  first.unmount(); assert.equal(active, 'c2', 'disposing a previously blurred route cannot retire the active route');
  second.blur(); assert.equal(active, '');
  first.focus(); await tick(); assert.equal(active, 'c1');
  first.unmount(); second.unmount(); assert.equal(active, '');
});
