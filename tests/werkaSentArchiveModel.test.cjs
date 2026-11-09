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
  let filename = path.resolve(file);
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.ts');
  else if (!filename.endsWith('.ts')) filename += '.ts';
  if (cache.has(filename)) return cache.get(filename);
  const module = new Module(filename); module.filename = filename; module.paths = require.main.paths; cache.set(filename, module.exports);
  module.require = name => name === './catalog.json' ? catalog
    : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  cache.set(filename, module.exports); return module.exports;
}
const localization = load(path.join(src, 'shared/localization'));
const model = load(path.join(src, 'werka/werkaSentArchiveModel.ts'));
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

test('month and year page actions reuse source ranges without changing other sent-hub state', () => {
  const initial = model.werkaSentArchiveInitial(new Date(2024, 1, 29));
  for (const panel of ['monthly', 'yearly']) {
    let current = initial;
    for (const step of [1, 1, -1]) {
      const before = current, result = model.werkaSentArchivePageStep(current, panel, step);
      current = result.state;
      assert.equal(current.selectedDate, initial.selectedDate); assert.equal(current.displayMonth, initial.displayMonth);
      assert.equal(current.open, 'daily'); assert.equal(result.query.kind, 'sent'); assert.equal(result.query.period, 'yearly');
      if (panel === 'monthly') {
        assert.equal(current.displayYear, before.displayYear + step); assert.equal(current.firstYear, initial.firstYear);
        assert.deepEqual([ymd(result.query.from), ymd(result.query.to)], [[current.displayYear, 1, 1], [current.displayYear, 12, 31]]);
      } else {
        assert.equal(current.firstYear, before.firstYear + step * 12); assert.equal(current.displayYear, initial.displayYear);
        assert.deepEqual([ymd(result.query.from), ymd(result.query.to)], [[current.firstYear, 1, 1], [current.firstYear + 11, 12, 31]]);
      }
    }
  }
  assert.equal(initial.displayYear, 2024); assert.equal(initial.firstYear, 2019);
});

test('only a real changed displayed month describes a new sent daily-panel request', () => {
  const state = model.werkaSentArchiveInitial(new Date(2024, 0, 31));
  const unchanged = model.werkaSentArchiveDisplayedMonth(state, new Date(2024, 0, 14, 19));
  assert.equal(unchanged.state, state); assert.equal(unchanged.query, null);
  const changed = model.werkaSentArchiveDisplayedMonth(state, new Date(2024, 1, 17, 18));
  assert.deepEqual(ymd(changed.state.displayMonth), [2024, 2, 1]);
  assert.equal(changed.state.selectedDate, state.selectedDate); assert.equal(changed.state.open, 'daily');
  assert.equal(changed.state.displayYear, state.displayYear); assert.equal(changed.state.firstYear, state.firstYear);
  assert.deepEqual([changed.query.kind, changed.query.period, ymd(changed.query.from), ymd(changed.query.to)],
    ['sent', 'monthly', [2024, 2, 1], [2024, 2, 29]]);
  assert.deepEqual(ymd(state.displayMonth), [2024, 1, 1]);
});

test('sent-hub day selection normalizes but does not close or page the calendar', () => {
  const input = new Date(2024, 1, 29, 18), initial = model.werkaSentArchiveInitial(new Date(2024, 0, 31));
  for (const open of [null, 'daily', 'monthly', 'yearly']) {
    const state = { ...initial, open }, result = model.werkaSentArchiveSelectDate(state, input);
    assert.deepEqual(ymd(result.state.selectedDate), [2024, 2, 29]); assert.equal(result.state.selectedDate.getHours(), 0);
    assert.equal(result.state.open, open); assert.equal(result.state.displayMonth, state.displayMonth);
    assert.equal(result.state.displayYear, state.displayYear); assert.equal(result.state.firstYear, state.firstYear);
    assert.deepEqual([result.query.kind, result.query.period, ymd(result.query.from), ymd(result.query.to)],
      ['sent', 'daily', [2024, 2, 29], [2024, 2, 29]]);
    assert.notEqual(result.state.selectedDate, result.query.from); assert.notEqual(result.query.from, result.query.to);
  }
  assert.equal(input.getHours(), 18); assert.deepEqual(ymd(initial.selectedDate), [2024, 1, 31]);
});

test('default sent-hub headers use the selected medium date and January of the independently displayed year', () => {
  const state = { ...model.werkaSentArchiveInitial(new Date(2026, 10, 8)), displayYear: 2024 };
  const values = {
    uz: ['Yak, 8-noy', 'yanvar, 2024', '2021 - 2032'], en: ['Sun, Nov 8', 'January 2024', '2021 - 2032'],
    ru: ['вс, 8 нояб.', 'январь 2024\u202fг.', '2021 - 2032'], 'ur-PK': ['اتوار، 8 نومبر', 'جنوری 2024', '2021 - 2032'],
  };
  for (const [locale, expected] of Object.entries(values)) {
    const result = model.werkaSentArchivePresentation(state, locale);
    assert.deepEqual(result.headers.map(row => row.value), expected);
    assert.equal(result.title, localization.localizedGetter('archiveSentTitle', locale));
    assert.equal(result.subtitle, localization.localizedGetter('archiveChoosePeriod', locale));
  }
});

test('source-compatible date formatter overrides receive copies rather than mutable sent selection state', () => {
  const state = model.werkaSentArchiveInitial(new Date(2026, 10, 8)), calls = [];
  const result = model.werkaSentArchivePresentation(state, 'uz', date => {
    calls.push(['month', ymd(date)]); date.setFullYear(1990); return 'Source month label';
  }, date => {
    calls.push(['day', ymd(date)]); date.setFullYear(1990); return 'Source day label';
  });
  assert.deepEqual(calls, [['day', [2026, 11, 8]], ['month', [2026, 1, 1]]]);
  assert.deepEqual(result.headers.map(row => row.value), ['Source day label', 'Source month label', '2021 - 2032']);
  assert.deepEqual(ymd(state.selectedDate), [2026, 11, 8]); assert.equal(state.displayYear, 2026);
});
