const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks) {
  const filename = path.resolve(__dirname, `../src/boyoqchi/${file}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function setup(initialTransition = false) {
  const session = { token: 'a', profile: { role: 'boyoqchi', ref: 'x' } }, listeners = new Set(), effects = [];
  let active = session, entry, transition = initialTransition, captures = 0, version = 0, reset, slot = 0;
  const refs = [], retired = new Set();
  const react = { useState: () => [entry, value => { entry = value; }],
    useRef: initial => { const current = refs[slot] ??= { current: initial }; slot++; return current; },
    useEffect: fn => { effects.push(fn); }, useSyncExternalStore: (subscribe, read) => { subscribe(() => {}); read(); } };
  const auth = { loadSession: async () => active,
    captureSessionWitness: value => { captures++; return !transition && value?.token && value === active ? { session: value, version } : null; },
    isSessionWitnessCurrent: witness => { if (!witness || retired.has(witness)) return false;
      if (transition || witness.session !== active || witness.version !== version) { retired.add(witness); return false; } return true; },
    registerSessionResetHook: fn => { reset = fn; return () => {}; }, sessionWitnessVersion: () => version,
    sessionWitnessTransitioning: () => transition,
    subscribeSessionWitness: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const bootstrap = compile('boyoqchiSessionBootstrap', { '../auth': auth });
  const hook = compile('useBoyoqchiSession', { react, '../auth': auth, './boyoqchiSessionBootstrap': bootstrap }).useBoyoqchiSession;
  const render = () => { slot = 0; return hook(); };
  return { session, render, effects, captures: () => captures,
    start: () => { transition = true; version++; listeners.forEach(listener => listener()); },
    finish: (next = active) => { active = next; transition = false; version++; listeners.forEach(listener => listener()); }, reset: () => reset() };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function mount(h) { const initial = h.render(); assert.equal(initial.witness, undefined);
  const cleanup = h.effects.splice(0).map(effect => effect()); await tick(); return cleanup; }

test('shell captures once and same-session token rotation keeps the witness', async () => {
  const h = setup(); const cleanup = await mount(h); let view = h.render(); assert.equal(view.witness.session, h.session);
  h.session.token = 'refreshed'; view = h.render(); assert.equal(view.witness.session, h.session); assert.equal(h.captures(), 1);
  cleanup.forEach(fn => fn?.()); assert.equal(view.mounted.current, false);
});

test('transition and same-object rollback retire the settled shell without recapturing', async () => {
  const h = setup(); const cleanup = await mount(h); h.start(); assert.equal(h.render().witness, null);
  h.finish(); await tick(); assert.equal(h.render().witness, null); assert.equal(h.captures(), 1); cleanup.forEach(fn => fn?.());
});

test('fresh shell during transition stays pending until it validates the final session', async () => {
  const h = setup(true); const cleanup = await mount(h); assert.equal(h.render().witness, undefined); assert.equal(h.captures(), 0);
  h.finish(); await tick(); assert.equal(h.render().witness.session, h.session); assert.equal(h.captures(), 1); cleanup.forEach(fn => fn?.());
});

test('reset clears a settled shell but a pending fresh shell waits for the transition', async () => {
  const settled = setup(); const firstCleanup = await mount(settled); await settled.reset(); assert.equal(settled.render().witness, null);
  const pending = setup(true); const secondCleanup = await mount(pending); await pending.reset();
  assert.equal(pending.render().witness, undefined); pending.finish(); await tick(); assert.equal(pending.render().witness.session, pending.session);
  firstCleanup.forEach(fn => fn?.()); secondCleanup.forEach(fn => fn?.());
});
