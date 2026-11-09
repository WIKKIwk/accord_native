const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': {} });
const { qolipReworkDate, qolipMileageMeter } = load('qolip/qolipMileageFormatting.ts', { './qolipApiCommon': common });

test('date formatting matches the f119 Dart oracle in Asia/Tashkent', () => {
  const old = process.env.TZ; process.env.TZ = 'Asia/Tashkent';
  try {
    const dates = { '2026-01-15': '15.01.2026 00:00', '2026-01-15T10:02:30': '15.01.2026 10:02',
      '2026-01-15T10:02:30Z': '15.01.2026 15:02', '2026-01-15T10:02:30+05:30': '15.01.2026 09:32',
      '20260115 100230': '15.01.2026 10:02', '2020-02-31 12:34': '02.03.2020 12:34', 'not a date': 'not a date',
      '0001-01-01': '01.01.1 00:00', '2026-13-01': '01.01.2027 00:00', '2026-01-15T10:00:00.999999Z': '15.01.2026 15:00' };
    for (const [input, expected] of Object.entries(dates)) assert.equal(qolipReworkDate(input), expected, input);
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});

test('mileage numbers match f119 Dart formatting, including negative zero', () => {
  for (const [input, expected] of [[0, '0'], [-0, '-0'], [1.005, '1'], [2.675, '2.67'], [1.234, '1.23'],
    [99.999, '100'], [-0.001, '-0'], [-0.0049, '-0'], [1e21, '1e+21'], [100, '100']]) {
    assert.equal(qolipMileageMeter(input), expected);
  }
});

test('local date parsing matches the f119 oracle across New York DST transitions', () => {
  const old = process.env.TZ; process.env.TZ = 'America/New_York';
  try {
    assert.equal(qolipReworkDate('2026-03-08 02:30'), '08.03.2026 03:30');
    assert.equal(qolipReworkDate('2026-11-01 01:30'), '01.11.2026 01:30');
    assert.equal(qolipReworkDate('2026-01-15T10:02:30Z'), '15.01.2026 05:02');
    assert.equal(qolipReworkDate('2026-01-15T10:02:30+05:30'), '14.01.2026 23:32');
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
