const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/material/materialHistoryValueText.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { materialHistoryJsonText: text, materialHistoryOptionalText: optional } = loaded.exports;

// Source-derived from f119 ?.toString() consumers and the installed Dart List/Map toString implementation.
// No Dart/Flutter execution was used for these expectations.
test('container text is unquoted, unescaped and untruncated, with source nullable-field behavior', () => {
  const strings = ['A, B', '"quoted"', 'line\nbreak', '[value]', ''], values = [...strings, true, false, null];
  assert.equal(text(values), '[A, B, "quoted", line\nbreak, [value], , true, false, null]');
  assert.equal(text({ name: 'A', options: [true, null], empty: {} }), '{name: A, options: [true, null], empty: {}}');
  assert.equal(text(Array.from({ length: 90 }, (_, index) => index)), `[${Array.from({ length: 90 }, (_, index) => index).join(', ')}]`);
  assert.equal(optional(null), ''); assert.equal(optional(undefined), ''); assert.equal(text(null), 'null');
  assert.equal(text([]), '[]'); assert.equal(text({}), '{}'); assert.equal(optional(' \u0085 '), ' \u0085 ');
});

test('characterization: decoded JSON does not recover Dart numeric spelling, precision or original numeric-key order', () => {
  const integer = JSON.parse('{"value":7}'), decimal = JSON.parse('{"value":7.0}');
  assert.equal(text(integer), text(decimal)); // Dart retains int 7 versus double 7.0, so this remains a route hold.
  assert.equal(JSON.parse('9007199254740993'), 9007199254740992);
  const reordered = JSON.parse('{"10":"first","2":"second","plain":true}');
  assert.equal(text(reordered), '{2: second, 10: first, plain: true}');
  assert.notEqual(text(reordered), '{10: first, 2: second, plain: true}');
});
