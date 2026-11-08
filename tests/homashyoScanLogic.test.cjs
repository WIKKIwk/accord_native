// V2 scan dialog completes only once, trims input and preserves opaque codes.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function compile(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : {};
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports; }
const inventory = compile('preparation/preparationInventory');
const { RawSplitScanGate } = compile('homashyo/rawSplitScanLogic', { '../preparation/preparationInventory': inventory });
test('scanner rejects empty input and accepts only the first non-empty result', () => {
  const gate = new RawSplitScanGate(); assert.equal(gate.accept('  '), null); assert.equal(gate.accept(' parent '), 'parent');
  assert.equal(gate.accept('other'), null); gate.reset(); assert.equal(gate.accept('other'), 'other');
});
test('scanner reuses existing opaque and absolute-URL material parsing', () => {
  for (const [raw, expected] of [['Milano Premium 30/40', 'Milano Premium 30/40'],
    ['https://example.test/r/ignored?barcode=A%2FB', 'A/B'], ['https://example.test/a/B%2FC', 'B/C'],
    ['https://example.test/a?epc= EPC ', 'EPC']]) {
    assert.equal(new RawSplitScanGate().accept(raw), expected);
  }
});
