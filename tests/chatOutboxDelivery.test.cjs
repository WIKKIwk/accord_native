const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const ts = require('typescript');

function fixture(items) {
  const pending = [...items];
  const attempts = [];
  const removed = [];
  let active = true;
  let fail = false;
  let onSend;
  const filename = path.resolve(__dirname, '../src/chatOutboxDelivery.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const overrides = {
    './auth': { activeSessionToken: () => active ? 'token' : null },
    './chatApi': { sendChatText: async (_, conversation, id, body, signal) => {
      attempts.push({ conversation, id, body });
      const result = onSend?.(signal);
      if (result) return await result;
      if (fail) throw new Error('offline');
      return { id: 'server-message', clientMessageId: id };
    } },
    './chatOutbox': {
      pendingChatTexts: async () => [...pending],
      removePendingChatText: async (_, id) => { removed.push(id); const index = pending.findIndex(item => item.clientMessageId === id); if (index >= 0) pending.splice(index, 1); },
    },
  };
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { flush: loaded.exports.flushChatOutbox, pending, attempts, removed, fail: value => { fail = value; },
    logout: () => { active = false; }, onSend: fn => { onSend = fn; } };
}

test('offline sends stay queued and retry uses the same client id until confirmed', async () => {
  const item = { conversationId: 'c1', clientMessageId: 'client-1', body: 'Salom', createdAt: 1 };
  const f = fixture([item]);
  const confirmed = [];
  f.fail(true);
  await assert.rejects(f.flush({}, 'c1', new AbortController().signal, message => confirmed.push(message)));
  assert.deepEqual(f.pending, [item]);
  assert.deepEqual(f.removed, []);
  f.fail(false);
  await f.flush({}, 'c1', new AbortController().signal, message => confirmed.push(message));
  assert.deepEqual(f.attempts.map(value => value.id), ['client-1', 'client-1']);
  assert.deepEqual(f.removed, ['client-1']);
  assert.equal(confirmed.length, 1);
  assert.deepEqual(f.pending, []);
});

test('cancellation or session change prevents subsequent queued sends', async () => {
  const f = fixture([
    { conversationId: 'c1', clientMessageId: 'first', body: 'one' },
    { conversationId: 'c1', clientMessageId: 'second', body: 'two' },
  ]);
  const controller = new AbortController();
  f.onSend(() => { controller.abort(); f.logout(); });
  await f.flush({}, 'c1', controller.signal, () => {});
  assert.deepEqual(f.attempts.map(item => item.id), ['first']);
  assert.equal(f.pending[0].clientMessageId, 'second');
});

test('a stalled send times out, keeps the message, and can retry with the same id', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const item = { conversationId: 'c1', clientMessageId: 'client-1', body: 'Salom' };
  const f = fixture([item]);
  let started;
  const sending = new Promise(resolve => { started = resolve; });
  f.onSend(signal => {
    started();
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
  });
  const attempt = f.flush({}, 'c1', new AbortController().signal, () => {});
  await sending;
  t.mock.timers.tick(15_000);
  await assert.rejects(attempt, /timeout/);
  assert.deepEqual(f.pending, [item]);
  f.onSend(undefined);
  await f.flush({}, 'c1', new AbortController().signal, () => {});
  assert.deepEqual(f.attempts.map(value => value.id), ['client-1', 'client-1']);
  assert.deepEqual(f.pending, []);
});

test('a lost response after server acceptance retries without creating a second message', async () => {
  const db = new DatabaseSync(':memory:');
  const nativeDb = {
    execAsync: async sql => db.exec(sql),
    runAsync: async (sql, ...args) => db.prepare(sql).run(...args),
    getAllAsync: async (sql, ...args) => db.prepare(sql).all(...args),
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...args),
  };
  const session = { baseUrl: 'https://erp.example', profile: { role: 'aparatchi', ref: 'worker-1' } };
  const auth = { activeSessionToken: () => 'token' };
  function load(file, overrides = {}) {
    const filename = path.resolve(__dirname, '../src', file);
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = module.paths;
    loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return loaded.exports;
  }
  const outbox = load('chatOutbox.ts', { './auth': auth, 'expo-crypto': { randomUUID: () => 'uuid-1' }, 'expo-sqlite': { openDatabaseAsync: async () => nativeDb } });
  const serverMessages = new Map();
  const requests = [];
  const api = load('chatApi.ts', {
    './auth': auth, './chatModel': load('chatModel.ts'),
    './authorizedFetch': { authorizedFetch: async (_, __, request) => {
      const sent = JSON.parse(request.body);
      requests.push(sent);
      if (!serverMessages.has(sent.client_message_id)) {
        serverMessages.set(sent.client_message_id, { message_id: 'server-1', conversation_id: 'c1', sequence: 1,
          client_message_id: sent.client_message_id, sender_role: 'aparatchi', sender_ref: 'worker-1',
          type: 'text', body: sent.body, created_at_unix: 1 });
        throw new TypeError('response lost');
      }
      return { ok: true, json: async () => ({ message: serverMessages.get(sent.client_message_id), created: false }) };
    } },
  });
  const { flushChatOutbox } = load('chatOutboxDelivery.ts', { './auth': auth, './chatApi': api, './chatOutbox': outbox });
  const queued = await outbox.queueChatText(session, 'c1', 'Salom');
  await assert.rejects(flushChatOutbox(session, 'c1', new AbortController().signal, () => {}), /response lost/);
  assert.equal((await outbox.pendingChatTexts(session, 'c1')).length, 1);
  const confirmed = [];
  await flushChatOutbox(session, 'c1', new AbortController().signal, message => confirmed.push(message));
  assert.equal(serverMessages.size, 1);
  assert.deepEqual(requests.map(item => item.client_message_id), [queued.clientMessageId, queued.clientMessageId]);
  assert.equal(confirmed[0].id, 'server-1');
  assert.deepEqual(await outbox.pendingChatTexts(session, 'c1'), []);
  db.close();
});
