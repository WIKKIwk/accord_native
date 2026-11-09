// Pure source-derived review projection/removal only. No picker, mutation, submit or route is used.
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
const model = compile('werka/werkaBatchReviewModel.ts', { '../shared/localization': localization });
const number = value => value === 'nan' ? NaN : value === 'inf' ? Infinity : value === '-inf' ? -Infinity : value === '-0' ? -0 : Number(value);
const convert = row => ({ localID: row.localID, customer: { ref: row.ref, name: row.customer },
  item: { code: row.code, name: row.item, uom: row.uom }, qty: number(row.qty) });

test('batch review replays source-equivalent Dart counts, rows, enablement and removal', () => {
  const fixture = require('./contracts/f11910bb/werka_batch_review_oracle.json');
  for (const sample of fixture.cases) for (const [name, submitting] of [['idle', false], ['submitting', true]]) {
    const lines = sample.rows.map(convert), expected = sample.expected[name], view = model.werkaBatchReviewPresentation(lines, submitting, 'en');
    assert.equal(view.customerCount, expected.customerCount, `${sample.name} customer count`);
    assert.equal(view.draftCount, expected.count, `${sample.name} draft count`);
    assert.deepEqual(view.rows.map(row => row.detail), expected.details, `${sample.name} quantity details`);
    assert.equal(view.needAtLeastTwo !== null, expected.needAtLeastTwo);
    assert.equal(view.sourceCanConfirm, expected.sourceCanConfirm);
    assert.equal(view.canRemove, expected.canRemove);
    assert.deepEqual(model.werkaBatchReviewRemove(lines, sample.removedID, submitting).map(line => line.localID), expected.afterRemoveIDs);
  }
});

test('customer count uses exact untrimmed refs, and one removal removes all matching local IDs', () => {
  const lines = [convert({ localID: 'x', ref: 'A', customer: 'one', code: '1', item: 'one', uom: 'kg', qty: '1' }),
    convert({ localID: 'x', ref: ' A ', customer: 'two', code: '2', item: 'two', uom: 'kg', qty: '1' }),
    convert({ localID: 'y', ref: '', customer: 'three', code: '3', item: 'three', uom: 'kg', qty: '1' })];
  const view = model.werkaBatchReviewPresentation(lines, false, 'en');
  assert.equal(view.customerCount, 3); assert.equal(view.sourceCanConfirm, true);
  assert.deepEqual(model.werkaBatchReviewRemove(lines, 'x', false).map(line => line.localID), ['y']);
  assert.equal(lines.length, 3); assert.deepEqual(model.werkaBatchReviewRemove(lines, 'x', true), lines);
});

test('the review describes source labels and button states in all four app locales', () => {
  const expected = {
    uz: ['Ro‘yxatni tekshirish', '1 ta haridor', 'Ro‘yxatda 1 ta mahsulot', 'Kamida 2 ta mahsulot kerak.', 'Tasdiqlash', 'Yuborilmoqda...'],
    en: ['Review list', '1 customers', '1 items in the list', 'At least 2 items are required.', 'Confirm', 'Sending...'],
    ru: ['Проверка списка', '1 покупателей', 'В списке 1 товаров', 'Нужно минимум 2 товара.', 'Подтверждение', 'Отправка...'],
    ur: ['فہرست کا جائزہ لیں', '1 گاہک', 'فہرست میں 1 آئٹمز', 'کم از کم 2 آئٹمز درکار ہیں۔', 'تصدیق کریں', 'بھیجا جا رہا ہے...'],
  };
  const lines = [convert({ localID: 'x', ref: 'A', customer: 'Customer', code: 'CODE', item: 'Item', uom: 'kg', qty: '1' })];
  for (const [locale, values] of Object.entries(expected)) {
    const idle = model.werkaBatchReviewPresentation(lines, false, locale), sending = model.werkaBatchReviewPresentation(lines, true, locale);
    assert.deepEqual([idle.title, idle.customers, idle.drafts, idle.needAtLeastTwo, idle.confirmLabel, sending.confirmLabel], values);
    assert.equal(idle.canRemove, true); assert.equal(idle.sourceCanConfirm, false); assert.equal(sending.canRemove, false);
  }
});

test('review quantity formats negative zero, non-finite values and rounding like sampled Dart', () => {
  assert.deepEqual([-0, -0.4, 0.5, 1.5, -1.5, 1e21, NaN, Infinity, -Infinity].map(model.werkaBatchReviewQuantity),
    ['-0', '-0', '1', '2', '-2', '1e+21', 'NaN', 'Infinity', '-Infinity']);
});
