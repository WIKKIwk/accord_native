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
function api(fetch) {
  let reset;
  class Disk { constructor() { this.values = new Map(); }
    async read(key) { return this.values.get(key) ?? null; }
    async write(key, data) { this.values.set(key, data); }
    async remove(key) { this.values.delete(key); }
    async clear() { this.values.clear(); } }
  const mocks = { './authorizedFetch': { authorizedFetch: fetch }, './auth': { activeSessionToken: s => s.active === false ? null : s.token,
    registerSessionResetHook: callback => { reset = callback; return () => {}; } },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: async (_kind, key) => crypto.createHash('sha256').update(key).digest('hex') },
    './orderImageDiskStore': { FileOrderImageDiskStore: Disk } };
  return { client: load('orderImageApi', mocks), reset: () => reset() };
}
const session = () => ({ token: 'token', baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' } });

test('production order images use the scoped URL and cache identical requests', async () => {
  let reads = 0, requested;
  const { client } = api(async (_session, url) => { reads++; requested = new URL(url, 'https://example.test');
    return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { etag: 'v1' } }); });
  const account = session();
  assert.equal(await client.adminProductionMapOrderImage(account, '  '), null);
  assert.deepEqual(await client.adminProductionMapOrderImage(account, ' order ', { image_id: 'image', thumbnail: true }), Uint8Array.from([1, 2, 3]));
  assert.equal(requested.pathname, '/v1/mobile/admin/production-maps/order-image/view');
  assert.deepEqual(Object.fromEntries(requested.searchParams), { order_id: 'order', image_id: 'image', variant: 'thumb-v1' });
  assert.deepEqual(await client.adminProductionMapOrderImage(account, 'order', { image_id: 'image', thumbnail: true }), Uint8Array.from([1, 2, 3]));
  assert.equal(reads, 1);
  await client.adminProductionMapOrderImage(account, 'order', { image_id: 'image' });
  assert.equal(reads, 2);
});

test('order image route missing and logout races are handled explicitly', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const { client, reset } = api(async () => { entered(); return new Promise(resolve => { release = resolve; }); });
  const account = session(), pending = client.adminProductionMapOrderImage(account, 'order');
  await started;
  account.active = false;
  await reset();
  release(new Response(Uint8Array.from([9]), { status: 200 }));
  assert.equal(await pending, null);
  const missing = api(async () => new Response('', { status: 404 })).client;
  await assert.rejects(missing.adminProductionMapOrderImage(session(), 'order'), error => error.code === 'production_map_order_image_route_missing');
});

test('production order image replays the recorded authenticated thumbnail', async () => {
  const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
  const stem = 'order_image_memory_peek_test', name = 'API peek shares cache key but isolates variant version account and session';
  const route = '/v1/mobile/admin/production-maps/order-image/view';
  const replay = contractFetch(stem, name, { onlyPaths: [route], onlyMethods: ['GET'] });
  const account = recordedSession(stem, name);
  const { client } = api((s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }));
  assert.deepEqual(await client.adminProductionMapOrderImage(account, 'order-1', { image_id: 'v1', thumbnail: true }), Uint8Array.from([7, 8, 9]));
  replay.assertDone();
});
