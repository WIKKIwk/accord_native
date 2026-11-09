const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const testFile = path.resolve(__dirname, 'authLoginRollback.test.cjs'), helper = new Module(testFile, module);
helper.filename = testFile; helper.paths = module.paths;
helper._compile(fs.readFileSync(testFile, 'utf8').split("test('failed login retains")[0] + '\nmodule.exports = { auth };', testFile);
function load(auth) {
  const cache = new Map();
  function get(relative) {
    const file = path.resolve(__dirname, '../src', `${relative}.ts`);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file, module); cache.set(file, mod); mod.filename = file; mod.paths = module.paths;
    mod.require = id => id === '../auth' || id === './auth' ? auth : id.startsWith('.')
      ? get(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(file), id))) : id === 'expo/fetch' ? require('./support/expoFetch.cjs') : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    return mod.exports;
  }
  return { guard: get('rezka/rezkaSessionGuard'), api: get('rezka/rezkaMasterApi') };
}
const master = () => ({ token: 'master-token', baseUrl: 'https://example.test', imageCacheScope: 'scope',
  profile: { role: 'rezka_master', ref: 'master' }, capabilities: ['rezka.master.access'], assigned_apparatus: [], assigned_apparatus_labels: [] });
test('actual auth witness prevents old master mutation throughout a failed login and after rollback', async () => {
  const original = global.fetch; let release, signal, writes = 0; const entered = new Promise(resolve => { signal = resolve; });
  global.fetch = async url => { if (String(url).endsWith('/auth/login')) { signal(); return new Promise(resolve => { release = resolve; }); }
    writes++; return new Response('{}'); };
  try {
    const auth = helper.exports.auth({}), s = master(); await auth.saveSession(s); const t = load(auth), snapshot = t.guard.captureRezkaSession(s);
    assert.equal(t.guard.isRezkaSessionCurrent(snapshot, 'master'), true);
    const pending = auth.login('https://example.test', 'new', 'bad'); const rejected = assert.rejects(pending, /Login failed/); await entered;
    assert.equal(t.guard.captureRezkaSession(s).witness, null);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', [], [], snapshot), e => e.name === 'RezkaScopeChanged' && !e.mayHaveExecuted);
    release({ status: 401 }); await rejected; assert.equal(auth.currentSession(), s);
    assert.equal(t.guard.isRezkaSessionCurrent(snapshot, 'master'), false); assert.equal(t.guard.isRezkaSessionCurrent(t.guard.captureRezkaSession(s), 'master'), true);
    assert.equal(writes, 0);
  } finally { global.fetch = original; }
});
test('actual auth witness rejects same-epoch account ABA and known fake token before dispatch', async () => {
  const original = global.fetch; let writes = 0; global.fetch = async () => { writes++; return new Response('{}'); };
  try {
    const auth = helper.exports.auth({}), s = master(), other = { ...master(), profile: { role: 'rezka_master', ref: 'other' } };
    await auth.saveSession(s); const t = load(auth), snapshot = t.guard.captureRezkaSession(s), epoch = auth.activeSessionEpoch(s);
    await auth.saveSession(other); await auth.saveSession(s); assert.equal(auth.activeSessionEpoch(s), epoch);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', [], [], snapshot), e => !e.mayHaveExecuted);
    s.token = 'test-mode-token'; const fake = t.guard.captureRezkaSession(s);
    await assert.rejects(t.api.rezkaMasterAssignWorker(s, 'w', [], [], fake), e => !e.mayHaveExecuted); assert.equal(writes, 0);
  } finally { global.fetch = original; }
});
