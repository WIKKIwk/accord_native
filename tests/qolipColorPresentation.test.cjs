const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative), loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const { qolipColorValue, qolipVisibleColor } = load('qolip/qolipColorPresentation.ts', { './qolipApiCommon': common });

test('source color parser removes first hash, trims, forces opaque and uses gray for invalid hexadecimal', () => {
  for (const [raw, expected] of [['#E53935', '#E53935'], ['  #1e88e5  ', '#1E88E5'], ['FF#00', '#00FF00'],
    ['# FF ', '#0000FF'], ['#FF123456', '#123456'], ['#-1', '#FFFFFF'], ['+1', '#000001'], ['0', '#000000'],
    ['PANTON 1', '#757575'], ['red', '#757575'], ['#', '#757575'], ['0xFF', '#757575'], ['##FF', '#757575'], ['+ FF', '#757575']]) {
    assert.equal(qolipColorValue(raw), expected, raw);
  }
});

test('explicit radix enforces signed 64-bit range without losing the low RGB bits', () => {
  for (const [raw, expected] of [['7fffffffffffffff', '#FFFFFF'], ['8000000000000000', '#757575'],
    ['-8000000000000000', '#000000'], ['-8000000000000001', '#757575'], ['000000007fffffffffffffff', '#FFFFFF'],
    ['123456789abcdef', '#ABCDEF'], ['-1000001', '#FFFFFF']]) assert.equal(qolipColorValue(raw), expected, raw);
});

test('source row suppresses only an empty trimmed color; invalid nonempty colors retain gray swatches', () => {
  assert.equal(qolipVisibleColor(''), null); assert.equal(qolipVisibleColor('\u0085 \t'), null);
  assert.equal(qolipVisibleColor(' PANTON 1 '), '#757575'); assert.equal(qolipVisibleColor(' #fff '), '#000FFF');
});
