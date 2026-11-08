// @v2 raw_material_split_result_view.dart: result and issue presentation.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/homashyo/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('rawSplitModel'), p = load('rawSplitHistoryPresentation', { './rawSplitModel': model });
const source = { revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: ' Raw W ', item_code: 'FILM', item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const output = { ...source, stock_id: 'child', barcode: 'child', kg: '98', gross_kg: '99', bobina_kg: '1', length_m: '1000', width_mm: '1000' };
const result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2', outputs: [output] });
test('history title, actual child count, measured waste and details match V2', () => {
  assert.equal(p.rawSplitHistoryTitle(result), '100 → 98 kg');
  assert.equal(p.rawSplitHistorySubtitle(result), 'Raw W • 1 rulon • 2 kg chiqindi');
  assert.equal(p.rawSplitOutputSummary(result.outputs[0]), '98 kg · 1000 mm · 20 mkm · 1000 m');
  assert.equal(p.rawSplitIssueOutputSummary(output), '1000 mm · Og‘irlik: 99 kg · Babina: 1 kg · Netto: 98 kg');
});
test('history time uses local today, otherwise date and original invalid string', () => {
  const now = new Date(2026, 8, 8, 18, 0), today = new Date(2026, 8, 8, 11, 5), other = new Date(2026, 8, 7, 9, 3);
  assert.equal(p.rawSplitHistoryTime(today.toISOString(), now), '11:05');
  assert.equal(p.rawSplitHistoryTime(other.toISOString(), now), '07.09 09:03');
  assert.equal(p.rawSplitHistoryTime('garbage', now), 'garbage'); assert.equal(p.rawSplitHistoryTime(null, now), '');
  assert.equal(p.rawSplitHistoryTime('2026-09-08', now), '00:00');
  assert.equal(p.rawSplitHistoryTime('20260908T120000', now), '12:00');
  assert.equal(p.rawSplitHistoryTime('09/08/2026', now), '09/08/2026');
});
