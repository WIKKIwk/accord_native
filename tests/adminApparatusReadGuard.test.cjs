const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const station = 'apparatus:default:asset-005';
const projection = { apparatus_id: station, source_revision: 1, source_aasx_sha256: 'a'.repeat(64),
  display: { display_name: 'Pechat', catalog_order: 5 }, capabilities: {}, execution_profile: { operation: 'print', technology: 'flexographic' } };
const body = JSON.stringify([projection]);
class WorkerControlException extends Error { constructor(code, message, statusCode) { super(message); this.code = code; this.statusCode = statusCode; } }
const controls = { WorkerControlException, isCanonicalApparatusId: value => value.startsWith('apparatus:') };
function fixture(refresh = () => {}) {
  const session = { baseUrl: 'https://server.example', token: 'first' };
  const auth = { activeSessionToken: () => session.token, refreshSession: async () => { session.token = 'refreshed'; refresh(); return true; } };
  const transport = load('authorizedFetch', { './auth': auth });
  return { session, api: load('apparatusApi', { './authorizedFetch': transport, './workerControlsApi': controls }) };
}
test('omitted apparatus guard retains the legacy transport argument count and decoded model', async () => {
  let args;
  const api = load('apparatusApi', { './workerControlsApi': controls, './authorizedFetch': { authorizedFetch: async (...values) => {
    args = values; return new Response(body); } } });
  assert.equal((await api.adminApparatus({}, { limit: 200 }))[0].id, station); assert.equal(args.length, 3);
  assert.equal(args[1], '/v1/mobile/admin/apparatus?limit=200'); assert.ok(args[2].signal instanceof AbortSignal);
});
test('stale initial guard rejects before the catalog request is sent', async () => {
  const f = fixture(), previous = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return new Response(body); };
  try { await assert.rejects(f.api.adminApparatus(f.session, { beforeSend: () => { throw new Error('changed'); } }), /changed/);
    assert.equal(calls, 0); } finally { global.fetch = previous; }
});
test('catalog checks its original guard after its deferred entry microtask', async () => {
  const f = fixture(), previous = global.fetch; let current = true, calls = 0;
  global.fetch = async () => { calls++; return new Response(body); };
  try { const pending = f.api.adminApparatus(f.session, { beforeSend: () => { if (!current) throw new Error('changed'); } });
    current = false; await assert.rejects(pending, /changed/); assert.equal(calls, 0); } finally { global.fetch = previous; }
});
test('account transition during 401 refresh blocks catalog retry; same account token refresh continues', async () => {
  for (const invalidate of [false, true]) {
    let current = true; const f = fixture(() => { if (invalidate) current = false; }), previous = global.fetch, sent = [];
    global.fetch = async (_url, init) => { sent.push(new Headers(init.headers).get('authorization'));
      return sent.length === 1 ? new Response('', { status: 401 }) : new Response(body); };
    try { const pending = f.api.adminApparatus(f.session, { beforeSend: () => { if (!current) throw new Error('changed'); } });
      if (invalidate) { await assert.rejects(pending, /changed/); assert.deepEqual(sent, ['Bearer first']); }
      else { assert.equal((await pending)[0].id, station); assert.deepEqual(sent, ['Bearer first', 'Bearer refreshed']); }
    } finally { global.fetch = previous; }
  }
});
test('stale successful or error response body never publishes data or error and cannot transient-retry', { todo: 'Admin-only alternate apparatus guard is deferred; Admin entry is held and main guard is retained' }, async () => {
  for (const status of [200, 503]) {
    const f = fixture(), previous = global.fetch; let current = true, calls = 0;
    global.fetch = async () => { calls++; return { status, headers: new Headers(), text: async () => { current = false; return status === 200 ? body : '{"error":"busy"}'; } }; };
    try { await assert.rejects(f.api.adminApparatus(f.session, { retryTransient: true, beforeSend: () => { if (!current) throw new Error('changed'); } }), /changed/);
      assert.equal(calls, 1); } finally { global.fetch = previous; }
  }
});
test('a guard invalidated during the transient-retry delay prevents the second attempt', async () => {
  const f = fixture(), previous = global.fetch; let current = true, calls = 0;
  global.fetch = async () => { calls++; setTimeout(() => { current = false; }, 20); return new Response('{"error":"busy"}', { status: 503 }); };
  try { await assert.rejects(f.api.adminApparatus(f.session, { retryTransient: true, beforeSend: () => { if (!current) throw new Error('changed'); } }), /changed/);
    assert.equal(calls, 1); } finally { global.fetch = previous; }
});

test('one-shot TypeError thrown by the guard after response/body is terminal, never a transport retry', { todo: 'Admin-only alternate apparatus guard is deferred; Admin entry is held and main guard is retained' }, async () => {
  for (const failAt of ['response', 'body']) {
    const f = fixture(), previous = global.fetch, failure = new TypeError('guard failed once');
    let stage = '', calls = 0, thrown = false;
    const guard = () => { if (stage === failAt && !thrown) { thrown = true; throw failure; } };
    global.fetch = async () => { calls++; stage = 'response'; return { status: 200, headers: new Headers(), text: async () => { stage = 'body'; return body; } }; };
    try {
      await assert.rejects(f.api.adminApparatus(f.session, { retryTransient: true, beforeSend: guard }), error => error === failure);
      assert.equal(calls, 1);
      // A deliberate new public operation is independent of the failed operation's latch.
      assert.equal((await f.api.adminApparatus(f.session, { beforeSend: guard }))[0].id, station); assert.equal(calls, 2);
    } finally { global.fetch = previous; }
  }
});
test('async, rejected Promise/thenable, value-returning and non-function guards fail closed without unhandled rejection', { todo: 'Admin-only alternate apparatus guard is deferred; Admin entry is held and main guard is retained' }, async () => {
  const f = fixture(), previous = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; return new Response(body); };
  try {
    for (const beforeSend of [async () => {}, async () => { throw new Error('async guard'); }, () => Promise.reject(new Error('rejected guard')),
      () => ({ then(_yes, no) { no(new Error('thenable guard')); } }), () => true, () => null, () => 1, 42]) {
      await assert.rejects(f.api.adminApparatus(f.session, { retryTransient: true, beforeSend }), /Invalid apparatus guard/);
    }
    await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0);
    await assert.rejects(f.api.readApparatus(f.session, '/v1/mobile/admin/apparatus', true, undefined, async () => {}), /Invalid apparatus guard/);
    assert.equal(calls, 0);
  } finally { global.fetch = previous; }
});
test('valid synchronous guard preserves an opted-in transient network retry', async () => {
  const f = fixture(), previous = global.fetch; let calls = 0;
  global.fetch = async () => { if (++calls === 1) throw new TypeError('network request failed'); return new Response(body); };
  try { assert.equal((await f.api.adminApparatus(f.session, { retryTransient: true, beforeSend() {} }))[0].id, station); assert.equal(calls, 2); }
  finally { global.fetch = previous; }
});
