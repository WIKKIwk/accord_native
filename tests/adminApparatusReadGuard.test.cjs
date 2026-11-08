const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
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
test('stale successful or error response body never publishes data or error and cannot transient-retry', async () => {
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
