const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime() {
  let rejectLogin, startedLogin; const started = new Promise(resolve => { startedLogin = resolve; });
  const auth = load('auth.ts', { 'expo-secure-store': {}, 'react-native': { Platform: { OS: 'web' } }, './chunkedStorage': load('chunkedStorage.ts'),
    './serverEndpointRuntime': { initializeServerEndpoints: async () => ({ setBaseUrl: async value => value }) },
    './authenticateAccount': { authenticateAccount: () => { startedLogin(); return new Promise((_resolve, reject) => { rejectLogin = reject; }); } } });
  const routes = load('shared/appRoutes.ts'), access = load('admin/adminShellAccess.ts', { '../shared/appRoutes': routes });
  const session = { baseUrl: 'https://server.example', token: 'old', profile: { role: 'admin', ref: 'one' }, capabilities: ['admin.access'],
    assigned_apparatus: [], assigned_apparatus_labels: [], assigned_item_groups: [], assigned_warehouses: [], imageCacheScope: 'one' };
  return { auth, access, session, started, failLogin: () => rejectLogin(Error('mock login failed')) };
}
function gate(auth, access) {
  const updates = []; let effect;
  const hook = load('admin/useAdminShellSession.ts', { react: { useState: value => [value, next => updates.push(next)], useEffect: fn => { effect = fn; } },
    '../auth': auth, './adminShellAccess': access });
  hook.useAdminShellSession(); const cleanup = effect(); return { updates, cleanup };
}
test('actual witness invalidates old gate immediately on failed-login transition and only a fresh gate may recapture', async () => {
  const f = runtime(); await f.auth.saveSession(f.session); const first = gate(f.auth, f.access); await tick();
  const witness = first.updates[0].witness; assert.equal(f.auth.isSessionWitnessCurrent(witness), true);
  const login = f.auth.login('https://server.example', 'mock', 'mock'); await f.started;
  assert.equal(first.updates.at(-1), undefined); assert.equal(f.auth.activeSessionToken(f.session), 'old');
  assert.equal(f.auth.isSessionWitnessCurrent(witness), false);
  const waiting = gate(f.auth, f.access); await tick(); assert.deepEqual(waiting.updates, []); // capture is unavailable in transition
  f.failLogin(); await assert.rejects(login, /mock login failed/); await tick();
  assert.equal(f.auth.isSessionWitnessCurrent(witness), false); assert.deepEqual(waiting.updates, []); // no stale recapture
  const fresh = gate(f.auth, f.access); await tick(); assert.equal(fresh.updates[0].session, f.session);
  assert.equal(f.auth.isSessionWitnessCurrent(fresh.updates[0].witness), true);
  first.cleanup(); waiting.cleanup(); fresh.cleanup();
});
test('tracked same-session scope update invalidates the gate rather than reviving old data', async () => {
  const f = runtime(); await f.auth.saveSession(f.session); const first = gate(f.auth, f.access); await tick();
  const witness = first.updates[0].witness; f.session.capabilities.push('catalog.item.read'); await f.auth.saveSession(f.session); await tick();
  assert.equal(first.updates.at(-1), undefined); assert.equal(f.auth.isSessionWitnessCurrent(witness), false);
  const fresh = gate(f.auth, f.access); await tick(); assert.equal(f.auth.isSessionWitnessCurrent(fresh.updates[0].witness), true);
  first.cleanup(); fresh.cleanup();
});
