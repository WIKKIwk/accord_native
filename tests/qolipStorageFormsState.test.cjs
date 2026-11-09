const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), mod = new Module(filename, module); cache.set(name, mod);
  mod.require = key => key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const { QolipPaddonCreateState, QolipInspectionState } = load('qolip/qolipStorageFormsState.ts');
function boundary() {
  let valid = true; const listeners = new Set();
  return { boundary: { current: () => valid, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } },
    expire: () => { valid = false; [...listeners].forEach(fn => fn()); }, revive: () => { valid = true; } };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
// Source-derived pure rules from the two V2 dialog widgets; no V2 runtime or fabricated recording.
test('paddon create selects one warehouse, accepts only a current draft warehouse, and returns empty location/note', () => {
  const b = boundary(), create = (warehouses, initial) => { const owner = new QolipPaddonCreateState(warehouses, initial, b.boundary); owner.activate(); return owner; };
  let owner = create(['W']); assert.deepEqual(owner.submit(), { warehouse: 'W', location: '', note: '' }); owner.suspend();
  owner = create(['W', 'X'], { warehouse: 'X', location: 'old', note: 'old' }); assert.deepEqual(owner.submit(), { warehouse: 'X', location: '', note: '' }); owner.suspend();
  owner = create(['W'], { warehouse: 'missing' }); assert.equal(owner.getSnapshot().warehouse, 'W'); owner.suspend();
});
test('zero/multiple warehouses have no default and invalid choices do not enable create', () => {
  for (const warehouses of [[], ['W', 'X']]) {
    const owner = new QolipPaddonCreateState(warehouses, { warehouse: 'missing' }, boundary().boundary); owner.activate();
    assert.equal(owner.getSnapshot().canSubmit, false); assert.equal(owner.submit(), null); owner.choose('fake'); assert.equal(owner.submit(), null); owner.suspend();
  }
});
test('create tests null rather than truthiness and preserves exact warehouse spelling/order', () => {
  const owner = new QolipPaddonCreateState([' W ', ''], null, boundary().boundary); owner.activate(); owner.choose('');
  assert.deepEqual(owner.submit(), { warehouse: '', location: '', note: '' }); assert.deepEqual(owner.warehouses, [' W ', '']); owner.choose(' W '); assert.equal(owner.submit().warehouse, ' W '); owner.suspend();
});
test('create input/results clear on original-boundary expiration and do not revive after ABA', () => {
  const b = boundary(), owner = new QolipPaddonCreateState(['private'], null, b.boundary); owner.activate(); b.expire(); b.revive();
  assert.equal(owner.getSnapshot().invalid, true); assert.equal(owner.getSnapshot().warehouse, null); assert.equal(owner.submit(), null); owner.choose('private'); owner.suspend();
});
function inspection(expected, values = []) {
  const b = boundary(), owner = new QolipInspectionState(expected, b.boundary, async () => values.shift() ?? null); owner.activate(); return { ...b, owner };
}
test('inspection found follows scan order with expected spelling; missing follows expected order; duplicates update casing in place', async () => {
  const h = inspection(['A', 'b', 'C', 'a'], ['b', 'unknown', 'A', 'B']);
  await h.owner.scan(); await h.owner.scan(); await h.owner.scan(); await h.owner.scan();
  const value = h.owner.getSnapshot(); assert.deepEqual(value.found, ['b', 'a']); assert.deepEqual(value.missing, ['C']); assert.deepEqual(value.unexpected, ['unknown']);
  assert.deepEqual(h.owner.result(), ['B', 'unknown', 'A']); h.owner.suspend();
});
test('inspection uses the existing raw-material parser and keeps opaque mold text', async () => {
  const h = inspection(['Q-ONE', 'Milano Premium 30/40'], ['https://erp.example/scan?barcode=%20Q-ONE%20', ' Milano Premium 30/40 ']);
  await h.owner.scan(); await h.owner.scan(); assert.deepEqual(h.owner.getSnapshot().found, ['Q-ONE', 'Milano Premium 30/40']); h.owner.suspend();
});
test('null/blank scan results are ignored and empty or incomplete inspections can still be saved', async () => {
  const h = inspection(['A'], [null, ' \u0085 ']); assert.deepEqual(h.owner.result(), []); await h.owner.scan(); await h.owner.scan();
  assert.deepEqual(h.owner.result(), []); assert.deepEqual(h.owner.getSnapshot().missing, ['A']); h.owner.suspend();
});
test('pending scan disables scan/cancel/save while chip deletion remains active', async () => {
  const b = boundary(), pending = deferred(); let scans = 0;
  const owner = new QolipInspectionState(['A'], b.boundary, () => ++scans === 1 ? Promise.resolve('A') : pending.promise); owner.activate(); await owner.scan();
  const result = owner.scan(); await owner.scan(); assert.equal(scans, 2); assert.equal(owner.getSnapshot().scanning, true); assert.equal(owner.canCancel(), false); assert.equal(owner.result(), null);
  owner.remove('a'); assert.deepEqual(owner.getSnapshot().codes, []); assert.equal(owner.canAct(), true, 'source ordinary backdrop/back dismissal remains allowed');
  pending.resolve('B'); await result; assert.deepEqual(owner.result(), ['B']); owner.suspend();
});
test('expiration during a scan suppresses its result and erases every code/expected label', async () => {
  const b = boundary(), pending = deferred(), owner = new QolipInspectionState(['private'], b.boundary, () => pending.promise); owner.activate();
  const result = owner.scan(); b.expire(); b.revive(); pending.resolve('private'); await result;
  assert.deepEqual(owner.getSnapshot().codes, []); assert.deepEqual(owner.getSnapshot().missing, []); assert.equal(owner.result(), null); owner.suspend();
});
test('suspend/restart does not accept a completion from a previous scan activation', async () => {
  const b = boundary(), pending = deferred(), owner = new QolipInspectionState(['A'], b.boundary, () => pending.promise); owner.activate();
  const result = owner.scan(); owner.suspend(); owner.activate(); pending.resolve('A'); await result; assert.deepEqual(owner.result(), []); owner.suspend();
});
test('source scan-dialog failure is propagated without inventing a snackbar or silently accepting a result', async () => {
  const failure = new Error('scan failed'), h = inspection([]); h.owner.suspend();
  const owner = new QolipInspectionState([], h.boundary, async () => { throw failure; }); owner.activate();
  await assert.rejects(owner.scan(), value => value === failure); assert.equal(owner.getSnapshot().scanning, true); assert.equal(owner.result(), null); assert.equal(owner.canAct(), true); owner.suspend();
});
test('source parser errors propagate without creating a scanned code', async () => {
  const b = boundary(), owner = new QolipInspectionState([], b.boundary, async () => 'nonblank', () => { throw new URIError('bad UTF-8'); }); owner.activate();
  await assert.rejects(owner.scan(), URIError); assert.deepEqual(owner.getSnapshot().codes, []); assert.equal(owner.getSnapshot().scanning, false); owner.suspend();
});
test('a subscriber invalidating the boundary before scanner launch prevents the scanner from opening', async () => {
  const b = boundary(); let calls = 0; const owner = new QolipInspectionState(['private'], b.boundary, async () => { calls++; return 'private'; }); owner.activate();
  owner.subscribe(() => { if (owner.getSnapshot().scanning) b.expire(); }); await owner.scan(); assert.equal(calls, 0); assert.equal(owner.getSnapshot().invalid, true); owner.suspend();
});

test('new widget warehouse options retain the existing selection instead of reapplying the initial draft', () => {
  const b = boundary(), owner = new QolipPaddonCreateState(['W', 'X'], { warehouse: 'W' }, b.boundary); owner.activate(); owner.choose('X');
  owner.updateWarehouses(['X', 'Y']); assert.equal(owner.getSnapshot().warehouse, 'X'); assert.deepEqual(owner.warehouses, ['X', 'Y']);
  owner.choose('Y'); assert.equal(owner.submit().warehouse, 'Y'); b.expire(); assert.deepEqual(owner.warehouses, []); owner.suspend();
});
test('new expected widget input reclassifies retained scans without resetting their order or starting a scan', async () => {
  const h = inspection(['A'], ['A', 'B']); await h.owner.scan(); await h.owner.scan();
  h.owner.updateExpected(['b', 'C']); const state = h.owner.getSnapshot();
  assert.deepEqual(state.found, ['b']); assert.deepEqual(state.missing, ['C']); assert.deepEqual(state.unexpected, ['A']); assert.deepEqual(h.owner.result(), ['A', 'B']); h.owner.suspend();
});
