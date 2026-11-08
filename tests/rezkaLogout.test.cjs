const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup() {
  let current = { profile: { role: 'rezka_master', ref: 'one' } }, valid = true, transition = false, release; const calls = [];
  const snapshot = { session: current }, filename = path.resolve(__dirname, '../src/rezka/useRezkaShell.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  const mocks = { react: {}, '../auth': { currentSession: () => current, sessionWitnessTransitioning: () => transition,
      logout: s => { calls.push(['logout', s]); return new Promise(resolve => { release = resolve; }); } },
    '../shared/localization/runtime': { localeController: {} }, './rezkaSessionGuard': { isRezkaSessionCurrent: s => valid && s === snapshot },
    './rezkaShellModel': {},
    // The split-session hook imports these, but logout must not consult route permissions.
    '../shared/appRoutes': { appRoutes: { rezkaSplit: '/rezka-split' },
      canOpenRoute: () => assert.fail('Logout must not check split-route permissions') } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { start: () => mod.exports.logoutRezkaSession(snapshot, () => calls.push('finished')), calls,
    invalidate: () => { valid = false; }, replaceSession: value => { current = value; }, transitioning: value => { transition = value; },
    finish: () => release() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('old confirmation cannot begin logout or any account cleanup after a transition', async () => {
  const t = setup(); t.invalidate(); assert.equal(t.start(), false); await flush(); assert.deepEqual(t.calls, []);
});
test('logout completion never navigates away from a newly opened account or pending login', async () => {
  const t = setup(); assert.equal(t.start(), true); t.replaceSession({ profile: { role: 'rezka_master', ref: 'two' } }); t.finish(); await flush();
  assert.equal(t.calls.length, 1); assert.equal(t.calls[0][0], 'logout');
  const sameAccount = setup(); sameAccount.start(); sameAccount.replaceSession({ profile: { role: 'rezka_master', ref: 'one' } });
  sameAccount.finish(); await flush(); assert.equal(sameAccount.calls.length, 1);
  const pending = setup(); pending.start(); pending.replaceSession(null); pending.transitioning(true); pending.finish(); await flush();
  assert.equal(pending.calls.length, 1);
});
test('logout completion may navigate when no session or new transition remains', async () => {
  const t = setup(); t.start(); t.replaceSession(null); t.finish(); await flush(); assert.equal(t.calls.at(-1), 'finished');
});
