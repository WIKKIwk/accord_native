const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/qolip/qolipProductTransferState.ts'), loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { QolipProductTransferState } = loaded.exports;
const mold = (code, item = 'ITEM-A', patch = {}) => ({ code: item, name: item, qolip_code: code, is_in_use: false, customer_names: [], item_group: '', ...patch });
const a = mold('Q1'), b = mold('Q2'), target = mold('', 'ITEM-B');
function harness(patch = {}) {
  const calls = [], messages = []; let current = true, id = 0, rows = [a, b], pendingFailure = false;
  const deps = { current: () => current, products: async input => { calls.push(['products', input]); return rows; },
    transfer: async input => { calls.push(['transfer', input]); if (pendingFailure) throw new Error('lost response'); return input.qolipCodes.map(code => mold(code.toUpperCase(), input.toItemCode)); },
    requestId: async () => { calls.push(['id']); return `id-${++id}`; }, confirm: async (...args) => { calls.push(['confirm', ...args]); return true; },
    scan: async () => 'qr', lookup: async () => ({ kind: 'qolip', product: a }), pickCandidate: async values => { calls.push(['candidates', values]); return values[0]; },
    notice: (...args) => messages.push(args), error: (error, fallback) => messages.push(['error', fallback]),
    changed: () => calls.push(['revision']), scrollTo: item => calls.push(['scroll', item.code]), ...patch };
  const state = new QolipProductTransferState(deps); state.activate();
  return { state, calls, messages, setCurrent: value => { current = value; }, setRows: value => { rows = value; }, fail: value => { pendingFailure = value; } };
}
test('source product picker deduplicates source in original order and excludes the opposite product', async () => {
  const h = harness(); h.setRows([a, b, mold('Q3', 'ITEM-B'), mold('Q4', 'ITEM-C')]); await h.state.reload();
  h.state.selectProduct(false, target);
  const pick = h.state.productPicker(true);
  assert.deepEqual((await pick('', 0, 80)).map(item => item.code), ['ITEM-A', 'ITEM-C']);
  assert.equal(h.calls.filter(call => call[0] === 'products').length, 1, 'empty source uses the loaded full snapshot');
  await pick('query', 0, 80); await pick('query', 80, 80);
  assert.equal(h.calls.filter(call => call[0] === 'products').length, 2, 'one query future serves every page');
  assert.deepEqual(h.calls.at(-1), ['products', { query: 'query', limit: 20000, with_qolip_only: true }]);
});
test('target picker requests products without requiring a mold spec', async () => {
  const h = harness(); await h.state.reload(); h.state.selectProduct(true, a); h.setRows([a, target]);
  const result = await h.state.productPicker(false)('', 0, 80);
  assert.deepEqual(result, [target]); assert.deepEqual(h.calls.at(-1), ['products', { query: '', limit: 20000, with_qolip_only: false }]);
});
test('selection clears when changing product, is limited to 100, and reload retains only available source molds', async () => {
  const h = harness(); h.setRows(Array.from({ length: 102 }, (_, index) => mold(`Q${index}`))); await h.state.reload(); h.state.selectProduct(true, a);
  for (let i = 0; i < 101; i++) h.state.toggle(`q${i}`, a);
  assert.equal(h.state.getSnapshot().selected.size, 100); assert.deepEqual(h.messages.at(-1), ['limit']);
  h.setRows([mold('Q0'), mold('Q1', 'ITEM-A', { is_in_use: true })]); await h.state.reload();
  assert.deepEqual([...h.state.getSnapshot().selected], ['q0']);
  h.state.toggle('other', target); assert.deepEqual([...h.state.getSnapshot().selected], ['other']);
});
test('transfer confirms sorted unique codes, retains retry ID after uncertainty and atomically publishes validated saved molds first', async () => {
  const h = harness(); await h.state.reload(); h.state.selectProduct(true, a); h.state.selectProduct(false, target); h.state.toggle('q1', a); h.fail(true);
  await h.state.move(['q2', 'q1', 'q1'], a, target);
  assert.deepEqual(h.state.getSnapshot().molds, [a, b]); assert.equal(h.state.getSnapshot().selected.size, 1);
  h.fail(false); await h.state.move(['q1', 'q2'], a, target);
  const sent = h.calls.filter(call => call[0] === 'transfer').map(call => call[1]);
  assert.equal(sent[0].requestId, sent[1].requestId); assert.deepEqual(sent[1].qolipCodes, ['q1', 'q2']);
  assert.equal(h.calls.filter(call => call[0] === 'id').length, 1);
  assert.deepEqual(h.state.getSnapshot().molds.map(item => [item.code, item.qolip_code]), [['ITEM-B', 'Q1'], ['ITEM-B', 'Q2']]);
  assert.equal(h.state.getSnapshot().selected.size, 0); assert.deepEqual(h.messages.at(-1), ['success', { count: 2 }]);
  assert.ok(h.calls.some(call => call[0] === 'revision'));
});
test('changed transfer intent gets a new ID and a cancelled confirmation sends no mutation', async () => {
  let accepted = true; const h = harness({ confirm: async () => accepted }); await h.state.reload(); h.fail(true);
  await h.state.move(['q1'], a, target); await h.state.move(['q2'], a, target);
  assert.equal(h.calls.filter(call => call[0] === 'id').length, 2);
  accepted = false; await h.state.move(['q1'], a, target);
  assert.equal(h.calls.filter(call => call[0] === 'transfer').length, 2); assert.equal(h.state.getSnapshot().saving, false);
});
test('unknown, in-use and oversized selections stop before confirmation or random ID generation', async () => {
  const h = harness(); h.setRows([a, mold('Q2', 'ITEM-A', { is_in_use: true }), ...Array.from({ length: 101 }, (_, index) => mold(`X${index}`))]); await h.state.reload();
  await h.state.move(['unknown'], a, target); assert.deepEqual(h.messages.at(-1), ['unknown']);
  await h.state.move(['q2'], a, target); assert.deepEqual(h.messages.at(-1), ['in_use']);
  await h.state.move(Array.from({ length: 101 }, (_, index) => `x${index}`), a, target); assert.deepEqual(h.messages.at(-1), ['limit']);
  assert.equal(h.calls.filter(call => ['id', 'confirm', 'transfer'].includes(call[0])).length, 0);
});
test('scan reuses current source among shared mold candidates and clears an identical target', async () => {
  const shared = mold('Q1', 'ITEM-C'), h = harness(); h.setRows([a, shared]); await h.state.reload(); h.state.selectProduct(true, shared); h.state.selectProduct(false, shared);
  await h.state.scanSource(); assert.equal(h.state.getSnapshot().source, shared); assert.equal(h.state.getSnapshot().target, null);
  assert.deepEqual([...h.state.getSnapshot().selected], ['q1']); assert.equal(h.calls.filter(call => call[0] === 'candidates').length, 0);
});
test('scan asks for ambiguous product, keeps used molds unselected, and cancellation leaves state intact', async () => {
  const used = mold('Q1', 'ITEM-C', { is_in_use: true }), h = harness({ pickCandidate: async () => used }); h.setRows([a, used]); await h.state.reload();
  await h.state.scanSource(); assert.equal(h.state.getSnapshot().source, used); assert.equal(h.state.getSnapshot().selected.size, 0); assert.deepEqual(h.messages.at(-1), ['in_use']);
  const cancelled = harness({ scan: async () => null }); await cancelled.state.reload(); await cancelled.state.scanSource(); assert.equal(cancelled.state.getSnapshot().source, null); assert.equal(cancelled.state.getSnapshot().scanning, false);
});
test('expired original boundary blocks post-confirmation send and late mutation publication', async () => {
  let h; h = harness({ confirm: async () => { h.setCurrent(false); return true; } }); await h.state.reload(); await h.state.move(['q1'], a, target);
  assert.equal(h.calls.filter(call => call[0] === 'transfer').length, 0);
  let finish; const pending = new Promise(resolve => { finish = resolve; }), later = harness({ transfer: async () => pending }); await later.state.reload();
  const operation = later.state.move(['q1'], a, target); await new Promise(resolve => setImmediate(resolve)); later.setCurrent(false); finish([mold('Q1', 'ITEM-B')]); await operation;
  assert.deepEqual(later.state.getSnapshot().molds, [a, b]); assert.equal(later.calls.filter(call => call[0] === 'revision').length, 0);
});
