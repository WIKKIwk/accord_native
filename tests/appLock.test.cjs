const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture({ expoGo = false, platform = 'ios', values = new Map() } = {}) {
  let active = true;
  let biometricAccepted = true;
  const store = {
    async getItemAsync(key, options) {
      if (options?.requireAuthentication && !biometricAccepted) throw new Error('cancelled');
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) { values.set(key, value); },
    async deleteItemAsync(key) { values.delete(key); },
    canUseBiometricAuthentication: () => true,
  };
  const filename = path.resolve(__dirname, '../src/appLock.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => {
    if (id === 'expo-secure-store') return store;
    if (id === 'expo-constants') return { __esModule: true, default: { appOwnership: expoGo ? 'expo' : null }, AppOwnership: { Expo: 'expo' } };
    if (id === 'react-native') return { Platform: { OS: platform } };
    if (id === './auth') return { activeSessionToken: () => active ? 'token' : null };
    if (id === 'expo-crypto') return {
      CryptoDigestAlgorithm: { SHA256: 'sha256' },
      digestStringAsync: async (_algorithm, value) => crypto.createHash('sha256').update(value).digest('hex'),
      getRandomBytesAsync: async n => crypto.randomBytes(n), randomUUID: () => crypto.randomUUID(),
    };
    return require(id);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return { api: loaded.exports, store, values, setActive: value => { active = value; }, setBiometric: value => { biometricAccepted = value; } };
}

const session = { baseUrl: 'https://erp.example', profile: { role: 'aparatchi', ref: 'one' } };

test('PIN is account-scoped, validated, salted and never stored as plaintext', async () => {
  const { api, values, setActive } = fixture();
  await assert.rejects(api.saveAppPin(session, '123'), /4 ta raqam/);
  await api.saveAppPin(session, '1234');
  assert.equal(await api.verifyAppPin(session, '1234'), true);
  assert.equal(await api.verifyAppPin(session, '1235'), false);
  assert.equal(await api.verifyAppPin({ ...session, profile: { ...session.profile, ref: 'other' } }, '1234'), false);
  assert.equal([...values.values()][0].includes('1234'), false);
  setActive(false);
  assert.equal(await api.verifyAppPin(session, '1234'), false);
});

test('biometric enable requires successful device authentication and remains PIN-protected', async () => {
  const { api, setBiometric } = fixture();
  await assert.rejects(api.setAppBiometric(session, true), /Avval PIN/);
  await api.saveAppPin(session, '2468');
  setBiometric(false);
  await assert.rejects(api.setAppBiometric(session, true));
  assert.equal((await api.loadAppLock(session)).biometric, false);
  setBiometric(true);
  await api.setAppBiometric(session, true);
  assert.equal(await api.unlockAppWithBiometric(session), true);
  await api.setAppBiometric(session, false);
  assert.equal(await api.unlockAppWithBiometric(session), false);
  await api.clearAppLock(session);
  assert.deepEqual(await api.loadAppLock(session), { hasPin: false, biometric: false });
});

test('Face ID is not offered inside Expo Go', () => {
  assert.equal(fixture({ expoGo: true }).api.biometricAvailable(), false);
});

test('web skips native-only lock storage', async () => {
  const { api, store } = fixture({ platform: 'web' });
  store.getItemAsync = async () => { throw new Error('SecureStore unavailable'); };
  store.deleteItemAsync = async () => { throw new Error('SecureStore unavailable'); };
  assert.deepEqual(await api.loadAppLock(session), { hasPin: false, biometric: false });
  await api.clearAppLock(session);
  assert.equal(api.biometricAvailable(), false);
});

test('logout cleanup waits for a pending PIN save', async () => {
  const { api, store } = fixture();
  const original = store.setItemAsync;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  store.setItemAsync = async (...args) => { await held; return original(...args); };
  const save = api.saveAppPin(session, '1234');
  const clear = api.clearAppLock(session);
  release();
  await Promise.all([save, clear]);
  assert.deepEqual(await api.loadAppLock(session), { hasPin: false, biometric: false });
});

test('a removed PIN stays disabled after restart if native deletion is ineffective', async () => {
  const values = new Map();
  const first = fixture({ values });
  await first.api.saveAppPin(session, '1234');
  await first.api.setAppBiometric(session, true);
  first.store.deleteItemAsync = async () => {};

  await first.api.clearAppLock(session);
  const restarted = fixture({ values });
  assert.deepEqual(await restarted.api.loadAppLock(session), { hasPin: false, biometric: false });
  assert.equal(await restarted.api.verifyAppPin(session, '1234'), false);
  assert.equal(await restarted.api.unlockAppWithBiometric(session), false);
  await restarted.api.saveAppPin(session, '5678');
  assert.equal(await restarted.api.verifyAppPin(session, '5678'), true);
});

test('a failed disable write leaves the existing PIN active', async () => {
  const { api, store } = fixture();
  await api.saveAppPin(session, '1234');
  store.setItemAsync = async () => { throw new Error('write failed'); };
  await assert.rejects(api.clearAppLock(session), /write failed/);
  assert.deepEqual(await api.loadAppLock(session), { hasPin: true, biometric: false });
  assert.equal(await api.verifyAppPin(session, '1234'), true);
});
