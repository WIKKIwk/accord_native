// @v2-test test/raw_material_split_test.dart (passing arithmetic, result and width tests)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/homashyo/${name}.ts`);
  const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const model = load('rawSplitModel');
const { RawSplitWidthPlan } = load('rawSplitWidthPlan', { './rawSplitModel': model });
const source = { revision: '1.000000', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM',
  item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const result = { id: 'split-result', source, source_kg: '100', output_kg: '98', waste_kg: '2', outputs: [
  { ...source, stock_id: 'child1', barcode: 'child1', kg: '39', gross_kg: '40', bobina_kg: '1', length_m: '1000', width_mm: '400' },
  { ...source, stock_id: 'child2', barcode: 'child2', kg: '59', gross_kg: '60', bobina_kg: '1', length_m: '1500', width_mm: '600' },
] };
test('six-place quantities are exact and invalid values do not become zero', () => {
  const { rawSplitQuantity: q, rawSplitDecimal: d, rawSplitDisplay: show, rawSplitDifference: diff } = model;
  assert.equal(q('0,1') + q('0.2'), q('0.3'));
  assert.equal(d(q('999999999999.999999')), '999999999999.999999');
  assert.equal(show('100.000000'), '100'); assert.equal(show('0.000000'), '0');
  assert.equal(d(diff('-0.000001')), '-0.000001');
  for (const input of ['NaN', '-1', '0', '1e2', '1.0000001', '9999999999999']) assert.throws(() => q(input));
  for (const input of [' 1', '+1', '1.', '1,5', '-9999999999999']) assert.throws(() => diff(input));
});
test('waste errors preserve exact measurement and distinguish invalid, zero, shortage and excess', () => {
  const { RawSplitWasteCheck: Check, rawSplitQuantity: q } = model;
  for (const [input, kind, text] of [['0', 'zero_waste', '2 kg hisobga olinmagan'], ['00,000000', 'zero_waste', '2 kg hisobga olinmagan'],
    ['1', 'missing_weight', '1 kg hisobga olinmagan'], ['2.000001', 'excess_weight', 'Asl vazndan 0.000001 kg oshib ketdi'],
    ['', 'invalid_waste', 'Atxot kg ni kiriting'], ['bad', 'invalid_waste', 'Atxot kg ni kiriting'],
    ['-1', 'invalid_waste', 'Atxot kg ni kiriting'], ['1.', 'invalid_waste', 'Atxot kg ni kiriting']]) {
    const check = new Check(q('100'), q('98'), input); assert.equal(check.kind, kind); assert.match(check.message, new RegExp(text));
    if (kind === 'invalid_waste') assert.equal(check.difference, null);
  }
  assert.equal(new Check(q('100'), q('98'), '2').kind, null);
});
test('result validates stock identity, measured totals, duplicates and issue discrepancy', () => {
  const { RawSplitResult: Result } = model;
  assert.deepEqual(new Result(result).outputs.map(o => o.kg), ['39', '59']);
  assert.throws(() => new Result({ ...result, output_kg: '100' }));
  assert.throws(() => new Result({ ...result, outputs: [result.outputs[0], result.outputs[0]] }));
  assert.throws(() => new Result({ ...result, outputs: [{ ...result.outputs[0], gross_kg: '41' }, result.outputs[1]] }));
  const withIssue = { ...result, source: { ...source, kg: '68.25' }, source_kg: '68.25', output_kg: '63', waste_kg: '2',
    difference_kg: '3.250000', issue_id: 'raw-issue:test', issue_note: 'Sababi yozilgan', outputs: [
      { ...source, stock_id: 'child', barcode: 'child', kg: '63', gross_kg: '64', bobina_kg: '1', width_mm: '700' }] };
  assert.equal(new Result(withIssue).differenceLabel, 'Izohli kamomad: 3.25 kg');
  assert.throws(() => new Result({ ...withIssue, issue_id: null }));
  assert.throws(() => new Result({ ...withIssue, issue_note: '' }));
  assert.equal(new Result({ ...withIssue, waste_kg: '6', difference_kg: '-0.750000' }).differenceLabel, 'Izohli ortiqcha: 0.75 kg');
});
test('issue validates returned exact totals, note and kind before allowing completion', () => {
  const { RawSplitIssue: Issue } = model;
  const issue = { id: 'raw-issue:test', request_id: 'id', source, source_kg: '100.000000', output_kg: '98.000000',
    entered_waste_kg: '1', waste_kg: '1.000000', difference_kg: '1.000000', kind: 'missing_weight', outputs: result.outputs,
    note: 'Tarozi', actor_ref: 'split-1', actor_name: 'Cutter', created_at: '2026-09-08T12:00:00+00:00' };
  const parsed = new Issue(issue); assert.equal(parsed.check.difference, 1000000n);
  assert.notEqual(parsed.outputs[0], issue.outputs[0]);
  const invalidWaste = { ...issue, entered_waste_kg: '', kind: 'invalid_waste' };
  delete invalidWaste.difference_kg; delete invalidWaste.waste_kg;
  assert.equal(new Issue(invalidWaste).check.waste, null);
  for (const change of [{ difference_kg: '2.000000' }, { kind: 'excess_weight' }, { output_kg: '98' }, { note: '' }])
    assert.throws(() => new Issue({ ...issue, ...change }));
});
test('width plans enforce 355mm minimum and never infer usable remainder as waste', () => {
  const q = model.rawSplitQuantity, one = new RawSplitWidthPlan('700', ['400']);
  assert.equal(one.maxRolls, 1); assert.equal(one.remaining, q('300')); assert.equal(one.canAdd, false); one.validateForSave();
  for (const widths of [['350', '350'], ['355', '355'], ['700.000001'], ['NaN'], ['-1']])
    assert.throws(() => new RawSplitWidthPlan('700', widths).validateForSave());
  new RawSplitWidthPlan('710', ['355', '355']).validateForSave();
  const edge = new RawSplitWidthPlan('1000', ['645']); assert.equal(edge.canAdd, true); assert.throws(() => edge.validateForSave());
  const trim = new RawSplitWidthPlan('1000', ['645,000001']); assert.equal(trim.remaining, q('354.999999')); trim.validateForSave();
  assert.equal(new RawSplitWidthPlan('1000', ['600', '']).canAdd, false);
  assert.equal(new RawSplitWidthPlan('354.999999', ['']).maxRolls, 0);
});
test('labels replace original dimensions while preserving measured gross and core', () => {
  const roll = new model.RawSplitRoll({ ...source, item_name: 'BOPP METAL 700/12', barcode: '300000000000000000000001',
    width_mm: '350', micron: '12', kg: '3', gross_kg: '3.5', bobina_kg: '0.5', length_m: '1000' });
  assert.equal(roll.labelName, 'BOPP METAL 350/12');
  assert.throws(() => new model.RawSplitRoll({ ...source, gross_kg: '100' }));
});
