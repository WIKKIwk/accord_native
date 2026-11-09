const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const pallet = { code: 'QP-00012', warehouse: 'W', locked: false, archived: false, revision: 4, item_count: 1 };
const mold = { qolip_code: 'Q-ONE', warehouse: 'W' };
const archive = { id: 'entry', kind: 'qolip', code: 'Q-ONE', warehouse: 'W', archived_at: '2026-11-01', snapshot: mold };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const account = { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'A', role: 'qolipchi' }, capabilities: ['qolip.manage'] };
  let active = account, valid = true, run = true, refreshes = 0; const listeners = new Set(), cache = new Map(), applied = [];
  const overrides = {
    'auth.ts': { activeSessionToken: value => value === active ? value.token : null, refreshSession: async () => { refreshes++; return true; }, joinRefreshForGuardedRead: async (_session, _token, check) => { check(); return false; } },
    'sessionReadScope.ts': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref, value.profile.role]) },
    'workerControlsApi.ts': { WorkerControlException: class WorkerControlException extends Error {} },
    'shared/qolipCatalogRuntime.ts': { qolipCatalogRuntimeFor: () => ({ applyResponse: (...args) => applied.push(args) }) },
  };
  function load(name) {
    if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = key => key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : key === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(key);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  const boundary = { current: () => valid, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
  return { account, boundary, api: load('qolip/qolipStorageApi.ts'), load, applied, refreshes: () => refreshes,
    guard: () => run, stop: () => { run = false; }, resume: () => { run = true; },
    expire: () => { valid = false; [...listeners].forEach(fn => fn()); }, revive: () => { valid = true; }, setActive: value => { active = value; } };
}
function useFetch(t, fetch) { const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = fetch; }
for (const method of ['qolipPaddons', 'qolipPaddonDetail', 'qolipStorageMolds', 'qolipArchive']) {
  test(`${method}: an expired run prevents dispatch through the actual authorized transport`, async t => {
    const h = harness(); let calls = 0; useFetch(t, async () => { calls++; return json({}); }); h.stop();
    await assert.rejects(h.api[method](h.account, method === 'qolipPaddonDetail' ? 'QP-00012' : {}, h.guard), /qolip_read_expired/);
    assert.equal(calls, 0);
  });
}
test('guarded storage readers preserve source requests and parsed results using actual transport', async t => {
  const h = harness(), calls = []; useFetch(t, async (url, init) => {
    calls.push([url, init]); const path = new URL(url).pathname;
    return json(path.endsWith('/detail') ? { ok: true, paddon: pallet, items: [mold] } : path.endsWith('/molds') ? { ok: true, molds: [mold], has_more: false }
      : path.endsWith('/archive') ? { ok: true, entries: [archive], has_more: false } : { ok: true, paddons: [pallet], has_more: false });
  });
  assert.equal((await h.api.qolipPaddons(h.account, { query: ' Q ', offset: 100 }, h.guard)).items[0].code, 'QP-00012');
  assert.equal((await h.api.qolipPaddonDetail(h.account, 'QP-00012', h.guard)).items[0].code, 'Q-ONE');
  assert.equal((await h.api.qolipStorageMolds(h.account, { code: 'Q-ONE' }, h.guard)).items[0].code, 'Q-ONE');
  assert.equal((await h.api.qolipArchive(h.account, { status: 'all', view: 'molds', warehouse: 'W', from: new Date(2026, 0, 2) }, h.guard)).items[0].code, 'Q-ONE');
  assert.equal(new URL(calls[0][0]).searchParams.get('q'), ' Q '); assert.equal(new URL(calls[0][0]).searchParams.get('offset'), '100');
  assert.equal(new URL(calls[3][0]).searchParams.get('from'), '2026-01-02');
  for (const [, init] of calls) { assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit'); assert.equal(init.headers.get('authorization'), 'Bearer token'); }
  assert.equal(h.applied.length, 0);
});
test('isolated guarded storage 401 never starts credential refresh; legacy callers retain theirs', async t => {
  const h = harness(); let calls = 0; useFetch(t, async () => { calls++; return json({}, 401); });
  await assert.rejects(h.api.qolipPaddons(h.account, {}, h.guard), error => error.code === 'guarded_read_refresh_unavailable');
  assert.equal(calls, 1); assert.equal(h.refreshes(), 0);
  await assert.rejects(h.api.qolipPaddons(h.account)); assert.equal(h.refreshes(), 1); assert.equal(calls, 3);
});
for (const reject of [false, true]) test(`late storage body ${reject ? 'failure' : 'success'} is rejected by the original run`, async t => {
  const h = harness(), body = deferred(); useFetch(t, async () => ({ status: 200, text: () => body.promise, headers: new Headers() }));
  const result = h.api.qolipPaddons(h.account, {}, h.guard); await tick(); h.stop();
  if (reject) body.reject(new Error('old backend detail')); else body.resolve(JSON.stringify({ ok: true, paddons: [pallet], has_more: false }));
  await assert.rejects(result, /qolip_read_expired/); assert.equal(h.applied.length, 0);
});
test('legacy archive mold fallback carries the original run guard into every page', async t => {
  const h = harness(), calls = []; useFetch(t, async url => {
    calls.push(url); const query = new URL(url).searchParams;
    if (query.get('view') === 'molds') return new Response('Failed to deserialize query string: unknown field `view`', { status: 400, headers: { 'content-type': 'text/plain' } });
    return json({ ok: true, entries: [archive], has_more: false });
  });
  const result = await h.api.qolipArchive(h.account, { view: 'molds' }, h.guard);
  assert.equal(result.items[0].code, 'Q-ONE'); assert.equal(calls.length, 2); assert.equal(new URL(calls[1]).searchParams.has('view'), false);
});
test('expiration during the unsupported-view response prevents a fallback read', async t => {
  const h = harness(); let sends = 0; useFetch(t, async () => { sends++; return { status: 400, headers: new Headers({ 'content-type': 'text/plain' }),
    text: async () => { h.stop(); return 'Failed to deserialize query string: unknown field `view`'; } }; });
  await assert.rejects(h.api.qolipArchive(h.account, { view: 'molds' }, h.guard), /qolip_read_expired/); assert.equal(sends, 1);
});
test('storage runtime supplies real guarded list and warehouse GETs and permanently retires account ABA', async t => {
  const h = harness(), calls = []; useFetch(t, async url => { calls.push(url); return json(new URL(url).pathname.endsWith('/blocks')
    ? { warehouses: ['W'], blocks: [] } : { ok: true, entries: [archive], has_more: false }); });
  const owner = h.load('qolip/qolipStorageReadRuntime.ts').createQolipStorageRead(h.account, h.boundary, true, () => {});
  owner.activate(); await owner.load(); await owner.toggleWarehouseFilter(); assert.equal(owner.getSnapshot().archive.length, 1); assert.deepEqual(owner.getSnapshot().warehouses, ['W']);
  h.expire(); h.revive(); await owner.load(); assert.equal(owner.getSnapshot().invalid, true); assert.equal(owner.getSnapshot().query, ''); assert.equal(calls.length, 2); owner.suspend();
});
test('storage runtime refuses non-Qolip or missing-capability entry before any GET', async t => {
  let calls = 0; useFetch(t, async () => { calls++; return json({}); });
  for (const mutate of [h => { h.account.profile.role = 'admin'; }, h => { h.account.capabilities = []; }, h => { h.account.token = 'test-mode-token'; }, h => h.setActive(null)]) {
    const h = harness(); mutate(h); const owner = h.load('qolip/qolipStorageReadRuntime.ts').createQolipStorageRead(h.account, h.boundary, false, () => {});
    owner.activate(); await owner.load(); assert.equal(owner.getSnapshot().invalid, true); owner.suspend();
  }
  assert.equal(calls, 0);
});
