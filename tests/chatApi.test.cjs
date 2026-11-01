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
