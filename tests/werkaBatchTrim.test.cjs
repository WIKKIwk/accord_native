const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/werka/werkaBatchTrim.ts');
const loaded = new Module(file); loaded.filename = file; loaded.paths = require.main.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { werkaBatchTrim } = loaded.exports;

test('all Unicode scalar edge characters match the standalone Dart 3.13.7 trim probe', () => {
  const fixture = require('./contracts/f11910bb/werka_batch_trim_oracle.json');
  const trimmed = new Set(fixture.trimmed); let count = 0;
  for (let code = 0; code <= 0x10ffff; code++) {
    if (code >= 0xd800 && code <= 0xdfff) continue;
    count++; const char = String.fromCodePoint(code);
    const result = werkaBatchTrim(`${char}x${char}`);
    if (result !== (trimmed.has(code) ? 'x' : `${char}x${char}`)) assert.fail(`U+${code.toString(16)}`);
  }
  assert.equal(count, fixture.scalarCount);
  assert.equal(werkaBatchTrim('\u0085 \u0085x\u0085 \u0085'), 'x');
  assert.equal(werkaBatchTrim('x\u0085x'), 'x\u0085x');
  assert.equal(werkaBatchTrim('\ud800x\udfff'), '\ud800x\udfff');
  assert.equal(loaded.exports.werkaDartTrim, werkaBatchTrim);
});
