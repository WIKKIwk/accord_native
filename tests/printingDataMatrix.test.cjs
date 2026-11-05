const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/printing/materialDataMatrix.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { materialDataMatrixBars } = loaded.exports;

// Digests were generated from baseline 7c87a54e using v2_oracle.sh. They include
// every rectangle edge in order, rounded to the same 12 decimal places as V2.
const cases = [
  ['', 31, 'c5cc36bab9ae78c1e0d2405f61b47b894101946cbafcdb5781423a2be4ffff96'],
  ['00001', 32, '0bbca0a5e4310ba912c68a94840eb92f8db6663ca64b040115108f85b409fb0d'],
  ['303132333435363738394142', 80, 'eba74d89a30c29e4d6e358188e549903ec8f6216ea3724cdcf9eed2621e96158'],
  ['RPS-BATCH:BATCH-HISTORY-92', 133, '60c23f662d16c94432941e4e1a8caa5569a2ac42d626f9fe9b9be45c10cf7d2e'],
  ['ABC123xyz!@', 69, '9bc265a45c6532d658efa6de26dd60be1b69c76356ca4be11dc625d99ed67183'],
  ['A'.repeat(100), 426, '0ea635fdd0f7c994b6195c00f6ad7dfd3b5faca5f2efa983893e7baa1bd7d008'],
  ['A'.repeat(300), 1361, '2852aa2df2d11d8996be22b9e170501986fa0d8a4c35afef08975754b841db4e'],
  ['A'.repeat(1000), 3667, 'd5374bf3957d14dd2b107f29f725f6cf25bfc57cc6d51c696cc60dafa546d096'],
];
for (const [input, count, digest] of cases) {
  test(`Data Matrix matches V2 rectangle coordinates: ${input.slice(0, 26)} (${input.length})`, () => {
    const bars = materialDataMatrixBars(input);
    const normalized = bars.map(bar => bar.map(n => Math.round(n * 1e12)).join(',')).join(';');
    assert.equal(bars.length, count);
    assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'), digest);
  });
}
