const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function api(refresh = async () => false) {
  const filename = path.resolve(__dirname, '../src/authorizedFetch.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === './auth' ? { activeSessionToken: s => s.token, refreshSession: refresh } : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const session = { baseUrl: 'https://example.test', token: 'old' };

test('an individual authorized attempt times out without retrying a mutation', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = () => { calls++; return new Promise(() => {}); };
  try {
    await assert.rejects(api().authorizedFetch(session, '/v1/mobile/profile', { method: 'PUT' }, undefined, 2), e => e.name === 'TimeoutError');
    assert.equal(calls, 1);
  } finally { global.fetch = original; }
});

test('each authorized retry gets its own timeout and multipart may opt out', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return { status: calls === 1 ? 401 : 200 }; };
  try {
    const transport = api(async s => { s.token = 'new'; return true; });
    assert.equal((await transport.authorizedFetch({ ...session }, '/v1/mobile/profile', {}, undefined, 100)).status, 200);
    assert.equal(calls, 2);
    global.fetch = async () => new Promise(resolve => setTimeout(() => resolve({ status: 200 }), 3));
    assert.equal((await transport.authorizedFetch({ ...session }, '/v1/mobile/profile/avatar', {}, undefined, null)).status, 200);
  } finally { global.fetch = original; }
});

test('the request deadline includes reading the full response body', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(new ReadableStream({ start(controller) {
    setTimeout(() => { controller.enqueue(new TextEncoder().encode('{"ok":true}')); controller.close(); }, 30);
  } }), { headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(api().authorizedFetch({ ...session }, '/v1/mobile/profile', {}, undefined, 2), e => e.name === 'TimeoutError');
    const response = await api().authorizedFetch({ ...session }, '/v1/mobile/profile', {}, undefined, 100);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('content-type'), 'application/json');
  } finally { global.fetch = original; }
});

test('streamed uploads may receive headers before their response body completes', async () => {
  const original = global.fetch; let finish;
  global.fetch = async () => new Response(new ReadableStream({ start(controller) { finish = () => {
    controller.enqueue(new TextEncoder().encode('done')); controller.close();
  }; } }));
  try {
    const response = await api().authorizedFetch({ ...session }, '/v1/mobile/profile/avatar', { method: 'POST' }, undefined, null);
    finish(); assert.equal(await response.text(), 'done');
  } finally { global.fetch = original; }
});
