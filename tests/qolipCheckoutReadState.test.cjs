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
const entry = (id, item_name) => ({ id, location_id: '', block: '', warehouse: '', item_code: id, item_name, qolip_code: '', size: 0, quantity: 1,
  row_letter: '', column_number: null, location_label: '', issued_to_name: '', status: 'open', issued_at: '', is_open: true });
function harness(options = {}) {
  const listeners = new Set(), reads = [], load = modules(); let valid = true;
  const boundary = { current: () => valid, subscribe: listener => { listeners.add(listener); options.onSubscribe?.(() => { valid = false; listener(); });
    return () => listeners.delete(listener); } };
  const owner = new (load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState)(boundary, guard => {
    const pending = deferred(); reads.push({ guard, ...pending }); return pending.promise;
  });
  return { owner, reads, listeners, boundary, invalidate: () => { valid = false; for (const listener of [...listeners]) listener(); }, revive: () => { valid = true; } };
}

test('checkout read starts only after subscription and preserves source search text and order', async () => {
  const h = harness(), a = entry('A1', 'Needle'), b = entry('B2', 'Other');
  assert.equal(h.owner.getSnapshot().loading, true); assert.equal(h.owner.getSnapshot().invalid, false); assert.equal(h.reads.length, 0);
  const stop = h.owner.activate(); assert.equal(h.listeners.size, 1); assert.equal(h.reads.length, 1);
  h.reads[0].resolve([a, b]); await tick(); let state = h.owner.getSnapshot(); assert.deepEqual(state.entries, [a, b]); assert.deepEqual(state.visible, [a, b]);
  h.owner.setSearch(' A1 '); state = h.owner.getSnapshot(); assert.equal(state.search, ' A1 '); assert.deepEqual(state.visible, [a]);
  h.owner.setSearch(''); assert.deepEqual(h.owner.getSnapshot().visible, [a, b]); stop();
});

test('replacement load retains prior entries while waiting; error and retry follow FutureBuilder data rules', async () => {
  const h = harness(), a = entry('A1', 'Needle'); const stop = h.owner.activate(); h.reads[0].resolve([a]); await tick();
  const refresh = h.owner.reload(); assert.equal(h.owner.getSnapshot().loading, true); assert.deepEqual(h.owner.getSnapshot().entries, [a]);
  h.reads[1].reject(new Error('offline')); await refresh; assert.equal(h.owner.getSnapshot().error, true); assert.equal(h.owner.getSnapshot().entries, null);
  const retry = h.owner.reload(); assert.equal(h.owner.getSnapshot().loading, true); h.reads[2].resolve([]); await retry;
  assert.deepEqual(h.owner.getSnapshot().entries, []); assert.equal(h.owner.getSnapshot().error, false); stop();
});

test('only the latest future publishes, while a newer refresh does not invalidate the old request guard', async () => {
  const h = harness(), stop = h.owner.activate(), next = h.owner.reload(); assert.equal(h.reads.length, 2); assert.equal(h.reads[0].guard(), true);
  h.reads[1].resolve([entry('new', 'New')]); await next; h.reads[0].resolve([entry('old', 'Old')]); await tick();
  assert.deepEqual(h.owner.getSnapshot().entries.map(row => row.id), ['new']); stop();
});

test('earlier snapshot reads cannot suppress invalidation; late data and old callbacks stay closed after ABA', async () => {
  const h = harness(), seen = [], stopEarlier = h.boundary.subscribe(() => h.owner.getSnapshot());
  h.owner.subscribe(() => seen.push(h.owner.getSnapshot().invalid)); const stop = h.owner.activate(); h.owner.setSearch('private');
  h.invalidate(); assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.owner.getSnapshot().search, ''); assert.equal(seen.at(-1), true);
  h.reads[0].resolve([entry('private', 'Old')]); await tick(); h.revive(); h.owner.setSearch('stale'); await h.owner.reload();
  assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.reads.length, 1); assert.equal(h.listeners.size, 1); stop(); stopEarlier();
});

test('invalidation during search projection cannot republish a stale query or list', async () => {
  for (const stage of ['setSearch', 'resolve']) {
    const h = harness(), seen = []; let armed = false;
    const item = entry('secret', 'Private');
    Object.defineProperty(item, 'item_name', { get() { if (armed) h.invalidate(); return 'Private'; } });
    h.owner.subscribe(() => seen.push(h.owner.getSnapshot())); const stop = h.owner.activate();
    if (stage === 'setSearch') {
      h.reads[0].resolve([item]); await tick(); armed = true; h.owner.setSearch('Private');
    } else {
      h.owner.setSearch('Private'); armed = true; h.reads[0].resolve([item]); await tick();
    }
    assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.owner.getSnapshot().search, '');
    assert.equal(seen.at(-1).invalid, true); stop();
  }
});

test('effect replay closes its old run, starts a fresh read with the same boundary and ignores stale cleanup', async () => {
  const h = harness(), stopOld = h.owner.activate(); stopOld(); const stopNew = h.owner.activate(); assert.equal(h.reads.length, 2);
  assert.equal(h.reads[0].guard(), false); h.reads[0].resolve([entry('old', 'Old')]); h.reads[1].resolve([entry('new', 'New')]); await tick();
  stopOld(); assert.deepEqual(h.owner.getSnapshot().entries.map(row => row.id), ['new']); stopNew();
});

test('a synchronous invalidation during subscription starts no read', () => {
  const h = harness({ onSubscribe: invalidate => invalidate() }), stop = h.owner.activate();
  assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.reads.length, 0); assert.equal(h.listeners.size, 0); stop();
});

test('asynchronous or throwing boundaries and asynchronous cleanup never authorize a read', async () => {
  const load = modules(), State = load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState;
  for (const boundary of [
    { current: async () => { throw new Error('async check'); }, subscribe: () => () => {} },
    { current: () => true, subscribe: () => { throw new Error('subscribe'); } },
    { current: () => true, subscribe: async () => async () => { throw new Error('async cleanup'); } },
  ]) {
    let reads = 0; const owner = new State(boundary, async () => { reads++; return []; });
    const stop = owner.activate(); assert.equal(owner.getSnapshot().invalid, true); await tick(); assert.equal(reads, 0); stop();
  }
});

test('runtime requires the role, capability, active token, unchanged scope and original boundary for the real GET', async () => {
  const account = { token: 'local', baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [] };
  let active = account, boundaryCurrent = true, listener, calls = 0, received;
  const boundary = { current: () => boundaryCurrent, subscribe: value => { listener = value; return () => {}; } };
  const load = modules({ 'auth.ts': { activeSessionToken: value => value === active ? value.token : null },
    'qolip/qolipCheckoutApi.ts': { qolipCheckouts: async (s, input, guard) => { calls++; received = { s, input, guard }; return []; } } });
  const create = load('qolip/qolipCheckoutReadRuntime.ts').createQolipCheckoutRead, owner = create(account, boundary), stop = owner.activate();
  await tick(); assert.equal(calls, 1); assert.equal(received.s, account); assert.deepEqual(received.input, { status: 'open', limit: 200 }); assert.equal(received.guard(), true);
  boundaryCurrent = false; listener(); assert.equal(owner.getSnapshot().invalid, true); assert.equal(received.guard(), false); stop();
  for (const bad of [{ ...account, profile: { role: 'admin', ref: 'A' } }, { ...account, capabilities: [] }, { ...account, token: 'test-mode-token' }]) {
    active = bad; boundaryCurrent = true; const denied = create(bad, boundary), close = denied.activate(); await tick(); assert.equal(denied.getSnapshot().invalid, true); close();
  }
  assert.equal(calls, 1);
});

test('hook subscribes to one real owner and activates only after commit', () => {
  const layouts = [], events = [], snapshot = { invalid: false }, owner = { subscribe() {}, getSnapshot: () => snapshot,
    activate: () => { events.push('activate'); return () => events.push('suspend'); } };
  const filename = path.join(root, 'qolip/useGuardedQolipCheckouts.ts'), loaded = new Module(filename, module);
  const mocks = { react: { useMemo: fn => fn(), useSyncExternalStore: (subscribe, get, server) => { assert.equal(subscribe, owner.subscribe); assert.equal(get, server); return get(); },
    useLayoutEffect: fn => layouts.push(fn) }, './qolipCheckoutReadRuntime': { createQolipCheckoutRead: () => owner } };
  loaded.require = target => target in mocks ? mocks[target] : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const result = loaded.exports.useGuardedQolipCheckouts({}, {}); assert.equal(result.owner, owner); assert.deepEqual(events, []);
  const cleanup = layouts[0](); cleanup(); assert.deepEqual(events, ['activate', 'suspend']);
});
