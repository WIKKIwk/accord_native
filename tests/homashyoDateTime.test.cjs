// Expected values were observed using Dart DateTime.parse/toLocal from the pinned f119 V2 snapshot,
// in a temporary oracle export (UTC and Asia/Tashkent) and standalone SDK tests. No fixture was overwritten.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
const file = path.resolve(__dirname, '../src/homashyo/rawSplitModel.ts'), m = new Module(file, module);
m.filename = file; m.paths = module.paths;
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { rawSplitParseDateTime, rawSplitLocalDateTime, RawSplitIssue } = m.exports;
const cases = [
  ['2026-09-08T12:34:56.123456Z', '2026-09-08 12:34:56.123456', '2026-09-08 17:34:56.123456'],
  ['2026-09-08 12:34:56.123456', '2026-09-08 12:34:56.123456', '2026-09-08 12:34:56.123456'],
  ['2026-09-08T12:34:56.123456+05:30', '2026-09-08 07:04:56.123456', '2026-09-08 12:04:56.123456'],
  ['2026-09-08', '2026-09-08 00:00:00.000', '2026-09-08 00:00:00.000'],
  ['20260908', '2026-09-08 00:00:00.000', '2026-09-08 00:00:00.000'],
  ['2026-09-08T12', '2026-09-08 12:00:00.000', '2026-09-08 12:00:00.000'],
  ['2026-09-08T12:30', '2026-09-08 12:30:00.000', '2026-09-08 12:30:00.000'],
  ['2026-09-08T12:30:60Z', '2026-09-08 12:31:00.000', '2026-09-08 17:31:00.000'],
  ['2026-02-30', '2026-03-02 00:00:00.000', '2026-03-02 00:00:00.000'],
  ['2026-13-40', '2027-02-09 00:00:00.000', '2027-02-09 00:00:00.000'],
  ['2026-01-01T25:00:00', '2026-01-02 01:00:00.000', '2026-01-02 01:00:00.000'],
  ['2026-01-01T00:00:00,1234567Z', '2026-01-01 00:00:00.123456', '2026-01-01 05:00:00.123456'],
  ['2026-09-08T12:34:56.000001Z', '2026-09-08 12:34:56.000001', '2026-09-08 17:34:56.000001'],
  ['2026-09-08T12:34:56.123000Z', '2026-09-08 12:34:56.123', '2026-09-08 17:34:56.123'],
];
for (const [zone, column] of [['UTC', 1], ['Asia/Tashkent', 2]]) test(`Dart date-time subset and local microseconds match the ${zone} oracle`, () => {
  const previous = process.env.TZ; process.env.TZ = zone;
  try { for (const row of cases) { const parsed = rawSplitParseDateTime(row[0]);
    assert.equal(rawSplitLocalDateTime(parsed.date, parsed.microsecond), row[column], row[0]); }
    for (const raw of [' 2026-09-08T12:34:56Z ', '2026-09-08\n', 'garbage', '', '09/08/2026']) assert.throws(() => rawSplitParseDateTime(raw), /Invalid date/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('selected daylight-saving local dates match the Dart SDK oracle', () => {
  const previous = process.env.TZ;
  try { for (const [zone, raw, expected] of [
    ['America/New_York', '2024-03-10T01:59:59.999999', '2024-03-10 01:59:59.999999'],
    ['America/New_York', '2024-03-10T02:30:00', '2024-03-10 03:30:00.000'],
    ['America/New_York', '2024-11-03T01:30:00', '2024-11-03 01:30:00.000'],
    ['Europe/Berlin', '2025-03-30T02:30:00', '2025-03-30 03:30:00.000'],
    ['Europe/Berlin', '2025-10-26T02:30:00', '2025-10-26 02:30:00.000'],
  ]) { process.env.TZ = zone; const parsed = rawSplitParseDateTime(raw);
    assert.equal(rawSplitLocalDateTime(parsed.date, parsed.microsecond), expected, `${zone}: ${raw}`); }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('the maximum Dart instant rejects an extra microsecond', () => {
  assert.throws(() => rawSplitParseDateTime('275760-09-13T00:00:00.000001Z'), /Invalid date/);
  assert.equal(rawSplitParseDateTime('275760-09-13T00:00:00.000000Z').microsecond, 0);
  assert.equal(rawSplitParseDateTime('-271821-04-20T00:00:00.000001Z').microsecond, 1);
});
test('RawSplitIssue retains six fractional digits instead of silently dropping microseconds', () => {
  const source = { revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM', item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
  const output = { ...source, kg: '98', gross_kg: '99', bobina_kg: '1' };
  const issue = new RawSplitIssue({ id: 'issue', request_id: 'id', source, source_kg: '100', output_kg: '98.000000', entered_waste_kg: '1',
    waste_kg: '1.000000', difference_kg: '1.000000', kind: 'missing_weight', outputs: [output], note: 'n', actor_ref: 'a', actor_name: 'A',
    created_at: '2026-09-08T12:34:56.123456Z' });
  assert.equal(issue.createdAt.getMilliseconds(), 123); assert.equal(issue.createdAtMicrosecond, 456);
});
