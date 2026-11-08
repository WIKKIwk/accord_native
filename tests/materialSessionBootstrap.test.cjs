const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup({ transitioning = false, session = { token: 'token', profile: { role: 'material_taminotchi', ref: 'old' } }, duringSubscribe, finishOnSubscribe = false, loadGate = null } = {}) {
  const filename = path.resolve(__dirname, '../src/material/materialSessionBootstrap.ts'), loaded = new Module(filename, module);
  const listeners = new Set(), delivered = [], witnesses = new Set(); let version = 0, loads = 0, captures = 0, pending = loadGate;
  const auth = { sessionWitnessVersion: () => version, sessionWitnessTransitioning: () => transitioning,
    subscribeSessionWitness: fn => { listeners.add(fn); if (finishOnSubscribe) { transitioning = false; version++; } duringSubscribe?.(); return () => listeners.delete(fn); },
    loadSession: async () => { loads++; return pending ? pending.promise : session; },
    captureSessionWitness: value => { captures++; if (transitioning || !value?.token || value !== session) return null;
      const witness = { session: value, version }; witnesses.add(witness); return witness; },
    isSessionWitnessCurrent: witness => witnesses.has(witness) && !transitioning && witness.session === session && witness.version === version };
  loaded.filename = filename; loaded.paths = module.paths; loaded.require = id => id === '../auth' ? auth : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const bootstrap = loaded.exports.startMaterialSessionBootstrap(value => delivered.push(value));
  const emit = () => { version++; listeners.forEach(fn => fn()); };
  return { auth, bootstrap, delivered, loads: () => loads, captures: () => captures, hold: () => { pending = deferred(); return pending; },
    start: () => { transitioning = true; emit(); }, finish: next => { session = next; transitioning = false; pending = null; emit(); },
    replace: next => { session = next; pending = null; }, emit, listenerCount: () => listeners.size };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('new mount waits for successful transition and loads final session once', async () => {
  const h = setup({ transitioning: true }); await tick(); assert.equal(h.loads(), 0); assert.deepEqual(h.delivered, []);
  const next = { token: 'new', profile: { role: 'material_taminotchi', ref: 'new' } }; h.finish(next); await tick();
  assert.equal(h.delivered.length, 1); assert.equal(h.delivered[0].session, next); assert.equal(h.loads(), 1); h.bootstrap.stop();
});

test('subscription recheck handles completion during registration', async () => {
  const h = setup({ transitioning: true, finishOnSubscribe: true }); await tick();
  assert.equal(h.loads(), 1); assert.ok(h.delivered[0]?.witness); h.bootstrap.stop();
});

test('transition ending in a different role delivers that role for layout authorization', async () => {
  const h = setup({ transitioning: true }), next = { token: 'new', profile: { role: 'aparatchi', ref: 'worker' } };
  h.finish(next); await tick(); assert.equal(h.delivered[0].session, next);
  assert.notEqual(h.delivered[0].session.profile.role, 'material_taminotchi'); h.bootstrap.stop();
});

test('new mount after failed transition can load the final rollback without reviving an old witness', async () => {
  const old = { token: 'old', profile: { role: 'material_taminotchi', ref: 'old' } }, h = setup({ transitioning: true, session: old });
  await tick(); h.finish(old); await tick(); assert.equal(h.delivered[0].session, old);
  const witness = h.delivered[0].witness; h.start(); h.finish(old); await tick();
  assert.equal(h.auth.isSessionWitnessCurrent(witness), false); assert.equal(h.delivered.length, 1); assert.equal(h.captures(), 1); h.bootstrap.stop();
});

test('transition starting during load discards the old read and waits for the final account', async () => {
  const gate = deferred(), old = { token: 'old', profile: { role: 'material_taminotchi', ref: 'old' } };
  const h = setup({ session: old, loadGate: gate }); assert.equal(h.loads(), 1); h.start(); gate.resolve(old); await tick();
  assert.deepEqual(h.delivered, []);
  const next = { token: 'new', profile: { role: 'material_taminotchi', ref: 'new' } }; h.finish(next); await tick();
  assert.equal(h.loads(), 2); assert.equal(h.delivered[0].session, next); h.bootstrap.stop();
});

test('reset retry while load is in flight discards the old result even without an event', async () => {
  const gate = deferred(), old = { token: 'old' }, next = { token: 'new' }, h = setup({ session: old, loadGate: gate });
  h.bootstrap.retry(); h.replace(next); gate.resolve(old); await tick();
  assert.equal(h.loads(), 2); assert.equal(h.delivered[0].session, next); h.bootstrap.stop();
});

test('truly logged-out and invalid-token states finish instead of spinning', async () => {
  for (const session of [null, { token: '', profile: { role: 'material_taminotchi', ref: 'x' } }]) {
    const h = setup({ session }); await tick(); assert.deepEqual(h.delivered, [null]); assert.equal(h.loads(), 1); h.bootstrap.stop();
  }
});

test('test-mode-token is not a demo flag and does not keep bootstrap loading', async () => {
  const session = { token: 'test-mode-token', profile: { role: 'material_taminotchi', ref: 'x' } }, h = setup({ session });
  await tick(); assert.equal(h.delivered[0].session, session); assert.equal(h.loads(), 1); h.bootstrap.stop();
});

test('unmount while waiting or loading does not deliver a stale session', async () => {
  const waiting = setup({ transitioning: true }); waiting.bootstrap.stop(); waiting.finish({ token: 'new' }); await tick();
  assert.deepEqual(waiting.delivered, []); assert.equal(waiting.listenerCount(), 0);
  const gate = deferred(), loading = setup({ loadGate: gate }); loading.bootstrap.stop(); gate.resolve({ token: 'late' }); await tick();
  assert.deepEqual(loading.delivered, []);
});
