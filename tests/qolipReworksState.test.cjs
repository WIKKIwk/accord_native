const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const { QolipReworksState } = load('qolip/qolipReworksState.ts', { './qolipApiCommon': common });
const row = (id, overrides = {}) => ({ id, qolip_code: `Q-${id}`, qolip_set_id: 'SET', warehouse: 'W', item_code: 'I',
  item_name: 'Hot lunch', color: '', size: 40, sent_at: '2026-01-01T00:00:00Z', returned_at: null, is_open: true, ...overrides });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(overrides = {}) {
  let scope = 'one', next = 0; const calls = [], events = [], entries = [row('a'), row('b'), row('c', { qolip_set_id: '', item_name: '', is_open: false })];
  const state = new QolipReworksState({ load: async () => entries, scope: () => scope,
    nextRequestId: async () => `test-id-${++next}`, returnFromRework: async (id, ids) => { calls.push([id, ids]);
      return ids.map(value => row(value, { is_open: false, returned_at: '2026-01-02T00:00:00Z' })); },
    notifyLocationsChanged: () => events.push('revision'), ...overrides });
  return { state, calls, events, setScope: value => { scope = value; }, entries };
}

test('rework lists group in source order, use simple case-insensitive search and clear selection on tab change', async () => {
  const h = harness(); await h.state.load(); assert.equal(h.state.groups.length, 1);
  assert.deepEqual(h.state.groups[0].names, ['Hot lunch']); assert.equal(h.state.groups[0].entries.length, 2);
  h.state.setQuery(' LUNCH '); assert.equal(h.state.groups[0].key, 'SET');
  h.state.setQuery('hot lun'); assert.equal(h.state.groups.length, 1);
  h.state.setQuery('hotlunch'); assert.equal(h.state.groups.length, 0);
  h.state.setQuery(''); h.state.selectGroup(h.state.groups[0].entries, true); assert.equal(h.state.groups[0].selected, true);
  h.state.setReturned(true); assert.equal(h.state.getSnapshot().selected.size, 0);
  assert.equal(h.state.groups[0].key, 'Q-c'); assert.deepEqual(h.state.groups[0].names, ['I']);
});

test('refresh retains only selected IDs that are still open', async () => {
  let count = 0; const h = harness({ load: async () => ++count === 1 ? [row('a'), row('b')] : [row('a'), row('b', { is_open: false })] });
  await h.state.load(); h.state.toggle('a'); h.state.toggle('b'); h.state.toggle('missing'); await h.state.load();
  assert.deepEqual([...h.state.getSnapshot().selected], ['a']);
});

test('return confirmation sorts IDs, keeps one ID across an uncertain failure, and signals only success', async () => {
  let attempt = 0, ids = 0; const calls = [], events = [];
  const h = harness({ nextRequestId: async () => `stable-${++ids}`, returnFromRework: async (id, selected) => {
    calls.push([id, selected]); if (++attempt === 1) throw new Error('connection lost');
    return selected.map(value => row(value, { is_open: false, returned_at: '2026-01-02T00:00:00Z' })); },
    notifyLocationsChanged: () => events.push('revision') });
  await h.state.load(); h.state.toggle('b'); h.state.toggle('a'); const prepared = h.state.prepareReturn();
  assert.deepEqual(prepared.ids, ['a', 'b']); assert.equal((await h.state.confirmReturn(prepared)).kind, 'failed');
  assert.deepEqual(events, []); assert.equal((await h.state.confirmReturn(prepared)).kind, 'returned');
  assert.deepEqual(calls, [['stable-1', ['a', 'b']], ['stable-1', ['a', 'b']]]); assert.deepEqual(events, ['revision']);
  assert.equal(h.state.getSnapshot().selected.size, 0); assert.equal(h.state.groups.length, 0);
});

test('changed selection gets a new key and double submit or edits while saving do nothing', async () => {
  let ids = 0, attempt = 0; const wait = deferred(), calls = [];
  const h = harness({ nextRequestId: async () => `key-${++ids}`, returnFromRework: async (id, selected) => {
    calls.push([id, selected]); if (++attempt === 1) throw new Error('offline'); return wait.promise; } });
  await h.state.load(); h.state.toggle('a'); await h.state.confirmReturn(h.state.prepareReturn());
  h.state.toggle('b'); const prepared = h.state.prepareReturn(), pending = h.state.confirmReturn(prepared);
  h.state.toggle('a'); h.state.setReturned(true); assert.equal(await h.state.confirmReturn(prepared), null);
  assert.equal(h.state.getSnapshot().returned, false); assert.deepEqual([...h.state.getSnapshot().selected], ['a', 'b']);
  await Promise.resolve(); wait.resolve([row('a', { is_open: false }), row('b', { is_open: false })]); await pending;
  assert.deepEqual(calls, [['key-1', ['a']], ['key-2', ['a', 'b']]]);
});

test('a pending refresh cannot overwrite a completed return and loading ends when that future settles', async () => {
  const stale = deferred(); let reads = 0;
  const h = harness({ load: () => ++reads === 1 ? Promise.resolve([row('a'), row('b')]) : stale.promise });
  await h.state.load(); h.state.toggle('a'); const pendingRead = h.state.load();
  assert.equal((await h.state.confirmReturn(h.state.prepareReturn())).kind, 'returned');
  assert.equal(h.state.getSnapshot().loading, true);
  stale.resolve([row('a'), row('b')]); await pendingRead;
  assert.equal(h.state.getSnapshot().loading, false); assert.deepEqual(h.state.groups[0].entries.map(x => x.id), ['b']);
});

test('account changes before confirmation or during secure key creation never send a request', async () => {
  const key = deferred(), h = harness({ nextRequestId: () => key.promise });
  await h.state.load(); h.state.toggle('a'); let prepared = h.state.prepareReturn(); h.setScope('two');
  assert.deepEqual(await h.state.confirmReturn(prepared), { kind: 'session_changed' }); assert.equal(h.state.prepareReturn().kind, 'session_changed');
  h.setScope('one'); prepared = h.state.prepareReturn(); const pending = h.state.confirmReturn(prepared); h.setScope('two'); key.resolve('key');
  assert.deepEqual(await pending, { kind: 'session_changed' }); assert.deepEqual(h.calls, []); assert.deepEqual(h.events, []);
});
