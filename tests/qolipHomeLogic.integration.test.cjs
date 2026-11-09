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
const h = load('qolip/qolipHomeLogic.ts', { './qolipApiCommon': common, './qolipSearchEngine': search });
const block = (name, warehouse = 'W') => ({ name, warehouse });
const location = (overrides = {}) => ({ id: '1', block: ' A ', warehouse: 'W', item_code: 'ITEM', item_name: 'Hotlunch',
  qolip_code: 'Q-1', size: 40, quantity: 2, row_letter: 'A', column_number: 1, location_label: ' a1 ', ...overrides });
const result = (blocks, overrides = {}) => ({ warehouses: ['W'], blocks, supports_cross_block_move: false, ...overrides });

test('selected tab follows its block when another block moves across it', () => {
  assert.equal(h.reorderedTabIndex(0, 0, 2), 2);
  assert.equal(h.reorderedTabIndex(2, 0, 2), 1);
  assert.equal(h.reorderedTabIndex(0, 2, 0), 1);
  for (let old = 0; old < 4; old++) for (let next = 0; next < 4; next++) for (let current = 0; current < 4; current++) {
    const original = [0, 1, 2, 3], move = [...original], [item] = move.splice(old, 1); move.splice(next, 0, item);
    assert.equal(move[h.reorderedTabIndex(current, old, next)], original[current]);
  }
});

test('saved block order retains first key order, final duplicate value and unmatched server order', () => {
  const a = block(' A '), b = block('B'), duplicate = block('a', 'Other'), c = block('C');
  assert.equal(h.qolipHomeBlockOrderKey, 'qolip.home.block_order');
  assert.deepEqual(h.qolipApplySavedBlockOrder([a, b, duplicate, c], ['b', 'missing', 'b']), [b, duplicate, c]);
  assert.deepEqual(h.qolipApplySavedBlockOrder([a, b, duplicate, c], []), [duplicate, b, c]);
});

test('invalid reorders do nothing and valid reorders preserve selected block', () => {
  const blocks = [block('A'), block('B'), block('C')];
  assert.deepEqual(h.qolipReorderBlocks(blocks, 1, 0, 2), { blocks: [blocks[1], blocks[2], blocks[0]], selectedIndex: 0, changed: true });
  assert.deepEqual(h.qolipReorderBlocks(blocks, 1, 3, 0), { blocks, selectedIndex: 1, changed: false });
  assert.deepEqual(h.qolipReorderBlocks(blocks, 1, 1, 1), { blocks, selectedIndex: 1, changed: false });
});

test('quiet refresh detects changes in every visible block and location field', () => {
  const initial = result([block('A')]); assert.equal(h.sameQolipHomeBlocks(initial, result([block('A')])), true);
  assert.equal(h.sameQolipHomeBlocks(null, initial), false);
  for (const changed of [result([block('a')]), result([block('A', 'other')]), result([block('A')], { warehouses: ['w'] }),
    result([block('A')], { supports_cross_block_move: true })]) assert.equal(h.sameQolipHomeBlocks(initial, changed), false);
  const original = location(); assert.equal(h.sameQolipHomeLocations([original], [{ ...original }]), true);
  for (const key of Object.keys(original)) assert.equal(h.sameQolipHomeLocations([original], [{ ...original, [key]: `${original[key]}!` }]), false, key);
  assert.equal(h.sameQolipHomeLocations(null, []), false);
});

test('home search counts matching locations by normalized actual block and cell, including duplicates', async () => {
  const rows = { A: [location(), location({ id: '2', location_label: 'A1' }), location({ id: '3', item_name: 'Other', item_code: 'X' })],
    B: [location({ id: '4', block: 'B', location_label: '', item_name: 'Hotlunch' })] };
  const counts = await h.qolipHomeSearchCounts([block('A'), block('B')], 'hotlunch', async key => rows[key], () => true);
  assert.deepEqual({ ...counts.blocks }, { a: 2, b: 1 }); assert.deepEqual({ ...counts.cells.a }, { A1: 2 });
  assert.deepEqual({ ...counts.cells.b }, { '': 1 });
});

test('failed block reads are ignored and stale search generations never publish counts', async () => {
  let current = true, resolve;
  const wait = new Promise(done => { resolve = done; });
  const pending = h.qolipHomeSearchCounts([block('A'), block('B')], 'hot', name => name === 'A' ? wait : Promise.reject(new Error('offline')), () => current);
  current = false; resolve([location()]); assert.equal(await pending, null);
  const result = await h.qolipHomeSearchCounts([block('A'), block('B')], 'hot', name => name === 'A'
    ? Promise.resolve([location()]) : Promise.reject(new Error('offline')), () => true);
  assert.deepEqual({ ...result.blocks }, { a: 1 });
});
