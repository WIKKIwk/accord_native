// Real auth state machine and role scopes with fake storage/account/network dependencies only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), module = new Module(filename);
  module.filename = filename; module.paths = require.main.paths;
  module.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return module.exports;
}
const readScope = compile('sessionReadScope.ts');
const exception = compile('shared/mobileApiException.ts');
const session = ref => ({ baseUrl: 'https://example.invalid', token: `fake-${ref}`, profile: { role: 'werka', ref },
  capabilities: ['werka.access'], assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [],
  assigned_warehouses: [], imageCacheScope: ref });
function setup(authenticate = async () => ({ token: 'fake-B', profile: { role: 'werka', ref: 'B', capabilities: ['werka.access'] } })) {
  const values = new Map(); let failMetadata = false;
  const secure = { getItemAsync: async key => values.get(key) ?? null, deleteItemAsync: async key => { values.delete(key); },
    setItemAsync: async (key, value) => {
      if (key === 'accord_v4_session' && failMetadata) { failMetadata = false; throw new Error('fake metadata failure'); }
      values.set(key, value);
    } };
  const endpoints = { setBaseUrl: async () => {} };
  const auth = compile('auth.ts', { 'expo-secure-store': secure, 'react-native': { Platform: { OS: 'ios' } },
    './chunkedStorage': { chunkedStorage: value => value },
    './serverEndpointRuntime': { initializeServerEndpoints: async () => endpoints },
    './savedAccountRuntime': { initializeSavedAccounts: async () => { throw new Error('fake unavailable account store'); } },
    './shared/searchActivityStore': { sessionAccessRole: () => 'werka' },
    './authenticateAccount': { authenticateAccount: authenticate } });
  const mocks = { '../auth': auth, '../sessionReadScope': readScope, '../shared/mobileApiException': exception };
  return { auth, mutation: compile('werka/werkaMutationScope.ts', mocks).werkaMutationScope,
    read: compile('werka/werkaReadScope.ts', mocks).werkaReadScope,
    failNextMetadata: () => { failMetadata = true; } };
}
test('a scope captured while its session is inactive cannot become usable later', async () => {
  const h = setup(), a = session('A'), read = h.read(a), mutation = h.mutation(a);
  await h.auth.saveSession(a);
  assert.throws(read, error => error.code === 'session_scope_changed');
  assert.throws(mutation.beforeSend, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === false);
});
test('same-object changes to role, permission or assigned scope invalidate both guards', async () => {
  for (const mutate of [a => { a.profile.role = 'customer'; }, a => { a.capabilities = []; },
    a => { a.assigned_warehouses = ['new-warehouse']; }, a => { a.assigned_apparatus = ['new-machine']; }]) {
    const h = setup(), a = session('A'); await h.auth.saveSession(a);
    const read = h.read(a), before = h.mutation(a), after = h.mutation(a); after.beforeSend(); mutate(a);
    assert.throws(read, error => error.code === 'session_scope_changed');
    assert.throws(before.beforeSend, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === false);
    assert.throws(after.afterResponse, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
  }
});
test('failed login rollback to the exact old object rejects prior read and write snapshots', async () => {
  const h = setup(), a = session('A'); await h.auth.saveSession(a);
  const epoch = h.auth.activeSessionEpoch(a), read = h.read(a), unsent = h.mutation(a), sent = h.mutation(a);
  sent.beforeSend(); h.failNextMetadata();
  await assert.rejects(h.auth.login('https://example.invalid', 'fake', 'fake'), /fake metadata failure/);
  assert.equal(h.auth.currentSession(), a); assert.equal(h.auth.activeSessionEpoch(a), epoch + 1);
  assert.throws(read, error => error.code === 'session_scope_changed');
  assert.throws(unsent.beforeSend, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === false);
  assert.throws(sent.afterResponse, error => error.code === 'session_scope_changed' && error.requestMayHaveBeenSent === true);
  assert.doesNotThrow(h.read(a)); assert.doesNotThrow(h.mutation(a).beforeSend);
});
test('known limit: a same-epoch saveSession A-to-B-to-A is not detected', async () => {
  const h = setup(), a = session('A'), b = session('B'); await h.auth.saveSession(a);
  const epoch = h.auth.activeSessionEpoch(a), read = h.read(a);
  await h.auth.saveSession(b); assert.throws(read, error => error.code === 'session_scope_changed');
  await h.auth.saveSession(a); assert.equal(h.auth.activeSessionEpoch(a), epoch); assert.doesNotThrow(read);
});
test('known limit: a scope captured after login starts cannot detect its later failure', async () => {
  let release, signal; const started = new Promise(resolve => { signal = resolve; });
  const h = setup(() => { signal(); return new Promise((_resolve, reject) => { release = reject; }); });
  const a = session('A'); await h.auth.saveSession(a);
  const attempt = h.auth.login('https://example.invalid', 'fake', 'fake'); await started;
  const read = h.read(a); release(new Error('fake sign-in failure')); await assert.rejects(attempt, /fake sign-in failure/);
  assert.equal(h.auth.currentSession(), a); assert.doesNotThrow(read);
});
