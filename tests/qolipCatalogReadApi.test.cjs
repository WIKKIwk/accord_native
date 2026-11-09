const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
const root = path.resolve(__dirname, '../src');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const page = (items = [{ id: 'item', name: 'Mold', order_image_order_id: ' map ' }], has_more = false, next_cursor = null) => ({ items, has_more, next_cursor });
const product = (overrides = {}) => ({ code: 'ITEM', name: 'Mold', qolip_code: 'Q-1', qolip_set_id: 'set-1', size: 42, ...overrides });
function harness(options = {}) {
  const account = options.account ?? { token: 'token', baseUrl: 'https://example.test', profile: { ref: 'A', role: 'qolipchi' }, capabilities: ['qolip.manage'] };
  let active = account, valid = true, run = true;
  const listeners = new Set(), cache = new Map();
  const overrides = { 'auth.ts': { activeSessionToken: value => value === active ? value.token : null, refreshSession: options.refresh ?? (async () => false) },
    'sessionReadScope.ts': { sessionReadScope: value => JSON.stringify([value.baseUrl, value.profile.ref, value.profile.role]) },
    'workerControlsApi.ts': { WorkerControlException: class WorkerControlException extends Error {} }, ...(options.overrides ?? {}) };
  function load(name) {
    name = name.replaceAll('\\', '/'); if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : target === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  const boundary = { current: () => valid, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const readers = load('qolip/qolipCatalogReadApi.ts').createQolipCatalogReaders(account, boundary);
  return { account, boundary, readers, load, lifetime: () => run, invalidate: () => { valid = false; for (const listener of [...listeners]) listener(); },
    revive: () => { valid = true; }, stop: () => { run = false; }, resume: () => { run = true; }, setActive: value => { active = value; } };
}

// Historical recording at 7c87; both the source API and test blobs are identical at f119, but their full dependencies were not established as identical.
test('historical V2 page recording replays the clamped first page and stuck cursor rejection', async t => {
  const stem = 'qolip_catalog_test', name = 'catalog requests are bounded, scoped and reject a stuck continuation';
  const session = { ...recordedSession(stem, name), profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'] };
  const h = harness({ account: session }), replay = contractFetch(stem, name), previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = replay;
  const result = await h.readers.page({ query: ' Product ', limit: 999 }, h.lifetime);
  assert.equal(result.items.length, 200); assert.equal(result.next_cursor, 'next'); assert.ok(Object.isFrozen(result.items));
  await assert.rejects(h.readers.page({ query: 'Product', cursor: 'next' }, h.lifetime), /Invalid Qolip catalog page/); replay.assertDone();
});

test('historical V2 detail recording reuses the existing product parser', async t => {
  const stem = 'qolip_catalog_test', name = 'only names load initially; tapping loads and reuses one product detail';
  const session = { ...recordedSession(stem, name), profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'] };
  const h = harness({ account: session }), replay = contractFetch(stem, name, { onlyPaths: ['/v1/mobile/qolip/products/detail'] });
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = replay;
  const result = await h.readers.details('row-0', h.lifetime); assert.equal(result[0].qolip_code, 'MOLD-001'); assert.equal(result[0].set_id, 'set-1');
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result[0])); replay.assertDone();
});

test('page and detail preserve source query, raw ID, limit bounds and immutable results', async t => {
  const h = harness(), urls = [], previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async (url, init) => { urls.push(url); assert.equal(init.method ?? 'GET', 'GET');
    return url.includes('/page?') ? json(page()) : json({ products: [product()] }); };
  const first = await h.readers.page({ query: '\u0085 Q ! \u0085', cursor: '', limit: 0 }, h.lifetime);
  assert.equal(urls[0], 'https://example.test/v1/mobile/qolip/products/page?limit=1&q=Q+%21&cursor');
  assert.deepEqual(first.items, [{ id: 'item', name: 'Mold', order_image_order_id: 'map' }]); assert.ok(Object.isFrozen(first.items[0]));
  await h.readers.page({ limit: 201 }, h.lifetime); assert.equal(urls[1], 'https://example.test/v1/mobile/qolip/products/page?limit=200');
  const detail = await h.readers.details(' id /1 ', h.lifetime); assert.equal(urls[2], 'https://example.test/v1/mobile/qolip/products/detail?id=+id+%2F1+');
  assert.equal(detail[0].qolip_code, 'Q-1'); assert.throws(() => h.readers.page({}, undefined), /qolip_read_expired/);
  await assert.rejects(h.readers.page({ limit: 1.5 }, h.lifetime), /Invalid Qolip catalog limit/);
});

test('page and detail reject malformed response contracts without creating cache state', async t => {
  const h = harness(); const previous = global.fetch; t.after(() => { global.fetch = previous; });
  for (const invalid of [null, {}, page([], true, 'n'), page([{ id: '', name: 'x' }]), page([{ id: 'x', name: 3 }]),
    page([{ id: 'x', name: 'x' }, { id: 'x', name: 'y' }]), page([{ id: 'x', name: 'x', order_image_order_id: 4 }]), page([{ id: 'x', name: 'x' }], true, ''),
    page([{ id: 'x', name: 'x' }], true, 'same')]) {
    global.fetch = async () => json(invalid); await assert.rejects(h.readers.page({ cursor: 'same' }, h.lifetime));
  }
  for (const invalid of [null, {}, { products: [] }, { products: [null] }]) {
    global.fetch = async () => json(invalid); await assert.rejects(h.readers.details('id', h.lifetime));
  }
  const code = fs.readFileSync(path.join(root, 'qolip/qolipCatalogReadApi.ts'), 'utf8');
  assert.doesNotMatch(code, /qolipCatalogRuntime|QolipCatalogStore|applyResponse|\.reset\(/);
});

test('error response preserves source fallback and server code while current', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async () => json({ error: 'catalog_failure', message: ' Server error ' }, 409);
  await assert.rejects(h.readers.page({}, h.lifetime), error => error.code === 'catalog_failure' && error.message === 'Server error' && error.statusCode === 409);
  global.fetch = async () => new Response('not JSON', { status: 500 });
  await assert.rejects(h.readers.details('id', h.lifetime), error => error.code === 'qolip_products_failed' && error.message === 'Qoliplar yuklanmadi');
});

test('invalid, asynchronous and reentrant lifetime guards reject both readers before a send', async t => {
  const h = harness(), previous = global.fetch; let sends = 0; t.after(() => { global.fetch = previous; }); global.fetch = async () => { sends++; return json(page()); };
  const { assertQolipReadCurrent } = h.load('qolip/qolipApiCommon.ts');
  const reentrant = () => { try { assertQolipReadCurrent(reentrant); } catch {} return true; };
  for (const guard of [() => false, () => { throw new Error('bad'); }, async () => true, async () => { throw new Error('async'); }, reentrant]) {
    await assert.rejects(h.readers.page({}, guard)); await assert.rejects(h.readers.details('id', guard));
  }
  assert.equal(sends, 0);
});

test('original witness, role, capability, account and scope invalidation latch through ABA', async t => {
  const previous = global.fetch; let sends = 0; t.after(() => { global.fetch = previous; }); global.fetch = async () => { sends++; return json(page()); };
  for (const invalidate of [h => h.invalidate(), h => { h.account.profile.role = 'admin'; }, h => { h.account.capabilities = []; },
    h => h.setActive(null), h => { h.account.profile.ref = 'B'; }, h => { h.account.token = 'test-mode-token'; }]) {
    const h = harness(); invalidate(h); await assert.rejects(h.readers.page({}, h.lifetime));
    h.revive(); h.account.profile = { ref: 'A', role: 'qolipchi' }; h.account.capabilities = ['qolip.manage']; h.account.token = 'token'; h.setActive(h.account);
    await assert.rejects(h.readers.details('id', h.lifetime));
  }
  assert.equal(sends, 0);
});

test('invalidation during setup or 401 refresh prevents initial or retry dispatch for both readers', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  for (const method of ['page', 'details']) {
    const refresh = deferred(), h = harness({ refresh: () => refresh.promise }); let sends = 0;
    global.fetch = async () => { sends++; return json({}, 401); };
    const call = () => method === 'page' ? h.readers.page({}, h.lifetime) : h.readers.details('id', h.lifetime);
    const initial = call(); h.stop(); await assert.rejects(initial, /qolip_read_expired/); assert.equal(sends, 0);
    h.resume(); const retry = call(); await tick(); assert.equal(sends, 1); h.stop(); h.account.token = 'refreshed'; refresh.resolve(true);
    await assert.rejects(retry, /qolip_read_expired/); assert.equal(sends, 1);
  }
});

test('valid 401 refresh uses the same original witness and a new token on retry', async t => {
  const h = harness({ refresh: async () => { h.account.token = 'new-token'; return true; } }), calls = [], previous = global.fetch;
  t.after(() => { global.fetch = previous; }); global.fetch = async (url, init) => { calls.push({ url, token: init.headers.get('authorization') });
    return calls.length === 1 ? json({}, 401) : json({ products: [product()] }); };
  const rows = await h.readers.details('id', h.lifetime); assert.equal(rows[0].qolip_code, 'Q-1');
  assert.deepEqual(calls.map(call => call.token), ['Bearer token', 'Bearer new-token']); assert.equal(calls.length, 2);
});

test('response, status, error body, JSON, fields and product parse cannot publish across invalidation', async () => {
  for (const method of ['page', 'details']) for (const stage of ['response', 'status', 'error', 'json', 'list', 'field']) {
    let current = true, reads = 0; const pending = deferred();
    const h = harness({ overrides: { 'authorizedFetch.ts': { authorizedFetch: async (_s, _path, _init, beforeSend) => {
      beforeSend();
      if (stage === 'response') return pending.promise;
      if (stage === 'status') return { get status() { current = false; return 200; }, json: async () => { reads++; return {}; } };
      if (stage === 'error' || stage === 'json') return { status: stage === 'error' ? 409 : 200, json: async () => { reads++; return pending.promise; } };
      const item = method === 'page' ? { id: 'x', name: 'x' } : product();
      if (stage === 'field') Object.defineProperty(item, method === 'page' ? 'id' : 'qolip_code', { get() { current = false; return 'private'; } });
      const result = method === 'page' ? page([item]) : { products: [item] };
      if (stage === 'list') Object.defineProperty(result, method === 'page' ? 'items' : 'products', { get() { current = false; return []; } });
      return { status: 200, json: async () => result };
    } } } });
    const life = () => current, promise = method === 'page' ? h.readers.page({}, life) : h.readers.details('id', life);
    if (['response', 'error', 'json'].includes(stage)) {
      await tick(); current = false;
      pending.resolve(stage === 'response' ? { status: 200, json: async () => { reads++; return {}; } } : {});
    }
    await assert.rejects(promise, /qolip_read_expired/, `${method} ${stage}`);
    if (stage === 'response' || stage === 'status') assert.equal(reads, 0);
  }
});


test('a lifetime invalidated in the final parse microtask cannot receive a successful result', async () => {
  for (const method of ['page', 'details']) {
    let current = true; const h = harness({ overrides: { 'authorizedFetch.ts': { authorizedFetch: async (_s, _path, _init, beforeSend) => {
      beforeSend(); const item = method === 'page' ? { id: 'x', name: 'x' } : product();
      Object.defineProperty(item, method === 'page' ? 'name' : 'qolip_code', { get() { queueMicrotask(() => { current = false; }); return 'x'; } });
      return { status: 200, json: async () => method === 'page' ? page([item]) : { products: [item] } };
    } } } });
    await assert.rejects(method === 'page' ? h.readers.page({}, () => current) : h.readers.details('id', () => current), /qolip_read_expired/);
  }
});

test('open-reworks reader replays the exact f119 read contract without exposing mutations', async t => {
  const stem = 'f11910bb/qolip_reworks_api_test', name = 'same-account token refresh does not invalidate pending rework reads';
  const session = { ...recordedSession(stem, name), profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'] };
  const h = harness({ account: session }), replay = contractFetch(stem, name), previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = replay;
  assert.deepEqual(await h.readers.reworks(h.lifetime), []); replay.assertDone();
  assert.deepEqual(Object.keys(h.readers).sort(), ['details', 'page', 'reworks']);
  assert.throws(() => h.readers.reworks(undefined), /qolip_read_expired/);
});

test('open-reworks read uses the original witness and checks before a 401 retry', async t => {
  const refresh = deferred(), h = harness({ refresh: () => refresh.promise }); let sends = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async url => { sends++; assert.equal(url, 'https://example.test/v1/mobile/qolip/reworks?status=open'); return json({}, 401); };
  const before = h.readers.reworks(h.lifetime); h.stop(); await assert.rejects(before, /qolip_read_expired/); assert.equal(sends, 0);
  h.resume(); const retry = h.readers.reworks(h.lifetime); await tick(); assert.equal(sends, 1);
  h.invalidate(); h.account.token = 'new-token'; refresh.resolve(true); await assert.rejects(retry, /qolip_read_expired/); assert.equal(sends, 1);
  h.revive(); await assert.rejects(h.readers.reworks(h.lifetime)); assert.equal(sends, 1);
});

test('open-reworks read blocks invalid, asynchronous and reentrant lifetime predicates', async t => {
  const h = harness(), previous = global.fetch; let sends = 0; t.after(() => { global.fetch = previous; });
  global.fetch = async () => { sends++; return json({ reworks: [] }); };
  const { assertQolipReadCurrent } = h.load('qolip/qolipApiCommon.ts');
  const reentrant = () => { try { assertQolipReadCurrent(reentrant); } catch {} return true; };
  for (const guard of [() => false, () => { throw new Error('bad'); }, async () => true, async () => { throw new Error('async'); }, reentrant]) {
    await assert.rejects(h.readers.reworks(guard));
  }
  assert.equal(sends, 0);
});

test('open-reworks parse and error bodies cannot publish after lifetime invalidation', async () => {
  for (const stage of ['response', 'status', 'error', 'json', 'list', 'field', 'microtask']) {
    let current = true, reads = 0; const pending = deferred();
    const h = harness({ overrides: { 'authorizedFetch.ts': { authorizedFetch: async (_s, _path, _init, beforeSend) => {
      beforeSend();
      if (stage === 'response') return pending.promise;
      if (stage === 'status') return { get status() { current = false; return 200; }, json: async () => { reads++; return {}; } };
      if (stage === 'error' || stage === 'json') return { status: stage === 'error' ? 409 : 200, json: async () => { reads++; return pending.promise; } };
      const row = { id: 'r1', qolip_code: 'Q-1', sent_at: '2026-10-24T10:00:00Z' };
      if (stage === 'field' || stage === 'microtask') Object.defineProperty(row, 'id', { get() {
        if (stage === 'field') current = false; else queueMicrotask(() => { current = false; }); return 'private';
      } });
      const result = { reworks: [row] };
      if (stage === 'list') Object.defineProperty(result, 'reworks', { get() { current = false; return []; } });
      return { status: 200, json: async () => result };
    } } } });
    const promise = h.readers.reworks(() => current);
    if (['response', 'error', 'json'].includes(stage)) {
      await tick(); current = false;
      pending.resolve(stage === 'response' ? { status: 200, json: async () => { reads++; return { reworks: [] }; } } : {});
    }
    await assert.rejects(promise, /qolip_read_expired/, stage);
    if (stage === 'response' || stage === 'status') assert.equal(reads, 0);
  }
});

test('valid open-reworks read preserves rows and source server errors', async t => {
  const h = harness(), previous = global.fetch; t.after(() => { global.fetch = previous; });
  global.fetch = async () => json({ reworks: [{ id: 'r1', qolip_code: 'Q-1', sent_at: '2026-10-24T10:00:00Z' }] });
  const rows = await h.readers.reworks(h.lifetime); assert.equal(rows[0].qolip_code, 'Q-1'); assert.equal(rows[0].is_open, true);
  global.fetch = async () => json({ error: 'failed', message: ' Bad ' }, 409);
  await assert.rejects(h.readers.reworks(h.lifetime), error => error.code === 'failed' && error.message === 'Bad' && error.statusCode === 409);
});


test('direct opt-in reworks guard rejects a test token introduced by 401 refresh', async t => {
  const h = harness({ refresh: async () => { h.account.token = 'test-mode-token'; return true; } }); let sends = 0;
  const previous = global.fetch; t.after(() => { global.fetch = previous; }); global.fetch = async () => { sends++; return json({}, 401); };
  await assert.rejects(h.load('qolip/qolipReworkApi.ts').qolipReworks(h.account, 'open', () => true), /test mode is not yet ported/);
  assert.equal(sends, 1);
});
