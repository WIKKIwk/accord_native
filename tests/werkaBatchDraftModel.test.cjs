// Pure source-derived draft decisions only. No picker, draft ID, route or write is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const trim = compile('werka/werkaBatchTrim.ts'), parse = compile('werka/werkaUnannouncedInput.ts');
const model = compile('werka/werkaBatchDraftModel.ts', { '../shared/localization': localization, './werkaBatchTrim': trim,
  './werkaUnannouncedInput': parse });
const customer = { ref: 'C', name: 'Customer', phone: ' +998 ' }, item = { code: 'I', name: 'Item', uom: 'kg' };
const state = (overrides = {}) => ({ customer, item, quantityText: '1.5', draftCount: 0, ...overrides });

test('batch source positive-quantity decisions replay all 303 Dart input samples', () => {
  const fixture = require('./contracts/f11910bb/werka_batch_draft_oracle.json');
  assert.equal(fixture.values.length, 303);
  for (const sample of fixture.values) {
    const view = model.werkaBatchDraftPresentation(state({ quantityText: sample.input }), 'en');
    assert.equal(view.valid, sample.positive, JSON.stringify(sample.input));
  }
  assert.equal(model.werkaBatchDraftPresentation(state({ quantityText: 'NaN' }), 'en').valid, false);
  assert.equal(model.werkaBatchDraftPresentation(state({ quantityText: 'Infinity' }), 'en').valid, true);
});

test('source selection, phone, draft count and action matrix matches standalone Dart', () => {
  const fixture = require('./contracts/f11910bb/werka_batch_draft_oracle.json');
  assert.equal(fixture.matrix.length, 120);
  for (const sample of fixture.matrix) {
    const selectedCustomer = sample.customer ? { ...customer, phone: sample.phone } : null;
    const view = model.werkaBatchDraftPresentation(state({ customer: selectedCustomer, item: sample.item ? item : null,
      quantityText: sample.quantityText, draftCount: sample.drafts }), 'en');
    assert.equal(view.valid, sample.valid); assert.equal(view.phone !== null, sample.showPhone);
    assert.equal(view.showQuantity, sample.showQuantity); assert.equal(view.hasDrafts, sample.showList);
    assert.equal(view.sourceCanSave, sample.canSave); assert.equal(view.sourceCanOpenList, sample.showList);
    assert.equal(view.sourceCanConfirmReview, sample.canConfirmReview);
  }
});

test('choosing or clearing customer and item follows source quantity-reset rules', () => {
  const initial = state(), another = { ref: 'D', name: 'Another', phone: '2' }, otherItem = { code: 'J', name: 'Other', uom: 'm' };
  assert.deepEqual(model.werkaBatchDraftClearItem(initial), { ...initial, item: null, quantityText: '' });
  assert.deepEqual(model.werkaBatchDraftClearCustomer(initial), { ...initial, customer: null });
  assert.deepEqual(model.werkaBatchDraftChooseCustomer(initial, another), { ...initial, customer: another });
  assert.deepEqual(model.werkaBatchDraftChooseCustomer({ ...initial, item: null }, another),
    { ...initial, item: null, customer: another, quantityText: '' });
  assert.deepEqual(model.werkaBatchDraftChooseItem(initial, otherItem), { ...initial, item: otherItem, quantityText: '' });
  assert.deepEqual(model.werkaBatchDraftChooseOption(initial, otherItem, another),
    { ...initial, item: otherItem, customer: another, quantityText: '' });
  assert.deepEqual(model.werkaBatchDraftPrepareNextLine(initial), { ...initial, item: null, quantityText: '' });
  assert.deepEqual(initial, state());
});

test('the source enables review differently for zero, one and two saved lines', () => {
  const view = (draftCount, quantityText) => model.werkaBatchDraftPresentation(state({ draftCount, quantityText }), 'en');
  assert.equal(view(0, '1').sourceCanOpenList, false); assert.equal(view(0, '1').sourceCanConfirmReview, false);
  assert.equal(view(1, '0').sourceCanOpenList, true); assert.equal(view(1, '0').sourceCanConfirmReview, false);
  assert.equal(view(1, '1').sourceCanConfirmReview, true); assert.equal(view(2, '0').sourceCanConfirmReview, true);
});

test('labels and field presence come from selected source values without invented defaults', () => {
  const empty = model.werkaBatchDraftPresentation(state({ customer: null, item: null, quantityText: '', draftCount: 0 }), 'en');
  assert.equal(empty.title, 'Multi-item dispatch'); assert.equal(empty.itemName, 'Select item'); assert.equal(empty.customerName, 'Select customer');
  assert.equal(empty.saveLabel, 'Next'); assert.equal(empty.draftCountLabel, null); assert.equal(empty.showQuantity, false);
  assert.equal(empty.clearItemTooltip, 'Clear item'); assert.equal(empty.clearCustomerTooltip, 'Clear customer');
  const filled = model.werkaBatchDraftPresentation(state({ draftCount: 1 }), 'en');
  assert.equal(filled.saveLabel, 'Add another'); assert.equal(filled.draftCountLabel, '1 items in the list');
  assert.equal(filled.phone, null); assert.equal(filled.showQuantity, true);
  const onlyCustomer = model.werkaBatchDraftPresentation(state({ item: null }), 'en');
  assert.equal(onlyCustomer.phone, ' +998 ');
  for (const invalid of [-1, 1.5, NaN, Infinity]) assert.throws(() => model.werkaBatchDraftPresentation(state({ draftCount: invalid }), 'en'), RangeError);
  for (const invalid of [{ customer: undefined }, { item: undefined }, { quantityText: undefined },
    { customer: { ...customer, ref: undefined } }, { item: { ...item, uom: undefined } }]) {
    assert.throws(() => model.werkaBatchDraftPresentation(state(invalid), 'en'), TypeError);
  }
});

test('batch draft title and source action labels match the four app locales', () => {
  const expected = {
    uz: ['Ko‘p mahsulot chiqarish', 'Mahsulot tanlang', 'Haridor tanlang', 'Keyingi', 'Yana', 'Tasdiqlash'],
    en: ['Multi-item dispatch', 'Select item', 'Select customer', 'Next', 'Add another', 'Confirm'],
    ru: ['Массовая отправка товаров', 'Выберите товар', 'Выберите покупателя', 'Далее', 'Добавить еще', 'Подтверждение'],
    ur: ['متعدد آئٹمز کی ترسیل', 'آئٹم منتخب کریں', 'گاہک منتخب کریں', 'اگلا', 'ایک اور شامل کریں', 'تصدیق کریں'],
  };
  for (const [locale, values] of Object.entries(expected)) {
    const empty = model.werkaBatchDraftPresentation(state({ customer: null, item: null, quantityText: '' }), locale);
    const saved = model.werkaBatchDraftPresentation(state({ draftCount: 1 }), locale);
    assert.deepEqual([empty.title, empty.itemName, empty.customerName, empty.saveLabel, saved.saveLabel, saved.confirmLabel], values);
  }
});
