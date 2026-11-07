const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function setup(api) {
  const filename = path.resolve(__dirname, '../src/preparation/usePreparationHome.ts'), mod = new Module(filename, module);
  mod.require = id => {
    if (id === 'react') return {};
    if (id === '../auth') return { registerSessionResetHook: () => () => {} };
    if (id === '../preparationReadApi') return { preparationSnapshot: api.snapshot };
    if (id === './preparationCommandApi') return { preparationPendingCommand: api.pending, preparationSubmit: api.submit };
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return new mod.exports.PreparationHomeState({});
}
const snapshot = (orders = []) => ({ assigned_warehouses: ['Own'], material_warehouses: ['Own'], materials: [], orders, history: [], warehouses: [], managed_warehouses: [], responsibilities: [] });
test('home reload selects the sole warehouse and invalidates a saved order', async () => {
  let current = snapshot([{ id: 'o', saved: false }]);
  const state = setup({ snapshot: async () => current, pending: async () => null, submit: async () => ({}) });
  await state.reload(); assert.equal(state.getSnapshot().warehouse, 'Own');
  state.selectOrder('o'); state.setPercent('P1', '20');
  current = snapshot([{ id: 'o', saved: true }]); await state.reload();
  assert.equal(state.getSnapshot().orderId, null); assert.deepEqual(state.getSnapshot().percentages, {});
});
test('account reset clears the home snapshot and rejects an in-flight result', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const state = setup({ snapshot: () => pending, pending: async () => null, submit: async () => ({}) });
  const request = state.reload(); await Promise.resolve(); state.sessionChanged(); release(snapshot()); await request;
  assert.equal(state.getSnapshot().snapshot, null); assert.equal(state.locked, true);
  assert.match(state.getSnapshot().error, /Akkaunt/);
});
test('home locks uncertain operations and refreshes after a failed submission', async () => {
  let count = 0, pending = null;
  const state = setup({ snapshot: async () => { count++; return snapshot(); }, pending: async () => pending,
    submit: async () => { pending = { kind: 'receipts', payload: {}, request_id: 'id' }; throw Error('offline'); } });
  await state.reload(); await assert.rejects(state.submit('receipts', {}));
  assert.equal(count, 2); assert.equal(state.getSnapshot().pending.kind, 'receipts'); assert.equal(state.locked, true);
});

test('account reset clears home state and rejects a late snapshot', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const state = setup({ snapshot: () => pending, pending: async () => null, submit: async () => ({}) });
  const read = state.reload();
  await Promise.resolve();
  state.invalidate(); release(snapshot()); await read;
  assert.equal(state.getSnapshot().snapshot, null);
  assert.equal(state.getSnapshot().warehouse, null);
  assert.match(state.getSnapshot().error, /Akkaunt/);
});

test('only a marked child return reloads the preparation home', async () => {
  let reads = 0;
  const state = setup({ snapshot: async () => { reads++; return snapshot(); }, pending: async () => null });
  await state.reload();
  await state.refreshOnReturn(); // Returning from chat or profile does not mark the home.
  assert.equal(reads, 1);
  state.markReloadOnReturn();
  await state.refreshOnReturn();
  assert.equal(reads, 2);
  await state.refreshOnReturn();
  assert.equal(reads, 2);
});

test('manual refresh retains the snapshot and does not start another read while loading', async () => {
  let reads = 0, finish;
  const original = snapshot();
  const state = setup({ snapshot: () => ++reads === 1 ? Promise.resolve(original) : new Promise(resolve => { finish = resolve; }),
    pending: async () => null });
  await state.reload();
  const refreshing = state.refresh();
  assert.equal(state.getSnapshot().refreshing, true);
  assert.equal(state.getSnapshot().loading, true);
  assert.equal(state.getSnapshot().snapshot, original);
  assert.equal(state.locked, true);
  await state.refresh();
  await Promise.resolve();
  assert.equal(reads, 2);
  finish(snapshot());
  await refreshing;
  assert.equal(state.getSnapshot().refreshing, false);
  assert.equal(state.getSnapshot().loading, false);
});

test('overlapping reloads retain the newest result and its loading state', async () => {
  for (const newestFinishesFirst of [false, true]) {
    const waiting = [];
    const state = setup({ snapshot: () => new Promise(resolve => waiting.push(resolve)), pending: async () => null });
    const first = state.reload();
    const second = state.reload();
    await Promise.resolve();
    // The first read was superseded before it reached the snapshot request.
    assert.equal(waiting.length, 1);
    waiting.shift()(snapshot());
    await Promise.all([first, second]);

    const oldRead = state.reload();
    await Promise.resolve();
    const newRead = state.reload();
    await Promise.resolve();
    const finishOld = waiting.shift(), finishNew = waiting.shift();
    const oldSnapshot = { ...snapshot(), marker: 'old' }, newSnapshot = { ...snapshot(), marker: 'new' };
    if (newestFinishesFirst) {
      finishNew(newSnapshot); await newRead;
      finishOld(oldSnapshot); await oldRead;
    } else {
      let oldCompleted = false;
      void oldRead.then(() => { oldCompleted = true; });
      finishOld(oldSnapshot); await Promise.resolve(); await Promise.resolve();
      assert.equal(state.getSnapshot().loading, true);
      assert.equal(oldCompleted, false);
      finishNew(newSnapshot); await Promise.all([oldRead, newRead]);
    }
    assert.equal(state.getSnapshot().snapshot, newSnapshot);
    assert.equal(state.getSnapshot().loading, false);
  }
});

test('pending command descriptions preserve the V2 labels', () => {
  const filename = path.resolve(__dirname, '../src/preparation/preparationHomePresentation.ts'), mod = new Module(filename, module);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  const label = mod.exports.preparationPendingLabel;
  assert.equal(label({ kind: 'receipts', payload: { kg: '2.5' } }), 'Kirim: 2.5 kg');
  assert.equal(label({ kind: 'materials', payload: { name: 'Kley' } }), 'Homashyo: Kley');
  assert.equal(label({ kind: 'consumptions', payload: { order_id: 'O-1' } }), 'Order: O-1');
});
