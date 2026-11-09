// Standalone source-equivalent Dart samples, not a Flutter or device test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const fixture = require('./contracts/f11910bb/werka_unannounced_input_oracle.json');
const filename = path.resolve(__dirname, '../src/werka/werkaUnannouncedInput.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { werkaTryParseTrimmedDouble: parse, werkaUnannouncedAfterTrim: decision } = loaded.exports;
function bits(value) {
  if (Number.isNaN(value)) return 'NaN';
  const buffer = new ArrayBuffer(8); new DataView(buffer).setFloat64(0, value, false);
  return Buffer.from(buffer).toString('hex');
}
test('trimmed unannounced quantity samples match standalone f119 source-equivalent Dart', () => {
  assert.equal(fixture.baseline, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  assert.equal(fixture.seed, 0x11910bb);
  assert.equal(fixture.cases.length, 303);
  for (const sample of fixture.cases) {
    const parsed = parse(sample.trimmed), result = decision(sample.trimmed, 'kg');
    assert.equal(parsed === null ? null : bits(parsed), sample.parsedBits, JSON.stringify(sample.input));
    assert.equal(result.kind === 'confirm', sample.validationPassed, JSON.stringify(sample.input));
    assert.equal(result.kind === 'confirm' ? result.quantityText : null, sample.confirmationQuantity, JSON.stringify(sample.input));
  }
});
test('input requires a caller to apply the shared Dart trim before parsing', () => {
  assert.equal(parse('\u00851\u0085'), null);
  assert.equal(parse('1'), 1);
  assert.equal(decision('NaN', 'kg').quantityText, 'NaN kg');
  assert.equal(decision('Infinity', 'kg').quantityText, 'Infinity kg');
  assert.equal(decision('-Infinity', 'kg').kind, 'invalid');
  assert.equal(decision('0', 'kg').kind, 'invalid');
});
