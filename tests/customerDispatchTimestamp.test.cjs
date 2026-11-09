const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/dispatchRuntimeStores.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { compareCreatedLabelsDesc: compare, parseCreatedLabelTimestamp: parse } = loaded.exports;

// Source-derived from V2 app_models_declarations_part_01.dart and Dart DateTime.parse.
test('fractional timestamps retain six digits and discard later digits for ordering', () => {
  assert.equal(compare('2026-03-27T10:00:00.123456Z', '2026-03-27T10:00:00.123455Z'), -1);
  assert.equal(compare('2026-03-27T10:00:00.123455Z', '2026-03-27T10:00:00.123456Z'), 1);
  assert.equal(compare('2026-03-27T10:00:00.1234561Z', '2026-03-27T10:00:00.1234569Z'), 0);
  assert.equal(compare('2026-03-27T10:00:00.1Z', '2026-03-27T10:00:00.100000Z'), 0);
  assert.equal(parse('2026-03-27T10:00:00.123456Z'), parse('2026-03-27T10:00:00.123Z'));
});

test('different offsets for the same microsecond compare equal', () => {
  assert.equal(compare('2026-01-01T05:00:00.000001+05:00', '2026-01-01T00:00:00.000001Z'), 0);
  assert.equal(compare('2026-01-01T05:00:00.000002+05:00', '2026-01-01T00:00:00.000001Z'), -1);
  assert.equal(compare('1969-12-31T19:00:00.999999-05:00', '1970-01-01T00:00:00.999999Z'), 0);
});

test('negative epoch timestamps are ordered without rounding toward zero', () => {
  assert.equal(compare('1969-12-31T23:59:59.999999Z', '1970-01-01T00:00:00Z'), 1);
  assert.equal(compare('1969-12-31T23:59:59.999999Z', '1969-12-31T23:59:59.999001Z'), -1);
  assert.equal(parse('1969-12-31T23:59:59.999999Z'), -1);
});

test('parsed dates precede invalid dates and invalid labels sort by descending code units', () => {
  assert.equal(compare('not-a-date', '2026-01-01'), 1);
  assert.equal(compare('2026-01-01', 'not-a-date'), -1);
  assert.equal(compare('aaa', 'zzz'), 1);
  assert.equal(compare('same', 'same'), 0);
});

test('the comparator trims Dart VM whitespace without changing the exported parser', () => {
  const wrapped = '\u00852026-01-01T00:00:00Z\u0085';
  assert.equal(parse(wrapped), null);
  assert.equal(compare(wrapped, '2026-01-01T00:00:00Z'), 0);
});

test('a positive DateTime boundary with extra microseconds is invalid to the comparator', () => {
  assert.equal(parse('+275760-09-13T00:00:00.000001Z'), 8_640_000_000_000_000);
  assert.equal(compare('+275760-09-13T00:00:00.000001Z', '1970-01-01T00:00:00Z'), 1);
  assert.equal(compare('+275760-09-13T00:00:00Z', '1970-01-01T00:00:00Z'), -1);
});
