const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/metalayzer/metalayzerListState.ts');
const loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { MetalayzerListState } = loaded.exports;
const item = barcode => ({ barcode, itemName: 'Film', itemCode: 'F', warehouse: 'W', qty: 1, uom: 'kg', isMetalayzer: true });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('reload and pagination keep the latest marked materials', async () => {
  const calls = [], state = new MetalayzerListState({ isCurrent: () => true, page: (cursor, current) => {
    const pending = deferred(); calls.push({ cursor, current, ...pending }); return pending.promise;
  } });
  state.activate();
  const old = state.reload(), fresh = state.reload();
  calls[1].resolve({ items: [item('A')], nextCursor: 'cursor-a' }); await fresh;
  calls[0].resolve({ items: [item('OLD')], nextCursor: null }); await old;
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['A']);
  const more = state.loadMore();
  assert.equal(calls[2].cursor, 'cursor-a');
  await state.loadMore(); assert.equal(calls.length, 3);
  calls[2].resolve({ items: [item('a'), item('B')], nextCursor: null }); await more;
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['A', 'B']);
  assert.equal(state.getSnapshot().cursor, null);
});

test('a refresh or session change discards in-flight page results', async () => {
  const calls = []; let current = true;
  const state = new MetalayzerListState({ isCurrent: () => current, page: (cursor, guard) => {
    const pending = deferred(); calls.push({ cursor, guard, ...pending }); return pending.promise;
  } });
  state.activate(); const first = state.reload();
  calls[0].resolve({ items: [item('A')], nextCursor: 'next' }); await first;
  const more = state.loadMore(), refresh = state.reload();
  assert.equal(calls[1].guard(), false);
  calls[1].resolve({ items: [item('STALE')], nextCursor: null }); await more;
  calls[2].resolve({ items: [item('NEW')], nextCursor: null }); await refresh;
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['NEW']);
  const pending = state.reload(); current = false;
  calls[3].resolve({ items: [item('OTHER')], nextCursor: null }); await pending;
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['NEW']);
  state.invalidate(); assert.deepEqual(state.getSnapshot().items, []);
});

test('load-more failures preserve existing items and allow retry', async () => {
  let count = 0;
  const state = new MetalayzerListState({ isCurrent: () => true, page: async () => {
    count++; if (count === 1) return { items: [item('A')], nextCursor: 'next' };
    if (count === 2) throw new Error('Aloqa yo‘q');
    return { items: [item('B')], nextCursor: null };
  } });
  state.activate(); await state.reload(); await state.loadMore();
  assert.equal(state.getSnapshot().moreError, 'Aloqa yo‘q');
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['A']);
  await state.loadMore();
  assert.deepEqual(state.getSnapshot().items.map(i => i.barcode), ['A', 'B']);
});
