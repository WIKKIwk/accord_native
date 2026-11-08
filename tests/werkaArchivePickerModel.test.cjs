// Source-derived declared-SDK geometry/state samples, not a Flutter/widget, native picker or device oracle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function load(file, cache = new Map()) {
  const filename = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const model = load(path.join(root, 'werka/werkaArchivePickerModel.ts'));
function date(year, month, day, hour = 0) {
  const value = new Date(0); value.setHours(hour, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const ymd = value => [value.getFullYear(), value.getMonth() + 1, value.getDate()];
const bounds = { firstDate: date(2021, 1, 1), lastDate: date(2027, 12, 31) };
const grid = (year, month, firstWeekday = 0, selected = null, today = date(2026, 11, 8), limits = bounds) =>
  model.werkaArchivePickerMonth(date(year, month, 15, 17), selected, today, limits, firstWeekday);

test('first-day offset uses the supplied locale context and rotates Sunday-indexed weekday headers', () => {
  // Flutter DateUtils' own September 2017 examples: Friday is offset 5 for Sunday, 4 for Monday.
  const limits = { firstDate: date(2017, 1, 1), lastDate: date(2017, 12, 31) };
  const sunday = grid(2017, 9, 0, null, date(2017, 9, 1), limits), monday = grid(2017, 9, 1, null, date(2017, 9, 1), limits);
  assert.equal(sunday.firstDayOffset, 5); assert.equal(monday.firstDayOffset, 4);
  for (let first = 0; first < 7; first++) {
    const result = grid(2017, 9, first, null, date(2017, 9, 1), limits);
    assert.equal(result.firstDayOffset, (5 - first + 7) % 7);
    assert.deepEqual(result.weekdayOrder, Array.from({ length: 7 }, (_, index) => (first + index) % 7));
  }
});

test('four, five and six day rows produce the exact sent-hub clipping factor without fake trailing dates', () => {
  const four = grid(2026, 2), five = grid(2026, 2, 1), six = grid(2021, 5);
  assert.deepEqual([four.dayRows, five.dayRows, six.dayRows], [4, 5, 6]);
  assert.deepEqual([four.sentHeightFactor, five.sentHeightFactor, six.sentHeightFactor], [5 / 7, 6 / 7, 1]);
  assert.deepEqual(four.rows.map(row => row.length), [7, 7, 7, 7]);
  assert.deepEqual(six.rows.map(row => row.length), [7, 7, 7, 7, 7, 2]);
  assert.equal(six.cells.filter(cell => cell === null).length, 6);
  assert.deepEqual(six.cells.filter(Boolean).map(cell => cell.day), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(six.cells.at(-1).day, 31);
});

test('selected day, current day and bounds are separate, with no active-archive marker in the picker', () => {
  const limits = { firstDate: date(2026, 11, 4, 18), lastDate: date(2026, 11, 18, 18) };
  const result = grid(2026, 11, 1, date(2026, 11, 8, 17), date(2026, 11, 10, 22), limits);
  const cells = result.cells.filter(Boolean);
  assert.deepEqual(cells.filter(cell => cell.selected).map(cell => cell.day), [8]);
  assert.deepEqual(cells.filter(cell => cell.today).map(cell => cell.day), [10]);
  assert.deepEqual(cells.filter(cell => cell.enabled).map(cell => cell.day), Array.from({ length: 15 }, (_, i) => i + 4));
  assert.equal(cells.some(cell => Object.hasOwn(cell, 'active')), false);
  assert.equal(cells.every(cell => cell.date.getHours() === 0), true);
  assert.equal(result.previousEnabled, false); assert.equal(result.nextEnabled, false);
  assert.equal(limits.firstDate.getHours(), 18);
});

test('paging availability uses inclusive first/last months and preserves selection on other pages', () => {
  const first = grid(2021, 1, 0, date(2026, 11, 8)), last = grid(2027, 12), middle = grid(2026, 11);
  assert.equal(first.previousEnabled, false); assert.equal(first.nextEnabled, true);
  assert.equal(last.previousEnabled, true); assert.equal(last.nextEnabled, false);
  assert.equal(middle.previousEnabled, true); assert.equal(middle.nextEnabled, true);
  assert.deepEqual([ymd(first.previousMonth), ymd(first.nextMonth)], [[2020, 12, 1], [2021, 2, 1]]);
  assert.deepEqual([ymd(last.previousMonth), ymd(last.nextMonth)], [[2027, 11, 1], [2028, 1, 1]]);
  assert.equal(first.cells.filter(Boolean).some(cell => cell.selected), false);
});

test('Gregorian leap days and years below 100 retain their actual year rather than JS constructor offsets', () => {
  for (const [year, days] of [[0, 29], [4, 29], [50, 28], [99, 28], [1900, 28], [2000, 29], [2100, 28], [2400, 29]]) {
    const result = grid(year, 2, 1, null, date(year, 2, 1), { firstDate: date(year, 1, 1), lastDate: date(year, 12, 31) });
    assert.equal(result.daysInMonth, days); assert.deepEqual(ymd(result.cells.at(-1).date), [year, 2, days]);
  }
});

test('year choice keeps the shown month, prefers the selected day and clamps leap-day/month ends', () => {
  const limits = { firstDate: date(2020, 1, 1), lastDate: date(2027, 12, 31) };
  for (const [year, day] of [[2024, 29], [2025, 28]]) {
    const result = model.werkaArchivePickerYearChoice(date(2026, 2, 1), date(2026, 1, 31), year, limits);
    assert.equal(result.mode, 'day'); assert.equal(result.monthChanged, true);
    assert.deepEqual(ymd(result.displayMonth), [year, 2, 1]); assert.deepEqual(ymd(result.selectedDate), [year, 2, day]);
  }
  const noSelection = model.werkaArchivePickerYearChoice(date(2026, 11, 1), null, 2024, limits);
  assert.deepEqual(ymd(noSelection.selectedDate), [2024, 11, 1]);
});

test('year boundary choice clamps the month first, then the preferred day and date bounds', () => {
  const limits = { firstDate: date(2021, 3, 15, 17), lastDate: date(2027, 9, 12, 19) };
  const first = model.werkaArchivePickerYearChoice(date(2026, 1, 1), date(2026, 11, 8), 2021, limits);
  const last = model.werkaArchivePickerYearChoice(date(2026, 12, 1), date(2026, 11, 30), 2027, limits);
  assert.deepEqual(ymd(first.selectedDate), [2021, 3, 15]); assert.deepEqual(ymd(first.displayMonth), [2021, 3, 1]);
  assert.deepEqual(ymd(last.selectedDate), [2027, 9, 12]); assert.deepEqual(ymd(last.displayMonth), [2027, 9, 1]);
  assert.notEqual(first.selectedDate, limits.firstDate); assert.notEqual(last.selectedDate, limits.lastDate);
  assert.equal(limits.firstDate.getHours(), 17); assert.equal(limits.lastDate.getHours(), 19);
  for (const year of [2020, 2028]) assert.equal(model.werkaArchivePickerYearChoice(date(2026, 11, 1), null, year, limits), null);
});

test('choosing the current shown year still describes a selection, including an unchanged selected date', () => {
  const selected = date(2026, 11, 8, 19), result = model.werkaArchivePickerYearChoice(date(2026, 11, 1), selected, 2026, bounds);
  assert.equal(result.monthChanged, false); assert.equal(result.mode, 'day');
  assert.deepEqual(ymd(result.selectedDate), [2026, 11, 8]); assert.equal(result.selectedDate.getHours(), 0);
  assert.notEqual(result.selectedDate, selected); assert.equal(selected.getHours(), 19);
  result.displayMonth.setFullYear(1990); assert.equal(result.selectedDate.getFullYear(), 2026);
});

test('invalid or missing locale geometry and inconsistent picker inputs fail rather than invent defaults', () => {
  for (const first of [undefined, null, NaN, -1, 7, 1.5]) {
    assert.throws(() => model.werkaArchivePickerMonth(date(2026, 11, 1), null, date(2026, 11, 8), bounds, first), RangeError);
  }
  for (const value of [new Date(NaN)]) assert.throws(() => model.werkaArchivePickerMonth(value, null, date(2026, 11, 8), bounds, 0), RangeError);
  assert.throws(() => grid(2020, 12), RangeError);
  assert.throws(() => grid(2026, 11, 0, date(2020, 12, 31)), RangeError);
  const inverted = { firstDate: bounds.lastDate, lastDate: bounds.firstDate };
  assert.throws(() => grid(2026, 11, 0, null, date(2026, 11, 8), inverted), RangeError);
  for (const year of [NaN, 2024.5]) assert.throws(() => model.werkaArchivePickerYearChoice(date(2026, 11, 1), null, year, bounds), RangeError);
});
