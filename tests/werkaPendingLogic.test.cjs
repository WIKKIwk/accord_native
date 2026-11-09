// V2 has no direct tests of these store projections; assertions follow werka_store.dart at f119.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const api = load(path.resolve(__dirname, '../src/werka/werkaPendingLogic.ts'));
const record = (ref, name, qty, date, uom = '') => ({ supplier_ref: ref, supplier_name: name, sent_qty: qty, created_label: date, uom });
test('pending groups by trimmed ref, fills blank names and units, and sorts by latest label', () => {
  const result = api.werkaPendingBreakdown([record(' A ', '', 2, '2026-01-01'), record('B', 'Second', 4, '2026-01-03', 'Kg'),
    record('A', 'First', 3, '2026-01-05', 'm')]);
  assert.deepEqual(result, [
    { supplierRef: ' A ', supplierName: 'First', uom: 'm', receiptCount: 2, totalSentQty: 5, totalAcceptedQty: 0, totalReturnedQty: 0 },
    { supplierRef: 'B', supplierName: 'Second', uom: 'Kg', receiptCount: 1, totalSentQty: 4, totalAcceptedQty: 0, totalReturnedQty: 0 },
  ]);
});
test('blank references group by trimmed name but detail uses the blank reference', () => {
  const items = [record('', ' One ', 1, 'x'), record(' ', 'Two', 2, 'y'), record('B', 'Three', 3, 'z')];
  assert.equal(api.werkaPendingBreakdown(items).length, 3);
  assert.deepEqual(api.werkaPendingDetailItems(items, ''), items.slice(0, 2));
});
test('valid timestamps sort before unparseable labels', () => {
  const result = api.werkaPendingBreakdown([record('A', 'A', 1, 'zzz'), record('B', 'B', 1, '2026-01-01')]);
  assert.deepEqual(result.map(row => row.supplierRef), ['B', 'A']);
});
