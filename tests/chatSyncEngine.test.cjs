const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '../src/shared/chat', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const { ChatSyncEngine } = load('chatSyncEngine.ts');
const { ChatUnreadState } = load('chatUnreadState.ts');
const message = (sequence, overrides = {}) => ({ id: `m${sequence}`, conversationId: 'a', sequence, clientMessageId: '',
  senderRole: 'customer', senderRef: 'other', body: 'Hi', timestamp: sequence, ...overrides });
const event = item => ({ eventId: `e${item.sequence}`, cursor: item.sequence, event: 'chat.message.created',
  conversationId: item.conversationId, sequence: item.sequence, message: item });
const conversation = { id: 'a', title: 'A', peer: null, preview: '', lastMessageSequence: 1, unreadCount: 2, updatedAt: 1, timestamp: 1 };

function fixture(overrides = {}) {
  let current = true;
  let active = '';
  const calls = [];
  const unread = new ChatUnreadState({ role: 'customer', ref: 'me' });
  unread.replaceConversations([conversation]);
  const deps = {
    isCurrent: () => current,
    loadSync: async cursor => { calls.push(['sync', cursor]); return { events: [], nextCursor: cursor, hasMore: false }; },
    loadAfter: async (id, sequence) => { calls.push(['after', id, sequence]); return { items: [], hasMore: false }; },
    latestSavedSequence: async id => { calls.push(['latest', id]); return 0; },
    saveMessages: async items => { calls.push(['saveMessages', ...items.map(item => item.id)]); },
    saveConversations: async items => { calls.push(['saveConversations', ...items.map(item => item.unreadCount)]); },
    saveCursor: async cursor => { calls.push(['saveCursor', cursor]); },
    rememberMessages: items => unread.rememberMessages(items),
    acceptMessage: item => unread.acceptMessage(item),
    queueDelivered: async (id, sequence) => { calls.push(['delivered', id, sequence]); },
    refreshConversations: async () => { calls.push(['refresh']); },
    activeConversationId: () => active,
    markRead: async id => { calls.push(['read', id]); unread.markRead(id); },
    flushReceipts: async () => { calls.push(['flush']); },
    ...overrides,
  };
  return { calls, unread, engine: new ChatSyncEngine(deps), stop: () => { current = false; }, setActive: id => { active = id; } };
}

// Derived directly from f11910bb chat_store_sync.dart. No replay fixture is used.
test('sync persists accepted messages and receipts before advancing each cursor', async () => {
  const f = fixture({
    loadSync: async cursor => cursor === 0
      ? { events: [event(message(1))], nextCursor: 8, hasMore: true }
      : { events: [], nextCursor: 9, hasMore: false },
  });
  await f.engine.synchronize();
  assert.deepEqual(f.calls, [
    ['saveMessages', 'm1'], ['saveConversations', 3], ['delivered', 'a', 1], ['saveCursor', 8], ['saveCursor', 9], ['refresh'], ['flush'],
  ]);
  assert.equal(f.unread.value, 3);
});

test('gap recovery resumes from the saved sequence and marks fetched messages known', async () => {
  const f = fixture({
    loadSync: async () => ({ events: [event(message(5))], nextCursor: 5, hasMore: false }),
    latestSavedSequence: async () => 2,
    loadAfter: async (id, cursor) => { assert.equal(id, 'a'); assert.equal(cursor, 2); return { items: [message(3), message(4), message(5)], hasMore: false }; },
  });
  await f.engine.synchronize();
  assert.equal(f.unread.value, 2);
  assert.equal(f.engine.latestInMemorySequence('a'), 5);
  assert.deepEqual(f.calls.filter(item => item[0] === 'delivered'), [
    ['delivered', 'a', 3], ['delivered', 'a', 4], ['delivered', 'a', 5], ['delivered', 'a', 5],
  ]);
});

test('a persistence failure prevents cursor advancement and the next sync retries', async () => {
  let saves = 0;
  const cursors = [];
  const f = fixture({
    loadSync: async cursor => { cursors.push(cursor); return { events: [event(message(1))], nextCursor: 8, hasMore: false }; },
    saveMessages: async () => { if (++saves === 1) throw new Error('disk'); },
  });
  await assert.rejects(f.engine.synchronize(), /disk/);
  assert.ok(!f.calls.some(call => call[0] === 'saveCursor'));
  await f.engine.synchronize();
  assert.deepEqual(cursors, [0, 0]);
  assert.equal(f.unread.value, 3);
});

test('an empty unchanged page stops recovery even when hasMore is true', async () => {
  let pages = 0;
  const f = fixture({ loadSync: async cursor => { pages++; return { events: [], nextCursor: cursor, hasMore: true }; } });
  await f.engine.synchronize();
  assert.equal(pages, 1);
  assert.deepEqual(f.calls, [['flush']]);
});

test('sync never moves its cursor backwards and limits a recovery pass to 100 pages', async () => {
  let loads = 0;
  const f = fixture({ loadSync: async cursor => { loads++; return { events: [{ event: 'ignored', message: null }], nextCursor: cursor + 1, hasMore: true }; } });
  await f.engine.synchronize();
  assert.equal(loads, 100);
  assert.equal(f.calls.filter(call => call[0] === 'saveCursor').at(-1)[1], 100);
  const backwards = fixture({ loadSync: async () => ({ events: [], nextCursor: 1, hasMore: false }) });
  const engine = new ChatSyncEngine({
    isCurrent: () => true, loadSync: async () => ({ events: [], nextCursor: 1, hasMore: false }),
    loadAfter: async () => ({ items: [], hasMore: false }), latestSavedSequence: async () => 0,
    saveMessages: async () => {}, saveConversations: async () => {}, saveCursor: async cursor => backwards.calls.push(['cursor', cursor]),
    rememberMessages: () => {}, acceptMessage: () => null, queueDelivered: async () => {}, refreshConversations: async () => {},
    activeConversationId: () => '', markRead: async () => {}, flushReceipts: async () => {},
  }, 8);
  await engine.synchronize();
  assert.deepEqual(backwards.calls, []);
});

test('active conversation is marked read after recovery and before receipts flush', async () => {
  const f = fixture({ loadSync: async () => ({ events: [event(message(1))], nextCursor: 1, hasMore: false }) });
  f.setActive('a');
  await f.engine.synchronize();
  assert.deepEqual(f.calls.slice(-3), [['refresh'], ['read', 'a'], ['flush']]);
  assert.equal(f.unread.value, 0);
});

test('concurrent synchronization shares one operation and old-session responses are ignored', async () => {
  let release;
  const pendingPage = new Promise(resolve => { release = resolve; });
  let loads = 0;
  const f = fixture({ loadSync: async () => { loads++; return pendingPage; } });
  const first = f.engine.synchronize();
  assert.equal(first, f.engine.synchronize());
  f.stop();
  release({ events: [event(message(1))], nextCursor: 9, hasMore: false });
  await first;
  assert.equal(loads, 1);
  assert.deepEqual(f.calls, []);
  assert.equal(f.unread.value, 2);
});

test('realtime messages update unread state, queue delivery and trigger recovery', async () => {
  const f = fixture();
  await f.engine.acceptRealtimeMessage(message(1));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.unread.value, 3);
  assert.ok(f.calls.some(call => call[0] === 'delivered'));
  assert.ok(f.calls.some(call => call[0] === 'refresh'));
  assert.ok(f.calls.some(call => call[0] === 'sync'));
});

test('a realtime message in the active conversation is cleared locally and queues its read path', async () => {
  const f = fixture();
  f.unread.setActiveConversation('a');
  f.setActive('a');
  await f.engine.acceptRealtimeMessage(message(1));
  assert.equal(f.unread.value, 0);
  assert.ok(f.calls.some(call => call[0] === 'read' && call[1] === 'a'));
});
