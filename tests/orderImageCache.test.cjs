const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const { OrderImageCache } = load('orderImageCacheCore');
const digest = async key => crypto.createHash('sha256').update(key).digest('hex');
function disk() {
  const values = new Map();
  return { values, read: async key => values.get(key) ?? null, write: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); }, clear: async () => { values.clear(); } };
}
const response = (status, bytes = [], headers = {}) => ({ status, bytes: Uint8Array.from(bytes), etag: headers.etag ?? null, cacheControl: headers.cacheControl ?? '' });

// @v2-test test/order_image_cache_test.dart
test('same image shares downloads; server/account/version/variant stay separate', async () => {
  const cache = new OrderImageCache(disk(), digest);
  let reads = 0;
  const get = key => cache.load({ key, thumbnail: true, immutable: true, fetch: async () => { reads++; return response(200, [1, 2, 3]); } });
  assert.deepEqual(await Promise.all([get('a/me/image1/thumb'), get('a/me/image1/thumb')]), [Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3])]);
  assert.equal(reads, 1);
  await get('a/me/image1/thumb');
  for (const key of ['a/me/image1/full', 'a/me/image2/thumb', 'a/other/image1/thumb', 'b/me/image1/thumb']) await get(key);
  assert.equal(reads, 5);
});

test('expired mutable order links use ETag and 304 without downloading pixels', async () => {
  let now = 100000, reads = 0;
  const cache = new OrderImageCache(disk(), digest, () => now);
  const get = () => cache.load({ key: 'mutable-order', thumbnail: true, immutable: false, fetch: async etag => {
    reads++;
    if (reads === 1) { assert.equal(etag, null); return response(200, [4, 5, 6], { etag: '"v1"' }); }
    assert.equal(etag, '"v1"'); return response(304);
  } });
  assert.deepEqual(await get(), Uint8Array.from([4, 5, 6]));
  now += 31_000;
  assert.deepEqual(await get(), Uint8Array.from([4, 5, 6]));
  assert.deepEqual(await get(), Uint8Array.from([4, 5, 6]));
  assert.equal(reads, 2);
});

test('failures and no-store responses do not poison the cache', async () => {
  const store = disk(), cache = new OrderImageCache(store, digest);
  let status = 503, reads = 0;
  const get = () => cache.load({ key: 'retry', thumbnail: true, immutable: true,
    fetch: async () => { reads++; return response(status, [1], { cacheControl: 'no-store' }); } });
  await assert.rejects(get(), /HTTP 503/);
  status = 200;
  await get(); await get();
  assert.equal(reads, 3); assert.equal(store.values.size, 0);
  status = 403; assert.equal(await get(), null);
  status = 200; assert.deepEqual(await get(), Uint8Array.from([1]));
});

test('logout drops an in-flight result and cannot repopulate cleared disk', async () => {
  const store = disk(), cache = new OrderImageCache(store, digest);
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = cache.load({ key: 'old-account', thumbnail: false, immutable: true, fetch: () => {
    entered(); return new Promise(resolve => { release = resolve; });
  } });
  await started; await cache.clear(); release(response(200, [1, 2, 3]));
  assert.equal(await pending, null);
  assert.equal(store.values.size, 0);
});

test('missing images avoid request storms but recover after a short TTL', async () => {
  let now = 100000, reads = 0, missing = true;
  const cache = new OrderImageCache(disk(), digest, () => now);
  const get = () => cache.load({ key: 'missing-image', thumbnail: true, immutable: true,
    fetch: async () => { reads++; return missing ? response(404, [1]) : response(200, [1, 2, 3]); } });
  assert.equal(await get(), null); missing = false; assert.equal(await get(), null); assert.equal(reads, 1);
  now += 16_000; assert.deepEqual(await get(), Uint8Array.from([1, 2, 3])); assert.equal(reads, 2);
});

test('full-size view bypasses thumbnail backlog and thumbnails have bounded concurrency', async () => {
  const cache = new OrderImageCache(disk(), digest);
  let release, reads = 0;
  const responsePromise = new Promise(resolve => { release = resolve; });
  const pending = Array.from({ length: 12 }, (_, i) => cache.load({ key: `thumb-${i}`, thumbnail: true, immutable: true,
    fetch: () => { reads++; return responsePromise; } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 4);
  assert.deepEqual(await cache.load({ key: 'full', thumbnail: false, immutable: true, fetch: async () => response(200, [9]) }), Uint8Array.from([9]));
  assert.equal(reads, 4);
  release(response(200, [1])); await Promise.all(pending); assert.equal(reads, 12);
});

test('disk survives memory eviction and separates image variants', async () => {
  const store = disk(); let reads = 0;
  const get = (cache, key) => cache.load({ key, thumbnail: key === 'thumb', immutable: true,
    fetch: async () => { reads++; return response(200, key === 'thumb' ? [1, 2] : [9, 8, 7]); } });
  const first = new OrderImageCache(store, digest, Date.now, 1);
  await get(first, 'thumb'); await get(first, 'full');
  const restarted = new OrderImageCache(store, digest);
  assert.deepEqual(await get(restarted, 'thumb'), Uint8Array.from([1, 2]));
  assert.deepEqual(await get(restarted, 'full'), Uint8Array.from([9, 8, 7]));
  assert.equal(reads, 2); await restarted.clear(); assert.equal(store.values.size, 0);
});

test('cache reset during digest computation prevents a stale download', async () => {
  let release, called = false;
  const cache = new OrderImageCache(disk(), () => new Promise(resolve => { release = resolve; }));
  const pending = cache.load({ key: 'old', thumbnail: true, immutable: true, fetch: async () => { called = true; return response(200, [1]); } });
  await cache.clear();
  release('a'.repeat(64));
  assert.equal(await pending, null);
  assert.equal(called, false);
});
