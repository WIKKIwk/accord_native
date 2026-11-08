const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const ts = require('typescript');

function fixture(connection = new DatabaseSync(':memory:')) {
  let opens = 0;
  const db = {
    async execAsync(sql) { connection.exec(sql); },
    async runAsync(sql, ...args) { return connection.prepare(sql).run(...args); },
    async getAllAsync(sql, ...args) { return connection.prepare(sql).all(...args); },
    async getFirstAsync(sql, ...args) { return connection.prepare(sql).get(...args); },
    async withExclusiveTransactionAsync(action) {
      connection.exec('BEGIN TRANSACTION');
      try { await action(db); connection.exec('COMMIT'); }
      catch (error) { connection.exec('ROLLBACK'); throw error; }
    },
  };
  const filename = path.resolve(__dirname, '../src/shared/chat/chatLocalStore.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => name === 'expo-sqlite'
    ? { openDatabaseAsync: async () => { opens++; return db; } } : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  const session = { baseUrl: 'https://erp.example', profile: { role: 'customer', ref: 'first' } };
  return { ...loaded.exports, session, connection, opens: () => opens };
}

const conversation = (id, updatedAt, unreadCount = 0) => ({
  id, title: id, peer: null, preview: 'Message', lastMessageSequence: 1, unreadCount, updatedAt, timestamp: updatedAt + 1000,
});

// V2 f11910bb ChatLocalStore loads the 100 newest by updated_at_unix and
// upserts each conversation without removing other cached conversations.
test('cache restores by V2 updated time, retains prior rows and upserts changes', async () => {
  const f = fixture();
  await f.saveCachedChatConversations(f.session, [conversation('old', 1, 2), conversation('new', 2, 3)]);
  await f.saveCachedChatConversations(f.session, [conversation('old', 4, 0)]);
  assert.deepEqual(await f.loadCachedChatConversations(f.session), [conversation('old', 4, 0), conversation('new', 2, 3)]);
  assert.equal(f.opens(), 1);
});

test('cache restores at most 100 conversations in updated order', async () => {
  const f = fixture();
  await f.saveCachedChatConversations(f.session, Array.from({ length: 103 }, (_, i) => conversation(String(i), i)));
  const restored = await f.loadCachedChatConversations(f.session);
  assert.equal(restored.length, 100);
  assert.equal(restored[0].id, '102');
  assert.equal(restored.at(-1).id, '3');
});

test('cache is isolated by account and server and survives a new module instance', async () => {
  const first = fixture();
  const other = { ...first.session, profile: { role: 'customer', ref: 'second' } };
  const server = { ...first.session, baseUrl: 'https://another.example' };
  await first.saveCachedChatConversations(first.session, [conversation('a', 1, 2)]);
  await first.saveCachedChatConversations(other, [conversation('a', 1, 7)]);
  await first.saveCachedChatConversations(server, [conversation('a', 1, 9)]);
  const next = fixture(first.connection);
  assert.equal((await next.loadCachedChatConversations(first.session))[0].unreadCount, 2);
  assert.equal((await next.loadCachedChatConversations(other))[0].unreadCount, 7);
  assert.equal((await next.loadCachedChatConversations(server))[0].unreadCount, 9);
  assert.deepEqual(await next.loadCachedChatConversations({ ...first.session, profile: { role: 'supplier', ref: 'first' } }), []);
});

test('a failed batch rolls back all rows and invalid scopes never open storage', async () => {
  const f = fixture();
  await assert.rejects(f.saveCachedChatConversations({ ...f.session, baseUrl: 'http://erp.example' }, []));
  assert.equal(f.opens(), 0);
  const bad = { ...conversation('bad', 2), updatedAt: undefined };
  await assert.rejects(f.saveCachedChatConversations(f.session, [conversation('good', 1), bad]));
  assert.deepEqual(await f.loadCachedChatConversations(f.session), []);
});

const message = (sequence, overrides = {}) => ({
  id: `message-${sequence}`, conversationId: 'a', sequence, clientMessageId: '', senderRole: 'customer', senderRef: 'other',
  body: `Message ${sequence}`, timestamp: sequence, ...overrides,
});

test('message cache restores the latest 100 in chronological order and reports the stored maximum', async () => {
  const f = fixture();
  assert.equal(await f.latestCachedChatMessageSequence(f.session, 'a'), 0);
  await f.saveCachedChatMessages(f.session, Array.from({ length: 103 }, (_, i) => message(103 - i)));
  const restored = await f.loadCachedChatMessages(f.session, 'a');
  assert.equal(restored.length, 100);
  assert.equal(restored[0].sequence, 4);
  assert.equal(restored.at(-1).sequence, 103);
  assert.equal(await f.latestCachedChatMessageSequence(f.session, 'a'), 103);
  assert.deepEqual(await f.loadCachedChatMessages(f.session, 'other'), []);
});

test('message upserts replace the same sequence or message ID, scoped to the account', async () => {
  const f = fixture();
  const other = { ...f.session, profile: { role: 'customer', ref: 'other' } };
  await f.saveCachedChatMessages(f.session, [message(1), message(2)]);
  await f.saveCachedChatMessages(f.session, [message(3, { id: 'message-1', body: 'Updated' })]);
  await f.saveCachedChatMessages(other, [message(1)]);
  assert.deepEqual((await f.loadCachedChatMessages(f.session, 'a')).map(item => [item.id, item.sequence]), [['message-2', 2], ['message-1', 3]]);
  assert.equal((await f.loadCachedChatMessages(other, 'a'))[0].sequence, 1);
});

test('sync cursors persist per account and server, defaulting to zero', async () => {
  const f = fixture();
  const other = { ...f.session, profile: { role: 'customer', ref: 'other' } };
  assert.equal(await f.loadCachedChatSyncCursor(f.session), 0);
  await f.saveCachedChatSyncCursor(f.session, 12);
  await f.saveCachedChatSyncCursor(other, 4);
  const next = fixture(f.connection);
  assert.equal(await next.loadCachedChatSyncCursor(f.session), 12);
  assert.equal(await next.loadCachedChatSyncCursor(other), 4);
  assert.equal(await next.loadCachedChatSyncCursor({ ...f.session, baseUrl: 'https://another.example' }), 0);
});

test('concurrent operations are serialized and a read observes the preceding committed writes', async () => {
  const f = fixture();
  const first = f.saveCachedChatConversations(f.session, [conversation('first', 1)]);
  const second = f.saveCachedChatConversations(f.session, [conversation('second', 2)]);
  const read = f.loadCachedChatConversations(f.session);
  await Promise.all([first, second]);
  assert.deepEqual((await read).map(item => item.id), ['second', 'first']);
});
