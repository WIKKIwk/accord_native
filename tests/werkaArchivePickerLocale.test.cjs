// Source-data replay. No Flutter widget, native picker, device locale or backend is executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/werka_picker_locale_oracle.json');
function load(file, cache = new Map()) {
  const filename = [file, `${file}.ts`].find(value => fs.existsSync(value));
  if (!filename) throw Error(file);
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const root = path.resolve(__dirname, '../src/werka');
const { werkaArchivePickerLocale } = load(path.join(root, 'werkaArchivePickerLocale'));
const { werkaArchivePickerPage } = load(path.join(root, 'werkaArchivePickerPresentation'));
function date(year, month, day) {
  const value = new Date(0); value.setHours(12, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}

test('fixture identifies its exact baseline and standalone source data, not a widget result', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.kind, 'standalone source-equivalent locale data, not Flutter or device');
  assert.equal(fixture.flutterRevision, '737ba8f885dc774b53b442759999a312c9461e4e');
  assert.equal(fixture.flutterVersion, '3.47.8'); assert.equal(fixture.intlVersion, '0.20.3');
  assert.equal(fixture.dateDataSha256, '6dbcf772b367b3c993008b3267d63c38eccd4039b476dadf33753fe888401526');
  assert.equal(fixture.materialStringsSha256, 'dfe987456b1757657ce10123f1c7488eabcf43495983ea5b6241e62f168522a6');
});

test('all 472 full-date/year samples and decimal and weekday data match the declared SDK', () => {
  let samples = 0;
  for (const [locale, expected] of Object.entries(fixture.locales)) {
    const context = werkaArchivePickerLocale(locale);
    assert.equal(context.firstDayOfWeekIndex, expected.firstDayOfWeekIndex);
    assert.deepEqual(context.narrowWeekdays, expected.narrowWeekdays);
    for (const [number, formatted] of expected.decimals.entries()) assert.equal(context.formatDecimal(number), formatted);
    for (const entry of expected.decimalSamples) assert.equal(context.formatDecimal(entry.number), entry.formatted);
    for (const row of expected.samples) {
      const value = date(row.year, row.month, row.day), before = value.getTime();
      assert.equal(context.formatFullDate(value), row.fullDate, JSON.stringify([locale, row.year, row.month, row.day]));
      assert.equal(context.formatYear(row.year), row.yearLabel);
      assert.equal(value.getTime(), before); samples++;
    }
  }
  assert.equal(samples, 472);
});

test('Material tooltips and current-date labels preserve the four generated translations', () => {
  const expected = {
    uz: ['Avvalgi oy', 'Keyingi oy', 'Yilni tanlang', 'Bugun'],
    en: ['Previous month', 'Next month', 'Select year', 'Today'],
    ru: ['Предыдущий месяц', 'Следующий месяц', 'Выберите год', 'Сегодня'],
    'ur-PK': ['پچھلا مہینہ', 'اگلا مہینہ', 'سال منتخب کریں', 'آج'],
  };
  for (const [locale, labels] of Object.entries(expected)) {
    const value = werkaArchivePickerLocale(locale);
    assert.deepEqual([value.previousMonthTooltip, value.nextMonthTooltip, value.selectYearSemanticsLabel, value.currentDateLabel], labels);
  }
});

test('Urdu fallback, Russian date cases, localized semantics and independent weekday arrays are retained', () => {
  const expected = werkaArchivePickerLocale('ur-PK'), ru = werkaArchivePickerLocale('ru');
  for (const alias of ['ur', 'ur_PK', 'UR-pk']) {
    assert.equal(werkaArchivePickerLocale(alias).formatFullDate(date(2024, 2, 29)), expected.formatFullDate(date(2024, 2, 29)));
  }
  assert.equal(expected.formatDecimal(-31), '\u200e-31');
  assert.equal(ru.formatMonthYear(date(2024, 2, 29)), 'февраль 2024\u202fг.');
  assert.equal(ru.formatFullDate(date(2024, 2, 29)), 'четверг, 29 февраля 2024\u202fг.');
  const props = { localeContext: ru, currentDate: date(2024, 2, 29), bounds: { firstDate: date(2024, 1, 1), lastDate: date(2024, 12, 31) } };
  const page = werkaArchivePickerPage(date(2024, 2, 1), null, props);
  assert.deepEqual(page.weekdayLabels, ['П', 'В', 'С', 'Ч', 'П', 'С', 'В']);
  assert.equal(page.cells.find(cell => cell?.day === 29).accessibilityLabel, '29, четверг, 29 февраля 2024\u202fг., Сегодня');
  expected.narrowWeekdays[0] = 'changed';
  assert.equal(werkaArchivePickerLocale('ur').narrowWeekdays[0], 'S');
});

test('unsupported locales, invalid dates and unsafe or non-integer numeric inputs fail closed', () => {
  assert.throws(() => werkaArchivePickerLocale('fr'), RangeError);
  const context = werkaArchivePickerLocale('en');
  assert.throws(() => context.formatFullDate(new Date(NaN)), RangeError);
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => context.formatYear(value), RangeError);
    assert.throws(() => context.formatDecimal(value), RangeError);
  }
});
