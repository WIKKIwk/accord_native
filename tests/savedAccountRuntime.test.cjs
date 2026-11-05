const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
function storage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); } };
}

test('native saved accounts use persistent metadata and secure hashed secret keys', async () => {
  const prefs = storage(), secure = storage();
  const mocks = { 'expo-sqlite/kv-store': { __esModule: true, default: prefs },
    'expo-secure-store': { getItemAsync: secure.getItem, setItemAsync: secure.setItem, deleteItemAsync: secure.removeItem },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async (_algorithm, input) => crypto.createHash('sha256').update(input).digest('hex') },
    'react-native': { Platform: { OS: 'ios' } } };
  const runtime = load('savedAccountRuntime', mocks);
  const [store, same] = await Promise.all([runtime.initializeSavedAccounts('https://example.test'), runtime.initializeSavedAccounts('https://example.test')]);
  assert.equal(store, same);
  const saved = await store.upsertAuthenticated({ baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'worker' },
    token: 'secret-token', phone: 'phone', code: 'code', makeActive: true });
  assert.equal(prefs.values.get('saved_accounts_v1').includes('secret-token'), false);
  const key = `saved_account_secret_v1_${crypto.createHash('sha256').update(saved.id).digest('hex')}`;
  assert.equal(JSON.parse(secure.values.get(key)).token, 'secret-token');
  const restarted = await load('savedAccountRuntime', mocks).initializeSavedAccounts('https://example.test');
  assert.equal((await restarted.sessionFor(saved.id)).token, 'secret-token');
});

test('a migrated legacy session cannot replace a later active account on restart', async () => {
  const prefs = storage(), secure = storage();
  prefs.values.set('app_session_token', 'legacy-token');
  prefs.values.set('app_session_profile', JSON.stringify({ role: 'aparatchi', ref: 'legacy' }));
  const mocks = { 'expo-sqlite/kv-store': { __esModule: true, default: prefs },
    'expo-secure-store': { getItemAsync: secure.getItem, setItemAsync: secure.setItem, deleteItemAsync: secure.removeItem },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async (_algorithm, input) => crypto.createHash('sha256').update(input).digest('hex') },
    'react-native': { Platform: { OS: 'ios' } } };
  const store = await load('savedAccountRuntime', mocks).initializeSavedAccounts('https://example.test');
  assert.equal(store.activeAccountId, 'https://example.test|aparatchi|legacy');
  assert.equal(prefs.values.has('app_session_token'), false);
  assert.equal(prefs.values.has('app_session_profile'), false);
  await store.upsertAuthenticated({ baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'later' },
    token: 'later-token', phone: 'phone', code: 'code', makeActive: true });
  const restarted = await load('savedAccountRuntime', mocks).initializeSavedAccounts('https://example.test');
  assert.equal(restarted.activeAccountId, 'https://example.test|aparatchi|later');
});
