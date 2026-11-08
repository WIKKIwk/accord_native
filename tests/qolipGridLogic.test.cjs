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
const grid = load('qolip/qolipGridLogic.ts', { './qolipApiCommon': common });
const item = (id, label, quantity) => ({ id, location_label: label, quantity });

test('home grid groups normalized cell labels, counts unplaced rows and sums every quantity', () => {
  const entries = [item('a', ' a1 ', 2), item('b', 'A1', 3), item('c', 'B2', 4), item('d', ' ', 5)];
  const data = grid.qolipGridData(entries);
  assert.equal(grid.qolipGridLetters.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'); assert.equal(grid.qolipGridRowCount, 13);
  assert.deepEqual(data.byCell.get('A1'), entries.slice(0, 2)); assert.deepEqual(data.unplaced, [entries[3]]);
  assert.equal(data.occupiedCells, 2); assert.equal(data.totalQuantity, 14);
});

test('unknown nonempty labels still contribute to V2 occupancy and quantity', () => {
  const data = grid.qolipGridData([item('a', 'Z99', 2), item('b', 'not a cell', 7)]);
  assert.equal(data.occupiedCells, 2); assert.equal(data.totalQuantity, 9);
});

test('cell actions distinguish unplaced, same cell and other cells without sorting', () => {
  const entries = [item('a', '', 1), item('b', ' a1 ', 2), item('c', 'B2', 3), item('d', ' A2 ', 4)];
  assert.deepEqual(grid.qolipCellAlternatives('A1', entries), { unplaced: [entries[0]], movableIn: [entries[2], entries[3]] });
});

test('selection uses identity set and keeps original order including duplicate IDs', () => {
  const entries = [item('a', 'A1', 1), item('b', 'A1', 1), item('a', 'A1', 2)];
  assert.deepEqual(grid.qolipCellSelection(entries, new Set(['a'])), { selectionMode: true, selectedItems: [entries[0], entries[2]] });
  assert.deepEqual(grid.qolipCellSelection(entries, new Set(['missing'])), { selectionMode: true, selectedItems: [] });
  assert.deepEqual(grid.qolipCellSelection(entries, new Set()), { selectionMode: false, selectedItems: [] });
});

test('home grid supplies fixed row-major cells with first title, summed quantities and current match badges', () => {
  const entries = [{ ...item('a', ' a1 ', 2), item_name: 'First' }, { ...item('b', 'A1', 3), item_name: 'Second' },
    { ...item('c', 'Z13', 4), item_name: 'Last' }, { ...item('outside', 'B99', 8), item_name: 'Hidden' }];
  const data = grid.qolipGridCells(entries, { A1: 2, Z13: 1, B1: 9 });
  assert.equal(data.rows.length, 13); assert.equal(data.rows[0].length, 26);
  assert.deepEqual(data.rows[0][0], { label: 'A1', letter: 'A', row: 1, items: entries.slice(0, 2), quantity: 5, title: 'First', matchCount: 2 });
  assert.deepEqual(data.rows[0][1], { label: 'B1', letter: 'B', row: 1, items: [], quantity: 0, title: '', matchCount: 9 });
  assert.equal(data.rows[12][25].label, 'Z13'); assert.equal(data.occupiedCells, 3); assert.equal(data.totalQuantity, 17);
});

test('search-match overlay uses the V2 green at 22 percent over a Material container', () => {
  assert.equal(grid.qolipGridMatchBackground('#FFFFFFFF'), '#D1E2D2FF');
  assert.equal(grid.qolipGridMatchBackground('#000000FF'), '#0A1C0BFF');
  assert.equal(grid.qolipGridMatchBackground('unknown'), 'unknown');
});
