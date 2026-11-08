const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(mocks) {
  const filename = path.resolve(__dirname, '../src/material/useMaterialSession.ts'), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports.useMaterialSession;
}
function setup(captureAllowed = true) {
  const session = { token: 'a', profile: { role: 'material_taminotchi', ref: 'x' } }, witness = {}, listeners = new Set(), effects = [];
  let entry, current = true, retired = false, captures = 0, version = 0, reset, logout = 0;
  const ref = { current: 0 };
  const react = { useState: () => [entry, value => { entry = value; }], useRef: () => ref,
    useEffect: fn => { effects.push(fn); }, useSyncExternalStore: (subscribe, read) => { subscribe(() => {}); read(); } };
  const auth = { loadSession: async () => session, captureSessionWitness: value => { captures++; return captureAllowed && value === session ? witness : null; },
    isSessionWitnessCurrent: value => { if (!current) retired = true; return value === witness && current && !retired; },
    registerSessionResetHook: fn => { reset = fn; return () => {}; }, sessionWitnessVersion: () => version,
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    logout: async () => { logout++; } };
  const hook = compile({ react, '../auth': auth, '../appLock': { clearAppLock: async () => {} } });
  return { session, witness, hook, effects, captures: () => captures, logout: () => logout,
    transition: () => { current = false; version++; listeners.forEach(listener => listener()); },
    finish: () => { current = true; version++; listeners.forEach(listener => listener()); }, reset: () => reset() };
}
async function mount(h) { const initial = h.hook(); assert.equal(initial.session, undefined); const cleanup = h.effects.splice(0).map(effect => effect());
  await new Promise(resolve => setImmediate(resolve)); return cleanup; }

test('shell captures once and same-session token rotation keeps the Profile and Home session', async () => {
  const h = setup(); await mount(h); let view = h.hook(); assert.equal(view.session, h.session); assert.equal(view.witness, h.witness);
  h.session.token = 'refreshed'; view = h.hook(); assert.equal(view.session, h.session); assert.equal(h.captures(), 1);
});

test('tracked transition and rollback retire shell and reject stale logout without recapture', async () => {
  const h = setup(); await mount(h); const old = h.hook(); h.transition(); let view = h.hook();
  assert.equal(view.session, null); assert.equal(view.witness, null); old.onLogout(); assert.equal(h.logout(), 0);
  h.finish(); view = h.hook(); assert.equal(view.session, null); assert.equal(h.captures(), 1);
});

test('capture during a transition does not silently reopen when it finishes', async () => {
  const h = setup(false); await mount(h); assert.equal(h.hook().session, null); h.finish(); assert.equal(h.hook().session, null);
  assert.equal(h.captures(), 1);
});

test('session reset clears the shell snapshot', async () => {
  const h = setup(); await mount(h); assert.equal(h.hook().session, h.session); await h.reset(); assert.equal(h.hook().session, null);
});
