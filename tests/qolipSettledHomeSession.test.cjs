const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function modules(overrides = {}) {
  const root = path.resolve(__dirname, '../src'), cache = new Map();
  function load(name) {
    name = name.replaceAll('\\', '/');
    if (name in overrides) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext,
    } }).outputText, filename);
    return loaded.exports;
  }
  return load;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const session = (patch = {}) => ({ token: 'local-token', baseUrl: 'https://example.test', imageCacheScope: 'A',
  profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [], assigned_apparatus_labels: [], ...patch });

function harness(options = {}) {
  const account = options.session ?? session(), listeners = new Set(), issued = new WeakSet(), events = [], witnesses = [];
  let active = account, transitioning = false, version = 1, loadCount = 0, captures = 0;
  const auth = {
    activeSessionToken: value => value === active ? value.token : null,
    loadSession: () => { loadCount++; events.push('load'); return options.load ? options.load(loadCount, active) : Promise.resolve(active); },
    captureSessionWitness: value => {
      captures++; events.push('capture');
      if (options.capture) return options.capture(value, { begin, end });
      if (transitioning || value !== active) return null;
      const witness = Object.freeze({ session: value, scope: load('sessionReadScope.ts').sessionReadScope(value), version });
      issued.add(witness); witnesses.push(witness); return witness;
    },
    isSessionWitnessCurrent: witness => {
      events.push(['check', witness]);
      const current = issued.has(witness) && !transitioning && witness.session === active && witness.version === version &&
        witness.scope === load('sessionReadScope.ts').sessionReadScope(active);
      if (!current) issued.delete(witness);
      return current;
    },
    subscribeSessionWitness: callback => {
      events.push('subscribe'); listeners.add(callback);
      if (options.onSubscribe) options.onSubscribe(callback);
      return () => { events.push('unsubscribe'); listeners.delete(callback); };
    },
    sessionWitnessVersion: () => version,
    sessionWitnessTransitioning: () => transitioning,
  };
  const load = modules({ 'auth.ts': auth });
  const { QolipSettledHomeSessionOwner } = load('qolip/qolipSettledHomeSession.ts');
  const owner = new QolipSettledHomeSessionOwner();
  function notify() { for (const listener of [...listeners]) listener(); }
  function begin() { transitioning = true; version++; notify(); }
  function end(value = active) { active = value; transitioning = false; version++; notify(); }
  return { auth, owner, account, events, witnesses, listeners, begin, end, get loads() { return loadCount; }, get captures() { return captures; } };
}

test('older auth without shared witness exports fails closed before loading a session', () => {
  let loads = 0;
  const load = modules({ 'auth.ts': { loadSession: async () => { loads++; return session(); }, activeSessionToken: () => 'token' } });
  const owner = new (load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
  assert.equal(owner.getSnapshot().kind, 'loading'); const stop = owner.activate();
  assert.equal(owner.getSnapshot().kind, 'unavailable'); assert.equal(loads, 0); stop();
});

test('settled shell subscribes first, captures the exact shared witness once and retains a single boundary', async () => {
  const h = harness(), seen = []; h.owner.subscribe(() => seen.push(h.owner.getSnapshot().kind));
  const stop = h.owner.activate(); assert.deepEqual(h.events.slice(0, 2), ['subscribe', 'load']);
  await tick(); const ready = h.owner.getSnapshot(); assert.equal(ready.kind, 'ready'); assert.equal(ready.session, h.account);
  assert.equal(h.loads, 1); assert.equal(h.captures, 1); assert.equal(ready.boundary.current(), true);
  assert.ok(h.events.some(value => Array.isArray(value) && value[1] === h.witnesses[0]));
  assert.equal(h.owner.getSnapshot().boundary, ready.boundary); assert.deepEqual(seen, ['ready']); stop();
});

test('an already-running tracked transition blocks loading and capture until its completion', async () => {
  const h = harness(); h.begin(); const stop = h.owner.activate(); await tick();
  assert.equal(h.loads, 0); assert.equal(h.captures, 0); assert.equal(h.owner.getSnapshot().kind, 'loading');
  h.end(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'ready'); assert.equal(h.loads, 1); assert.equal(h.captures, 1); stop();
});

test('a load crossing A to B to A is discarded and retried only before the first capture', async () => {
  const pending = deferred(), h = harness({ load: (count, active) => count === 1 ? pending.promise : Promise.resolve(active) });
  const stop = h.owner.activate(); const b = session({ profile: { role: 'qolipchi', ref: 'B' } });
  h.begin(); h.end(b); h.begin(); h.end(h.account); pending.resolve(h.account); await tick();
  assert.equal(h.loads, 2); assert.equal(h.captures, 1); assert.equal(h.owner.getSnapshot().kind, 'ready'); stop();
});

test('invalidation removes a ready entry and cannot recapture after rollback or same-account ABA', async () => {
  const h = harness(), snapshots = []; h.owner.subscribe(() => snapshots.push(h.owner.getSnapshot().kind));
  const stop = h.owner.activate(); await tick(); const ready = h.owner.getSnapshot(); h.begin();
  assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(ready.boundary.current(), false);
  h.end(); h.begin(); h.end(h.account); await tick();
  assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(h.loads, 1); assert.equal(h.captures, 1);
  assert.deepEqual(snapshots, ['ready', 'invalid']); assert.equal(h.listeners.size, 0); stop();
});

test('an earlier shared listener reading the invalid snapshot cannot suppress the React invalidation event', async () => {
  const h = harness(), seen = [];
  const stopEarlier = h.auth.subscribeSessionWitness(() => h.owner.getSnapshot());
  h.owner.subscribe(() => seen.push(h.owner.getSnapshot().kind));
  const stop = h.owner.activate(); await tick(); assert.deepEqual(seen, ['ready']);
  h.begin(); assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.deepEqual(seen, ['ready', 'invalid']);
  assert.equal(h.listeners.size, 1, 'the shell closes its own invalidated shared subscription');
  h.end(); assert.equal(h.captures, 1); stop(); stopEarlier();
});

test('effect cleanup discards a pending load, serializes the replacement and preserves a settled witness on replay', async () => {
  const pending = deferred(), h = harness({ load: (count, active) => count === 1 ? pending.promise : Promise.resolve(active) });
  const stopOld = h.owner.activate(); stopOld(); const stopCurrent = h.owner.activate();
  assert.equal(h.loads, 1); pending.resolve(h.account); await tick();
  assert.equal(h.loads, 2); assert.equal(h.captures, 1); const ready = h.owner.getSnapshot(); assert.equal(ready.kind, 'ready');
  stopOld(); assert.equal(h.owner.getSnapshot(), ready, 'a late cleanup cannot stop the new run');
  stopCurrent(); assert.equal(h.owner.getSnapshot().kind, 'loading'); const stopReplay = h.owner.activate();
  assert.equal(h.owner.getSnapshot(), ready); assert.equal(h.owner.getSnapshot().boundary, ready.boundary);
  assert.equal(h.loads, 2); assert.equal(h.captures, 1); stopReplay();
});

test('a transition while effects are suspended invalidates the original witness on reactivation', async () => {
  const h = harness(), stop = h.owner.activate(); await tick(); const ready = h.owner.getSnapshot(); stop();
  h.begin(); h.end(); const stopReplay = h.owner.activate();
  assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(ready.boundary.current(), false); assert.equal(h.captures, 1); stopReplay();
});

test('capture null, throw or a reentrant transition is terminal, never an invitation to recapture', async () => {
  for (const result of ['null', 'throw', 'transition']) {
    const h = harness({ capture: (_account, actions) => {
      if (result === 'throw') throw new Error('capture failed');
      if (result === 'transition') { actions.begin(); actions.end(); }
      return null;
    } });
    const stop = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid', result);
    h.begin(); h.end(); await tick(); assert.equal(h.loads, 1); assert.equal(h.captures, 1); stop();
  }
});

test('capturing after a reentrant effect cleanup cannot bind or restart the old shell', async () => {
  let stop;
  const h = harness({ capture: account => { stop(); return { session: account, scope: 'untrusted' }; } });
  stop = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid');
  const replay = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(h.captures, 1); replay();
});

test('a capture that closes the run and then throws still terminates the original shell', async () => {
  let stop;
  const h = harness({ capture: () => { stop(); throw new Error('capture after cleanup'); } });
  stop = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid');
  const replay = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(h.captures, 1); replay();
});

test('wrong role, missing capability, fake token and invalid shared predicates never admit a shell', async () => {
  for (const account of [session({ profile: { role: 'admin', ref: 'A' } }), session({ capabilities: [] }),
    session({ token: '' }), session({ token: 'test-mode-token' })]) {
    const h = harness({ session: account }), stop = h.owner.activate(); await tick();
    assert.equal(h.owner.getSnapshot().kind, 'invalid'); assert.equal(h.captures, 1); stop();
  }
  const h = harness(); h.auth.isSessionWitnessCurrent = async () => true;
  // The actual references are captured by the owner at construction, so construct after substituting.
  const load = modules({ 'auth.ts': h.auth }), owner = new (load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
  const stop = owner.activate(); await tick(); assert.equal(owner.getSnapshot().kind, 'invalid'); stop();
});

test('synchronous subscription signals and asynchronous unsubscribe handles are fail-closed', async () => {
  const h = harness({ onSubscribe: callback => callback() }), stop = h.owner.activate(); await tick();
  assert.equal(h.owner.getSnapshot().kind, 'ready'); assert.equal(h.captures, 1); stop();
  let cleanup = 0;
  const auth = { ...h.auth, subscribeSessionWitness: async () => () => { cleanup++; } };
  const load = modules({ 'auth.ts': auth }), owner = new (load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
  const close = owner.activate(); assert.equal(owner.getSnapshot().kind, 'invalid'); await tick(); assert.equal(cleanup, 1); close();
});

test('rejected asynchronous observations, observers and cleanup results are consumed without authorizing them', async () => {
  for (const key of ['sessionWitnessTransitioning', 'sessionWitnessVersion']) {
    const h = harness(), auth = { ...h.auth, [key]: () => Promise.reject(new Error(key)) };
    const load = modules({ 'auth.ts': auth }), owner = new (load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
    const stop = owner.activate(); assert.equal(owner.getSnapshot().kind, 'invalid'); await tick(); stop();
  }
  const h = harness(), auth = { ...h.auth, subscribeSessionWitness: listener => {
    const stop = h.auth.subscribeSessionWitness(listener);
    return () => { stop(); return Promise.reject(new Error('async cleanup')); };
  } };
  const load = modules({ 'auth.ts': auth }), owner = new (load('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
  owner.subscribe(async () => { throw new Error('async observer'); });
  const stop = owner.activate(); await tick(); assert.equal(owner.getSnapshot().kind, 'ready'); stop(); await tick();

  const delayedCleanup = { ...h.auth, subscribeSessionWitness: async () => async () => { throw new Error('async delayed cleanup'); } };
  const loadDelayed = modules({ 'auth.ts': delayedCleanup });
  const delayedOwner = new (loadDelayed('qolip/qolipSettledHomeSession.ts').QolipSettledHomeSessionOwner)();
  const closeDelayed = delayedOwner.activate(); assert.equal(delayedOwner.getSnapshot().kind, 'invalid'); await tick(); closeDelayed();
});

test('a rejected async capture is consumed even if capture synchronously closes the run', async () => {
  let stop;
  const h = harness({ capture: () => { stop(); return Promise.reject(new Error('async capture')); } });
  stop = h.owner.activate(); await tick(); assert.equal(h.owner.getSnapshot().kind, 'invalid');
  const replay = h.owner.activate(); await tick(); assert.equal(h.captures, 1); assert.equal(h.owner.getSnapshot().kind, 'invalid'); replay();
});
