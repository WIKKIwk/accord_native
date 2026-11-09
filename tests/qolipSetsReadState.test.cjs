const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function modules(overrides = {}) {
  const cache = new Map();
  function load(name) {
    name = name.replaceAll('\\', '/'); if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
    loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
    return loaded.exports;
  }
  return load;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const entry = (id, name = '', codes = ['Q-1'], labels = []) => ({ name, display_name: name || id, source: {},
  set: { id, fingerprint: 'f', members: codes.map(qolip_code => ({ qolip_code })), product_labels: labels } });
function harness(saving = false) {
  let valid = true; const listeners = new Set(), reads = [], load = modules();
  const boundary = { current: () => valid, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
  const owner = new (load('qolip/qolipSetsReadState.ts').QolipSetsReadState)(boundary, guard => {
    const pending = deferred(); reads.push({ guard, ...pending }); return pending.promise;
  }, saving);
  return { owner, reads, listeners, boundary, invalidate: () => { valid = false; for (const callback of [...listeners]) callback(); }, revive: () => { valid = true; } };
}

test('f119 sets screen filters nonempty sets by simple lowercased name, set ID or mold code in source order', () => {
  const { qolipFilterManagedSets: filter } = modules()('qolip/qolipSetsReadState.ts');
  const a = entry('S-A', 'Red Name', ['Q-1'], ['Invisible product']), b = entry('SET-B', '', ['Blue-77']), empty = entry('S-C', 'Red', []);
  assert.deepEqual(filter([a, b, empty], '\u0085 \t'), [a, b]);
  assert.deepEqual(filter([a, b, empty], ' red '), [a]);
  assert.deepEqual(filter([a, b, empty], 'set-b'), [b]);
  assert.deepEqual(filter([a, b, empty], ' BLUE-7 '), [b]);
  assert.deepEqual(filter([a, b, empty], 'Invisible'), []);
  assert.deepEqual(filter([a, b, empty], 'r e d'), [], 'this screen does not use the fuzzy set lookup');
  const dotted = entry('İ', 'ΟΣ');
  assert.deepEqual(filter([dotted], 'i'), [dotted]);
  assert.deepEqual(filter([dotted], 'οσ'), [dotted]);
  assert.deepEqual(filter([dotted], 'ος'), []);
});

test('initial read subscribes first and offers only search and captured expansion actions', async () => {
  const h = harness(), stop = h.owner.activate(); assert.equal(h.listeners.size, 1); assert.equal(h.reads.length, 1);
  let snapshot = h.owner.getSnapshot(); assert.equal(snapshot.loading, true); assert.deepEqual(Object.keys(snapshot.actions).sort(), ['setSearch', 'tap']);
  const a = entry('S-1', 'One'), duplicate = entry('S-1', 'Other'); h.reads[0].resolve([a, duplicate]); await tick();
  snapshot = h.owner.getSnapshot(); assert.equal(snapshot.loading, false); assert.deepEqual(snapshot.rows.map(row => row.expanded), [false, false]);
  snapshot.actions.tap(a, false); assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.expanded), [true, true]);
  snapshot.actions.tap(a, false); assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.expanded), [true, true], 'rendered closures capture expansion');
  snapshot.actions.tap(a, true); assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.expanded), [false, false]); stop();
});

test('saving lock comes from the owner, suppresses expansion and leaves search available', async () => {
  const h = harness(true), stop = h.owner.activate(), a = entry('S-1', 'One'); h.reads[0].resolve([a]); await tick();
  let snapshot = h.owner.getSnapshot(); snapshot.actions.tap(a, false); assert.equal(h.owner.getSnapshot().rows[0].expanded, false);
  snapshot.actions.setSearch('one'); assert.equal(h.owner.getSnapshot().search, 'one'); h.owner.updateSaving(false);
  snapshot = h.owner.getSnapshot(); snapshot.actions.tap(a, false); assert.equal(h.owner.getSnapshot().rows[0].expanded, true);
  h.owner.updateSaving(true); snapshot.actions.tap(a, true); assert.equal(h.owner.getSnapshot().rows[0].expanded, true); stop();
});

test('search and error hide rows but retain the expanded ID; every pending replacement shows loading', async () => {
  const h = harness(), stop = h.owner.activate(), a = entry('S-1', 'One'), b = entry('S-2', 'Two'); h.reads[0].resolve([a, b]); await tick();
  let snapshot = h.owner.getSnapshot(); snapshot.actions.tap(a, false); snapshot.actions.setSearch('two');
  assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.entry), [b]); snapshot.actions.setSearch('one');
  assert.equal(h.owner.getSnapshot().rows[0].expanded, true);
  const failed = h.owner.reload(); assert.equal(h.owner.getSnapshot().loading, true); assert.deepEqual(h.owner.getSnapshot().rows, []);
  h.reads[1].reject(new Error('offline')); await failed; assert.equal(h.owner.getSnapshot().error, true); assert.deepEqual(h.owner.getSnapshot().rows, []);
  const next = h.owner.reload(); assert.equal(h.owner.getSnapshot().loading, true); h.reads[2].resolve([a, b]); await next;
  assert.equal(h.owner.getSnapshot().rows[0].expanded, true); stop();
});

test('latest replacement alone controls display, even with overlapping old success or failure', async () => {
  const h = harness(), stop = h.owner.activate(), old = entry('S-old'), latest = entry('S-new');
  const replacement = h.owner.reload(); h.reads[1].resolve([latest]); await replacement; h.reads[0].resolve([old]); await tick();
  assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.entry), [latest]);
  const olderError = h.owner.reload(), newest = h.owner.reload(); h.reads[3].resolve([latest]); await newest;
  h.reads[2].reject(new Error('old')); await olderError; assert.equal(h.owner.getSnapshot().error, false);
  assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.entry), [latest]);
  const olderSuccess = h.owner.reload(), latestError = h.owner.reload(); h.reads[5].reject(new Error('latest')); await latestError;
  h.reads[4].resolve([old]); await olderSuccess; assert.equal(h.owner.getSnapshot().error, true); assert.deepEqual(h.owner.getSnapshot().rows, []); stop();
});

test('the original witness blanks data, blocks late results and stale actions through ABA', async () => {
  const h = harness(), stop = h.owner.activate(), a = entry('S-1'); h.reads[0].resolve([a]); await tick();
  const actions = h.owner.getSnapshot().actions, pending = h.owner.reload(); h.invalidate();
  assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.reads[1].guard(), false); assert.equal(h.listeners.size, 0);
  h.reads[1].resolve([entry('PRIVATE')]); await pending; h.revive(); actions.setSearch('private'); actions.tap(a, false);
  assert.equal(h.owner.getSnapshot().invalid, true); stop();
});

test('effect replay gives new callbacks and discards the suspended lifetime read', async () => {
  const h = harness(), stopOld = h.owner.activate(), oldActions = h.owner.getSnapshot().actions; stopOld();
  const stopNew = h.owner.activate(), a = entry('S-1'); h.reads[0].resolve([entry('old')]); h.reads[1].resolve([a]); await tick();
  assert.deepEqual(h.owner.getSnapshot().rows.map(row => row.entry), [a]); assert.notEqual(h.owner.getSnapshot().actions, oldActions);
  oldActions.setSearch('old'); oldActions.tap(a, false); stopOld(); assert.equal(h.owner.getSnapshot().search, '');
  assert.equal(h.owner.getSnapshot().rows[0].expanded, false); stopNew();
});

test('reentrant invalidation while filtering or evaluating the boundary cannot reveal a revived snapshot', async () => {
  const h = harness(), stop = h.owner.activate(), a = entry('S-1'); h.reads[0].resolve([a]); await tick();
  let armed = true; Object.defineProperty(a, 'name', { get() { if (armed) { armed = false; h.invalidate(); h.revive(); } return 'private'; } });
  h.owner.getSnapshot().actions.setSearch('private'); assert.equal(h.owner.getSnapshot().invalid, true); stop();
  let valid = true, trigger = false; const listeners = new Set(), boundary = { current: () => {
    if (trigger) { trigger = false; valid = false; for (const listener of [...listeners]) listener(); return true; } return valid;
  }, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const State = modules()('qolip/qolipSetsReadState.ts').QolipSetsReadState, owner = new State(boundary, async () => [entry('private')], false);
  const close = owner.activate(); await tick(); trigger = true; assert.equal(owner.getSnapshot().invalid, true); close();
});

test('runtime binds the real managed-sets GET to a role-checked original witness and actual lock', async () => {
  const account = { token: 'local', baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [] };
  let active = account, valid = true, calls = 0, captured; const listeners = new Set();
  const boundary = { current: () => valid, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const load = modules({ 'auth.ts': { activeSessionToken: value => value === active ? value.token : null },
    'qolip/qolipSetsApi.ts': { qolipManagedSets: async (session, guard) => { calls++; captured = { session, guard }; return [entry('S-1')]; } } });
  const create = load('qolip/qolipSetsReadRuntime.ts').createQolipSetsRead, owner = create(account, boundary, true), stop = owner.activate(); await tick();
  assert.equal(calls, 1); assert.equal(captured.session, account); assert.equal(captured.guard(), true); assert.equal(owner.getSnapshot().saving, true);
  valid = false; for (const listener of [...listeners]) listener(); assert.equal(owner.getSnapshot().invalid, true); assert.equal(captured.guard(), false); stop();
  for (const bad of [{ ...account, profile: { role: 'admin', ref: 'A' } }, { ...account, capabilities: [] }, { ...account, token: 'test-mode-token' }]) {
    active = bad; valid = true; const denied = create(bad, boundary, false), close = denied.activate(); await tick();
    assert.equal(denied.getSnapshot().invalid, true); close();
  }
  assert.equal(calls, 1);
});

test('shared role read gate latches a reentrant witness failure even if the outer check returns true', () => {
  const account = { token: 'local', baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'] };
  const load = modules({ 'auth.ts': { activeSessionToken: value => value.token }, 'sessionReadScope.ts': { sessionReadScope: () => 'scope' } });
  let gate, trigger = false;
  const boundary = { current: () => { if (trigger) { trigger = false; assert.equal(gate.current(), false); } return true; }, subscribe: () => () => {} };
  gate = load('qolip/qolipRoleReadBoundary.ts').qolipRoleReadBoundary(account, boundary); assert.equal(gate.current(), true);
  trigger = true; assert.equal(gate.current(), false); assert.equal(gate.current(), false);
});
