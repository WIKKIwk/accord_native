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
  const { loadChatConversations } = loadTs('chatApi.ts', {
    './auth': { activeSessionToken: () => active ? session.token : null },
    './authorizedFetch': { authorizedFetch: async (...args) => { calls.push(args); return handler(); } },
    './chatModel': loadTs('chatModel.ts'),
  });
  return { session, calls, loadChatConversations, logout: () => { active = false; } };
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
