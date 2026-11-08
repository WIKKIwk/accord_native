// Pure source-data replay. This does not run Flutter, native controls or device Intl/Hermes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/werka_archive_date_oracle.json');
const filename = path.resolve(__dirname, '../src/werka/werkaArchiveDateLabels.ts');
const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const labels = loaded.exports;
function localDate(year, month, day) {
  const date = new Date(0); date.setHours(12, 0, 0, 0); date.setFullYear(year, month - 1, day); return date;
}

test('archive date fixture records the selected V2 and declared Flutter/Intl source, not a widget result', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.kind, 'standalone source-equivalent date data, not Flutter or device');
  assert.equal(fixture.flutterRevision, '737ba8f885dc774b53b442759999a312c9461e4e');
  assert.equal(fixture.flutterVersion, '3.47.8'); assert.equal(fixture.intlVersion, '0.20.3');
  assert.equal(fixture.dateDataSha256, '6dbcf772b367b3c993008b3267d63c38eccd4039b476dadf33753fe888401526');
  assert.equal(fixture.materialSha256, '3971b1b90d5d047261a57d547f9f0ff072282ab3f53a1d76fecf671decf59e8b');
  assert.equal(fixture.intlDateFieldSha256, 'f7e78fb9c84f355d9560aa1f7dcb8b35d489a6ef25e60f18641ece1f4857ba61');
  assert.equal(fixture.cases.length, 880);
});

test('all 880 source-data samples retain month/year, first-space cell and medium-date formatting', () => {
  for (const row of fixture.cases) {
    const date = localDate(row.year, row.month, row.day), context = JSON.stringify([row.locale, row.year, row.month, row.day]);
    const monthYear = labels.werkaArchiveMonthYear(date, row.locale);
    assert.equal(monthYear, row.monthYear, `month/year ${context}`);
    assert.equal(monthYear.split(' ')[0], row.monthCell, `month cell ${context}`);
    assert.equal(labels.werkaArchiveMediumDate(date, row.locale), row.mediumDate, `medium date ${context}`);
  }
});

test('source punctuation, standalone Russian month and year-free medium dates are preserved', () => {
  const date = localDate(2026, 11, 8);
  assert.equal(labels.werkaArchiveMonthYear(date, 'uz'), 'noyabr, 2026');
  assert.equal(labels.werkaArchiveMonthYear(date, 'ru'), 'ноябрь 2026\u202fг.');
  assert.equal(labels.werkaArchiveMediumDate(date, 'uz'), 'Yak, 8-noy');
  assert.equal(labels.werkaArchiveMediumDate(date, 'en'), 'Sun, Nov 8');
  assert.equal(labels.werkaArchiveMediumDate(date, 'ru'), 'вс, 8 нояб.');
  assert.equal(labels.werkaArchiveMediumDate(date, 'ur-PK'), 'اتوار، 8 نومبر');
});

test('app language aliases share labels and formatting leaves the date unchanged', () => {
  const date = localDate(2024, 2, 29), before = date.getTime();
  for (const locale of ['ur', 'ur-PK', 'ur_PK', 'UR-pk']) {
    assert.equal(labels.werkaArchiveMonthYear(date, locale), labels.werkaArchiveMonthYear(date, 'ur-PK'));
    assert.equal(labels.werkaArchiveMediumDate(date, locale), labels.werkaArchiveMediumDate(date, 'ur-PK'));
  }
  assert.equal(date.getTime(), before);
});

test('unsupported unresolved locale and invalid dates do not fabricate a label', () => {
  for (const format of [labels.werkaArchiveMonthYear, labels.werkaArchiveMediumDate]) {
    assert.throws(() => format(localDate(2026, 1, 1), 'fr'), RangeError);
    assert.throws(() => format(new Date(NaN), 'uz'), RangeError);
  }
});
