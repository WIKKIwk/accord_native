// Pure source-derived model. No archive request, date picker, navigation or device is exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const src = path.resolve(__dirname, '../src');
function load(file, cache = new Map()) {
  const filename = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const module = new Module(filename); module.filename = filename; module.paths = require.main.paths; cache.set(filename, module.exports);
  module.require = name => name === './catalog.json' ? catalog
    : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name)) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  cache.set(filename, module.exports); return module.exports;
}
// The localization import resolves to the directory's index in the real app.
const localizationFile = path.join(src, 'shared/localization/index.ts'), localization = load(localizationFile);
const calendar = load(path.join(src, 'werka/werkaArchiveCalendar.ts'));
const modelFile = path.join(src, 'werka/werkaSentArchiveModel.ts'), modelModule = new Module(modelFile);
modelModule.filename = modelFile; modelModule.paths = require.main.paths;
modelModule.require = name => name === '../shared/localization' ? localization : name === './werkaArchiveCalendar' ? calendar : require(name);
modelModule._compile(ts.transpileModule(fs.readFileSync(modelFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, modelFile);
const model = modelModule.exports;
const ymd = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()];
test('sent archive starts at today, current month/year, twelve-year page and daily panel', () => {
  const now = new Date(2026, 10, 8, 17, 32, 10), state = model.werkaSentArchiveInitial(now);
  assert.deepEqual(ymd(state.selectedDate), [2026, 11, 8]); assert.equal(state.selectedDate.getHours(), 0);
  assert.deepEqual(ymd(state.displayMonth), [2026, 11, 1]); assert.equal(state.displayYear, 2026);
  assert.equal(state.firstYear, 2021); assert.equal(state.open, 'daily'); assert.equal(now.getHours(), 17);
});
test('toggling closes the current panel or opens only the chosen panel', () => {
  for (const current of [null, 'daily', 'monthly', 'yearly']) for (const selected of ['daily', 'monthly', 'yearly', 'custom']) {
    const expected = selected === 'custom' || current === selected ? null : selected;
    assert.equal(model.werkaSentArchiveToggle(current, selected), expected);
  }
});
test('three sent-hub query descriptions use source periods and inclusive ranges', () => {
  const state = { ...model.werkaSentArchiveInitial(new Date(2024, 1, 17)), firstYear: 2020 };
  const [daily, monthly, yearly] = model.werkaSentArchiveQueries(state);
  assert.deepEqual([daily.kind, daily.period, ymd(daily.from), ymd(daily.to)], ['sent', 'monthly', [2024, 2, 1], [2024, 2, 29]]);
  assert.deepEqual([monthly.kind, monthly.period, ymd(monthly.from), ymd(monthly.to)], ['sent', 'yearly', [2024, 1, 1], [2024, 12, 31]]);
  assert.deepEqual([yearly.kind, yearly.period, ymd(yearly.from), ymd(yearly.to)], ['sent', 'yearly', [2020, 1, 1], [2031, 12, 31]]);
});
test('date selection produces sent archive arguments without navigating', () => {
  const day = model.werkaSentArchiveSelection('daily', 2024, 2, 29);
  assert.deepEqual([day.kind, day.period, ymd(day.from), ymd(day.to)], ['sent', 'daily', [2024, 2, 29], [2024, 2, 29]]);
  const month = model.werkaSentArchiveSelection('monthly', 2024, 2);
  assert.deepEqual([ymd(month.from), ymd(month.to)], [[2024, 2, 1], [2024, 2, 29]]);
  const year = model.werkaSentArchiveSelection('yearly', 2024);
  assert.deepEqual([ymd(year.from), ymd(year.to)], [[2024, 1, 1], [2024, 12, 31]]);
});
test('loading and error replace content only while every active set is empty', () => {
  const none = new Set(), some = new Set([1]);
  assert.equal(model.werkaSentArchiveBody(true, Error('x'), none, none, none), 'loading');
  assert.equal(model.werkaSentArchiveBody(false, Error('x'), none, none, none), 'error');
  assert.equal(model.werkaSentArchiveBody(false, null, none, none, none), 'content');
  for (const sets of [[some, none, none], [none, some, none], [none, none, some]]) {
    assert.equal(model.werkaSentArchiveBody(true, Error('x'), ...sets), 'content');
  }
});
test('header order, selection values, localizations and open state follow source', () => {
  const rows = model.werkaSentArchiveHeaders('en', 'Nov 8, 2026', 'January 2026', 2021, 'monthly');
  assert.deepEqual(rows.map(row => row.id), ['daily', 'monthly', 'yearly']);
  assert.deepEqual(rows.map(row => row.value), ['Nov 8, 2026', 'January 2026', '2021 - 2032']);
  assert.deepEqual(rows.map(row => row.open), [false, true, false]);
  assert.equal(rows[0].title, localization.localizedGetter('archiveDailyTitle', 'en'));
  assert.equal(rows[2].action, localization.localizedGetter('archiveSelectDateAction', 'en'));
});
