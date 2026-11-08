const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/shared/chat', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const { ChatSessionRuntime } = load('chatSessionRuntime.ts', {
  './chatUnreadState': load('chatUnreadState.ts'), './chatReceiptFlusher': load('chatReceiptFlusher.ts'),
  './chatSyncEngine': load('chatSyncEngine.ts'),
});
const conversation = (count = 2) => ({ id: 'a', title: 'A', peer: null, preview: '', lastMessageSequence: 1,
  unreadCount: count, updatedAt: 1, timestamp: 1 });
const message = (sequence = 1) => ({ id: `m${sequence}`, conversationId: 'a', sequence, clientMessageId: '',
  senderRole: 'customer', senderRef: 'other', body: 'Hi', timestamp: sequence });
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(overrides = {}, foreground = true) {
  const calls = [];
  let current = true, listener, invalidate, lastInvalidation, recovery, stops = 0, timerStops = 0, aborted = false;
  const receipts = new Map();
  const deps = {
    isCurrent: () => current,
    loadConversations: async () => [conversation()],
    saveConversations: async items => { calls.push(['saveConversations', ...items.map(item => item.unreadCount)]); },
    fetchConversations: async () => ({ items: [conversation()], hasMore: false }),
    loadCursor: async () => 0,
    saveCursor: async cursor => { calls.push(['cursor', cursor]); },
    loadSync: async cursor => { calls.push(['sync', cursor]); return { events: [], nextCursor: cursor, hasMore: false }; },
    loadAfter: async () => ({ items: [], hasMore: false }), latestSavedSequence: async () => 0,
    saveMessages: async items => { calls.push(['messages', ...items.map(item => item.id)]); },
    loadReceipts: async () => [...receipts.values()],
    saveReceipt: async receipt => {
      calls.push(['queue', receipt.conversationId, receipt.deliveredSequence, receipt.readSequence]);
      const old = receipts.get(receipt.conversationId) ?? { deliveredSequence: 0, readSequence: 0 };
      receipts.set(receipt.conversationId, { ...receipt, deliveredSequence: Math.max(old.deliveredSequence, receipt.deliveredSequence),
        readSequence: Math.max(old.readSequence, receipt.readSequence) });
    },
    acknowledgeReceipt: async (id, delivered, read) => { calls.push(['ack', id, delivered, read]); receipts.delete(id); },
    deviceId: async () => 'device-1',
    sendDelivered: async (...args) => { calls.push(['delivered', ...args]); },
    sendRead: async (...args) => { calls.push(['read', ...args]); },
    decodeRealtimeMessage: payload => payload.message ?? null,
    subscribeLive: (callback, onInvalidate) => { listener = callback; invalidate = onInvalidate; lastInvalidation = onInvalidate;
      calls.push(['subscribe']); return () => { stops++; listener = undefined; invalidate = undefined; }; },
    scheduleRecovery: callback => { recovery = callback; return () => { timerStops++; recovery = undefined; }; },
    abort: () => { aborted = true; },
    ...overrides,
  };
  const runtime = new ChatSessionRuntime({ role: 'customer', ref: 'me' }, deps, foreground);
  return { runtime, calls, stopSession: () => { current = false; }, emit: payload => listener?.(payload),
    invalidate: () => invalidate?.(), staleInvalidation: () => lastInvalidation?.(), recover: () => recovery?.(),
    stops: () => stops, timerStops: () => timerStops, aborted: () => aborted };
}

test('startup restores cached unread before the server responds and keeps it after a failed refresh', async () => {
  let release;
  const pending = new Promise((_, reject) => { release = reject; });
  const f = fixture({ fetchConversations: () => pending });
  const values = [];
  f.runtime.subscribe(() => values.push(f.runtime.value));
  await f.runtime.start();
  assert.equal(f.runtime.value, 2);
  release(new Error('offline'));
  await tick();
  assert.equal(f.runtime.value, 2);
  assert.deepEqual(values, [2]);
  f.runtime.close();
});

test('a real incoming event changes the unread count even if conversation refresh fails', async () => {
  let loads = 0;
  const f = fixture({ fetchConversations: async () => {
    if (++loads === 1) return { items: [conversation()], hasMore: false };
    throw new Error('offline');
  } });
  await f.runtime.start();
  await tick();
  f.emit({ event: 'chat.message.created', message: message() });
  await tick(); await tick();
  assert.equal(f.runtime.value, 3);
  assert.ok(f.calls.some(call => call[0] === 'queue' && call[2] === 1));
  f.runtime.close();
});

test('opening a conversation clears its badge and loaded messages queue delivery plus read', async () => {
  const f = fixture();
  await f.runtime.start();
  await tick();
  f.runtime.setActiveConversation('a');
  assert.equal(f.runtime.value, 0);
  await f.runtime.rememberThreadMessages('a', [message(2)]);
  await tick(); await tick();
  assert.ok(f.calls.some(call => call[0] === 'queue' && call[2] === 2 && call[3] === 2));
  assert.ok(f.calls.some(call => call[0] === 'delivered' && call[2] === 2));
  assert.ok(f.calls.some(call => call[0] === 'read' && call[2] === 2));
  f.runtime.close();
});

test('pause stops live and timer, while resume starts one of each and recovers', async () => {
  const f = fixture();
  await f.runtime.start();
  await tick();
  f.runtime.pause();
  assert.equal(f.stops(), 1);
  assert.equal(f.timerStops(), 1);
  f.runtime.resume();
  f.runtime.resume();
  await tick();
  assert.equal(f.calls.filter(call => call[0] === 'subscribe').length, 2);
  assert.ok(f.calls.filter(call => call[0] === 'sync').length >= 2);
  f.runtime.close();
  assert.equal(f.stops(), 2);
  assert.equal(f.timerStops(), 2);
});

test('focused screens share invalidations and stale callbacks stop on pause or session close', async () => {
  const f = fixture();
  let first = 0, second = 0;
  const unsubscribe = f.runtime.subscribeInvalidation(() => first++);
  f.runtime.subscribeInvalidation(() => second++);
  await f.runtime.start();
  f.invalidate();
  assert.deepEqual([first, second], [1, 1]);
  unsubscribe();
  f.invalidate();
  assert.deepEqual([first, second], [1, 2]);
  f.runtime.pause();
  f.staleInvalidation();
  assert.deepEqual([first, second], [1, 2]);
  f.runtime.resume();
  f.invalidate();
  assert.deepEqual([first, second], [1, 3]);
  f.runtime.close();
  f.staleInvalidation();
  assert.deepEqual([first, second], [1, 3]);
});

test('a closed or switched session cannot publish a late refresh', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ fetchConversations: () => pending });
  await f.runtime.start();
  assert.equal(f.runtime.value, 2);
  f.stopSession();
  f.runtime.close();
  release({ items: [conversation(50)], hasMore: false });
  await tick();
  assert.equal(f.runtime.value, 0);
  assert.equal(f.aborted(), true);
});

test('concurrent refreshes coalesce and run one requested follow-up', async () => {
  let release, loads = 0;
  const first = new Promise(resolve => { release = resolve; });
  const f = fixture({ fetchConversations: async () => {
    loads++;
    return loads === 1 ? first : { items: [conversation(4)], hasMore: false };
  } });
  await f.runtime.start();
  const pending = f.runtime.refresh();
  assert.equal(pending, f.runtime.refresh());
  release({ items: [conversation(3)], hasMore: false });
  await pending;
  assert.equal(loads, 2);
  assert.equal(f.runtime.value, 4);
  f.runtime.close();
});

test('cache and cursor failures do not prevent online startup', async () => {
  const f = fixture({ loadConversations: async () => { throw new Error('cache'); }, loadCursor: async () => { throw new Error('cursor'); } });
  await f.runtime.start();
  await tick();
  assert.equal(f.runtime.value, 2);
  assert.ok(f.calls.some(call => call[0] === 'sync' && call[1] === 0));
  f.runtime.close();
});
