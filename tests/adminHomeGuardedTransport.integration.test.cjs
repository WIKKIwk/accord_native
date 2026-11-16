const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const summary = { total_suppliers: 4, active_suppliers: 3, blocked_suppliers: 1 };
const response = () => new Response(JSON.stringify(summary), { status: 200 });
function fixture() {
  let current = true, joins = 0, refreshes = 0, join = async () => false;
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'same' },
    capabilities: ['admin.access', 'party.supplier.read'] };
  const auth = { activeSessionToken: () => session.token,
    refreshSession: async () => { refreshes++; return false; },
    joinRefreshForGuardedRead: async (...args) => { joins++; return join(...args); } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminSupplierSummary', { '../authorizedFetch': transport });
  const reader = load('admin/adminHomeSummaryReader', { '../auth': auth, '../sessionReadScope': load('sessionReadScope'),
    '../shared/profileSessionGuard': load('shared/profileSessionGuard'),
    './adminHomeModel': { adminHomeCanLoadSummary: value => value.capabilities.includes('party.supplier.read') }, './adminSupplierSummary': api });
  return { session, api, read: reader.adminHomeSummaryReader(session, () => current),
    reader: witness => reader.adminHomeSummaryReader(session, witness), retire: () => { current = false; },
    restore: () => { current = true; }, onJoin: callback => { join = callback; }, counts: () => ({ joins, refreshes }) };
}

for (const status of [302, 401]) {
  test(`original Home lifetime retires before ${status === 302 ? 'a redirect hop' : '401 recovery'} dispatch`, async t => {
    const original = global.fetch; t.after(() => { global.fetch = original; });
    const f = fixture(), first = deferred(); let sends = 0;
    global.fetch = async () => { sends++; return first.promise; };
    const pending = f.read(); await tick(); assert.equal(sends, 1); f.retire();
    first.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/redirected-summary' } : {} }));
    await assert.rejects(pending, /session changed|witness_expired/);
    assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
    f.restore(); await assert.rejects(f.read(), /session changed/); assert.equal(sends, 1);
  });
}

test('Home 401 without an independent refresh fails without initiating login', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  await assert.rejects(f.read(), error => error.code === 'guarded_read_refresh_unavailable');
  assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});

test('a joined refresh keeps the original Home witness and retries exactly once with the new token', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), requests = [];
  f.onJoin(async (session, failedToken, check) => { check(); assert.equal(failedToken, 'first'); session.token = 'second'; check(); return true; });
  global.fetch = async (url, init) => {
    requests.push({ url, token: new Headers(init.headers).get('authorization'), redirect: init.redirect, credentials: init.credentials });
    return requests.length === 1 ? new Response('', { status: 401 }) : response();
  };
  assert.deepEqual(await f.read(), summary);
  assert.deepEqual(requests.map(row => row.token), ['Bearer first', 'Bearer second']);
  assert.ok(requests.every(row => row.url === 'https://server.example/v1/mobile/admin/suppliers/summary' && row.redirect === 'manual' && row.credentials === 'omit'));
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});

test('a Home lifetime lost while joining refresh prevents the retry request', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), refresh = deferred(); let sends = 0;
  f.onJoin(() => refresh.promise);
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const pending = f.read(); await tick(); assert.equal(f.counts().joins, 1); f.retire();
  f.session.token = 'second'; refresh.resolve(true); await assert.rejects(pending); assert.equal(sends, 1);
});

test('a current cross-origin GET redirect strips the bearer token', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), tokens = [];
  global.fetch = async (_url, init) => {
    tokens.push(new Headers(init.headers).get('authorization'));
    return tokens.length === 1 ? new Response('', { status: 302, headers: { location: 'https://public.example/summary' } }) : response();
  };
  assert.deepEqual(await f.read(), summary); assert.deepEqual(tokens, ['Bearer first', null]);
});

test('scope or witness loss during body parsing rejects success and parse errors before store settlement', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  for (const outcome of ['success', 'parse-error']) for (const invalidate of ['witness', 'scope']) {
    const f = fixture();
    global.fetch = async () => ({ status: 200, headers: new Headers(),
      clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
      json: async () => {
        if (invalidate === 'witness') f.retire(); else f.session.capabilities = ['admin.access'];
        if (outcome === 'parse-error') throw new SyntaxError('bad body');
        return summary;
      } });
    await assert.rejects(f.read(), /session changed/);
  }
});

test('malformed asynchronous and reentrant Home witnesses never authorize a request', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0;
  global.fetch = async () => { sends++; return response(); };
  for (const witness of [() => Promise.resolve(true), () => Promise.reject(new Error('invalid async witness')), () => 1, () => null]) {
    const f = fixture(); await assert.rejects(f.reader(witness)(), /session changed/);
  }
  const f = fixture(); let read;
  read = f.reader(() => { void read().catch(() => {}); return true; });
  await assert.rejects(read(), /session changed/); await tick(); assert.equal(sends, 0);
});

test('direct supplier summary callers preserve legacy 401 refresh behavior without a read witness', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  await assert.rejects(f.api.adminSupplierSummary(f.session), /Admin supplier summary failed/);
  assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 1 });
});
