const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/authorizedFetch.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function transport(refresh = async () => false, join = async () => false) {
  const auth = { activeSessionToken: s => s.token, refreshSession: refresh, joinRefreshForGuardedRead: join }, m = new Module(filename, module);
  m.require = id => id === './auth' ? auth : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const session = () => ({ baseUrl: 'https://example.test', token: 'old-token' });

test('opt-in rejects false, async, throwing and malformed witnesses before any send', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0;
  global.fetch = async () => { sends++; return new Response('{}'); }; const api = transport(), a = session();
  for (const witness of [() => false, () => Promise.resolve(true), () => Promise.reject(new Error('async')), () => { throw new Error('bad'); }, null, 2]) {
    await assert.rejects(api.authorizedFetch(a, '/v1/mobile/test', {}, undefined, 100, { readWitness: witness }), /read_witness_expired/);
  }
  await tick(); assert.equal(sends, 0);
});

test('a reentrant witness cannot authorize either the inner or outer request', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0, nested, entered = false;
  global.fetch = async () => { sends++; return new Response('{}'); }; const api = transport(), a = session();
  const witness = () => { if (!entered) { entered = true; nested = api.authorizedFetch(a, '/v1/mobile/nested', {}, undefined, 100, { readWitness: witness });
    void nested.catch(() => {}); } return true; };
  await assert.rejects(api.authorizedFetch(a, '/v1/mobile/test', {}, undefined, 100, { readWitness: witness }), /read_witness_expired/);
  await assert.rejects(nested, /read_witness_expired/); assert.equal(sends, 0);
});

test('every supported redirect hop checks the witness after the response and body await', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  for (const status of [301, 302, 303, 307, 308]) for (const destination of ['/v1/mobile/next', 'https://other.test/next']) {
    let valid = true, sends = 0; const delayed = deferred();
    global.fetch = async () => { sends++; return delayed.promise; };
    const request = transport().authorizedFetch(session(), '/v1/mobile/test', {}, undefined, 100, { readWitness: () => valid });
    assert.equal(sends, 1); valid = false; delayed.resolve(new Response('', { status, headers: { location: destination } }));
    await assert.rejects(request, /read_witness_expired/); assert.equal(sends, 1, `${status}: ${destination}`);
  }
});

test('request argument getters cannot revoke the witness after its final pre-send check', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let valid = true, sends = 0, headerReads = 0;
  global.fetch = async () => { sends++; return new Response('{}'); };
  const init = { get headers() { if (++headerReads === 2) valid = false; return {}; } };
  await assert.rejects(transport().authorizedFetch(session(), '/v1/mobile/test', init, undefined, 100, { readWitness: () => valid }), /read_witness_expired/);
  assert.equal(sends, 0);
});

test('a timed-out guarded GET cannot issue a late redirect even if the witness remains current', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const delayed = deferred(); let sends = 0;
  global.fetch = async () => { sends++; return delayed.promise; };
  const request = transport().authorizedFetch(session(), '/v1/mobile/test', {}, undefined, 2, { readWitness: () => true });
  await assert.rejects(request, error => error.name === 'TimeoutError');
  delayed.resolve(new Response('', { status: 302, headers: { location: '/v1/mobile/next' } })); await tick(); await tick();
  assert.equal(sends, 1);
});

test('a late 401 after invalidation never starts shared refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const delayed = deferred(); let valid = true, refreshes = 0;
  global.fetch = async () => delayed.promise;
  const request = transport(async () => { refreshes++; return true; }).authorizedFetch(session(), '/v1/mobile/test', {}, undefined, 100, { readWitness: () => valid });
  valid = false; delayed.resolve(new Response('{}', { status: 401 }));
  await assert.rejects(request, /read_witness_expired/); assert.equal(refreshes, 0);
});

test('valid guarded reads retain redirect, refresh and 401-retry behavior', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = [], a = session(); let refreshes = 0, preflights = 0;
  global.fetch = async (url, init) => { calls.push({ url, token: init.headers.get('authorization') });
    if (calls.length === 1 || calls.length === 3) return new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } });
    return new Response('{}', { status: calls.length === 2 ? 401 : 200 }); };
  const api = transport(undefined, async (_session, _token, check) => { refreshes++; check(); a.token = 'new-token'; return true; });
  const response = await api.authorizedFetch(a, '/v1/mobile/test', {}, () => { preflights++; }, 100, { readWitness: () => true });
  assert.equal(response.status, 200); assert.equal(refreshes, 1); assert.equal(preflights, 2);
  assert.deepEqual(calls.map(call => call.token), ['Bearer old-token', 'Bearer old-token', 'Bearer new-token', 'Bearer new-token']);
});

test('legacy callers retain their original beforeSend counts across redirects and 401 retry', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = [], a = session(); let refreshes = 0, preflights = 0;
  global.fetch = async (url, init) => { calls.push({ url, token: init.headers.get('authorization') });
    if (calls.length === 1 || calls.length === 3) return new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } });
    return new Response('{}', { status: calls.length === 2 ? 401 : 200 }); };
  const api = transport(async (...args) => { assert.equal(args.length, 2); refreshes++; a.token = 'new-token'; return true; });
  const response = await api.authorizedFetch(a, '/v1/mobile/test', {}, () => { preflights++; }, 100);
  assert.equal(response.status, 200); assert.equal(refreshes, 1); assert.equal(preflights, 2);
  assert.deepEqual(calls.map(call => call.token), ['Bearer old-token', 'Bearer old-token', 'Bearer new-token', 'Bearer new-token']);
});

test('the opt-in witness is read-only and cannot dispatch or mark a mutation', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0;
  global.fetch = async () => { sends++; return new Response('{}'); }; const api = transport(), before = api.currentQueueSnapshotReadEpoch();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    await assert.rejects(api.authorizedFetch(session(), '/v1/mobile/test', { method }, undefined, 100, { readWitness: () => true }), /guarded_reads_only/);
  }
  assert.equal(sends, 0); assert.equal(api.currentQueueSnapshotReadEpoch(), before);
});

test('legacy fetch is looked up before RequestInit getters, matching the original expression', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = [];
  global.fetch = async () => { calls.push('original'); return new Response('{}'); };
  const init = { get signal() { global.fetch = async () => { calls.push('replacement'); return new Response('{}'); }; return undefined; } };
  await transport().authorizedFetch(session(), '/v1/mobile/test', init); assert.deepEqual(calls, ['original']);
});

test('unaided guarded 401 returns an explicit refresh-unavailable error without legacy refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let refreshes = 0, joins = 0;
  global.fetch = async () => new Response('{}', { status: 401 });
  const api = transport(async () => { refreshes++; return true; }, async (_session, _token, check) => { joins++; check(); return false; });
  await assert.rejects(api.authorizedFetch(session(), '/v1/mobile/test', {}, undefined, 100, { readWitness: () => true }),
    error => error.name === 'GuardedReadRefreshUnavailable' && error.code === 'guarded_read_refresh_unavailable');
  assert.equal(refreshes, 0); assert.equal(joins, 1);
});

test('a changing method getter cannot turn a guarded GET into a mutation', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let reads = 0, method;
  global.fetch = async (_url, init) => { method = init.method; return new Response('{}'); };
  const init = { get method() { return ++reads <= 1 ? 'GET' : 'POST'; } };
  await transport().authorizedFetch(session(), '/v1/mobile/test', init, undefined, 100, { readWitness: () => true });
  assert.equal(method, 'GET'); assert.equal(reads, 2);
});

test('invalidation while a redirect body drains prevents the next hop', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const body = deferred(); let valid = true, sends = 0, draining = false;
  global.fetch = async () => { sends++; return { status: 302, headers: new Headers({ location: '/v1/mobile/next' }), body: {},
    arrayBuffer: () => { draining = true; return body.promise; } }; };
  const request = transport().authorizedFetch(session(), '/v1/mobile/test', {}, undefined, 100, { readWitness: () => valid });
  for (let i = 0; i < 10 && !draining; i++) await tick(); assert.equal(draining, true); valid = false; body.resolve(new ArrayBuffer(0));
  await assert.rejects(request, /read_witness_expired/); assert.equal(sends, 1);
});

test('guarded redirects preserve same-origin credentials and strip them permanently across origins', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, headers: new Headers(init.headers) });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: '/v1/mobile/next' } });
    if (calls.length === 2) return new Response(null, { status: 307, headers: { location: 'https://other.test/path' } });
    if (calls.length === 3) return new Response(null, { status: 308, headers: { location: 'https://example.test/v1/mobile/back' } });
    return new Response('{}'); };
  const response = await transport().authorizedFetch(session(), '/v1/mobile/test', { headers: { Cookie: 'x', 'Proxy-Authorization': 'y' } },
    undefined, 100, { readWitness: () => true });
  assert.equal(response.status, 200); assert.equal(calls.length, 4); assert.equal(calls[1].headers.get('authorization'), 'Bearer old-token');
  assert.equal(calls[1].headers.get('cookie'), 'x'); assert.equal(calls[1].headers.get('proxy-authorization'), 'y');
  for (const call of calls.slice(2)) for (const header of ['authorization', 'cookie', 'proxy-authorization']) assert.equal(call.headers.get(header), null);
});
