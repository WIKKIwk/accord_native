const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks) {
  const filename = path.resolve(__dirname, `../src/material/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(initialTransition = false) {
  const session = { token: 'a', profile: { role: 'material_taminotchi', ref: 'x' } }, listeners = new Set(), effects = [];
  let active = session, entry, transition = initialTransition, captures = 0, version = 0, reset, logouts = 0, slot = 0;
  const refs = [], retired = new Set();
  const react = { useState: () => [entry, value => { entry = value; }], useRef: initial => refs[slot] ??= { current: initial },
    useEffect: fn => { effects.push(fn); }, useSyncExternalStore: (subscribe, read) => { subscribe(() => {}); read(); } };
  react.useRef = initial => { const current = refs[slot] ??= { current: initial }; slot++; return current; };
  const auth = { loadSession: async () => active, captureSessionWitness: value => { captures++; return !transition && value?.token && value === active ? { session: value, version } : null; },
    isSessionWitnessCurrent: witness => { if (!witness || retired.has(witness)) return false;
      if (transition || witness.session !== active || witness.version !== version) { retired.add(witness); return false; } return true; },
    registerSessionResetHook: fn => { reset = fn; return () => {}; }, sessionWitnessVersion: () => version,
    sessionWitnessTransitioning: () => transition,
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    logout: async () => { logouts++; } };
  const bootstrap = compile('materialSessionBootstrap', { '../auth': auth });
  const hook = compile('useMaterialSession', { react, '../auth': auth, '../appLock': { clearAppLock: async () => {} },
    './materialSessionBootstrap': bootstrap, './materialTestSession': { isMaterialTestSession: value => value.token === 'test-mode-token' } }).useMaterialSession;
  const render = () => { slot = 0; return hook(); };
  return { session, render, effects, captures: () => captures, logouts: () => logouts,
    start: () => { transition = true; version++; listeners.forEach(listener => listener()); },
    finish: (next = active) => { active = next; transition = false; version++; listeners.forEach(listener => listener()); }, reset: () => reset() };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function mount(h) { const initial = h.render(); assert.equal(initial.session, undefined); const cleanup = h.effects.splice(0).map(effect => effect());
  await tick(); return cleanup; }

test('shell captures once and same-session token rotation keeps the Profile and Home session', async () => {
  const h = setup(); await mount(h); let view = h.render(); assert.equal(view.session, h.session); assert.ok(view.witness);
  h.session.token = 'refreshed'; view = h.render(); assert.equal(view.session, h.session); assert.equal(h.captures(), 1);
});

test('tracked transition and rollback retire shell and reject stale logout without recapture', async () => {
  const h = setup(); await mount(h); const old = h.render(); h.start(); let view = h.render();
  assert.equal(view.session, null); assert.equal(view.witness, null); old.onLogout(); assert.equal(h.logouts(), 0);
  h.finish(); await tick(); view = h.render(); assert.equal(view.session, null); assert.equal(h.captures(), 1);
});

test('new mount during transition stays pending until it validates the final session', async () => {
  const h = setup(true); await mount(h); assert.equal(h.render().session, undefined); assert.equal(h.captures(), 0);
  h.finish(); await tick(); assert.equal(h.render().session, h.session); assert.equal(h.captures(), 1);
});

test('session reset clears a settled shell snapshot', async () => {
  const h = setup(); await mount(h); assert.equal(h.render().session, h.session); await h.reset(); assert.equal(h.render().session, null);
});

test('reset while new shell waits does not trigger an old-session redirect loop', async () => {
  const h = setup(true); await mount(h); await h.reset(); assert.equal(h.render().session, undefined);
  h.finish(); await tick(); assert.equal(h.render().session, h.session);
});


test('reserved test token never invokes real logout', async () => {
  const h = setup(); h.session.token = 'test-mode-token'; await mount(h); h.render().onLogout(); await tick();
  assert.equal(h.logouts(), 0); assert.equal(h.render().session, h.session);
});
