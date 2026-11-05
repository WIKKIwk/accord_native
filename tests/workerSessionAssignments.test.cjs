const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function authWithMemoryStore() {
  const values = new Map();
  const store = {
    setItemAsync: async (key, value) => { values.set(key, value); },
    getItemAsync: async key => values.get(key) ?? null,
    deleteItemAsync: async key => { values.delete(key); },
  };
  const filename = path.resolve(__dirname, '../src/auth.ts');
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id === 'expo-secure-store' ? store : id === 'react-native' ? { Platform: { OS: 'ios' } } : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { auth: loaded.exports, values };
}

test('updated assignments are saved for the active session and cannot revive a logged-out session', async () => {
  const { auth, values } = authWithMemoryStore();
  const session = { token: 'token', baseUrl: 'https://example.com', profile: { ref: 'worker', role: 'aparatchi' },
    capabilities: [], assigned_apparatus: ['one'], assigned_apparatus_labels: ['One'], imageCacheScope: 'scope' };
  await auth.saveSession(session);
  assert.equal(auth.updateSessionAssignments(session, ['one', 'two'], ['One', 'Two']), true);
  await auth.loadSession();
  const saved = JSON.parse(values.get('accord_v4_session'));
  assert.deepEqual(saved.assigned_apparatus, ['one', 'two']);
  assert.deepEqual(saved.assigned_apparatus_labels, ['One', 'Two']);
  assert.equal(saved.token, undefined);
  await auth.clearSession();
  assert.equal(auth.updateSessionAssignments(session, ['other'], ['Other']), false);
  assert.equal(await auth.loadSession(), null);
});

test('session reset hooks do not reorder a subsequent login', async () => {
  const { auth } = authWithMemoryStore();
  const session = token => ({ token, baseUrl: 'https://example.com', profile: { ref: token, role: 'aparatchi' },
    capabilities: [], assigned_apparatus: [], assigned_apparatus_labels: [], imageCacheScope: token });
  await auth.saveSession(session('old'));
  let release;
  const unhook = auth.registerSessionResetHook(() => new Promise(resolve => { release = resolve; }));
  const clearing = auth.clearSession(), next = session('new'), saving = auth.saveSession(next);
  await new Promise(resolve => queueMicrotask(resolve));
  release();
  await Promise.all([clearing, saving]);
  unhook();
  assert.equal((await auth.loadSession()).token, 'new');
});
