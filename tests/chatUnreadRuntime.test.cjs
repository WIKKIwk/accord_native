const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const state = load('shared/chat/chatUnreadState.ts');
const flusher = load('shared/chat/chatReceiptFlusher.ts');
const sync = load('shared/chat/chatSyncEngine.ts');
const sessionRuntime = load('shared/chat/chatSessionRuntime.ts', {
  './chatUnreadState': state, './chatReceiptFlusher': flusher, './chatSyncEngine': sync,
});
const model = load('chatModel.ts');
const conversation = count => ({ id: 'a', title: 'A', peer: null, preview: '', lastMessageSequence: 1,
  unreadCount: count, updatedAt: 1, timestamp: 1 });
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}) {
  let active, liveListener, liveInvalidation, liveStarts = 0, liveStops = 0, removedAppState = 0;
  const resetHooks = new Set(), appStateListeners = new Set(), signals = [];
  const appState = { currentState: 'active', addEventListener: (_, listener) => {
    appStateListeners.add(listener);
    return { remove: () => { removedAppState++; appStateListeners.delete(listener); } };
  } };
  const scope = session => JSON.stringify([session.baseUrl, session.profile.role, session.profile.ref]);
  const storage = {
    chatCacheScope: scope,
    loadCachedChatConversations: async () => [conversation(2)], saveCachedChatConversations: async () => {},
    loadCachedChatSyncCursor: async () => 0, saveCachedChatSyncCursor: async () => {},
    latestCachedChatMessageSequence: async () => 0, saveCachedChatMessages: async () => {},
    loadPendingChatReceipts: async () => [], savePendingChatReceipt: async () => {}, acknowledgePendingChatReceipt: async () => {},
    ...overrides.storage,
  };
  const api = {
    loadChatConversations: async (_session, signal) => { signals.push(signal); return { items: [conversation(2)], hasMore: false }; },
    loadChatSync: async (_session, cursor, signal) => { signals.push(signal); return { events: [], nextCursor: cursor, hasMore: false }; },
    loadChatMessagesAfter: async () => ({ items: [], hasMore: false }), markChatDelivered: async () => {}, markChatRead: async () => {},
    ...overrides.api,
  };
  const result = load('shared/chat/chatUnreadRuntime.ts', {
    'react-native': { AppState: appState },
    '../../auth': { activeSessionToken: session => active === session ? session.token : null,
      registerSessionResetHook: hook => { resetHooks.add(hook); return () => resetHooks.delete(hook); } },
    '../../chatApi': api,
    '../../chatLive': { subscribeChatLive: (_session, onInvalidate, onEvent) => {
      liveStarts++; liveListener = onEvent; liveInvalidation = onInvalidate;
      return () => { liveStops++; liveListener = undefined; liveInvalidation = undefined; };
    } },
    '../../chatModel': model,
    '../../chatOutbox': { chatDeviceId: async () => 'device-1' },
    './chatSecureReadiness': { secureChatUnavailableReason: () => overrides.secureUnavailable ?? null },
    './chatLocalStore': storage,
    './chatSessionRuntime': sessionRuntime,
  });
  const session = { token: 'token', baseUrl: 'https://erp.example', profile: { role: 'customer', ref: 'one' } };
  active = session;
  return { ...result, session, signals, activate: value => { active = value; },
    reset: async () => { await Promise.all([...resetHooks].map(hook => hook())); },
    changeState: value => { appState.currentState = value; for (const listener of [...appStateListeners]) listener(value); },
    emit: value => liveListener?.(value), invalidate: () => liveInvalidation?.(), liveStarts: () => liveStarts, liveStops: () => liveStops,
    removedAppState: () => removedAppState };
}

test('the same active session shares one live runtime and restored unread total', async () => {
  const f = fixture();
  const changes = [];
  const unsubscribe = f.subscribeChatUnreadRuntimeChanges(() => changes.push(!!f.existingChatUnreadRuntimeFor(f.session)));
  const first = f.chatUnreadRuntimeFor(f.session);
  assert.equal(f.chatUnreadRuntimeFor(f.session), first);
  assert.equal(f.existingChatUnreadRuntimeFor(f.session), first);
  await first.start();
  await tick();
  assert.equal(first.value, 2);
  assert.equal(f.liveStarts(), 1);
  let invalidations = 0;
  const stopInvalidation = first.subscribeInvalidation(() => invalidations++);
  f.invalidate();
  assert.equal(invalidations, 1);
  stopInvalidation();
  await f.reset();
  assert.deepEqual(changes, [true, false]);
  unsubscribe();
});

test('logout resets unread, aborts network, stops live work and unregisters lifecycle listeners', async () => {
  const f = fixture();
  const runtime = f.chatUnreadRuntimeFor(f.session);
  await runtime.start();
  await tick();
  f.activate(null);
  await f.reset();
  assert.equal(runtime.value, 0);
  assert.equal(f.liveStops(), 1);
  assert.equal(f.removedAppState(), 1);
  assert.ok(f.signals.length > 0 && f.signals.every(signal => signal.aborted));
  assert.equal(f.existingChatUnreadRuntimeFor(f.session), null);
});

test('a stale session cannot replace the current account runtime', async () => {
  const f = fixture();
  const old = f.chatUnreadRuntimeFor(f.session);
  await old.start();
  const nextSession = { ...f.session, profile: { role: 'customer', ref: 'two' } };
  f.activate(nextSession);
  const next = f.chatUnreadRuntimeFor(nextSession);
  assert.equal(old.value, 0);
  assert.throws(() => f.chatUnreadRuntimeFor(f.session), /Sessiya tugagan/);
  assert.equal(f.existingChatUnreadRuntimeFor(nextSession), next);
  await f.reset();
});

test('a secure role cannot reuse a legacy runtime for the same session', async () => {
  const f = fixture();
  const legacy = f.chatUnreadRuntimeFor(f.session);
  await legacy.start();
  assert.equal(f.existingChatUnreadRuntimeFor(f.session, 'secure'), null);
  let secureStarts = 0, secureStops = 0;
  const secure = f.chatUnreadRuntimeFor(f.session, { policy: 'secure',
    subscribeLive: () => { secureStarts++; return () => secureStops++; },
    onConversationsLoaded: () => {}, onConversationsFailed: () => {} });
  await secure.start();
  await tick();
  assert.notEqual(secure, legacy);
  assert.equal(f.existingChatUnreadRuntimeFor(f.session), null);
  assert.equal(f.existingChatUnreadRuntimeFor(f.session, 'secure'), secure);
  assert.equal(f.liveStops(), 1);
  assert.equal(secureStarts, 1);
  await f.reset();
  assert.equal(secureStops, 1);
});

test('an unavailable secure policy cannot start network work or dispose an existing legacy runtime', async () => {
  const f = fixture({ secureUnavailable: 'secure authentication unavailable' });
  const legacy = f.chatUnreadRuntimeFor(f.session);
  await legacy.start();
  await tick();
  const starts = f.liveStarts(), signals = f.signals.length;
  assert.throws(() => f.chatUnreadRuntimeFor(f.session, { policy: 'secure', subscribeLive: () => {
    throw new Error('must not start'); }, onConversationsLoaded: () => {}, onConversationsFailed: () => {} }), /secure authentication unavailable/);
  assert.equal(f.existingChatUnreadRuntimeFor(f.session), legacy);
  assert.equal(f.liveStarts(), starts);
  assert.equal(f.signals.length, signals);
  await f.reset();
});

test('background and foreground lifecycle stop and restart the real live adapter', async () => {
  const f = fixture();
  const runtime = f.chatUnreadRuntimeFor(f.session);
  await runtime.start();
  await tick();
  f.changeState('background');
  assert.equal(f.liveStops(), 1);
  f.changeState('active');
  await tick();
  assert.equal(f.liveStarts(), 2);
  await f.reset();
});
