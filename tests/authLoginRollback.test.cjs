const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function auth(store, platform = 'web', existingAccountStore, failAccountInitialization = false) {
  const filename = path.resolve(__dirname, '../src/auth.ts'), loaded = new Module(filename, module);
  const accountFile = path.resolve(__dirname, '../src/authenticateAccount.ts'), account = new Module(accountFile, module);
  account.filename = accountFile; account.paths = module.paths;
  account.require = id => id === './workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[^:]+:[^:]+$/.test(value) } : require(id);
  account._compile(ts.transpileModule(fs.readFileSync(accountFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, accountFile);
  const savedFile = path.resolve(__dirname, '../src/savedAccountStore.ts'), saved = new Module(savedFile, module);
  saved.filename = savedFile; saved.paths = module.paths;
  saved._compile(ts.transpileModule(fs.readFileSync(savedFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, savedFile);
  const roleFile = path.resolve(__dirname, '../src/shared/searchActivityStore.ts'), role = new Module(roleFile, module);
  role.filename = roleFile; role.paths = module.paths;
  role._compile(ts.transpileModule(fs.readFileSync(roleFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, roleFile);
  const chunksFile = path.resolve(__dirname, '../src/chunkedStorage.ts'), chunks = new Module(chunksFile, module);
  chunks.filename = chunksFile; chunks.paths = module.paths;
  chunks._compile(ts.transpileModule(fs.readFileSync(chunksFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, chunksFile);
  const memory = () => { const values = new Map(); return { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } }; };
  const accountStore = existingAccountStore ?? new saved.exports.SavedAccountStore(memory(), memory(), async value => crypto.createHash('sha256').update(value).digest('hex'));
  const endpoints = { baseUrl: 'https://example.test', setBaseUrl: async value => { endpoints.baseUrl = value; return value; } };
  const logoutFile = path.resolve(__dirname, '../src/logoutSavedSession.ts'), logoutModule = new Module(logoutFile, module);
  logoutModule.filename = logoutFile; logoutModule.paths = module.paths;
  logoutModule._compile(ts.transpileModule(fs.readFileSync(logoutFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, logoutFile);
  const chatFile = path.resolve(__dirname, '../src/chatDeviceTokenApi.ts'), chat = new Module(chatFile, module);
  chat.filename = chatFile; chat.paths = module.paths;
  chat.require = id => id === './auth' ? loaded.exports : id === './authorizedFetch' ? {} :
    id === './workerControlsApi' ? { WorkerControlException: class extends Error {} } : require(id);
  chat._compile(ts.transpileModule(fs.readFileSync(chatFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, chatFile);
  const pushFile = path.resolve(__dirname, '../src/pushTokenRuntime.ts'), push = new Module(pushFile, module);
  push.filename = pushFile; push.paths = module.paths;
  push.require = id => id === './chatDeviceTokenApi' ? chat.exports : require(id);
  push._compile(ts.transpileModule(fs.readFileSync(pushFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, pushFile);
  const switchFile = path.resolve(__dirname, '../src/shared/accountSwitchController.ts'), switching = new Module(switchFile, module);
  switching.filename = switchFile; switching.paths = module.paths;
  switching.require = id => id === '../savedAccountStore' ? saved.exports : require(id);
  switching._compile(ts.transpileModule(fs.readFileSync(switchFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, switchFile);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'expo-secure-store' ? store : id === 'react-native' ? { Platform: { OS: platform } }
    : id === './authenticateAccount' ? account.exports : id === './chunkedStorage' ? chunks.exports : id === './savedAccountRuntime' ? { initializeSavedAccounts: async () => {
      if (failAccountInitialization) throw new Error('saved account initialization failed');
      return accountStore;
    } }
    : id === './shared/searchActivityStore' ? role.exports
    : id === './shared/accountSwitchController' ? switching.exports
    : id === './serverEndpointRuntime' ? { initializeServerEndpoints: async () => endpoints }
    : id === './logoutSavedSession' ? logoutModule.exports : id === './pushTokenRuntime' ? push.exports : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return Object.assign(loaded.exports, { testAccountStore: accountStore, testEndpoints: endpoints, testPush: push.exports });
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
    assert.deepEqual(sent, { phone: '123', code: '456' });
    assert.equal(api.testEndpoints.baseUrl, 'https://example.test');
    assert.equal(session.token, 'token');
    assert.deepEqual(session.assigned_apparatus, ['apparatus:default:press']);
    assert.deepEqual(session.assigned_apparatus_labels, ['Press']);
    assert.deepEqual(session.capabilities, ['work']);
    assert.equal(session.profile.ref, 'worker');
  } finally { global.fetch = original; }
});

test('login and startup restore a large profile with bounded native storage values', async () => {
  const original = global.fetch, values = new Map();
  const secure = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { assert.ok(Buffer.byteLength(value) < 2048); values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'token',
    profile: { role: 'aparatchi', ref: 'one', display_name: '🔒'.repeat(1200) } }) });
  try {
    const first = auth(secure, 'ios');
    await first.login('https://example.test', 'one', 'code');
    const restarted = auth(secure, 'ios', first.testAccountStore);
    assert.equal((await restarted.loadSession()).profile.display_name, '🔒'.repeat(1200));
  } finally { global.fetch = original; }
});

test('login, refresh, restart and logout work when the saved account runtime is unavailable', async () => {
  const original = global.fetch, values = new Map(), requests = []; let token = 0;
  const secure = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  global.fetch = async url => {
    requests.push(String(url));
    return { status: 200, json: async () => ({ token: `token-${++token}`, profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const first = auth(secure, 'ios', undefined, true);
    const initial = await first.login('https://example.test', 'one', 'code');
    assert.equal(await first.refreshSession(initial, 'token-1'), true);
    const restarted = auth(secure, 'ios', undefined, true);
    const session = await restarted.loadSession();
    assert.equal(session.token, 'token-2');
    await restarted.logout(session);
    assert.ok(requests.some(url => url.endsWith('/logout')));
    assert.equal(await restarted.loadSession(), null);
    assert.equal(values.size, 0);
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

test('logout unregisters the current Firebase token before ending the server session', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return { status: 200, json: async () => ({ token: 'session-token', profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code');
    const removeReader = api.testPush.registerPushTokenReader(async () => ' fcm-token ');
    await api.logout(session);
    const [unregister, logout] = requests.filter(request => request.init.method !== 'POST' || request.url.endsWith('/logout'));
    assert.equal(unregister.init.method, 'DELETE');
    assert.equal(new URL(unregister.url).searchParams.get('token'), 'fcm-token');
    assert.equal(unregister.init.headers.Authorization, 'Bearer session-token');
    assert.ok(logout.url.endsWith('/logout'));
    removeReader();
  } finally { global.fetch = original; }
});

test('logout continues when the push token reader fails and no account store is available', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async url => {
    requests.push(String(url));
    return { status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const api = auth({}, 'web', undefined, true), session = await api.login('https://example.test', 'one', 'code');
    api.testPush.registerPushTokenReader(async () => { throw Error('Firebase unavailable'); });
    await api.logout(session);
    assert.ok(requests.some(url => url.endsWith('/logout')));
    assert.equal(await api.loadSession(), null);
  } finally { global.fetch = original; }
});

test('logout unregisters push even when the active saved session is missing', async () => {
  const original = global.fetch, requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return { status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code');
    api.testAccountStore.sessionFor = async () => null;
    api.testPush.registerPushTokenReader(async () => 'fcm-token');
    await api.logout(session);
    assert.ok(requests.some(request => request.init.method === 'DELETE' && request.url.includes('/device-token')));
    assert.equal(requests.some(request => request.url.endsWith('/logout')), false);
    assert.equal(api.activeSessionToken(session), null);
  } finally { global.fetch = original; }
});

test('logout clears the active session even if removing the saved account fails', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code');
    api.testAccountStore.remove = async () => { throw Error('account removal failed'); };
    await assert.rejects(api.logout(session), /account removal failed/);
    assert.equal(api.activeSessionToken(session), null);
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

test('same-account reauthentication does not rewrite legacy credentials', async () => {
  const original = global.fetch, values = new Map(); let calls = 0, rejectCredentials = false;
  const secure = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (rejectCredentials && key === 'accord_v4_credentials') throw new Error('credentials unavailable');
      values.set(key, value);
    }, deleteItemAsync: async key => { values.delete(key); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++calls}`,
    profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth(secure, 'ios');
    const session = await api.login('https://example.test', 'phone', 'code');
    rejectCredentials = true;
    assert.equal(await api.refreshSession(session, 'token-1'), true);
    assert.equal(session.token, 'token-2');
  } finally { global.fetch = original; }
});

// @v2-test test/mobile_api_saved_accounts_test_helpers_part_01.dart
test('reauthentication accepts a changed returned identity and activates its saved account', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++calls}`,
    profile: { role: 'aparatchi', ref: calls === 1 ? 'one' : 'two' } }) });
  try {
    const api = auth({}); let resets = 0;
    api.registerSessionResetHook(async () => { resets++; });
    const session = await api.login('https://example.test', 'phone', 'code');
    const previousScope = session.imageCacheScope;
    assert.equal(await api.refreshSession(session, 'token-1'), true);
    assert.equal(session.profile.ref, 'two'); assert.equal(session.token, 'token-2');
    assert.notEqual(session.imageCacheScope, previousScope); assert.equal(resets, 1);
    assert.equal(api.testAccountStore.activeAccountId, 'https://example.test|aparatchi|two');
    assert.equal(api.testAccountStore.accounts.length, 2);
    assert.equal(await api.refreshSession(session, 'token-2'), true);
    assert.equal(session.token, 'token-3');
  } finally { global.fetch = original; }
});

test('changed reauthentication identity persists when saved-account storage is unavailable', async () => {
  const original = global.fetch, values = new Map(); let calls = 0;
  const secure = { getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); }, deleteItemAsync: async key => { values.delete(key); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++calls}`,
    profile: { role: 'aparatchi', ref: calls === 1 ? 'one' : 'two' } }) });
  try {
    const first = auth(secure, 'ios', undefined, true);
    const session = await first.login('https://example.test', 'phone', 'code');
    assert.equal(await first.refreshSession(session, 'token-1'), true);
    const restarted = auth(secure, 'ios', undefined, true);
    const restored = await restarted.loadSession();
    assert.equal(restored.profile.ref, 'two');
    assert.equal(await restarted.refreshSession(restored, 'token-2'), true);
    assert.equal(restored.token, 'token-3');
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

test('a failed session reset rolls login back to the previous account', async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const ref = JSON.parse(init.body).phone;
    return { status: 200, json: async () => ({ token: `token-${ref}`, profile: { role: 'aparatchi', ref } }) };
  };
  try {
    const api = auth({});
    const previous = await api.login('https://example.test', 'one', 'code');
    const unregister = api.registerSessionResetHook(async () => { throw Error('reset failure'); });
    await assert.rejects(api.login('https://example.test', 'two', 'code'), /reset failure/);
    assert.equal(api.activeSessionToken(previous), 'token-one');
    assert.equal(api.testAccountStore.activeAccountId, 'https://example.test|aparatchi|one');
    unregister();
  } finally { global.fetch = original; }
});


test('failed stored-account reauthentication clears the active account and session', async () => {
  const original = global.fetch; let loginAttempts = 0;
  global.fetch = async () => {
    loginAttempts++;
    if (loginAttempts > 1) return { status: 401 };
    return { status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) };
  };
  try {
    const api = auth({});
    const session = await api.login('https://example.test', 'one', '40');
    assert.equal(await api.refreshSession(session, 'token'), false);
    assert.equal(api.testAccountStore.activeAccountId, null);
    assert.equal(await api.loadSession(), null);
    assert.equal(api.testAccountStore.accounts.length, 1);
  } finally { global.fetch = original; }
});


test('login and refresh reset session-scoped state when effective access role changes', async () => {
  const original = global.fetch; let attempt = 0;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++attempt}`,
    profile: { role: 'werka', ref: 'one' }, capabilities: [attempt === 1 ? 'supplier.access' : attempt === 2 ? 'customer.access' : 'werka.access'] }) });
  try {
    const api = auth({}); let resets = 0; api.registerSessionResetHook(async () => { resets++; });
    await api.login('https://example.test', 'one', 'code');
    const session = await api.login('https://example.test', 'one', 'code');
    assert.equal(resets, 1);
    assert.equal(await api.refreshSession(session, session.token), true);
    assert.equal(resets, 2);
  } finally { global.fetch = original; }
});


test('active session epoch is read-only and detects a failed login attempt even if the previous object returns', async () => {
  const original = global.fetch, values = new Map(); let failMetadata = false;
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => { values.delete(key); },
    setItemAsync: async (key, value) => { if (key === 'accord_v4_session' && failMetadata) { failMetadata = false; throw Error('storage failure'); } values.set(key, value); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'new-token', profile: { role: 'aparatchi', ref: 'new' } }) });
  try {
    const api = auth(secure, 'ios'), previous = oldSession(), unrelated = oldSession();
    assert.equal(api.activeSessionEpoch(previous), null);
    await api.saveSession(previous);
    const before = api.activeSessionEpoch(previous);
    assert.equal(typeof before, 'number'); assert.equal(api.activeSessionEpoch(unrelated), null);
    assert.equal(api.activeSessionToken(previous), 'old-token');
    failMetadata = true;
    await assert.rejects(api.login('https://example.test', '123', '456'), /storage failure/);
    assert.equal(api.currentSession(), previous); assert.equal(api.activeSessionToken(previous), 'old-token');
    assert.equal(api.activeSessionEpoch(previous), before + 1);
    assert.equal(values.get('accord_v4_token'), 'old-token');
  } finally { global.fetch = original; }
});

test('active session epoch stays stable on token refresh and changes on clear', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++calls}`,
    profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code');
    const before = api.activeSessionEpoch(session);
    assert.equal(await api.refreshSession(session, session.token), true);
    assert.equal(api.activeSessionEpoch(session), before);
    await api.clearSession(); assert.equal(api.activeSessionEpoch(session), null);
    await api.saveSession(session); assert.equal(api.activeSessionEpoch(session), before + 1);
  } finally { global.fetch = original; }
});

test('active session epoch does not claim to detect same-epoch saveSession ABA', async () => {
  const api = auth({}), first = oldSession(), other = { ...oldSession(), profile: { role: 'aparatchi', ref: 'other' } };
  await api.saveSession(first); const before = api.activeSessionEpoch(first);
  await api.saveSession(other); assert.equal(api.activeSessionEpoch(first), null);
  await api.saveSession(first); assert.equal(api.activeSessionEpoch(first), before);
});

test('an epoch captured after login starts cannot detect that attempt rolling back', async () => {
  const original = global.fetch; let release, signal;
  const entered = new Promise(resolve => { signal = resolve; });
  global.fetch = async () => { signal(); return new Promise(resolve => { release = resolve; }); };
  try {
    const api = auth({}), previous = oldSession(); await api.saveSession(previous);
    const before = api.activeSessionEpoch(previous);
    const attempt = api.login('https://example.test', '123', 'bad');
    await entered;
    const during = api.activeSessionEpoch(previous);
    assert.equal(during, before + 1); release({ ok: false, status: 401 });
    await assert.rejects(attempt);
    assert.equal(api.currentSession(), previous); assert.equal(api.activeSessionEpoch(previous), during);
  } finally { global.fetch = original; }
});

test('witness invalidates at login start, refuses during transition and never revives after failed rollback', async () => {
  const original = global.fetch; let release, signal; const events = [];
  const entered = new Promise(resolve => { signal = resolve; });
  global.fetch = async () => { signal(); return new Promise(resolve => { release = resolve; }); };
  try {
    const api = auth({}), previous = oldSession(); await api.saveSession(previous);
    const before = api.captureSessionWitness(previous); assert.ok(before); assert.equal(api.isSessionWitnessCurrent(before), true);
    const unsubscribe = api.subscribeSessionWitness(() => events.push([api.sessionWitnessVersion(), api.isSessionWitnessCurrent(before)]));
    const pending = api.login('https://example.test', '123', 'bad');
    assert.equal(api.isSessionWitnessCurrent(before), false); assert.equal(api.captureSessionWitness(previous), null);
    assert.equal(events.length, 1); assert.equal(events[0][1], false);
    await entered; assert.equal(api.captureSessionWitness(previous), null);
    release({ status: 401 }); await assert.rejects(pending, /Login failed/);
    assert.equal(api.currentSession(), previous); assert.equal(api.isSessionWitnessCurrent(before), false);
    const after = api.captureSessionWitness(previous); assert.ok(after); assert.notEqual(after.generation, before.generation);
    assert.equal(api.isSessionWitnessCurrent(after), true); assert.ok(events.length >= 2);
    unsubscribe();
  } finally { global.fetch = original; }
});

test('same-epoch saveSession A to B to A invalidates the old witness permanently', async () => {
  const api = auth({}), first = oldSession(), other = { ...oldSession(), profile: { role: 'aparatchi', ref: 'other' } };
  await api.saveSession(first); const witness = api.captureSessionWitness(first), epoch = api.activeSessionEpoch(first);
  const saveOther = api.saveSession(other);
  assert.equal(api.captureSessionWitness(first), null); assert.equal(api.isSessionWitnessCurrent(witness), false);
  await saveOther; await api.saveSession(first);
  assert.equal(api.activeSessionEpoch(first), epoch); assert.equal(api.isSessionWitnessCurrent(witness), false);
  assert.ok(api.captureSessionWitness(first));
  assert.equal(api.isSessionWitnessCurrent({ ...witness }), false, 'only an issued frozen witness is accepted');
});

test('overlapping queued saves never admit a snapshot between A to B to A transitions', async () => {
  const values = new Map(); let release, entered, block = false;
  const started = new Promise(resolve => { entered = resolve; });
  const store = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => values.delete(key),
    setItemAsync: async (key, value) => { if (block && key === 'accord_v4_token') { block = false; entered(); await new Promise(resolve => { release = resolve; }); } values.set(key, value); } };
  const api = auth(store, 'ios'), first = oldSession(), other = { ...oldSession(), profile: { role: 'aparatchi', ref: 'other' } };
  await api.saveSession(first); const witness = api.captureSessionWitness(first); block = true;
  const b = api.saveSession(other), a = api.saveSession(first); await started;
  assert.equal(api.captureSessionWitness(first), null); release(); await Promise.all([b, a]);
  assert.equal(api.currentSession(), first); assert.equal(api.isSessionWitnessCurrent(witness), false);
  assert.ok(api.captureSessionWitness(first));
});

test('throwing and rejecting witness subscribers do not change login, rollback or clear results', async () => {
  const original = global.fetch; let fail = false;
  global.fetch = async () => fail ? { status: 401 } : ({ status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({}); let events = 0;
    const stop1 = api.subscribeSessionWitness(() => { throw new Error('subscriber failure'); });
    const stop2 = api.subscribeSessionWitness(() => Promise.reject(new Error('async subscriber failure')));
    const stop3 = api.subscribeSessionWitness(() => { events++; });
    const session = await api.login('https://example.test', 'one', 'code'); assert.equal(api.activeSessionToken(session), 'token');
    fail = true; await assert.rejects(api.login('https://example.test', 'two', 'bad'), /Login failed/);
    assert.equal(api.currentSession(), session); await api.clearSession(); assert.equal(api.currentSession(), null); assert.ok(events >= 6);
    stop1(); stop2(); stop3();
  } finally { global.fetch = original; }
});

test('scope mutation invalidates witnesses and notifies while preserving worker assignment behavior', async () => {
  const api = auth({}), session = oldSession(); await api.saveSession(session);
  const before = api.captureSessionWitness(session); let events = 0; const stop = api.subscribeSessionWitness(() => events++);
  assert.equal(api.updateSessionAssignments(session, ['apparatus:default:1'], ['First']), true);
  assert.equal(api.isSessionWitnessCurrent(before), false); assert.equal(events, 1);
  const next = api.captureSessionWitness(session); assert.ok(next);
  assert.equal(api.updateSessionAssignments(session, ['apparatus:default:1'], ['Renamed']), true);
  assert.equal(api.isSessionWitnessCurrent(next), true, 'labels are not part of the access scope');
  session.capabilities = ['rezka.master.access']; assert.equal(api.isSessionWitnessCurrent(next), false);
  await api.saveSession(session); session.capabilities = []; await api.saveSession(session);
  assert.equal(api.isSessionWitnessCurrent(next), false); stop();
});

test('same-session 401 token refresh keeps the issued witness valid for the existing retry', async () => {
  const original = global.fetch; let logins = 0, writes = 0; const headers = [];
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/login')) return new Response(JSON.stringify({ token: `token-${++logins}`, profile: { role: 'aparatchi', ref: 'one' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
    headers.push(new Headers(init.headers).get('authorization')); return new Response('{}', { status: ++writes === 1 ? 401 : 200 });
  };
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code');
    const witness = api.captureSessionWitness(session); let notifications = 0; const stop = api.subscribeSessionWitness(() => notifications++);
    const filename = path.resolve(__dirname, '../src/authorizedFetch.ts'), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === './auth' ? api : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    const response = await mod.exports.authorizedFetch(session, '/v1/mobile/test', { method: 'PUT' }, () => {
      if (!api.isSessionWitnessCurrent(witness)) throw new Error('stale witness');
    });
    assert.equal(response.status, 200); assert.equal(writes, 2); assert.deepEqual(headers, ['Bearer token-1', 'Bearer token-2']);
    assert.equal(api.isSessionWitnessCurrent(witness), true); assert.equal(notifications, 0); stop();
  } finally { global.fetch = original; }
});

test('same-object ordinary profile save preserves the witness and emits no transition', async () => {
  const api = auth({}), session = oldSession(); await api.saveSession(session);
  const witness = api.captureSessionWitness(session); let notifications = 0; const stop = api.subscribeSessionWitness(() => notifications++);
  session.profile.display_name = 'Updated'; await api.saveSession(session);
  assert.equal(api.isSessionWitnessCurrent(witness), true); assert.equal(notifications, 0);
  assert.equal((await api.loadSession()).profile.display_name, 'Updated');
  const first = api.saveSession(session), second = api.saveSession(session);
  await Promise.all([first, second]); assert.equal(api.isSessionWitnessCurrent(witness), true); assert.equal(notifications, 0); stop();
});

test('a refresh changing capability invalidates the witness before any 401 retry', async () => {
  const original = global.fetch; let logins = 0, writes = 0;
  global.fetch = async url => {
    if (String(url).endsWith('/auth/login')) return new Response(JSON.stringify({ token: `token-${++logins}`,
      profile: { role: 'aparatchi', ref: 'one' }, capabilities: [logins === 1 ? 'old.access' : 'new.access'] }), { status: 200 });
    writes++; return new Response('{}', { status: 401 });
  };
  try {
    const api = auth({}), session = await api.login('https://example.test', 'one', 'code'), witness = api.captureSessionWitness(session);
    const filename = path.resolve(__dirname, '../src/authorizedFetch.ts'), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => id === './auth' ? api : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    await assert.rejects(mod.exports.authorizedFetch(session, '/v1/mobile/test', { method: 'PUT' }, () => {
      if (!api.isSessionWitnessCurrent(witness)) throw new Error('stale witness');
    }), /stale witness/);
    assert.equal(writes, 1); assert.equal(api.isSessionWitnessCurrent(witness), false); assert.deepEqual(session.capabilities, ['new.access']);
  } finally { global.fetch = original; }
});

test('changed-scope refresh stays in transition until persistence and session installation finish', async () => {
  const original = global.fetch, values = new Map(); let logins = 0, block = false, release, signal;
  const entered = new Promise(resolve => { signal = resolve; });
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => values.delete(key),
    setItemAsync: async (key, value) => { if (block && key === 'accord_v4_session') { block = false; signal(); await new Promise(resolve => { release = resolve; }); } values.set(key, value); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: `token-${++logins}`, profile: { role: 'aparatchi', ref: 'one' },
    capabilities: [logins === 1 ? 'old.access' : 'new.access'] }) });
  try {
    const api = auth(secure, 'ios'), session = await api.login('https://example.test', 'one', 'code'), witness = api.captureSessionWitness(session);
    block = true; const refreshing = api.refreshSession(session, session.token); await entered;
    assert.equal(api.isSessionWitnessCurrent(witness), false); assert.equal(api.captureSessionWitness(session), null);
    release(); assert.equal(await refreshing, true); assert.ok(api.captureSessionWitness(session)); assert.equal(api.isSessionWitnessCurrent(witness), false);
  } finally { global.fetch = original; }
});

test('runtime account-switch witness invalidates before reauthentication and remains invalid after switch', async () => {
  const original = global.fetch; let hold = false, release, signal; const entered = new Promise(resolve => { signal = resolve; });
  global.fetch = async (_url, init) => {
    const ref = JSON.parse(init.body).phone;
    if (hold) { signal(); await new Promise(resolve => { release = resolve; }); }
    return { status: 200, json: async () => ({ token: `token-${ref}`, profile: { role: 'aparatchi', ref } }) };
  };
  try {
    const api = auth({}); await api.login('https://example.test', 'one', 'code'); const second = await api.login('https://example.test', 'two', 'code');
    const witness = api.captureSessionWitness(second), controller = await api.createRuntimeAccountSwitchController();
    const first = api.testAccountStore.accounts.find(account => account.profile.ref === 'one'); hold = true;
    const pending = controller.switchTo(first.id); assert.equal(api.isSessionWitnessCurrent(witness), false); assert.equal(api.captureSessionWitness(second), null);
    await entered; assert.equal(api.captureSessionWitness(second), null); release(); await pending;
    assert.equal(api.currentSession().profile.ref, 'one'); assert.equal(api.isSessionWitnessCurrent(witness), false); assert.ok(api.captureSessionWitness(api.currentSession()));
  } finally { global.fetch = original; }
});

test('witness scope matches the shared read scope without including tokens or presentation labels', async () => {
  const file = path.resolve(__dirname, '../src/sessionReadScope.ts'), mod = new Module(file, module); mod.filename = file; mod.paths = module.paths;
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const api = auth({}), session = { ...oldSession(), capabilities: ['b', 'a', 'a'], assigned_apparatus: ['z', 'x', 'z'],
    assigned_item_groups: undefined, profile: { role: 'aparatchi', ref: 'one', assigned_item_groups: ['g'], assigned_warehouses: ['w'] } };
  await api.saveSession(session); const witness = api.captureSessionWitness(session);
  assert.equal(witness.scope, mod.exports.sessionReadScope(session));
  session.token = 'refreshed'; session.assigned_apparatus_labels = ['new label']; assert.equal(api.isSessionWitnessCurrent(witness), true);
});

test('storage failure during login restores legacy session but not its old witness', async () => {
  const original = global.fetch, values = new Map(); let failMetadata = false;
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => values.delete(key),
    setItemAsync: async (key, value) => { if (failMetadata && key === 'accord_v4_session') { failMetadata = false; throw Error('storage failure'); } values.set(key, value); } };
  global.fetch = async () => ({ status: 200, json: async () => ({ token: 'new-token', profile: { role: 'aparatchi', ref: 'new' } }) });
  try {
    const api = auth(secure, 'ios'), previous = oldSession(); await api.saveSession(previous); const witness = api.captureSessionWitness(previous);
    failMetadata = true; const pending = api.login('https://example.test', '123', 'code'); assert.equal(api.captureSessionWitness(previous), null);
    await assert.rejects(pending, /storage failure/); assert.equal(api.currentSession(), previous); assert.equal(values.get('accord_v4_token'), 'old-token');
    assert.equal(api.isSessionWitnessCurrent(witness), false); assert.ok(api.captureSessionWitness(previous));
  } finally { global.fetch = original; }
});

test('witness transition ends before the adopted login promise settles on success and rejection', async () => {
  const original = global.fetch; let fail = false;
  global.fetch = async () => fail ? { status: 401 } : ({ status: 200, json: async () => ({ token: 'token', profile: { role: 'aparatchi', ref: 'one' } }) });
  try {
    const api = auth({}), previous = oldSession(); await api.saveSession(previous); const events = [];
    const stop = api.subscribeSessionWitness(() => events.push(api.captureSessionWitness(api.currentSession()) ? 'end' : 'begin'));
    const good = api.login('https://example.test', 'one', 'code'); good.then(() => events.push('resolved'));
    await good; assert.deepEqual(events, ['begin', 'end', 'resolved']); events.length = 0;
    fail = true; const bad = api.login('https://example.test', 'one', 'bad'); bad.catch(() => events.push('rejected'));
    await assert.rejects(bad, /Login failed/); assert.deepEqual(events, ['begin', 'end', 'rejected']); stop();
  } finally { global.fetch = original; }
});

test('witness capture fails closed for missing or inactive sessions', async () => {
  const api = auth({}), session = oldSession();
  assert.equal(api.captureSessionWitness(null), null); assert.equal(api.captureSessionWitness(undefined), null);
  assert.equal(api.captureSessionWitness(session), null); await api.saveSession(session);
  assert.ok(api.captureSessionWitness(session)); await api.clearSession(); assert.equal(api.captureSessionWitness(session), null);
});

test('observed direct scope loss permanently retires a witness after the scope returns', async () => {
  const api = auth({}), session = oldSession(); session.capabilities = ['one']; await api.saveSession(session);
  const old = api.captureSessionWitness(session); assert.equal(api.isSessionWitnessCurrent(old), true);
  session.capabilities = ['two']; assert.equal(api.isSessionWitnessCurrent(old), false);
  session.capabilities = ['one']; assert.equal(api.isSessionWitnessCurrent(old), false);
  const fresh = api.captureSessionWitness(session); assert.ok(fresh); assert.equal(api.isSessionWitnessCurrent(fresh), true);
});
