// Source-derived state/query descriptions only. No request, route, native calendar or Flutter widget is executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/werka_archive_list_range_oracle.json');
const root = path.resolve(__dirname, '../src');
function load(file, cache = new Map()) {
  const filename = [file, `${file}.ts`, path.join(file, 'index.ts')]
    .find(value => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!filename) throw Error(file);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const state = load(path.join(root, 'werka/werkaArchiveListState.ts'));
const localization = load(path.join(root, 'shared/localization'));
function date(year, month, day, hour = 0) {
  const value = new Date(0); value.setHours(hour, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const fields = value => value === null ? null : [value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours()];

test('daily or monthly missing either endpoint replaces both with a clock-based source default', () => {
  const now = date(2024, 2, 29, 19), supplied = date(2023, 12, 20, 9);
  for (const [from, to] of [[null, null], [supplied, null], [null, supplied]]) {
    const day = state.werkaArchiveListInitial('received', 'daily', from, to, now);
    assert.deepEqual(fields(day.from), [2024, 2, 29, 0]); assert.deepEqual(fields(day.to), [2024, 2, 29, 0]);
    assert.equal(day.calendarOpen, false); assert.notEqual(day.from, day.to);
    const month = state.werkaArchiveListInitial('returned', 'monthly', from, to, now);
    assert.deepEqual(fields(month.from), [2024, 2, 1, 0]); assert.deepEqual(fields(month.to), [2024, 2, 29, 0]);
  }
  assert.deepEqual(fields(supplied), [2023, 12, 20, 9]); assert.equal(now.getHours(), 19);
});

test('provided ranges retain their time, while yearly/custom missing values stay missing', () => {
  const from = date(2023, 12, 20, 9), to = date(2024, 1, 17, 13), now = date(2026, 11, 8);
  for (const period of ['daily', 'monthly', 'yearly', 'custom']) {
    const initial = state.werkaArchiveListInitial('sent', period, from, to, now);
    assert.deepEqual(fields(initial.from), fields(from)); assert.deepEqual(fields(initial.to), fields(to));
    assert.notEqual(initial.from, from); assert.notEqual(initial.to, to);
  }
  for (const period of ['yearly', 'custom']) {
    const initial = state.werkaArchiveListInitial('sent', period, from, null, now);
    assert.deepEqual(fields(initial.from), fields(from)); assert.equal(initial.to, null);
  }
});

test('monthly fallback preserves the source absolute 24-hour subtraction across a midnight DST shift', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'Africa/Cairo';
    const april = state.werkaArchiveListInitial('sent', 'monthly', null, null, date(2027, 4, 10, 12));
    assert.deepEqual(fields(april.from), [2027, 4, 1, 0]);
    assert.deepEqual(fields(april.to), [2027, 4, 29, 23]);
    const october = state.werkaArchiveListInitial('sent', 'monthly', null, null, date(2024, 10, 10, 12));
    assert.deepEqual(fields(october.to), [2024, 10, 31, 1]);
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});

test('monthly fallback matches 18 standalone Dart DateTime samples in three time zones', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.kind, 'standalone source-equivalent DateTime, not Flutter or device');
  assert.equal(fixture.dartVersion, '3.13.7');
  const before = process.env.TZ; let count = 0;
  try {
    for (const result of fixture.results) {
      process.env.TZ = result.timezone;
      for (const row of result.cases) {
        const value = state.werkaArchiveListInitial('sent', 'monthly', null, null, date(row.year, row.month, 10, 12));
        assert.deepEqual([...fields(value.from), value.from.getMinutes()], row.from, `${result.timezone} from ${row.year}-${row.month}`);
        assert.deepEqual([...fields(value.to), value.to.getMinutes()], row.to, `${result.timezone} to ${row.year}-${row.month}`);
        count++;
      }
    }
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
  assert.equal(count, 18);
});

test('toggle is a state description and a real day selection closes, normalizes and requests even an unchanged date', () => {
  const initial = state.werkaArchiveListInitial('returned', 'daily', null, null, date(2024, 2, 29, 11));
  const opened = state.werkaArchiveListToggleCalendar(initial);
  assert.equal(initial.calendarOpen, false); assert.equal(opened.calendarOpen, true);
  const choice = state.werkaArchiveListSelectDaily(opened, date(2024, 2, 29, 20));
  assert.equal(choice.state.calendarOpen, false); assert.equal(opened.calendarOpen, true);
  assert.deepEqual(fields(choice.state.from), [2024, 2, 29, 0]); assert.deepEqual(fields(choice.state.to), [2024, 2, 29, 0]);
  assert.deepEqual([choice.query.kind, choice.query.period, fields(choice.query.from), fields(choice.query.to)],
    ['returned', 'daily', [2024, 2, 29, 0], [2024, 2, 29, 0]]);
  assert.notEqual(choice.query.from, choice.state.from); assert.notEqual(choice.query.to, choice.state.to);
  choice.query.from.setFullYear(1990); assert.equal(choice.state.from.getFullYear(), 2024);
});

test('selected date and subtitle use Material medium dates, with source fallbacks when Material is absent', () => {
  const value = state.werkaArchiveListInitial('sent', 'daily', date(2024, 2, 29), date(2024, 2, 29), date(2026, 1, 1));
  assert.deepEqual(state.werkaArchiveListDateLabels(value, 'en', true), { selectedDate: 'Thu, Feb 29', subtitle: 'Thu, Feb 29 - Thu, Feb 29' });
  assert.deepEqual(state.werkaArchiveListDateLabels(value, 'en', false),
    { selectedDate: localization.localizedGetter('archiveSelectDateAction', 'en'), subtitle: '' });
  const missing = { ...value, from: null };
  assert.deepEqual(state.werkaArchiveListDateLabels(missing, 'ru', true),
    { selectedDate: localization.localizedGetter('archiveSelectDateAction', 'ru'), subtitle: '' });
});

test('the PDF affordance is enabled only for nonempty loaded items while not downloading', () => {
  for (const [count, busy, enabled] of [[0, false, false], [0, true, false], [1, false, true], [4, true, false]]) {
    assert.equal(state.werkaArchiveListPdfEnabled(count, busy), enabled);
  }
});
