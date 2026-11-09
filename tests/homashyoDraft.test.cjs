// @v2-test test/raw_material_split_test.dart, plus source-derived payload guards.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('homashyo/rawSplitModel'); const width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width,
  'expo-crypto': { getRandomBytesAsync: async () => Uint8Array.from({ length: 16 }, (_, i) => i) } });
const printModels = load('printing/printModels', { '../workerControlsApi': { isCanonicalApparatusId: () => true } });
const { rawMaterialSplitPrintRequest } = load('homashyo/rawSplitPrinting', { './rawSplitModel': model, '../printing/printModels': printModels });
const source = new model.RawSplitRoll({ revision: '1.000000', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W',
  item_code: 'FILM', item_name: 'Film 1000/20', kg: '100', width_mm: '1000', micron: '20' });
const rows = [{ width: '400', gross: '40', bobina: '1', length: '1000' }, { width: '600', gross: '60', bobina: '1', length: '1500' }];
const input = { source, outputs: rows, waste: '2', issue: false, issueSaved: false, savedIssueId: null, requestId: 'split-fixed' };
test('save command uses measured waste, exact net, dimensions and stable revision', () => {
  const value = draft.buildRawSplitPayload(input);
  assert.deepEqual(value, { request_id: 'split-fixed', source_barcode: 'parent', expected_revision: '1.000000', expected_kg: '100',
    expected_width_mm: '1000', expected_micron: '20', waste_kg: '2.000000', outputs: [
      { kg: '39.000000', width_mm: '400.000000', gross_kg: '40.000000', bobina_kg: '1.000000', length_m: '1000.000000' },
      { kg: '59.000000', width_mm: '600.000000', gross_kg: '60.000000', bobina_kg: '1.000000', length_m: '1500.000000' }] });
  assert.throws(() => draft.buildRawSplitPayload({ ...input, waste: '1' }), draft.RawSplitWasteInputError);
  assert.throws(() => draft.buildRawSplitPayload({ ...input, waste: '', issueSaved: true, savedIssueId: 'issue' }), draft.RawSplitWasteInputError);
  assert.throws(() => draft.buildRawSplitPayload({ ...input, outputs: [{ ...rows[0], bobina: '40' }] }));
  assert.throws(() => draft.buildRawSplitPayload({ ...input, outputs: [{ ...rows[0], length: '' }] }));
});
test('discrepancy report preserves raw waste; stock may use a saved matching issue only', () => {
  const report = draft.buildRawSplitPayload({ ...input, issue: true, waste: ' 1,0 ' });
  assert.equal(report.waste_kg, '1,0'); assert.ok(!Object.hasOwn(report, 'issue_id'));
  assert.throws(() => draft.buildRawSplitPayload({ ...input, issue: true }), /Hisob teng/);
  const stock = draft.buildRawSplitPayload({ ...input, waste: '1', issueSaved: true, savedIssueId: 'issue-1' });
  assert.equal(stock.issue_id, 'issue-1'); assert.equal(stock.waste_kg, '1.000000');
});
test('width confirmation removes only empty excess rows and preserves partial measurements', () => {
  const empty = { width: '', gross: '', bobina: '', length: '' };
  assert.equal(draft.rawSplitConfirmWidth('1000', [{ ...rows[0], width: '700' }, empty]).length, 1);
  const partial = { ...empty, gross: '7' };
  assert.deepEqual(draft.rawSplitConfirmWidth('1000', [{ ...rows[0], width: '700' }, partial]), [{ ...rows[0], width: '700' }, partial]);
  assert.equal(draft.rawSplitConfirmWidth('1000', [{ ...rows[0], width: '600' }, empty]).length, 2);
});
test('print payload reuses native bridge and retains gross, core, length and output dimensions', () => {
  const roll = new model.RawSplitRoll({ stock_id: 'child', barcode: '300000000000000000000001', warehouse: 'Raw W', item_code: 'FILM',
    item_name: 'BOPP METAL 700/12', width_mm: '350', micron: '12', kg: '3', gross_kg: '3.5', bobina_kg: '0.5', length_m: '1000' });
  const request = rawMaterialSplitPrintRequest(roll);
  assert.equal(request.itemName, 'BOPP METAL 350/12'); assert.equal(request.grossQty, 3.5); assert.equal(request.tareKg, 0.5);
  assert.equal(request.netQty, 3); assert.equal(request.progressQty, 1000); assert.equal(request.progressUnit, 'm');
  assert.equal(request.tareEnabled, true); assert.equal(request.labelKind, 'material_product');
  const legacy = rawMaterialSplitPrintRequest(source); assert.equal(legacy.tareEnabled, false); assert.equal(legacy.progressQty, null);
});
test('request IDs use secure 16-byte randomness and V2 prefix', async () => {
  assert.match(await draft.newRawSplitRequestId(), /^split-\d+-000102030405060708090a0b0c0d0e0f$/);
});
