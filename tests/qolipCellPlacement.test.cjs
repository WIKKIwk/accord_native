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
const search = load('qolip/qolipSearchEngine.ts', { '../shared/searchNormalizer': load('shared/searchNormalizer.ts') });
const logic = load('qolip/qolipCellPlacement.ts', { './qolipApiCommon': common, './qolipSearchEngine': search });
const { QolipCellPlacementState } = load('qolip/qolipCellPlacementState.ts', { './qolipCellPlacement': logic });
const product = (code, more = {}) => ({ code: `ITEM-${code}`, name: `Name ${code}`, item_group: 'Group', customer_names: [],
  qolip_code: code, size: 40, has_qolip_spec: true, is_in_use: false, ...more });
const block = (name, warehouse = 'W') => ({ name, warehouse });
const location = (code, row = 'A', column = 1) => ({ qolip_code: code, row_letter: row, column_number: column });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(overrides = {}, input = {}) {
  const calls = [], blocks = [block(' A '), block('A', 'W2'), block('B'), block(' ')];
  let scope = 'one', valid = true;
  const deps = { locations: async name => { calls.push(['locations', name]); return name === 'A' ? [location('q1')] : []; },
    products: async () => { calls.push(['products']); return [product('Q1'), product('Q2'), product('Q3')]; },
    save: async (target, item) => { calls.push(['save', target, item.qolip_code]); },
    scope: () => scope, valid: () => valid, ...overrides };
  const state = new QolipCellPlacementState(deps, blocks, { initialBlock: blocks[2], rowLetter: 'C', columnNumber: 3, ...input });
  return { state, calls, blocks, setScope: value => { scope = value; }, setValid: value => { valid = value; } };
}

test('cell availability excludes unsaved, occupied and in-use molds and deduplicates eligible codes in source order', () => {
  const input = [product('Q1'), product('Q2', { has_qolip_spec: false }), product(' ', {}), product('Q3', { size: 0 }),
    product('Q4', { is_in_use: true }), product(' q4 '), product('Q4'), product('\u0085Q5\u0085'), product('Q6')];
  assert.deepEqual(logic.qolipProductsAvailableForCellPlacement(input, new Set([' q1 ', 'Q5', ''])), [input[5], input[8]]);
});

test('placed code reads start in parallel once per trimmed, case-sensitive name and require row plus nonnull column', async () => {
  const first = deferred(), second = deferred(), calls = [];
  const pending = logic.qolipPlacedCodes([block(' A '), block('A', 'W2'), block('a'), block(' ')], name => {
    calls.push(name); return name === 'A' ? first.promise : second.promise;
  });
  assert.deepEqual(calls, ['A', 'a']);
  first.resolve([location('Q1', ' A ', 0), location('Q2', '', 1), location('Q3', 'B', null)]);
  second.resolve([location(' q1 '), location(' Q4 '), location(' ', 'A', 1)]);
  assert.deepEqual([...await pending], ['q1', 'q4']);
});

test('picker reuses the fetched products, searches all V2 fields and pages without sorting', async () => {
  const h = harness({ products: async () => { h.calls.push(['products']); return [product('Q1'),
    product('Q2', { name: 'Kross model', customer_names: ['Olim'] }), product('Q3', { size: 42 }), product('Q4')]; } });
  h.state.start(); const picker = h.state.openPicker();
  assert.deepEqual((await picker.loadPage('kroos', 0, 80)).map(x => x.qolip_code), ['Q2']);
  assert.deepEqual((await picker.loadPage('olim', 0, 80)).map(x => x.qolip_code), ['Q2']);
  assert.deepEqual((await picker.loadPage('42', 0, 80)).map(x => x.qolip_code), ['Q3']);
  assert.deepEqual((await picker.loadPage('', 1, 1)).map(x => x.qolip_code), ['Q3']);
  assert.equal(h.calls.filter(x => x[0] === 'products').length, 1);
  assert.deepEqual(h.calls.filter(x => x[0] === 'locations').map(x => x[1]), ['A', 'B']);
  picker.close(); assert.deepEqual(await picker.loadPage('', 0, 80), []); h.state.dispose();
});

test('picker ignores late results after close or account change and retains read failure', async () => {
  const wait = deferred(); let reads = 0;
  const h = harness({ products: () => { reads++; return wait.promise; } }); h.state.start(); const picker = h.state.openPicker();
  const loading = picker.loadPage('', 0, 80); picker.close(); wait.resolve([product('Q2')]); assert.deepEqual(await loading, []);
  const other = h.state.openPicker(); h.setScope('two'); assert.deepEqual(await other.loadPage('', 0, 80), []); assert.equal(reads, 1);
  const failing = harness({ products: async () => { throw new Error('offline'); } }); failing.state.start(); const failed = failing.state.openPicker();
  await assert.rejects(failed.loadPage('', 0, 80), /offline/); await assert.rejects(failed.loadPage('query', 0, 80), /offline/);
  h.state.dispose(); failing.state.dispose();
});

test('single selection requires a saved specification and makes a single real-save call with its cell', async () => {
  const h = harness(); assert.equal(h.state.canSave, false); h.state.selectProduct(product('X', { has_qolip_spec: false }));
  assert.equal(h.state.canSave, false); assert.equal(await h.state.saveSelected(), null); assert.equal(h.calls.length, 0);
  const p = product('Q1'); h.state.selectProduct(p); assert.equal(h.state.canSave, true);
  assert.deepEqual(await h.state.saveSelected(), { kind: 'saved', target: { block: h.blocks[2], rowLetter: 'C', columnNumber: 3 }, products: [p] });
  assert.deepEqual(h.calls.map(x => x[0]), ['save']); h.state.dispose();
});

test('multi placement waits for confirmation, saves sequentially, skips unspeced items and reports partial success', async () => {
  const one = deferred(), calls = [];
  const h = harness({ save: async (_target, item) => { calls.push(item.qolip_code); if (item.qolip_code === 'Q1') await one.promise;
    if (item.qolip_code === 'Q2') throw new Error('denied'); } });
  const prepared = h.state.prepareMulti([product('Q1'), product('none', { has_qolip_spec: false }), product('Q2'), product('Q3')]);
  assert.deepEqual(calls, []); const pending = h.state.confirmMulti(prepared); assert.deepEqual(calls, ['Q1']);
  assert.equal(h.state.getSnapshot().saving, true); assert.equal(await h.state.confirmMulti(prepared), null);
  one.resolve(); assert.deepEqual(await pending, { kind: 'partial', saved: 2, failed: 1 });
  assert.deepEqual(calls, ['Q1', 'Q2', 'Q3']); assert.equal(h.state.getSnapshot().saving, false); h.state.dispose();
});

test('all failures keep the first error; missing target or cancelled confirmation sends nothing', async () => {
  const first = new Error('first'), second = new Error('second'); let writes = 0;
  const h = harness({ save: async () => { if (++writes === 1) throw first; throw second; } });
  const prepared = h.state.prepareMulti([product('Q1'), product('Q2')]); assert.equal(writes, 0);
  assert.deepEqual(await h.state.confirmMulti(prepared), { kind: 'failed', error: first }); assert.equal(writes, 2);
  const empty = harness({}, { rowLetter: null }); assert.equal(empty.state.prepareMulti([product('Q')]), null);
  assert.equal(await empty.state.saveSelected(), null); assert.equal(empty.calls.length, 0); h.state.dispose(); empty.state.dispose();
});

test('account reset prevents new writes including the remaining part of an in-flight batch', async () => {
  const one = deferred(), calls = []; const h = harness({ save: async (_target, item) => { calls.push(item.qolip_code); await one.promise; } });
  const prepared = h.state.prepareMulti([product('Q1'), product('Q2')]); const pending = h.state.confirmMulti(prepared);
  h.setValid(false); one.resolve(); assert.deepEqual(await pending, { kind: 'session_changed', saved: 1 }); assert.deepEqual(calls, ['Q1']);
  assert.equal(h.state.openPicker(), null); assert.deepEqual(await h.state.confirmMulti(prepared), { kind: 'session_changed', saved: 0 }); h.state.dispose();
});

test('placement hook binds existing location and product APIs and unregisters on account reset', async () => {
  const effects = [], calls = [], listeners = {}, session = { id: 1 }; let active = session, deps;
  class FakeState { constructor(input) { deps = input; } subscribe() {} getSnapshot() { return {}; }
    activate() { calls.push('activate'); } start() { calls.push('start'); } dispose() { calls.push('dispose'); }
    invalidateSession() { calls.push('invalidate'); } onIdle(callback) { callback(); } get canSave() { return false; } }
  const { useQolipCellPlacement } = load('qolip/useQolipCellPlacement.ts', {
    react: { useEffect: fn => effects.push(fn), useMemo: fn => fn(), useSyncExternalStore: (_sub, get) => get() },
    '../auth': { currentSession: () => active, registerSessionResetHook: callback => {
      listeners.reset = callback; return () => calls.push('unregister'); } },
    '../qolipProductsApi': { qolipProducts: (value, options) => { calls.push(['products', value, options]); return Promise.resolve([]); } },
    '../sessionReadScope': { sessionReadScope: value => `scope:${value.id}` },
    './qolipLocationsApi': { qolipLocations: (value, name) => { calls.push(['locations', value, name]); return Promise.resolve([]); },
      qolipSaveLocation: (value, input) => { calls.push(['save', value, input]); return Promise.resolve({}); } },
    './qolipCellPlacementState': { QolipCellPlacementState: FakeState },
  });
  const state = useQolipCellPlacement(session, [], {}); const cleanup = effects[0]();
  assert.equal(state.canSave, false); assert.equal(deps.valid(), true); assert.equal(deps.scope(), 'scope:1');
  const target = { block: block('A'), rowLetter: 'B', columnNumber: 1 }, item = product('Q1');
  await deps.products(); await deps.locations('A'); await deps.save(target, item);
  assert.deepEqual(calls[2], ['products', session, { limit: 20000, with_qolip_only: true }]);
  assert.deepEqual(calls[3], ['locations', session, 'A']);
  assert.deepEqual(calls[4], ['save', session, { ...target, product: item, quantity: 1 }]);
  active = { id: 2 }; assert.equal(deps.valid(), false); assert.equal(deps.scope(), 'scope:2');
  await listeners.reset(); cleanup(); assert.deepEqual(calls.slice(-3), ['invalidate', 'dispose', 'unregister']);
});


test('reset before session replacement stops a batch even after its view unmounts', async () => {
  const first = deferred(), calls = []; const h = harness({ save: async (_target, item) => { calls.push(item.qolip_code); await first.promise; } });
  const pending = h.state.confirmMulti(h.state.prepareMulti([product('Q1'), product('Q2')]));
  let unregistered = false; h.state.dispose(); h.state.onIdle(() => { unregistered = true; });
  assert.equal(unregistered, false); h.state.invalidateSession(); first.resolve();
  assert.deepEqual(await pending, { kind: 'session_changed', saved: 1 }); assert.deepEqual(calls, ['Q1']); assert.equal(unregistered, true);
});

test('closing the view does not interrupt an already confirmed batch without a session reset', async () => {
  const first = deferred(), calls = []; const h = harness({ save: async (_target, item) => { calls.push(item.qolip_code);
    if (item.qolip_code === 'Q1') await first.promise; } });
  const pending = h.state.confirmMulti(h.state.prepareMulti([product('Q1'), product('Q2')]));
  let unregistered = false; h.state.dispose(); h.state.onIdle(() => { unregistered = true; }); first.resolve();
  assert.equal(await pending, null); assert.deepEqual(calls, ['Q1', 'Q2']); assert.equal(unregistered, true);
});
