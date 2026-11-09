const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/chat/chatUnreadState.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { ChatUnreadState } = loaded.exports;

// Derived directly from f11910bb ChatStore.totalUnread, markRead and
// _acceptMessage; no recorded or historical fixture is used.
const conversation = (id, unreadCount, lastMessageSequence = 1) => ({ id, title: id, peer: null, preview: '', unreadCount, lastMessageSequence, updatedAt: 1, timestamp: 1 });
const message = (id, conversationId, overrides = {}) => ({
  id, conversationId, sequence: 2, timestamp: 10, senderRole: 'customer', senderRef: 'other', ...overrides,
});
const state = () => new ChatUnreadState({ role: 'customer', ref: 'me' });

test('unread value sums the current conversations and only notifies when the total changes', () => {
  const store = state();
  const values = [];
  const unsubscribe = store.subscribe(() => values.push(store.value));
  store.replaceConversations([conversation('a', 2), conversation('b', 3)]);
  store.replaceConversations([conversation('a', 1), conversation('b', 4)]);
  assert.equal(store.value, 5);
  assert.deepEqual(values, [5]);
  store.replaceConversations([]);
  unsubscribe();
  store.replaceConversations([conversation('a', 1)]);
  assert.deepEqual(values, [5, 0]);
});

test('active conversation is cleared immediately and remains zero for incoming messages', () => {
  const store = state();
  store.replaceConversations([conversation('a', 4), conversation('b', 2)]);
  store.setActiveConversation('a');
  assert.equal(store.value, 2);
  store.acceptMessage(message('m1', 'a'));
  assert.equal(store.value, 2);
  store.setActiveConversation('');
  store.acceptMessage(message('m2', 'a'));
  assert.equal(store.value, 3);
  store.markRead('a');
  assert.equal(store.value, 2);
});

test('a new message from another account increments once, but mine and known messages do not', () => {
  const store = state();
  store.replaceConversations([conversation('a', 2)]);
  store.acceptMessage(message('m1', 'a'));
  store.acceptMessage(message('m1', 'a', { sequence: 3 }));
  store.acceptMessage(message('mine', 'a', { senderRef: 'me' }));
  store.rememberMessages([message('history', 'a')]);
  store.acceptMessage(message('history', 'a'));
  assert.equal(store.value, 3);
});

test('known IDs are scoped to their conversation and role plus ref identifies the sender', () => {
  const store = state();
  store.replaceConversations([conversation('a', 0), conversation('b', 0)]);
  store.acceptMessage(message('same-id', 'a', { senderRef: 'me' }));
  store.acceptMessage(message('same-id', 'b', { senderRole: 'supplier', senderRef: 'me' }));
  assert.equal(store.value, 1);
});

test('an event for an unknown conversation is remembered but does not invent a count', () => {
  const store = state();
  store.acceptMessage(message('m1', 'new'));
  assert.equal(store.value, 0);
  store.replaceConversations([conversation('new', 3)]);
  store.acceptMessage(message('m1', 'new'));
  assert.equal(store.value, 3);
});

test('a closed session clears its total and ignores late refreshes and messages', () => {
  const old = state();
  const values = [];
  old.subscribe(() => values.push(old.value));
  old.replaceConversations([conversation('a', 2)]);
  old.close();
  old.close();
  old.replaceConversations([conversation('a', 9)]);
  old.acceptMessage(message('late', 'a'));
  assert.equal(old.value, 0);
  assert.deepEqual(values, [2, 0]);
  const next = new ChatUnreadState({ role: 'supplier', ref: 'next' });
  next.replaceConversations([conversation('a', 7)]);
  assert.equal(next.value, 7);
});

test('newest message updates the cache ordering time and returned snapshots cannot mutate state', () => {
  const store = state();
  const input = { ...conversation('a', 0, 5), peer: { role: 'customer', ref: 'other', displayName: 'Ali', avatarUrl: '' } };
  store.replaceConversations([input]);
  input.peer.displayName = 'Changed outside';
  store.acceptMessage(message('older', 'a', { sequence: 4, timestamp: 20 }));
  assert.equal(store.snapshot()[0].updatedAt, 1);
  store.acceptMessage(message('newer', 'a', { sequence: 6, timestamp: 30 }));
  const snapshot = store.snapshot();
  assert.equal(snapshot[0].updatedAt, 30);
  snapshot[0].unreadCount = 900;
  snapshot[0].peer.displayName = 'Changed snapshot';
  assert.equal(store.value, 2);
  assert.equal(store.snapshot()[0].unreadCount, 2);
  assert.equal(store.snapshot()[0].peer.displayName, 'Ali');
});
