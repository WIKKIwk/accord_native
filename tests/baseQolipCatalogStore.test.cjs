const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/qolipCatalogStore.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { QolipCatalogStore, qolipCatalogId } = mod.exports;
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { promise, resolve }; };
const product = (code, qolip_code = 'M1') => ({ code, qolip_code, customer_names: [] });
const item = (id, name = id) => ({ id, name, order_image_order_id: '' });
function fixture(overrides = {}) {
  let scope = 'session'; const calls = [];
  const options = { scope: () => scope, requestScope: () => scope,
    page: async (query, cursor) => { calls.push({ query, cursor });
      return cursor === null ? { items: [item('a', 'A')], next_cursor: 'next' } : { items: [item('b', 'B')], next_cursor: null }; },
    details: async id => [product(id)], parseProduct: value => ({ ...value }), ...overrides };
  return { store: new QolipCatalogStore(options), calls, setScope: value => { scope = value; } };
}

// @v2-test test/qolip_catalog_store_test.dart
test('first reads are shared; following pages and scroll position stay cached', async () => {
  const f = fixture(), first = f.store.first();
  assert.equal(f.store.first(), first);
  const window = await first; window.scrollOffset = 500;
  assert.deepEqual(window.items.map(row => row.name), ['A']);
  assert.equal(await f.store.more(''), window);
  assert.deepEqual(window.items.map(row => row.name), ['A', 'B']);
  assert.equal(await f.store.first(), window); assert.equal(window.scrollOffset, 500);
  assert.equal(f.calls.length, 2);
});

test('a write delta updates cached pages and details and filters searches', async () => {
  const f = fixture(), store = f.store;
  const window = await store.first(), search = await store.first('needle');
  const upsert = { id: 'b', name: 'B', products: [product('Needle')] };
  store.applyResponse({ catalog_delta: { upserts: [upsert], removed_ids: ['a'] } }, 'session');
  assert.deepEqual(window.items.map(row => row.id), ['b']);
  assert.deepEqual(search.items.map(row => row.id), ['b']);
  assert.equal(store.details('b')[0].code, 'Needle');
  store.applyResponse({ catalog_delta: { upserts: [], removed_ids: ['b'] } }, 'session');
  assert.deepEqual(window.items, []); assert.equal(store.details('b'), null);
});

test('a late page keeps newer writes and a late detail cannot revive a deletion', async () => {
  const page = deferred(), details = deferred();
  const f = fixture({ page: () => page.promise, details: () => details.promise }), store = f.store;
  const loadingPage = store.first(), loadingDetails = store.loadDetails('a');
  store.applyResponse({ catalog_delta: { upserts: [{ id: 'a', name: 'New', products: [product('a', 'M2')] }], removed_ids: [] } }, 'session');
  details.resolve([product('a', 'M1')]); page.resolve({ items: [item('a', 'Old')], next_cursor: null });
  assert.equal((await loadingDetails)[0].qolip_code, 'M2');
  assert.equal((await loadingPage).items[0].name, 'New');
  const nextDetails = deferred();
  const g = fixture({ details: () => nextDetails.promise });
  const read = g.store.loadDetails('a');
  g.store.applyResponse({ catalog_delta: { upserts: [], removed_ids: ['a'] } }, 'session');
  nextDetails.resolve([product('a')]);
  await assert.rejects(read, /removed/); assert.equal(g.store.details('a'), null);
});

test('session changes and invalidation reject stale reads', async () => {
  const page = deferred(), details = deferred();
  const f = fixture({ page: () => page.promise, details: () => details.promise });
  const pendingPage = f.store.first(), pendingDetails = f.store.loadDetails('a');
  f.store.invalidateDetails(); details.resolve([product('a')]);
  await assert.rejects(pendingDetails, /availability changed/);
  f.setScope('new session'); page.resolve({ items: [item('a')], next_cursor: null });
  await assert.rejects(pendingPage, /session changed/);
  assert.equal(f.store.window('').loaded, false);
});

test('invalid deltas reset the cache and stale-session writes are ignored', async () => {
  const f = fixture(), window = await f.store.first();
  f.store.applyResponse({ catalog_delta: { upserts: [], removed_ids: ['a'] } }, 'other');
  assert.equal(window.items.length, 1);
  f.store.applyResponse({ catalog_delta: { upserts: [{ id: 'b', name: 'B', products: [] }], removed_ids: [] } }, 'session');
  assert.equal(f.store.window('').loaded, false);
  assert.equal(qolipCatalogId('  ÄBCD  '), `qp1.${Buffer.from('äbcd').toString('base64url')}`);
});
