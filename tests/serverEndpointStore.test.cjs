const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/serverEndpointStore.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ServerEndpointStore, normalizeServerEndpoint } = loaded.exports;
function storage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); } };
}

test('server endpoint normalization accepts only HTTPS origins', () => {
  assert.equal(normalizeServerEndpoint(' Example.COM:8443/ '), 'https://example.com:8443');
  for (const value of ['', 'http://example.test', 'https://user@example.test', 'https://example.test/path',
    'https://example.test/?x=1', 'https://example.test/#part']) assert.equal(normalizeServerEndpoint(value), null);
});

test('active and saved endpoints survive reload and an override can be cleared', async () => {
  const prefs = storage(), first = new ServerEndpointStore(prefs, 'https://initial.test');
  await first.load();
  await first.saveEndpoint('other.test');
  await first.setBaseUrl('active.test');
  const second = new ServerEndpointStore(prefs, 'https://initial.test');
  await second.load();
  assert.equal(second.baseUrl, 'https://active.test');
  assert.equal(second.isRuntimeOverride, true);
  assert.deepEqual(new Set(second.savedEndpoints.map(value => value.base_url)), new Set(['https://initial.test', 'https://other.test', 'https://active.test']));
  await second.clearOverride();
  assert.equal(second.baseUrl, 'https://initial.test');
  assert.equal(second.isRuntimeOverride, false);
  assert.equal(prefs.values.has('active_server_endpoint'), false);
});

test('invalid stored endpoint rows are skipped without losing valid endpoints', async () => {
  const prefs = storage();
  prefs.values.set('active_server_endpoint', 'http://invalid.test');
  prefs.values.set('saved_server_endpoints_v1', JSON.stringify([
    { base_url: 'https://valid.test', last_used_at: '2026-01-01T00:00:00Z' },
    { base_url: 'http://bad.test', last_used_at: '2026-01-01T00:00:00Z' },
    { base_url: 'https://bad-date.test', last_used_at: 'invalid' }, null,
  ]));
  const store = new ServerEndpointStore(prefs, 'https://initial.test');
  await store.load();
  assert.equal(store.baseUrl, 'https://initial.test');
  assert.equal(prefs.values.has('active_server_endpoint'), false);
  assert.deepEqual(new Set(store.savedEndpoints.map(value => value.base_url)), new Set(['https://initial.test', 'https://valid.test']));
});

test('saving an existing endpoint preserves its last-used timestamp', async () => {
  const prefs = storage(), store = new ServerEndpointStore(prefs, 'https://initial.test');
  await store.load();
  const first = await store.saveEndpoint('other.test');
  const second = await store.saveEndpoint('OTHER.test');
  assert.equal(second.last_used_at, first.last_used_at);
  await assert.rejects(store.setBaseUrl('https://example.test/path'), /HTTPS/);
});
