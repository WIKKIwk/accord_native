const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return loaded.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const model = load('boyoqchi/returnedPaintModel', { '../workerControlsApi': controls });
const worker = load('workerOrderLogic', { './workerControlsApi': {} });
const rules = load('boyoqchi/returnedPaintRules', { '../workerOrderLogic': worker, './returnedPaintModel': model });
const { boyoqchiNumber } = load('boyoqchi/boyoqchiLogic', { './returnedPaintModel': model, './returnedPaintRules': rules });
const fixture = require('./fixtures/boyoqchi_number_f11910bb.json');

test('Boyoqchi number display matches pinned V2 oracle at decimal, sign and integer limits', () => {
  assert.equal(fixture.v2Commit, 'f11910bb2c8c7081ce26770e69811b03fd0739ed');
  const oracle = fs.readFileSync(path.resolve(__dirname, 'oracles/boyoqchi_number_oracle_test.dart'), 'utf8');
  const source = oracle.match(/String _formatNumber\(String rawValue\) \{\n[\s\S]*?\n\}/)?.[0];
  assert.ok(source, 'the generated V2 oracle function must be present');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), fixture.functionSha256);
  assert.equal(fixture.cases.length, 239);
  for (const [input, expected] of fixture.cases) assert.equal(boyoqchiNumber(input), expected, `input ${JSON.stringify(input)}`);
});

test('integer conversion retains the exact represented bits throughout the signed 64-bit range', () => {
  // BigInt is a Node-only test oracle, not a dependency of the React Native code.
  let x = 0x6b842c3d;
  for (let i = 0; i < 20000; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const hi = x >>> 1;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const lo = x >>> 0;
    let value = hi * 2 ** 32 + lo;
    if (i & 1) value = -value;
    const expected = value >= 2 ** 63 ? '9223372036854775807'
      : value <= -(2 ** 63) ? '-9223372036854775808' : BigInt(value).toString();
    assert.equal(boyoqchiNumber(String(value)), expected, `represented value ${value}`);
  }
});
