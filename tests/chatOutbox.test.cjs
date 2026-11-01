const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const ts = require('typescript');

function fixture(connection = new DatabaseSync(':memory:')) {
  let serial = 0;
  let active = true;
  let opens = 0;
  const db = {
    async execAsync(sql) { connection.exec(sql); },
    async runAsync(sql, ...args) { return connection.prepare(sql).run(...args); },
    async getAllAsync(sql, ...args) { return connection.prepare(sql).all(...args); },
    async getFirstAsync(sql, ...args) { return connection.prepare(sql).get(...args); },
  };
  const filename = path.resolve(__dirname, '../src/chatOutbox.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const overrides = {
    'expo-crypto': { randomUUID: () => `uuid-${++serial}` },
    'expo-sqlite': { openDatabaseAsync: async () => { opens++; return db; } },
    './auth': { activeSessionToken: () => active ? 'token' : null },
  };
  loaded.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const session = { baseUrl: 'https://erp.example', profile: { role: 'aparatchi', ref: 'worker-1' } };
  return { ...loaded.exports, session, connection, opens: () => opens, logout: () => { active = false; } };
}

test('pending text is persisted with a unique id and isolated by account, server and conversation', async () => {
  const f = fixture();
  const queued = await f.queueChatText(f.session, 'c1', ' Salom ');
  assert.equal(queued.body, 'Salom');
  assert.equal(queued.clientMessageId, 'client_uuid-1');
  assert.deepEqual(await f.pendingChatTexts(f.session, 'c1'), [queued]);
  assert.deepEqual(await f.pendingChatTexts(f.session, 'c2'), []);
  assert.deepEqual(await f.pendingChatTexts({ ...f.session, profile: { role: 'aparatchi', ref: 'worker-2' } }, 'c1'), []);
  assert.deepEqual(await f.pendingChatTexts({ ...f.session, baseUrl: 'https://another.example' }, 'c1'), []);
  await f.removePendingChatText(f.session, queued.clientMessageId);
  assert.deepEqual(await f.pendingChatTexts(f.session, 'c1'), []);
  assert.equal(f.opens(), 1);
});

test('invalid text or inactive sessions cannot create pending messages', async () => {
  const f = fixture();
  await assert.rejects(f.queueChatText(f.session, 'c1', '  '));
  await assert.rejects(f.queueChatText(f.session, '..', 'Salom'));
  await assert.rejects(f.queueChatText(f.session, 'c1', 'a'.repeat(4001)));
  f.logout();
  await assert.rejects(f.queueChatText(f.session, 'c1', 'Salom'));
  assert.equal(f.opens(), 0);
});

test('device identity stays stable for read receipts', async () => {
  const f = fixture();
  const first = await f.chatDeviceId();
  const second = await f.chatDeviceId();
  assert.equal(first, second);
  assert.match(first, /^device_/);
});

test('a new outbox instance can recover previously queued messages', async () => {
  const first = fixture();
  const queued = await first.queueChatText(first.session, 'c1', 'Qayta tiklash');
  const next = fixture(first.connection);
  assert.deepEqual(await next.pendingChatTexts(next.session, 'c1'), [queued]);
});
