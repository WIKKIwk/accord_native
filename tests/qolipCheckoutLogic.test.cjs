const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/');
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext,
  } }).outputText, filename);
  return loaded.exports;
}
const picker = load('qolip/qolipCellPickerLogic.ts'), ledger = load('qolip/qolipCheckoutLogic.ts');
const checkout = (patch = {}) => ({ id: 'one', location_id: 'L', block: 'Block', warehouse: 'Warehouse', item_code: 'ITEM-73', item_name: '  Product  ',
  qolip_code: 'MOLD-24', size: 40, quantity: 2, row_letter: 'A', column_number: 1, location_label: 'A1', issued_to_name: '  Worker  ',
  status: 'open', issued_at: 'invalid-date', is_open: true, ...patch });

test('cell picker normalization preserves source letter/digit extraction and 1–13 range', () => {
  for (const [input, expected] of [['a 001', 'A1'], ['zZ / 13', 'Z13'], ['A-2', 'A2'], ['A0', null], ['A14', null], ['12', null], ['Ab', null]]) {
    assert.equal(picker.normalizeQolipCellLabel(input), expected, input);
  }
});

test('cell picker enumerates letter-first and promotes an exact normalized search result', () => {
  const labels = picker.allQolipCellLabels(); assert.equal(labels.length, 338);
  assert.deepEqual(labels.slice(0, 3), ['A1', 'A2', 'A3']); assert.deepEqual(labels.slice(12, 15), ['A13', 'B1', 'B2']);
  assert.equal(labels.at(-1), 'Z13'); assert.deepEqual(picker.searchQolipCellLabels('  '), []);
  assert.deepEqual(picker.searchQolipCellLabels('a-01'), ['A1']);
  assert.deepEqual(picker.searchQolipCellLabels('A1').slice(0, 5), ['A1', 'A10', 'A11', 'A12', 'A13']);
  assert.equal(picker.searchQolipCellLabels('1').length, 130);
});

test('checkout return target tries source row/column first and then the location label', () => {
  assert.equal(ledger.qolipKnownReturnCell(checkout({ row_letter: ' bc ', column_number: 3, location_label: 'Z9' })), 'B3');
  assert.equal(ledger.qolipKnownReturnCell(checkout({ row_letter: 'A', column_number: 14, location_label: ' D-02 ' })), 'D2');
  assert.equal(ledger.qolipKnownReturnCell(checkout({ row_letter: '', column_number: null, location_label: 'unplaced' })), null);
  assert.equal(ledger.qolipKnownReturnCell(checkout({ row_letter: 'A', column_number: -2 })), 'A2');
});

test('checkout search uses the exact source fields and retains Expando-like document identity', () => {
  const entry = checkout();
  for (const query of ['Worker', 'Product', 'ITEM-73', 'MOLD-24', 'Block', 'Warehouse', 'A1', '40']) {
    assert.equal(ledger.qolipCheckoutSearchMatches(query, entry), true, query);
  }
  assert.equal(ledger.qolipCheckoutSearchMatches('93874', entry), false);
  assert.equal(ledger.qolipCheckoutSearchMatches(' \u0085 ', entry), true);
  assert.equal(ledger.qolipCheckoutSearchDocument(entry), ledger.qolipCheckoutSearchDocument(entry));
  const rows = [entry, checkout({ id: 'two', item_code: 'SECOND-56', item_name: 'Second' })];
  assert.equal(ledger.qolipFilterCheckouts(rows, ''), rows); assert.deepEqual(ledger.qolipFilterCheckouts(rows, 'ITEM-73'), [entry]);
});

test('checkout row and detail preserve source fallback, whitespace and ordered omission rules', () => {
  const entry = checkout({ item_name: '  ', item_code: ' Code ', issued_to_name: ' ', location_label: '  ', block: ' Block ', qolip_code: '', issued_at: 'bad' });
  assert.deepEqual(ledger.qolipCheckoutRowText(entry, 'Unknown'), { title: ' Code ', subtitle: 'Unknown • 40 • bad' });
  assert.deepEqual(ledger.qolipCheckoutDetailLines(entry, ' 2 molds '), [
    { key: 'item_code', value: 'Code' }, { key: 'size', value: '40' }, { key: 'quantity', value: '2 molds' },
    { key: 'block', value: 'Block' }, { key: 'warehouse', value: 'Warehouse' }, { key: 'issued_at', value: 'bad' },
  ]);
  const fallback = checkout({ location_label: '', block: ' Block ', item_name: ' Item ', issued_at: '' });
  assert.equal(ledger.qolipCheckoutRowText(fallback, 'Unknown').title, 'Item');
  assert.ok(ledger.qolipCheckoutRowText(fallback, 'Unknown').subtitle.includes(' •  Block  • '));
  assert.ok(ledger.qolipCheckoutDetailLines(fallback, '2').some(line => line.key === 'cell' && line.value === 'Block'));
});

test('checkout issue date shows local day, month, hour and minute and preserves an invalid input', () => {
  const previous = process.env.TZ; process.env.TZ = 'UTC';
  try {
    assert.equal(ledger.qolipCheckoutIssuedAt('2025-01-02T03:04:05Z'), '02.01 03:04');
    assert.equal(ledger.qolipCheckoutIssuedAt('bad'), 'bad');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('checkout selected IDs survive only loaded IDs; bulk order follows source rows including duplicate IDs', () => {
  const a = checkout({ id: 'a' }), b = checkout({ id: 'b' }), duplicate = checkout({ id: 'a' });
  const result = ledger.qolipCheckoutSelection([a, b, duplicate], new Set(['b', 'gone', 'a']));
  assert.deepEqual([...result.retained], ['b', 'a']); assert.deepEqual(result.selected, [a, b, duplicate]);
});
