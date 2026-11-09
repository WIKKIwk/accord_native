// Pure source-derived state/query projections. No native picker events, frames, requests or routes are exercised.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const root = path.resolve(__dirname, '../src');
function load(file, cache = new Map()) {
  let filename = path.resolve(file);
  if (fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename = path.join(filename, 'index.ts');
  else if (!filename.endsWith('.ts')) filename += '.ts';
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => name === './catalog.json' ? catalog
    : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const model = load(path.join(root, 'werka/werkaDailyArchiveModel.ts'));
const localization = load(path.join(root, 'shared/localization'));
const ymd = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()];
function localDate(year, month, day, hour = 0) {
  const date = new Date(0); date.setHours(hour, 0, 0, 0); date.setFullYear(year, month - 1, day); return date;
}

test('daily archive starts at today with a closed calendar and a separate month start', () => {
  const now = localDate(2026, 11, 8, 17), state = model.werkaDailyArchiveInitial(now);
  assert.deepEqual(ymd(state.displayMonth), [2026, 11, 1]); assert.deepEqual(ymd(state.selectedDate), [2026, 11, 8]);
  assert.equal(state.calendarOpen, false); assert.equal(state.selectedDate.getHours(), 0);
  assert.equal(state.displayMonth.getHours(), 0); assert.equal(now.getHours(), 17);
  assert.notEqual(state.displayMonth, state.selectedDate); assert.notEqual(state.selectedDate, now);
});

test('first-frame reveal and toggle are state descriptions, leaving inputs unchanged', () => {
  const initial = model.werkaDailyArchiveInitial(localDate(2026, 11, 8));
  const revealed = model.werkaDailyArchiveReveal(initial);
  assert.equal(initial.calendarOpen, false); assert.equal(revealed.calendarOpen, true);
  assert.equal(model.werkaDailyArchiveReveal(revealed).calendarOpen, true);
  const closed = model.werkaDailyArchiveToggle(revealed), reopened = model.werkaDailyArchiveToggle(closed);
  assert.equal(closed.calendarOpen, false); assert.equal(reopened.calendarOpen, true);
  assert.deepEqual(ymd(reopened.selectedDate), [2026, 11, 8]);
});

test('bounds use the supplied current year rather than the originally selected date', () => {
  const before = model.werkaDailyArchiveBounds(localDate(2026, 12, 31, 23));
  const after = model.werkaDailyArchiveBounds(localDate(2027, 1, 1));
  assert.deepEqual([ymd(before.firstDate), ymd(before.lastDate)], [[2021, 1, 1], [2027, 12, 31]]);
  assert.deepEqual([ymd(after.firstDate), ymd(after.lastDate)], [[2022, 1, 1], [2028, 12, 31]]);
  const ancient = model.werkaDailyArchiveBounds(localDate(5, 1, 1));
  assert.deepEqual([ymd(ancient.firstDate), ymd(ancient.lastDate)], [[0, 1, 1], [6, 12, 31]]);
});

test('daily calendar loads a whole monthly interval for every archive kind', () => {
  const state = model.werkaDailyArchiveInitial(localDate(2024, 2, 29));
  for (const kind of ['received', 'sent', 'returned']) {
    const query = model.werkaDailyArchiveQuery(kind, state);
    assert.deepEqual([query.kind, query.period, ymd(query.from), ymd(query.to)], [kind, 'monthly', [2024, 2, 1], [2024, 2, 29]]);
  }
});

test('same displayed-month events produce no reload, even if their day or time differs', () => {
  const state = model.werkaDailyArchiveInitial(localDate(2026, 11, 8));
  for (const date of [localDate(2026, 11, 1), localDate(2026, 11, 30, 23)]) {
    const event = model.werkaDailyArchiveDisplayedMonth('sent', state, date);
    assert.equal(event.state, state); assert.equal(event.query, null);
  }
});

test('a real displayed-month event updates only that month and describes its request', () => {
  const state = model.werkaDailyArchiveReveal(model.werkaDailyArchiveInitial(localDate(2026, 12, 20)));
  const event = model.werkaDailyArchiveDisplayedMonth('returned', state, localDate(2027, 1, 14, 16));
  assert.deepEqual(ymd(event.state.displayMonth), [2027, 1, 1]);
  assert.deepEqual(ymd(state.displayMonth), [2026, 12, 1]);
  assert.equal(event.state.calendarOpen, true); assert.equal(event.state.selectedDate, state.selectedDate);
  assert.deepEqual([event.query.kind, event.query.period, ymd(event.query.from), ymd(event.query.to)],
    ['returned', 'monthly', [2027, 1, 1], [2027, 1, 31]]);
});

test('selection normalizes, closes, preserves the shown month and produces a daily range for each kind', () => {
  const state = model.werkaDailyArchiveReveal(model.werkaDailyArchiveInitial(localDate(2024, 1, 31)));
  const selected = localDate(2024, 2, 29, 21);
  for (const kind of ['received', 'sent', 'returned']) {
    const result = model.werkaDailyArchiveSelect(kind, state, selected);
    assert.equal(result.state.calendarOpen, false); assert.equal(state.calendarOpen, true);
    assert.equal(result.state.displayMonth, state.displayMonth);
    assert.deepEqual(ymd(result.state.selectedDate), [2024, 2, 29]); assert.equal(result.state.selectedDate.getHours(), 0);
    assert.deepEqual([result.query.kind, result.query.period, ymd(result.query.from), ymd(result.query.to)],
      [kind, 'daily', [2024, 2, 29], [2024, 2, 29]]);
    assert.notEqual(result.query.from, result.query.to); assert.notEqual(result.state.selectedDate, result.query.from);
  }
  assert.equal(selected.getHours(), 21); assert.deepEqual(ymd(state.selectedDate), [2024, 1, 31]);
});

test('first-load blank/header progress, retry, empty and retained-data branches follow source', () => {
  const state = model.werkaDailyArchiveInitial(localDate(2026, 11, 8));
  const present = (active, loading, error) => model.werkaDailyArchivePresentation('received', state, active, loading, error, 'uz');
  assert.equal(present(new Set(), true, Error('x')).body, 'loading');
  assert.equal(present(new Set(), true, null).headerLoading, true);
  assert.equal(present(new Set(), false, Error('x')).body, 'error');
  assert.equal(present(new Set(), false, null).body, 'content');
  assert.equal(present(new Set(), false, null).summary, localization.localizedGetter('archiveCalendarEmptyMonth', 'uz'));
  for (const loading of [true, false]) for (const error of [null, Error('retained')]) {
    const result = present(new Set([1, 7]), loading, error);
    assert.equal(result.body, 'content'); assert.equal(result.headerLoading, false); assert.equal(result.summary, '2 ta faol kun');
  }
});

test('date copy and title are localized while source active-day summary stays Uzbek in every app language', () => {
  const state = model.werkaDailyArchiveInitial(localDate(2026, 11, 8));
  const expectedDate = { uz: 'Yak, 8-noy', en: 'Sun, Nov 8', ru: 'вс, 8 нояб.', 'ur-PK': 'اتوار، 8 نومبر' };
  for (const [locale, selectedLabel] of Object.entries(expectedDate)) for (const kind of ['received', 'sent', 'returned']) {
    const result = model.werkaDailyArchivePresentation(kind, state, new Set([3, 5, 11]), false, null, locale);
    assert.equal(result.summary, '3 ta faol kun'); assert.equal(result.selectedDateLabel, selectedLabel);
    const key = { received: 'archiveReceivedTitle', sent: 'archiveSentTitle', returned: 'archiveReturnedTitle' }[kind];
    assert.equal(result.title, `${localization.localizedGetter(key, locale)} • ${localization.localizedGetter('archiveDailyTitle', locale)}`);
    assert.equal(result.action, localization.localizedGetter('archiveSelectDateAction', locale));
    assert.equal(result.dateTitle, localization.localizedGetter('archiveDateTitle', locale));
  }
});

test('nullable source selection uses the source action label, without inventing a date', () => {
  const state = { ...model.werkaDailyArchiveInitial(localDate(2026, 11, 8)), selectedDate: null };
  const result = model.werkaDailyArchivePresentation('sent', state, new Set(), false, null, 'en');
  assert.equal(result.selectedDateLabel, localization.localizedGetter('archiveSelectDateAction', 'en'));
});
