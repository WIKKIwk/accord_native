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
const row = (id, name = id) => ({ id, location_id: '', block: '', warehouse: '', item_code: id, item_name: name, qolip_code: '', size: 0, quantity: 1,
  row_letter: '', column_number: null, location_label: '', issued_to_name: '', status: 'open', issued_at: '', is_open: true });
const locks = () => ({ returningIds: new Set(), bulkReturning: false });
function harness() {
  let valid = true; const listeners = new Set(), reads = [], load = modules();
  const boundary = { current: () => valid, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } };
  const selection = new (load('qolip/qolipCheckoutSelectionState.ts').QolipCheckoutSelectionState)([], [], locks(), boundary);
  const read = new (load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState)(boundary, guard => {
    const pending = deferred(); reads.push({ guard, ...pending }); return pending.promise;
  }, entries => selection.recordLoaded(entries));
  const owner = new (load('qolip/qolipCheckoutViewState.ts').QolipCheckoutViewState)(read, selection, locks());
  return { owner, selection, read, reads, listeners, boundary, invalidate: () => { valid = false; for (const callback of [...listeners]) callback(); }, revive: () => { valid = true; } };
}

test('composition subscribes before the actual initial read and exposes no return, bulk or retry action', async () => {
  const h = harness(), stop = h.owner.activate(); assert.equal(h.reads.length, 1); assert.equal(h.listeners.size, 2);
  assert.deepEqual(Object.keys(h.owner.getSnapshot().actions).sort(), ['cancelSelection', 'longPress', 'setSearch', 'tap']);
  const a = row('a'), b = row('b'); h.reads[0].resolve([a, b]); await tick();
  assert.deepEqual(h.owner.getSnapshot().read.entries, [a, b]); assert.deepEqual(h.owner.getSnapshot().selection.rows.map(item => item.entry), [a, b]); stop();
});

test('runtime factory binds both children to the same role-checked original boundary and the real GET contract', async () => {
  const account = { token: 'local', baseUrl: 'https://example.test', profile: { role: 'qolipchi', ref: 'A' }, capabilities: ['qolip.manage'], assigned_apparatus: [] };
  let active = account, valid = true, calls = 0, captured; const listeners = new Set();
  const boundary = { current: () => valid, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const load = modules({ 'auth.ts': { activeSessionToken: value => value === active ? value.token : null },
    'qolip/qolipCheckoutApi.ts': { qolipCheckouts: async (session, input, guard) => { calls++; captured = { session, input, guard }; return [row('a')]; } } });
  const create = load('qolip/qolipCheckoutViewRuntime.ts').createQolipCheckoutView, owner = create(account, boundary, locks()), stop = owner.activate();
  await tick(); assert.equal(calls, 1); assert.equal(captured.session, account); assert.deepEqual(captured.input, { status: 'open', limit: 200 });
  assert.equal(captured.guard(), true); assert.equal(owner.getSnapshot().read.entries[0].id, 'a');
  valid = false; for (const listener of [...listeners]) listener(); assert.equal(owner.getSnapshot().invalid, true); assert.equal(captured.guard(), false); stop();
  for (const bad of [{ ...account, profile: { role: 'admin', ref: 'A' } }, { ...account, capabilities: [] }, { ...account, token: 'test-mode-token' }]) {
    active = bad; valid = true; const denied = create(bad, boundary, locks()), close = denied.activate(); await tick();
    assert.equal(denied.getSnapshot().invalid, true); close();
  }
  assert.equal(calls, 1);
});

test('newer visible future and later older loaded future remain distinct, without a stale-completion notification', async () => {
  const h = harness(), notifications = [], stop = h.owner.activate(); h.owner.subscribe(() => notifications.push('change'));
  const a = row('a', 'old display'), b = row('b'); h.reads[0].resolve([a, b]); await tick();
  h.owner.getSnapshot().actions.longPress(a); assert.deepEqual([...h.owner.getSnapshot().selection.selectedIds], ['a']);
  const old = h.read.reload(), recent = h.read.reload(), aNew = row('a', 'new display'), bNew = row('b', 'new B');
  h.reads[2].resolve([aNew, bNew]); await recent; const before = notifications.length;
  h.reads[1].resolve([b]); await old; assert.equal(notifications.length, before, 'source old future has no setState');
  const snapshot = h.owner.getSnapshot(); assert.deepEqual(snapshot.read.entries, [aNew, bNew]);
  assert.equal(snapshot.selection.selectionMode, false); assert.deepEqual(snapshot.selection.rows.map(item => item.entry), [aNew, bNew]); stop();
});

test('a stale load can retain an older selected object while the displayed row is newer, without enabling bulk dispatch', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a', 'first'); h.reads[0].resolve([a]); await tick();
  h.owner.getSnapshot().actions.longPress(a); const old = h.read.reload(), recent = h.read.reload();
  const aNew = row('a', 'displayed'), bNew = row('b-938', 'displayed B'), aOld = row('a', 'stale loaded');
  h.reads[2].resolve([aNew, bNew]); await recent; h.reads[1].resolve([aOld]); await old;
  let snapshot = h.owner.getSnapshot(); assert.equal(snapshot.read.entries[0], aNew); assert.equal(snapshot.selection.selectedEntries[0], aOld);
  assert.equal('bulkChoice' in snapshot.actions, false); assert.equal('return' in snapshot.actions, false);
  snapshot.actions.setSearch('938'); snapshot = h.owner.getSnapshot(); assert.deepEqual(snapshot.read.visible, [bNew]);
  assert.deepEqual([...snapshot.selection.selectedIds], ['a']); assert.equal(snapshot.selection.selectedEntries[0], aOld); stop();
});

test('visible selection can outlive stale loaded rows; source bulk preparation would cancel when none remain', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a'), b = row('b'); h.reads[0].resolve([a, b]); await tick();
  h.owner.getSnapshot().actions.longPress(a); const old = h.read.reload(), recent = h.read.reload(), aNew = row('a'), bNew = row('b');
  h.reads[2].resolve([aNew, bNew]); await recent; h.reads[1].resolve([a]); await old;
  let actions = h.owner.getSnapshot().actions; actions.tap(aNew, true, false); actions.longPress(bNew);
  assert.deepEqual([...h.owner.getSnapshot().selection.selectedIds], ['b']); assert.deepEqual(h.owner.getSnapshot().selection.selectedEntries, []);
  // This is source-state evidence only. No coordinator/UI bulk action is exposed.
  assert.equal(h.selection.bulkChoice(), null); assert.equal(h.owner.getSnapshot().selection.selectionMode, false); stop();
});

test('a row tap uses the last rendered selection mode after a silent old load changes the live selection', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a'), b = row('b'); h.reads[0].resolve([a, b]); await tick();
  h.owner.getSnapshot().actions.longPress(b);
  const rendered = h.owner.getSnapshot(), renderedRow = rendered.selection.rows.find(item => item.entry === b);
  assert.equal(rendered.selection.selectionMode, true); const old = h.read.reload(), latest = h.read.reload();
  h.reads[1].resolve([a]); await old; // V2 mutates the live ID set without rebuilding the already displayed row.
  rendered.actions.tap(b, rendered.selection.selectionMode, renderedRow.expanded);
  assert.deepEqual([...h.owner.getSnapshot().selection.selectedIds], ['b']);
  assert.equal(h.owner.getSnapshot().selection.rows.find(item => item.entry === b).expanded, false);
  h.reads[2].resolve([a, b]); await latest; stop();
});

test('old success plus latest error keeps internal selection, while old failure cannot overwrite latest display', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a'); h.reads[0].resolve([a]); await tick(); h.owner.getSnapshot().actions.longPress(a);
  const old = h.read.reload(), recent = h.read.reload(); h.reads[1].resolve([a]); await old; h.reads[2].reject(new Error('offline')); await recent;
  let snapshot = h.owner.getSnapshot(); assert.equal(snapshot.read.error, true); assert.deepEqual([...snapshot.selection.selectedIds], ['a']);
  const olderFailure = h.read.reload(), latest = h.read.reload(), replacement = row('a', 'replacement');
  h.reads[4].resolve([replacement]); await latest; h.reads[3].reject(new Error('old failure')); await olderFailure;
  snapshot = h.owner.getSnapshot(); assert.deepEqual(snapshot.read.entries, [replacement]); assert.deepEqual([...snapshot.selection.selectedIds], ['a']); stop();
});

test('list unmount after no matches or error clears local expansion; pending refresh with data retains it', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a', 'Needle'); h.reads[0].resolve([a]); await tick();
  let actions = h.owner.getSnapshot().actions; actions.tap(a, false, false); assert.equal(h.owner.getSnapshot().selection.rows[0].expanded, true);
  const refresh = h.read.reload(); assert.equal(h.owner.getSnapshot().selection.rows[0].expanded, true); h.reads[1].resolve([a]); await refresh;
  actions.setSearch('no-match-938'); assert.equal(h.owner.getSnapshot().selection.rows.length, 0); actions.setSearch('');
  assert.equal(h.owner.getSnapshot().selection.rows[0].expanded, false); actions.tap(a, false, false);
  const failed = h.read.reload(); h.reads[2].reject(new Error('offline')); await failed; const retry = h.read.reload(); h.reads[3].resolve([a]); await retry;
  assert.equal(h.owner.getSnapshot().selection.rows[0].expanded, false); stop();
});

test('locked long press silently clears source expansion, visible on the next independent rebuild', async () => {
  for (const held of ['returning', 'bulk']) {
    const h = harness(), stop = h.owner.activate(), a = row('a'); h.reads[0].resolve([a]); await tick();
    h.owner.getSnapshot().actions.tap(a, false, false); h.owner.updateLocks({
      returningIds: new Set(held === 'returning' ? ['a'] : []), bulkReturning: held === 'bulk',
    });
    const rendered = h.owner.getSnapshot(), notifications = []; h.owner.subscribe(() => notifications.push('change'));
    assert.equal(rendered.selection.rows[0].expanded, true); rendered.actions.longPress(a);
    assert.equal(notifications.length, 0, 'the locked source parent never calls setState');
    assert.equal(rendered.selection.rows[0].expanded, true, 'the previously rendered closure is unchanged');
    assert.equal(h.owner.getSnapshot().selection.rows[0].expanded, false, 'a later independent rebuild sees the silent clear');
    assert.equal(h.owner.getSnapshot().selection.selectionMode, false); stop();
  }
});

test('original boundary invalidation blocks late old/new results and every stale action through ABA', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a'); h.reads[0].resolve([a]); await tick();
  const actions = h.owner.getSnapshot().actions; actions.longPress(a); const old = h.read.reload(), recent = h.read.reload();
  h.invalidate(); assert.equal(h.owner.getSnapshot().invalid, true); assert.equal(h.reads[1].guard(), false); assert.equal(h.reads[2].guard(), false);
  h.reads[2].resolve([row('private')]); h.reads[1].resolve([row('older')]); await Promise.all([old, recent]); h.revive();
  actions.setSearch('private'); actions.tap(a, false, false); actions.longPress(a); actions.cancelSelection(); assert.equal(h.owner.getSnapshot().invalid, true);
  assert.equal(h.listeners.size, 0); stop();
});

test('invalidation during stale-selection projection cannot return or invoke a revived snapshot', async () => {
  const h = harness(), stop = h.owner.activate(), a = row('a'); h.reads[0].resolve([a]); await tick();
  const actions = h.owner.getSnapshot().actions; actions.longPress(a); const old = h.read.reload(), latest = h.read.reload();
  h.reads[2].resolve([a]); await latest; let armed = false;
  const stale = row('a'); Object.defineProperty(stale, 'id', { get() { if (armed) { armed = false; h.invalidate(); } return 'a'; } });
  h.reads[1].resolve([stale]); await old; armed = true;
  assert.equal(h.owner.getSnapshot().invalid, true); actions.setSearch('private'); actions.tap(a, false, false); assert.equal(h.owner.getSnapshot().invalid, true); stop();
});

test('a reentrant boundary notification that returns true cannot revive read or selection state', async () => {
  const load = modules(), listeners = new Set(); let current = true, trigger = false;
  const boundary = { current: () => {
    if (trigger) { trigger = false; current = false; for (const listener of [...listeners]) listener(); return true; }
    return current;
  }, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const selection = new (load('qolip/qolipCheckoutSelectionState.ts').QolipCheckoutSelectionState)([], [], locks(), boundary);
  const read = new (load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState)(boundary, async () => [row('private')], entries => selection.recordLoaded(entries));
  const owner = new (load('qolip/qolipCheckoutViewState.ts').QolipCheckoutViewState)(read, selection, locks());
  const stop = owner.activate(); await tick(); const actions = owner.getSnapshot().actions; trigger = true;
  assert.equal(owner.getSnapshot().invalid, true); actions.setSearch('private'); assert.equal(owner.getSnapshot().invalid, true); stop();
});

test('effect replay creates new action lifetime and old cleanup/actions cannot affect it', async () => {
  const h = harness(), stopOld = h.owner.activate(), oldActions = h.owner.getSnapshot().actions; stopOld();
  const stopNew = h.owner.activate(), a = row('a'); h.reads[0].resolve([row('old')]); h.reads[1].resolve([a]); await tick();
  const current = h.owner.getSnapshot(); assert.equal(current.invalid, false); assert.notEqual(current.actions, oldActions);
  oldActions.setSearch('stale'); oldActions.longPress(a); stopOld(); assert.equal(h.owner.getSnapshot().read.search, '');
  assert.equal(h.owner.getSnapshot().selection.selectionMode, false); stopNew();
});

test('failed or asynchronous load observers close the read instead of publishing unsynchronized rows', async () => {
  const load = modules(), Read = load('qolip/qolipCheckoutReadState.ts').QolipCheckoutReadState;
  for (const observe of [() => false, () => { throw new Error('bad observer'); }, async () => { throw new Error('async observer'); }]) {
    const owner = new Read({ current: () => true, subscribe: () => () => {} }, async () => [row('private')], observe);
    const stop = owner.activate(); await tick(); assert.equal(owner.getSnapshot().invalid, true); stop();
  }
});

test('hook updates real locks by value without looping for a recreated object or missing a mutated set', () => {
  const filename = path.join(root, 'qolip/useQolipCheckoutView.ts'), loaded = new Module(filename, module), effects = [], calls = [];
  const owner = { subscribe() {}, getSnapshot: () => ({ invalid: true }), activate: () => () => {},
    updateLocks: value => calls.push({ ids: [...value.returningIds], bulk: value.bulkReturning }) };
  let index = 0; const slots = [], pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { useMemo: (make, deps) => { const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) slots[slot] = { deps, value: make() }; return slots[slot].value; },
    useSyncExternalStore: (_subscribe, get) => { index++; return get(); }, useLayoutEffect: (effect, deps) => {
      const slot = index++; if (!slots[slot] || !same(slots[slot].deps, deps)) { slots[slot] = { deps }; pending.push(effect); }
    } };
  loaded.require = name => name === 'react' ? react : name === './qolipCheckoutViewRuntime' ? { createQolipCheckoutView: () => owner } : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  const hook = loaded.exports.useQolipCheckoutView, session = {}, boundary = {}, mutable = new Set(['b', 'a']);
  const render = value => { index = 0; hook(session, boundary, value); while (pending.length) effects.push(pending.shift()()); };
  render({ returningIds: mutable, bulkReturning: false }); assert.deepEqual(calls, [{ ids: ['a', 'b'], bulk: false }]);
  render({ returningIds: new Set(['a', 'b']), bulkReturning: false }); assert.equal(calls.length, 1);
  mutable.add('c'); render({ returningIds: mutable, bulkReturning: true });
  assert.deepEqual(calls[1], { ids: ['a', 'b', 'c'], bulk: true });
  for (const cleanup of effects) if (typeof cleanup === 'function') cleanup();
});
