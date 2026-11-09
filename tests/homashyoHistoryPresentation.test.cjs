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

test('result metadata keeps V2 row labels, order, raw warehouse and raw timestamp without added punctuation', () => {
  const linked = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '1',
    difference_kg: '1.000000', issue_id: 'issue', issue_note: '  mismatch\nchecked  ', created_at: '  original time  ', outputs: [output] });
  assert.deepEqual(p.rawSplitResultDetailRows(linked), [{ label: 'Manba QR', value: 'parent' }, { label: 'Ombor', value: ' Raw W ' },
    { label: 'Vaqti', value: '  original time  ' }, { label: 'Farq', value: 'Izohli kamomad: 1 kg' }, { label: 'Sabab', value: '  mismatch\nchecked  ' }]);
});
test('metadata optional fields follow null checks rather than truthiness', () => {
  assert.deepEqual(p.rawSplitResultDetailRows(result).map(row => row.label), ['Manba QR', 'Ombor']);
  const emptyTime = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2', created_at: '', outputs: [output] });
  assert.deepEqual(p.rawSplitResultDetailRows(emptyTime).at(-1), { label: 'Vaqti', value: '' });
});
const issueValue = { source: result.source, outputs: [output], enteredWaste: '1' };
test('issue metadata preserves actual roll order and V2 measured values', () => {
  assert.deepEqual(p.rawSplitIssueDetailRows({ ...issueValue, outputs: [output, { ...output, width_mm: '355.000000', kg: '9', gross_kg: '10', bobina_kg: '1' }] }),
    [{ label: 'QR', value: 'parent' }, { label: 'Asl', value: '100 kg · Atxot: 1 kg' },
      { label: '1-rulon', value: '1000 mm · Og‘irlik: 99 kg · Babina: 1 kg · Netto: 98 kg' },
      { label: '2-rulon', value: '355 mm · Og‘irlik: 10 kg · Babina: 1 kg · Netto: 9 kg' }]);
});
test('issue entered-waste fallback applies only to an exactly empty string', () => {
  for (const [enteredWaste, expected] of [['', 'kiritilmagan'], ['  ', '  '], ['invalid', 'invalid'], ['0', '0']])
    assert.equal(p.rawSplitIssueDetailRows({ ...issueValue, enteredWaste })[1].value, `100 kg · Atxot: ${expected} kg`);
});
