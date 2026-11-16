const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const routes = load('shared/appRoutes'), scope = load('sessionReadScope'), parser = load('shared/notificationApi', { '../authorizedFetch': {} });
const profileGuard = load('shared/profileSessionGuard');
const guards = load('admin/adminProductionRequest', { '../authorizedFetch': {}, '../shared/mobileApiException': {}, '../workerControlsApi': {} });
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; return { promise: new Promise(yes => { resolve = yes; }), resolve: value => resolve(value) }; };
function fixture() {
  const session = { baseUrl: 'https://server.example', token: 'first', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access', 'admin.activity.read'] };
  let current = true, joins = 0, refreshes = 0, join = async () => false;
  const auth = { activeSessionToken: value => value.token, refreshSession: async () => { refreshes++; return false; },
    joinRefreshForGuardedRead: async (...args) => { joins++; return join(...args); } };
  const transport = load('authorizedFetch', { './auth': auth });
  const api = load('admin/adminActivityApi', { '../authorizedFetch': transport, '../shared/notificationApi': parser, './adminProductionRequest': guards });
  const reader = load('admin/adminActivityReader', { '../auth': auth, '../sessionReadScope': scope, '../shared/appRoutes': routes,
    '../shared/profileSessionGuard': profileGuard, './adminActivityApi': api });
  return { session, read: reader.adminActivityReader(session, () => current), retire: () => { current = false; },
    restore: () => { current = true; }, readWith: witness => reader.adminActivityReader(session, witness),
    counts: () => ({ joins, refreshes }), onJoin: callback => { join = callback; } };
}
for (const status of [302, 401]) test(`Activity original witness prevents a retired ${status} continuation`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const f = fixture(), response = deferred(); let sends = 0;
  global.fetch = async () => { sends++; return response.promise; };
  const pending = f.read(), rejected = assert.rejects(pending); await tick(); f.retire();
  response.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} }));
  await rejected; assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 0, refreshes: 0 });
});
test('Activity 401 only joins an independent refresh and never initiates credential refresh', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); let sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  await assert.rejects(f.read(), error => error.code === 'guarded_read_refresh_unavailable');
  assert.equal(sends, 1); assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});
test('Activity can retry after independent same-session token refresh while its original witness is current', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), headers = [];
  f.onJoin(async session => { session.token = 'second'; return true; });
  global.fetch = async (_url, init) => { headers.push(new Headers(init.headers).get('authorization')); return headers.length === 1
    ? new Response('', { status: 401 }) : new Response('[{"id":"one","supplier_name":"Vendor"}]', { status: 200 }); };
  assert.equal((await f.read())[0].supplier_name, 'Vendor'); assert.deepEqual(headers, ['Bearer first', 'Bearer second']);
  assert.deepEqual(f.counts(), { joins: 1, refreshes: 0 });
});
test('Activity retirement during joined refresh prevents the second send', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), joined = deferred(); let sends = 0;
  f.onJoin(() => joined.promise); global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const pending = f.read(), rejected = assert.rejects(pending); await tick(); await tick();
  assert.equal(f.counts().joins, 1); f.retire(); f.session.token = 'second'; joined.resolve(true);
  await rejected; assert.equal(sends, 1);
});
test('Activity retains the original witness through response JSON parsing', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), body = deferred(); let parsing = false;
  global.fetch = async () => { const response = new Response('[]', { status: 200 }); response.json = () => { parsing = true; return body.promise; }; return response; };
  const pending = f.read(), rejected = assert.rejects(pending); await tick(); await tick(); assert.equal(parsing, true);
  f.retire(); body.resolve([{ id: 'old' }]); await rejected;
});

test('Activity reader never revives an observed retired witness or restored scope', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0;
  global.fetch = async () => { sends++; return new Response('[]', { status: 200 }); };
  const f = fixture(); f.retire(); await assert.rejects(f.read(), /session changed/);
  f.restore(); await assert.rejects(f.read(), /session changed/); assert.equal(sends, 0);
  const g = fixture(), capabilities = [...g.session.capabilities];
  g.session.capabilities = ['admin.access']; await assert.rejects(g.read(), /session changed/);
  g.session.capabilities = capabilities; await assert.rejects(g.read(), /session changed/); assert.equal(sends, 0);
  // A genuinely new owner can capture the restored scope.
  assert.deepEqual(await g.readWith(() => true)(), []); assert.equal(sends, 1);
});

test('Activity rejects async, truthy nonboolean and reentrant witnesses before any network send', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); let sends = 0;
  global.fetch = async () => { sends++; return new Response('[]', { status: 200 }); };
  const f = fixture();
  for (const callback of [() => Promise.resolve(true), () => Promise.reject(new Error('async witness')),
    () => 1, () => ({}), () => null, null]) {
    await assert.rejects(f.readWith(callback)(), /session changed/);
  }
  let read;
  read = f.readWith(() => { void read().catch(() => {}); return true; });
  await assert.rejects(read()); await tick(); assert.equal(sends, 0);
});
