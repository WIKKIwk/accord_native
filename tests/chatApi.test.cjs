const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(handler) {
  const session = { token: 'token', baseUrl: 'https://erp.example' };
  let active = true;
  const calls = [];
  const api = loadTs('chatApi.ts', {
    './auth': { activeSessionToken: () => active ? session.token : null },
    './authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); return handler(...args); } },
    './chatModel': loadTs('chatModel.ts'),
  });
  session.profile = { role: 'aparatchi', ref: 'worker-1' };
  return { session, calls, ...api, logout: () => { active = false; } };
}

test('conversation list uses the existing authenticated V2 endpoint', async () => {
  const f = fixture(() => ({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  const signal = new AbortController().signal;
  const result = await f.loadChatConversations(f.session, signal);
  assert.deepEqual(result, { items: [], hasMore: false });
  assert.equal(f.calls[0][0], f.session);
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations?limit=100');
  assert.equal(f.calls[0][2].signal, signal);
});

test('server permission and malformed response failures are visible', async () => {
  const denied = fixture(() => ({ ok: false, status: 403 }));
  await assert.rejects(denied.loadChatConversations(denied.session), /chat ochilmagan/);
  const broken = fixture(() => ({ ok: true, json: async () => ({ items: null }) }));
  await assert.rejects(broken.loadChatConversations(broken.session), /o‘qib bo‘lmadi/);
});

test('responses received after logout or cancellation are never accepted', async () => {
  let complete;
  const body = new Promise(resolve => { complete = resolve; });
  const f = fixture(() => ({ ok: true, json: () => body }));
  const pending = f.loadChatConversations(f.session);
  await Promise.resolve();
  f.logout();
  complete({ items: [], has_more: false });
  await assert.rejects(pending, /Sessiya tugagan/);

  const aborted = fixture(() => ({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(aborted.loadChatConversations(aborted.session, controller.signal), /Sessiya tugagan/);
});

test('directory searches the authenticated server and keeps roles with matching references distinct', async () => {
  const peer = { role: 'aparatchi', ref: 'shared-1', display_name: 'Ali', avatar_url: '/v1/mobile/profile/avatar/view?v=1' };
  const f = fixture(() => ({ ok: true, json: async () => ({
    items: [peer, peer, { ...peer, role: 'qolipchi' }, { role: 'admin', ref: '' }], has_more: true,
  }) }));
  const page = await f.loadChatDirectory(f.session, ' Ali & Vali ', 100);
  const url = new URL(f.calls[0][1], f.session.baseUrl);
  assert.equal(url.pathname, '/v1/mobile/chat/directory');
  assert.equal(url.searchParams.get('q'), 'Ali & Vali');
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(url.searchParams.get('offset'), '100');
  assert.deepEqual(page.items.map(item => [item.role, item.ref]), [['aparatchi', 'shared-1'], ['qolipchi', 'shared-1']]);
  assert.equal(page.count, 4);
  assert.equal(page.hasMore, true);
  const broken = fixture(() => ({ ok: true, json: async () => ({ items: null }) }));
  await assert.rejects(broken.loadChatDirectory(broken.session, ''), /o‘qib bo‘lmadi/);
});

test('opening a DM uses the selected person and accepts a new empty conversation', async () => {
  const target = { role: 'qolipchi', ref: 'worker-2', displayName: 'Vali', avatarUrl: '' };
  const response = { conversation_id: 'conversation-2', last_message_sequence: 0, last_message: null,
    peer: { role: 'qolipchi', ref: 'worker-2', display_name: 'Vali', avatar_url: '' } };
  const f = fixture(() => ({ ok: true, json: async () => response }));
  const result = await f.openChatConversation(f.session, target);
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations/dm');
  assert.equal(f.calls[0][2].method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[0][2].body), { role: 'qolipchi', ref: 'worker-2' });
  assert.equal(result.id, 'conversation-2');
  assert.equal(result.title, 'Vali');
  assert.equal(result.lastMessageSequence, 0);
  const wrong = fixture(() => ({ ok: true, json: async () => ({ ...response, peer: { ...response.peer, ref: 'someone-else' } }) }));
  await assert.rejects(wrong.openChatConversation(wrong.session, target), /Suhbatni ochib bo‘lmadi/);
  const invalid = fixture(() => ({ ok: true, json: async () => ({ ...response, conversation_id: '..' }) }));
  await assert.rejects(invalid.openChatConversation(invalid.session, target), /Suhbatni ochib bo‘lmadi/);
});

test('a DM response after cancellation or logout never opens a conversation', async () => {
  const target = { role: 'qolipchi', ref: 'worker-2', displayName: 'Vali', avatarUrl: '' };
  const response = { conversation_id: 'conversation-2', peer: { role: target.role, ref: target.ref } };
  let complete;
  const body = new Promise(resolve => { complete = resolve; });
  const f = fixture(() => ({ ok: true, json: () => body }));
  const pending = f.openChatConversation(f.session, target);
  await Promise.resolve();
  f.logout();
  complete(response);
  await assert.rejects(pending, /Sessiya tugagan/);
  const aborted = fixture(() => ({ ok: true, json: async () => response }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(aborted.openChatConversation(aborted.session, target, controller.signal), /Sessiya tugagan/);
});

test('a newly opened conversation appears in the list after its first sent message', async () => {
  const target = { role: 'qolipchi', ref: 'worker-2', displayName: 'Vali', avatarUrl: '' };
  const peer = { role: target.role, ref: target.ref, display_name: target.displayName, avatar_url: '' };
  let lastMessage = null;
  const f = fixture((_session, path, init) => {
    if (path.endsWith('/conversations/dm')) return { ok: true, json: async () => ({ conversation_id: 'new-1', peer, last_message: null }) };
    if (path.endsWith('/new-1/messages')) {
      const { client_message_id, body } = JSON.parse(init.body);
      lastMessage = { message_id: 'm1', conversation_id: 'new-1', sequence: 1, client_message_id,
        sender_role: 'aparatchi', sender_ref: 'worker-1', type: 'text', body, created_at_unix: 1 };
      return { ok: true, json: async () => ({ message: lastMessage }) };
    }
    if (path.startsWith('/v1/mobile/chat/conversations?')) return { ok: true, json: async () => ({
      items: [{ conversation_id: 'new-1', peer, last_message_sequence: lastMessage ? 1 : 0, last_message: lastMessage }], has_more: false,
    }) };
    throw new Error(`Unexpected request: ${path}`);
  });
  const conversation = await f.openChatConversation(f.session, target);
  assert.equal((await f.loadChatConversations(f.session)).items.length, 0);
  await f.sendChatText(f.session, conversation.id, 'client-1', 'Salom');
  const page = await f.loadChatConversations(f.session);
  assert.equal(page.items[0].id, conversation.id);
  assert.equal(page.items[0].title, 'Vali');
  assert.equal(page.items[0].preview, 'Salom');
});

test('thread reads newest or earlier messages through the V2 conversation endpoint', async () => {
  const f = fixture(() => ({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  await f.loadChatMessages(f.session, 'conversation 1');
  await f.loadChatMessages(f.session, 'conversation 1', undefined, 42);
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations/conversation%201/messages?limit=100');
  assert.equal(f.calls[1][1], '/v1/mobile/chat/conversations/conversation%201/messages?limit=100&before_sequence=42');
  await assert.rejects(f.loadChatMessages(f.session, '..'), /Suhbat topilmadi/);
});

test('text send retains the client id on retry and accepts only a matching confirmation', async () => {
  const confirmed = { message_id: 'm1', conversation_id: 'c1', sequence: 1, client_message_id: 'client-1',
    sender_role: 'aparatchi', sender_ref: 'worker-1', type: 'text', body: 'Salom', created_at_unix: 1 };
  const f = fixture(() => ({ ok: true, json: async () => ({ message: confirmed }) }));
  const first = await f.sendChatText(f.session, 'c1', 'client-1', ' Salom ');
  await f.sendChatText(f.session, 'c1', 'client-1', ' Salom ');
  assert.equal(first.id, 'm1');
  assert.deepEqual(JSON.parse(f.calls[0][2].body), { client_message_id: 'client-1', body: 'Salom' });
  assert.equal(f.calls[1][2].body, f.calls[0][2].body);
  const wrong = fixture(() => ({ ok: true, json: async () => ({ message: { ...confirmed, sender_ref: 'someone-else' } }) }));
  await assert.rejects(wrong.sendChatText(wrong.session, 'c1', 'client-1', 'Salom'), /tasdiqlanmadi/);
  const altered = fixture(() => ({ ok: true, json: async () => ({ message: { ...confirmed, body: 'Boshqa xabar' } }) }));
  await assert.rejects(altered.sendChatText(altered.session, 'c1', 'client-1', 'Salom'), /tasdiqlanmadi/);
  await assert.rejects(f.sendChatText(f.session, 'c1', 'client-1', ' '), /noto‘g‘ri/);
});

test('read receipt carries the sequence and stable device identity', async () => {
  const f = fixture(() => ({ ok: true }));
  await f.markChatRead(f.session, 'c1', 17, 'device-1');
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations/c1/read');
  assert.deepEqual(JSON.parse(f.calls[0][2].body), { sequence: 17, device_id: 'device-1' });
  await f.markChatRead(f.session, 'c1', 0, 'device-1');
  assert.equal(f.calls.length, 1);
});

test('gap recovery requests messages after the known sequence, including zero', async () => {
  const f = fixture(() => ({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  await f.loadChatMessagesAfter(f.session, 'conversation 1', 0);
  await f.loadChatMessagesAfter(f.session, 'conversation 1', 42);
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations/conversation%201/messages?limit=100&after_sequence=0');
  assert.equal(f.calls[1][1], '/v1/mobile/chat/conversations/conversation%201/messages?limit=100&after_sequence=42');
  const malformed = fixture(() => ({ ok: true, json: async () => ({ items: [{ message_id: '', conversation_id: 'c1', sequence: 2 }], has_more: false }) }));
  await assert.rejects(malformed.loadChatMessagesAfter(malformed.session, 'c1', 1), /Chat so‘rovi bajarilmadi/);
});

test('sync uses V2 cursor and limit and parses message events without advancing past an invalid message', async () => {
  const message = { message_id: 'm1', conversation_id: 'c1', sequence: 4, sender_role: 'customer', sender_ref: 'other', type: 'text', body: 'Hello' };
  const f = fixture(() => ({ ok: true, json: async () => ({ events: [
    { event_id: 'e1', cursor: 10, event: 'chat.message.created', conversation_id: 'c1', sequence: 4, message },
    { event: 'other', message: null }, 'ignored',
  ], next_cursor: 10, has_more: true }) }));
  const result = await f.loadChatSync(f.session, 3);
  assert.equal(f.calls[0][1], '/v1/mobile/chat/sync?cursor=3&limit=200');
  assert.equal(result.nextCursor, 10);
  assert.equal(result.hasMore, true);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].message.id, 'm1');
  assert.equal(result.events[1].message, null);
  const malformed = fixture(() => ({ ok: true, json: async () => ({ events: [{ event: 'chat.message.created', message: { ...message, message_id: '' } }], next_cursor: 100 }) }));
  await assert.rejects(malformed.loadChatSync(malformed.session, 3), /Chat so‘rovi bajarilmadi/);
});

test('sync and gap reads reject an aborted or no-longer-active session', async () => {
  let complete;
  const body = new Promise(resolve => { complete = resolve; });
  const f = fixture(() => ({ ok: true, json: () => body }));
  const pending = f.loadChatSync(f.session, 0);
  await Promise.resolve();
  f.logout();
  complete({ events: [], next_cursor: 1, has_more: false });
  await assert.rejects(pending, /Sessiya tugagan/);
  const aborted = fixture(() => ({ ok: true, json: async () => ({ items: [], has_more: false }) }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(aborted.loadChatMessagesAfter(aborted.session, 'c1', 0, controller.signal), /Sessiya tugagan/);
});

test('delivery receipt uses the V2 endpoint, sequence and device identity', async () => {
  const f = fixture(() => ({ ok: true }));
  await f.markChatDelivered(f.session, 'c1', 17, 'device-1');
  assert.equal(f.calls[0][1], '/v1/mobile/chat/conversations/c1/delivered');
  assert.deepEqual(JSON.parse(f.calls[0][2].body), { sequence: 17, device_id: 'device-1' });
  await f.markChatDelivered(f.session, 'c1', 0, 'device-1');
  assert.equal(f.calls.length, 1);
});
