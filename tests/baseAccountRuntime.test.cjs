const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const memory = () => { const data = new Map(); return { getItem: async k => data.get(k) ?? null,
  setItem: async (k, v) => { data.set(k, v); }, removeItem: async k => { data.delete(k); } }; };
function fixture() {
  const saved = load('savedAccountStore');
  const accountStore = new saved.SavedAccountStore(memory(), memory(), async value => crypto.createHash('sha256').update(value).digest('hex'));
  const chunks = load('chunkedStorage');
  const role = load('shared/searchActivityStore');
  const parser = load('authenticateAccount', { './workerControlsApi': { isCanonicalApparatusId: () => true } });
  const controller = load('shared/accountSwitchController', { '../savedAccountStore': saved });
  const endpoints = { baseUrl: 'https://example.test', setBaseUrl: async value => { endpoints.baseUrl = value; } };
  const clearedPins = [];
  const auth = load('auth', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': chunks,
    './authenticateAccount': parser, './shared/searchActivityStore': role, './serverEndpointRuntime': { initializeServerEndpoints: async () => endpoints },
    './savedAccountRuntime': { initializeSavedAccounts: async () => accountStore }, './shared/accountSwitchController': controller,
    './pushTokenRuntime': { unregisterCurrentPushToken: async () => {} }, './appLock': { clearAppLock: async () => {} },
    './logoutSavedSession': { logoutSavedSession: async () => {} },
    './shared/switchPinRuntime': { switchPinStore: { clear: async account => clearedPins.push(account.profile.ref) } } });
  return { auth, accountStore, clearedPins };
}

test('runtime switch reauthenticates and activates the saved session', async () => {
  const previousFetch = global.fetch; const requests = [];
  global.fetch = async (url, init) => { const body = JSON.parse(init.body); requests.push(body);
    return { status: 200, json: async () => ({ token: `new-${body.phone}`, profile: { role: 'aparatchi', ref: body.phone }, capabilities: ['apparatus.queue.read'] }) }; };
  try {
    const { auth, accountStore } = fixture();
    const first = await auth.login('https://example.test', 'one', '40');
    const second = await accountStore.upsertAuthenticated({ baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'two', capabilities: [] },
      token: 'old-two', phone: 'two', code: '42', makeActive: false });
    let resets = 0; auth.registerSessionResetHook(async () => { resets++; });
    const controller = await auth.createRuntimeAccountSwitchController();
    await controller.switchTo(second.id);
    const active = await auth.loadSession();
    assert.equal(active.profile.ref, 'two'); assert.equal(active.token, 'new-two');
    assert.equal(auth.activeSessionToken(first), null); assert.equal(accountStore.activeAccountId, second.id);
    assert.equal(resets, 1); assert.deepEqual(requests, [{ phone: 'one', code: '40' }, { phone: 'two', code: '42' }]);
  } finally { global.fetch = previousFetch; }
});

test('runtime switch retains the prior session when reauthentication changes identity', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (_url, init) => { const body = JSON.parse(init.body); return { status: 200,
    json: async () => ({ token: 'new', profile: { role: 'aparatchi', ref: body.phone === 'two' ? 'other' : body.phone } }) }; };
  try {
    const { auth, accountStore } = fixture();
    const first = await auth.login('https://example.test', 'one', '40');
    const second = await accountStore.upsertAuthenticated({ baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'two' },
      token: 'old-two', phone: 'two', code: '42', makeActive: false });
    const controller = await auth.createRuntimeAccountSwitchController();
    await assert.rejects(controller.switchTo(second.id), /identity does not match/);
    assert.equal(await auth.loadSession(), first);
    assert.equal(accountStore.activeAccountId, 'https://example.test|aparatchi|one');
  } finally { global.fetch = previousFetch; }
});


test('runtime logout clears the active profile switch PIN before ending the session', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const { auth, accountStore, clearedPins } = fixture();
    await auth.login('https://example.test', 'one', '40');
    await accountStore.upsertAuthenticated({ baseUrl: 'https://example.test', profile: { role: 'aparatchi', ref: 'two' },
      token: 'two', phone: 'two', code: '42', makeActive: false });
    const controller = await auth.createRuntimeAccountSwitchController();
    await controller.logoutCurrent();
    assert.deepEqual(clearedPins, ['one']);
    assert.equal(await auth.loadSession(), null);
    assert.equal(accountStore.accounts.length, 1);
  } finally { global.fetch = previousFetch; }
});
