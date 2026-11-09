const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let i = 0; i < 100 && !predicate(); i++) await tick(); assert.equal(!!predicate(), true, 'expected asynchronous step'); }
function authHarness(...args) {
  const filename = path.join(root, 'tests/authLoginRollback.test.cjs'), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  m._compile(fs.readFileSync(filename, 'utf8').split("test('failed login retains")[0] + '\nmodule.exports = { auth };', filename);
  return m.exports.auth(...args);
}
function transport(auth) {
  const filename = path.join(root, 'src/authorizedFetch.ts'), m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = id => id === './auth' ? auth : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
function network() {
  let logins = 0, reads = 0; const calls = [];
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/login')) return new Response(JSON.stringify({ token: `token-${++logins}`,
      profile: { role: 'qolipchi', ref: 'one' }, capabilities: ['qolip.manage'] }), { status: 200 });
    reads++; const token = init.headers.get('authorization'); calls.push(token);
    return new Response('{}', { status: token === 'Bearer token-1' ? 401 : 200 });
  };
  return { get logins() { return logins; }, get reads() { return reads; }, calls };
}
const guarded = (api, session, witness) => api.authorizedFetch(session, '/v1/mobile/test', {}, undefined, 1000, { readWitness: witness });
const unavailable = error => error.name === 'GuardedReadRefreshUnavailable' && error.code === 'guarded_read_refresh_unavailable';

test('unaided guarded 401 never starts saved-account reauthentication or publication', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), auth = authHarness({});
  const session = await auth.login('https://example.test', 'one', 'code'), store = auth.testAccountStore;
  const witness = auth.captureSessionWitness(session), originalHash = store.sha256; let refreshHashCalls = 0;
  store.sha256 = async id => { if (net.logins > 1) refreshHashCalls++; return originalHash(id); };
  await assert.rejects(guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness)), unavailable);
  assert.equal(net.logins, 1); assert.equal(net.reads, 1); assert.equal(refreshHashCalls, 0);
  assert.equal(session.token, 'token-1'); assert.equal((await store.sessionFor(store.activeAccountId)).token, 'token-1');
});

test('unaided guarded 401 starts no iOS token, metadata or chunk writes', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), values = new Map(), writes = [];
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => { values.delete(key); },
    setItemAsync: async (key, value) => { writes.push(key); values.set(key, value); } };
  const auth = authHarness(secure, 'ios', undefined, true), session = await auth.login('https://example.test', 'one', 'code'); writes.length = 0;
  const witness = auth.captureSessionWitness(session);
  await assert.rejects(guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness)), unavailable);
  assert.equal(net.logins, 1); assert.deepEqual(writes, []); assert.equal(session.token, 'token-1'); assert.equal(values.get('accord_v4_token'), 'token-1');
});

test('a revoked guarded joiner neither cancels nor diverges an independent saved-account refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), auth = authHarness({});
  const session = await auth.login('https://example.test', 'one', 'code'), store = auth.testAccountStore, entered = deferred(), release = deferred();
  const originalHash = store.sha256; let blocked = false, valid = true, joins = 0;
  store.sha256 = async id => { if (net.logins === 2 && !blocked) { blocked = true; entered.resolve(); await release.promise; } return originalHash(id); };
  const legacy = auth.refreshSession(session, 'token-1'); await entered.promise;
  const originalJoin = auth.joinRefreshForGuardedRead; auth.joinRefreshForGuardedRead = (...args) => { joins++; return originalJoin(...args); };
  const request = guarded(transport(auth), session, () => valid), rejected = assert.rejects(request, /read_witness_expired/);
  await until(() => joins === 1); valid = false; release.resolve();
  assert.equal(await legacy, true); await rejected; assert.equal(net.logins, 2); assert.equal(net.reads, 1);
  assert.equal(session.token, 'token-2'); assert.equal((await store.sessionFor(store.activeAccountId)).token, 'token-2');
});

test('a revoked joiner does not stop an independent iOS refresh at a paused native token write', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), values = new Map(), writes = [];
  const entered = deferred(), release = deferred(); let block = false, valid = true, joins = 0;
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => { values.delete(key); },
    setItemAsync: async (key, value) => { writes.push({ key, valid }); if (block && key === 'accord_v4_token') { block = false; entered.resolve(); await release.promise; }
      values.set(key, value); } };
  const auth = authHarness(secure, 'ios', undefined, true), session = await auth.login('https://example.test', 'one', 'code'); writes.length = 0; block = true;
  const legacy = auth.refreshSession(session, 'token-1'); await entered.promise;
  const originalJoin = auth.joinRefreshForGuardedRead; auth.joinRefreshForGuardedRead = (...args) => { joins++; return originalJoin(...args); };
  const request = guarded(transport(auth), session, () => valid), rejected = assert.rejects(request, /read_witness_expired/);
  await until(() => joins === 1); valid = false; release.resolve();
  assert.equal(await legacy, true); await rejected; assert.equal(net.logins, 2); assert.equal(net.reads, 1);
  assert.equal(session.token, 'token-2'); assert.equal(values.get('accord_v4_token'), 'token-2');
  assert.ok(writes.some(write => write.valid === false), 'those later writes belong to the independent legacy refresh');
});

test('two distinct guarded lifetimes join one legacy refresh but only the current one retries', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), auth = authHarness({});
  const session = await auth.login('https://example.test', 'one', 'code'), store = auth.testAccountStore, entered = deferred(), release = deferred();
  const originalHash = store.sha256; let blocked = false, firstCurrent = true, joins = 0;
  store.sha256 = async id => { if (net.logins === 2 && !blocked) { blocked = true; entered.resolve(); await release.promise; } return originalHash(id); };
  const legacy = auth.refreshSession(session, 'token-1'); await entered.promise;
  const originalJoin = auth.joinRefreshForGuardedRead; auth.joinRefreshForGuardedRead = (...args) => { joins++; return originalJoin(...args); };
  const api = transport(auth), first = guarded(api, session, () => firstCurrent), rejected = assert.rejects(first, /read_witness_expired/);
  const second = guarded(api, session, () => true); await until(() => joins === 2); firstCurrent = false; release.resolve();
  assert.equal(await legacy, true); await rejected; assert.equal((await second).status, 200);
  assert.equal(net.logins, 2); assert.equal(net.reads, 3); assert.deepEqual(net.calls, ['Bearer token-1', 'Bearer token-1', 'Bearer token-2']);
});

test('guarded 401 uses a token already rotated by an independent refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), auth = authHarness({});
  const session = await auth.login('https://example.test', 'one', 'code'), delayed = deferred(); let reads = 0;
  const baseFetch = global.fetch; global.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/login')) return baseFetch(url, init);
    if (++reads === 1) return delayed.promise; return new Response('{}', { status: init.headers.get('authorization') === 'Bearer token-2' ? 200 : 401 });
  };
  const witness = auth.captureSessionWitness(session), request = guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness));
  await until(() => reads === 1); assert.equal(await auth.refreshSession(session, 'token-1'), true);
  delayed.resolve(new Response('{}', { status: 401 })); assert.equal((await request).status, 200); assert.equal(reads, 2); assert.equal(net.logins, 2);
});

test('a reentrant unguarded refresh is a single legacy flight, never duplicated by a guarded reader', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const auth = authHarness({}), net = network();
  const session = await auth.login('https://example.test', 'one', 'code'), response = deferred(), baseFetch = global.fetch; let reauth = 0, legacy;
  global.fetch = async (url, init) => { if (String(url).endsWith('/auth/login')) { reauth++; return response.promise; } return baseFetch(url, init); };
  const witness = () => { if (!legacy) legacy = auth.refreshSession(session, 'token-1'); return true; };
  const request = guarded(transport(auth), session, witness); await until(() => reauth === 1 && net.reads === 1);
  response.resolve(new Response(JSON.stringify({ token: 'token-2', profile: { role: 'qolipchi', ref: 'one' }, capabilities: ['qolip.manage'] }), { status: 200 }));
  assert.equal(await legacy, true); assert.equal((await request).status, 200); assert.equal(reauth, 1); assert.equal(net.reads, 2);
});

test('a guarded-only 401 cannot publish a changed-scope saved account', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let logins = 0;
  global.fetch = async url => String(url).endsWith('/auth/login') ? new Response(JSON.stringify({ token: `token-${++logins}`,
    profile: { role: 'qolipchi', ref: 'one' }, capabilities: logins === 1 ? ['qolip.manage'] : ['new.access'] }), { status: 200 })
    : new Response('{}', { status: 401 });
  const auth = authHarness({}), session = await auth.login('https://example.test', 'one', 'code'), witness = auth.captureSessionWitness(session);
  await assert.rejects(guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness)), unavailable);
  const saved = await auth.testAccountStore.sessionFor(auth.testAccountStore.activeAccountId);
  assert.equal(logins, 1); assert.equal(session.token, 'token-1'); assert.equal(saved.token, 'token-1');
  assert.deepEqual(session.capabilities, ['qolip.manage']); assert.deepEqual(saved.account.profile.capabilities, ['qolip.manage']);
});

test('an independent changed-scope legacy refresh completes for itself while a guarded joiner closes', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let logins = 0, joins = 0, blocked = false;
  global.fetch = async url => String(url).endsWith('/auth/login') ? new Response(JSON.stringify({ token: `token-${++logins}`,
    profile: { role: 'qolipchi', ref: 'one' }, capabilities: logins === 1 ? ['qolip.manage'] : ['new.access'] }), { status: 200 })
    : new Response('{}', { status: 401 });
  const auth = authHarness({}), session = await auth.login('https://example.test', 'one', 'code'), store = auth.testAccountStore;
  const witness = auth.captureSessionWitness(session), entered = deferred(), release = deferred(), originalHash = store.sha256;
  store.sha256 = async id => { if (logins === 2 && !blocked) { blocked = true; entered.resolve(); await release.promise; } return originalHash(id); };
  const legacy = auth.refreshSession(session, 'token-1'); await entered.promise;
  const originalJoin = auth.joinRefreshForGuardedRead; auth.joinRefreshForGuardedRead = (...args) => { joins++; return originalJoin(...args); };
  const request = guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness)), rejected = assert.rejects(request, /read_witness_expired/);
  await until(() => joins === 1); release.resolve(); assert.equal(await legacy, true); await rejected;
  const saved = await store.sessionFor(store.activeAccountId);
  assert.equal(logins, 2); assert.equal(session.token, 'token-2'); assert.equal(saved.token, 'token-2');
  assert.deepEqual(session.capabilities, ['new.access']); assert.deepEqual(saved.account.profile.capabilities, ['new.access']);
});

test('an unaided guarded failure does not suppress a later ordinary legacy refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const net = network(), auth = authHarness({});
  const session = await auth.login('https://example.test', 'one', 'code'), witness = auth.captureSessionWitness(session);
  await assert.rejects(guarded(transport(auth), session, () => auth.isSessionWitnessCurrent(witness)), unavailable);
  assert.equal(net.logins, 1); assert.equal(await auth.refreshSession(session, 'token-1'), true);
  assert.equal(net.logins, 2); assert.equal(session.token, 'token-2'); assert.equal(auth.isSessionWitnessCurrent(witness), true);
});
