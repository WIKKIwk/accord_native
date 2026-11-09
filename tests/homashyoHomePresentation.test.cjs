// Source-derived labels from raw_material_split_screen.dart.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/homashyo/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('rawSplitModel'), width = load('rawSplitWidthPlan', { './rawSplitModel': model });
const draft = load('rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, '../../modules/accord-native-clock/src/AccordNativeClockModule': {}, 'expo-crypto': {} });
const p = load('rawSplitHomePresentation', { './rawSplitModel': model, './rawSplitWidthPlan': width, './rawSplitDraft': draft });
const source = new model.RawSplitRoll({ revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM',
  item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' });
const one = { width: '400', gross: '40', bobina: '1', length: '1000' }, two = { width: '600', gross: '60', bobina: '1', length: '1500' };
test('net and balance display exact measured totals and never infer waste', () => {
  assert.equal(p.rawSplitNetLabel(one), 'Netto: 39 kg'); assert.equal(p.rawSplitNetLabel({ ...one, bobina: '' }), 'Netto: —');
  assert.equal(p.rawSplitBalance(source, [one, two], '2'), 'Chiqish: 98 kg · Chiqindi: 2 kg\nHisob teng ✓');
  assert.match(p.rawSplitBalance(source, [one, two], '1'), /Kiritilmagan: 1 kg/);
  assert.match(p.rawSplitBalance(source, [one, two], '3'), /Asl kg dan oshib ketdi/);
  assert.equal(p.rawSplitBalance(source, [one, two], '0'), 'Og‘irlik, babina va 0 dan katta atxot kg ni kiriting.');
});
test('width guidance distinguishes complete, scrap, usable remainder, and invalid', () => {
  const plan = widths => new width.RawSplitWidthPlan('1000', widths);
  assert.equal(p.rawSplitWidthSummary(plan(['']), [{ ...one, width: '' }]), 'Ko‘pi bilan 2 ta rulon · eng kam eni 355 mm');
  assert.equal(p.rawSplitWidthSummary(plan(['400', '600']), [one, two]), 'En to‘liq taqsimlandi');
  assert.equal(p.rawSplitWidthSummary(plan(['700']), [{ ...one, width: '700' }]), 'Qolgan 300 mm — atxot');
  assert.equal(p.rawSplitWasteWidthLabel(plan(['600'])), 'Yana rulon kerak: 400 mm');
  assert.equal(p.rawSplitWasteWidthLabel(plan(['700'])), 'Atxotga ketadi: 300 mm');
  assert.equal(p.rawSplitWasteWidthLabel(plan(['350'])), null);
  assert.equal(p.rawSplitSourceSummary(source), '100 kg · 1000 mm · 20 mkm');
});
