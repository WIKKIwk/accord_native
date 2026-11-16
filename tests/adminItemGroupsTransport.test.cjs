const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const dart = load('admin/dartJsonString.ts'), model = load('admin/itemGroupModel.ts', { './dartJsonString': dart });
const exception = load('shared/mobileApiException.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture() {
  let current = true, refreshes = 0, joins = 0, onRefresh = () => {};
  const session = { baseUrl: 'https://server.example', token: 'first' }, witness = () => current;
  const guard = () => { if (!current) throw new Error('retired'); };
  const transport = load('authorizedFetch.ts', { './auth': { activeSessionToken: () => session.token,
    refreshSession: async () => { refreshes++; session.token = 'second'; onRefresh(); return true; }, joinRefreshForGuardedRead: async () => { joins++; return false; } } });
  const api = load('admin/itemGroupApi.ts', { '../authorizedFetch': transport, '../gscale/gscaleAdminApi': {}, '../shared/mobileApiException': exception,
    './dartJsonString': dart, './itemGroupModel': model });
  const items = load('admin/itemGroupsItemsApi.ts', { '../authorizedFetch': transport, './dartJsonString': dart, '../shared/catalogApi': { supplierItemFromJson: value => value } });
  return { session, api, items, guard, witness, retire: () => { current = false; }, refresh: callback => { onRefresh = callback; }, counts: () => ({ refreshes, joins }) };
}
for (const status of [302, 401]) test(`original group read witness blocks retired ${status} continuation`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const f = fixture(), response = deferred(); let sends = 0;
  global.fetch = async () => { sends++; return response.promise; };
  const pending = f.api.adminItemGroups(f.session, f.guard, f.witness), rejected = assert.rejects(pending); await tick(); f.retire();
  response.resolve(new Response('', { status, headers: status === 302 ? { location: '/v1/mobile/next' } : {} })); await rejected;
  assert.equal(sends, 1); assert.deepEqual(f.counts(), { refreshes: 0, joins: 0 });
});
test('tree read rejects a stale body and items request carries exact source 40-row window', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), body = deferred();
  global.fetch = async () => { const response = new Response('[]', { status: 200 }); response.json = () => body.promise; return response; };
  const pending = f.api.adminItemGroupTree(f.session, f.guard, f.witness), rejected = assert.rejects(pending); await tick(); await tick(); f.retire(); body.resolve([]); await rejected;
  const g = fixture(); let request;
  global.fetch = async url => { request = new URL(url); return new Response('[{"code":"A"}]', { status: 200 }); };
  assert.deepEqual(await g.items.itemGroupsItemsPage(g.session, ' Group ', 40, g.guard, g.witness), [{ code: 'A' }]);
  assert.equal(request.pathname, '/v1/mobile/admin/items'); assert.equal(request.searchParams.get('group'), 'Group'); assert.equal(request.searchParams.get('limit'), '40'); assert.equal(request.searchParams.get('offset'), '40');
});
for (const operation of ['create', 'move']) test(`${operation} rechecks original owner before a 401 retry`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(); f.refresh(f.retire); let sends = 0;
  global.fetch = async () => { sends++; return new Response('', { status: 401 }); };
  const promise = operation === 'create' ? f.api.adminCreateItemGroup(f.session, 'New', 'Root', true, f.guard) : f.api.adminMoveItemGroupParent(f.session, 'A', 'Root', f.guard);
  await assert.rejects(promise, /retired/); assert.equal(sends, 1); assert.equal(f.counts().refreshes, 1);
});
test('valid create performs one token-only retry and preserves exact body fields', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture(), requests = [];
  global.fetch = async (_url, init) => { requests.push(init); return requests.length === 1 ? new Response('', { status: 401 }) : new Response('{"name":"New","is_group":true}', { status: 200 }); };
  assert.equal((await f.api.adminCreateItemGroup(f.session, ' New ', ' Root ', true, f.guard)).name, 'New');
  assert.deepEqual(requests.map(init => new Headers(init.headers).get('authorization')), ['Bearer first', 'Bearer second']);
  assert.deepEqual(JSON.parse(requests[1].body), { name: ' New ', parent: ' Root ', is_group: true });
});
for (const operation of ['create', 'move', 'items']) test(`${operation} checks captured authority after successful and failed body settlement`, async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  for (const fails of [false, true]) {
    const f = fixture();
    global.fetch = async () => {
      const response = new Response(operation === 'items' ? '[]' : '{}', { status: 200 });
      response.json = async () => { f.retire(); if (fails) throw new SyntaxError('bad body'); return operation === 'items' ? [] : {}; }; return response;
    };
    const action = operation === 'create' ? f.api.adminCreateItemGroup(f.session, 'New', 'Root', true, f.guard) : operation === 'move'
      ? f.api.adminMoveItemGroupParent(f.session, 'A', 'Root', f.guard) : f.items.itemGroupsItemsPage(f.session, 'A', 0, f.guard, f.witness);
    await assert.rejects(action, /retired/);
  }
});
test('guarded mutation rechecks captured authority after model conversion and a rejected transport', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); const f = fixture();
  global.fetch = async () => { const response = new Response('{}', { status: 200 }); response.json = async () => ({ get name() { f.retire(); return 'New'; } }); return response; };
  await assert.rejects(f.api.adminCreateItemGroup(f.session, 'New', 'Root', true, f.guard), /retired/);
  const g = fixture(); global.fetch = async () => { g.retire(); throw new TypeError('offline'); };
  await assert.rejects(g.api.adminMoveItemGroupParent(g.session, 'A', 'Root', g.guard), /retired/);
});
