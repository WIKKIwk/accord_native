const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function auth(store, platform = 'web', existingAccountStore) {
  const filename = path.resolve(__dirname, '../src/auth.ts'), loaded = new Module(filename, module);
  const accountFile = path.resolve(__dirname, '../src/authenticateAccount.ts'), account = new Module(accountFile, module);
  account.filename = accountFile; account.paths = module.paths;
  account.require = id => id === './workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[^:]+:[^:]+$/.test(value) } : require(id);
  account._compile(ts.transpileModule(fs.readFileSync(accountFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, accountFile);
  const savedFile = path.resolve(__dirname, '../src/savedAccountStore.ts'), saved = new Module(savedFile, module);
  saved.filename = savedFile; saved.paths = module.paths;
  saved._compile(ts.transpileModule(fs.readFileSync(savedFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, savedFile);
  const memory = () => { const values = new Map(); return { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } }; };
  const accountStore = existingAccountStore ?? new saved.exports.SavedAccountStore(memory(), memory(), async value => crypto.createHash('sha256').update(value).digest('hex'));
  const logoutFile = path.resolve(__dirname, '../src/logoutSavedSession.ts'), logoutModule = new Module(logoutFile, module);
  logoutModule.filename = logoutFile; logoutModule.paths = module.paths;
  logoutModule._compile(ts.transpileModule(fs.readFileSync(logoutFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, logoutFile);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'expo-secure-store' ? store : id === 'react-native' ? { Platform: { OS: platform } }
    : id === './authenticateAccount' ? account.exports : id === './savedAccountRuntime' ? { initializeSavedAccounts: async () => accountStore }
    : id === './logoutSavedSession' ? logoutModule.exports : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return Object.assign(loaded.exports, { testAccountStore: accountStore });
}
const oldSession = () => ({ baseUrl: 'https://example.test', token: 'old-token', profile: { role: 'aparatchi', ref: 'old' }, capabilities: [], assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: 'old' });
test('failed login retains the prior active session', async () => {
  const original = global.fetch; global.fetch = async () => ({ ok: false, status: 401 });
  try {
    const api = auth({}), previous = oldSession(); await api.saveSession(previous);
    await assert.rejects(api.login('https://example.test', '123', 'bad'));
    assert.equal(api.activeSessionToken(previous), 'old-token'); assert.equal(await api.loadSession(), previous);
  } finally { global.fetch = original; }
});
test('storage failure rolls the prior session back', async () => {
  const original = global.fetch, values = new Map(); let failMetadata = false;
  const store = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => { values.delete(key); },
    setItemAsync: async (key, value) => { if (key === 'accord_v4_session' && failMetadata) { failMetadata = false; throw Error('storage failure'); } values.set(key, value); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'new-token', profile: { role: 'aparatchi', ref: 'new' } }) });
  try {
    const api = auth(store, 'ios'), previous = oldSession(); await api.saveSession(previous); failMetadata = true;
    await assert.rejects(api.login('https://example.test', '123', '456'), /storage failure/);
    assert.equal(api.activeSessionToken(previous), 'old-token'); assert.equal(values.get('accord_v4_token'), 'old-token');
    assert.equal(JSON.parse(values.get('accord_v4_session')).profile.ref, 'old');
    assert.equal(api.testAccountStore.activeAccountId, 'https://example.test|aparatchi|old');
  } finally { global.fetch = original; }
});

test('login uses V2 account parsing and keeps assigned machines in the session', async () => {
  const original = global.fetch; let sent;
  global.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { status: 200, json: async () => ({ token: ' token ',
    profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['work'],
    assigned_apparatus: ['apparatus:default:press', 'apparatus:default:press'], assigned_apparatus_labels: [' Press '] }) }; };
  try {
    const api = auth({});
    const session = await api.login('https://example.test', ' 123 ', ' 456 ');
    assert.deepEqual(sent, { phone: ' 123 ', code: ' 456 ' });
    assert.equal(session.token, 'token');
    assert.deepEqual(session.assigned_apparatus, ['apparatus:default:press']);
    assert.deepEqual(session.assigned_apparatus_labels, ['Press']);
    assert.deepEqual(session.capabilities, ['work']);
    assert.equal(session.profile.ref, 'worker');
  } finally { global.fetch = original; }
});

test('logging into another account retains the prior saved account and activates the new one', async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const ref = JSON.parse(init.body).phone.trim();
    return { status: 200, json: async () => ({ token: `token-${ref}`, profile: { role: 'aparatchi', ref } }) };
  };
  try {
    const api = auth({});
    await api.login('https://example.test', 'one', 'code-one');
    await api.login('https://example.test', 'two', 'code-two');
    const accounts = api.testAccountStore;
    assert.equal(accounts.accounts.length, 2);
    assert.equal(accounts.activeAccountId, 'https://example.test|aparatchi|two');
    assert.equal((await accounts.sessionFor('https://example.test|aparatchi|one')).code, 'code-one');
  } finally { global.fetch = original; }
});

test('logout removes only the active saved account even if server logout fails', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith('/logout')) throw new Error('network unavailable');
    const ref = JSON.parse(init.body).phone;
    return { status: 200, json: async () => ({ token: `token-${ref}`, profile: { role: 'aparatchi', ref } }) };
  };
  try {
    const api = auth({});
    await api.login('https://example.test', 'one', 'code-one');
    const current = await api.login('https://example.test', 'two', 'code-two');
    await api.logout(current);
    assert.equal(api.testAccountStore.activeAccountId, null);
    assert.deepEqual(api.testAccountStore.accounts.map(account => account.profile.ref), ['one']);
    assert.equal((await api.testAccountStore.sessionFor('https://example.test|aparatchi|one')).token, 'token-one');
    assert.equal(await api.loadSession(), null);
    const logoutRequest = requests.find(request => request.url.endsWith('/logout'));
    assert.equal(logoutRequest.init.headers.Authorization, 'Bearer token-two');
  } finally { global.fetch = original; }
});

test('startup restores the active saved account if the older single-session copy is absent', async () => {
  const original = global.fetch, values = new Map();
  const secure = { getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'saved-token', profile: { role: 'aparatchi', ref: 'one' },
    assigned_apparatus: ['apparatus:default:press'] }) });
  try {
    const first = auth(secure, 'ios');
    await first.login('https://example.test', 'one', 'code');
    values.clear();
    const restarted = auth(secure, 'ios', first.testAccountStore);
    const restored = await restarted.loadSession();
    assert.equal(restored.token, 'saved-token');
    assert.deepEqual(restored.assigned_apparatus, ['apparatus:default:press']);
    assert.equal(JSON.parse(values.get('accord_v4_credentials')).code, 'code');
  } finally { global.fetch = original; }
});

test('reauthentication updates the active saved account token', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: ++calls === 1 ? 'old-token' : 'new-token',
    profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({});
    const session = await api.login('https://example.test', 'one', 'code');
    assert.equal(await api.refreshSession(session, 'old-token'), true);
    assert.equal(session.token, 'new-token');
    assert.equal((await api.testAccountStore.sessionFor(api.testAccountStore.activeAccountId)).token, 'new-token');
  } finally { global.fetch = original; }
});

test('profile updates synchronize the active saved account', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({});
    const session = await api.login('https://example.test', 'one', 'code');
    session.profile.display_name = 'Updated';
    session.assigned_apparatus = ['apparatus:default:press'];
    await api.saveSession(session);
    const saved = await api.testAccountStore.sessionFor(api.testAccountStore.activeAccountId);
    assert.equal(saved.account.profile.display_name, 'Updated');
    assert.deepEqual(saved.account.profile.assigned_apparatus, ['apparatus:default:press']);
    assert.equal(api.updateSessionAssignments(session, ['apparatus:default:second'], ['Second']), true);
    await api.loadSession();
    const after = await api.testAccountStore.sessionFor(api.testAccountStore.activeAccountId);
    assert.deepEqual(after.account.profile.assigned_apparatus, ['apparatus:default:second']);
    assert.deepEqual(after.account.profile.assigned_apparatus_labels, ['Second']);
  } finally { global.fetch = original; }
});

test('login resets session-scoped state only when the account identity changes', async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const ref = JSON.parse(init.body).phone;
    return { status: 200, json: async () => ({ token: `token-${ref}`, profile: { role: 'aparatchi', ref } }) };
  };
  try {
    const api = auth({}); let resets = 0;
    const unregister = api.registerSessionResetHook(async () => { resets++; });
    await api.login('https://example.test', 'one', 'code');
    await api.login('https://example.test', 'one', 'code');
    assert.equal(resets, 0);
    await api.login('https://example.test', 'two', 'code');
    assert.equal(resets, 1);
    unregister();
  } finally { global.fetch = original; }
});

test('reauthentication cannot update a saved account while logout owns the account operation', async () => {
  const original = global.fetch;
  let releaseLogout, signalStart, logins = 0;
  const started = new Promise(resolve => { signalStart = resolve; });
  global.fetch = async (url) => {
    if (String(url).endsWith('/logout')) {
      signalStart();
      await new Promise(resolve => { releaseLogout = resolve; });
      return { status: 200 };
    }
    return { status: 200, json: async () => ({ token: ++logins === 1 ? 'old-token' : 'new-token',
      profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const api = auth({});
    const session = await api.login('https://example.test', 'one', 'code');
    const loggingOut = api.logout(session);
    await started;
    assert.equal(await api.refreshSession(session, 'old-token'), false);
    assert.equal((await api.testAccountStore.sessionFor(api.testAccountStore.activeAccountId)).token, 'old-token');
    releaseLogout(); await loggingOut;
  } finally { global.fetch = original; }
});
