const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function auth(store, platform = 'web') {
  const filename = path.resolve(__dirname, '../src/auth.ts'), loaded = new Module(filename, module);
  const accountFile = path.resolve(__dirname, '../src/authenticateAccount.ts'), account = new Module(accountFile, module);
  account.filename = accountFile; account.paths = module.paths;
  account.require = id => id === './workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[^:]+:[^:]+$/.test(value) } : require(id);
  account._compile(ts.transpileModule(fs.readFileSync(accountFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, accountFile);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => id === 'expo-secure-store' ? store : id === 'react-native' ? { Platform: { OS: platform } }
    : id === './authenticateAccount' ? account.exports : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
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
  } finally { global.fetch = original; }
});

test('login uses V2 account parsing and keeps assigned machines in the session', async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => ({ status: 200, json: async () => ({ token: ' token ',
    profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['work'],
    assigned_apparatus: ['apparatus:default:press', 'apparatus:default:press'], assigned_apparatus_labels: [' Press '] }) });
  try {
    const api = auth({});
    const session = await api.login('https://example.test', '123', '456');
    assert.equal(session.token, 'token');
    assert.deepEqual(session.assigned_apparatus, ['apparatus:default:press']);
    assert.deepEqual(session.assigned_apparatus_labels, ['Press']);
    assert.deepEqual(session.capabilities, ['work']);
    assert.equal(session.profile.ref, 'worker');
  } finally { global.fetch = original; }
});
