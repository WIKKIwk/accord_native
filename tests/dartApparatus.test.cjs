const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const controls = compile('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} });
const { dartTrim, isAscii, isAsciiCanonicalApparatusId } = compile('shared/dartApparatus', { '../workerControlsApi': controls });
const oracle = require('./contracts/f11910bb/material_unicode_trim.json');

test('Dart-compatible trim handles every whitespace scalar recorded by the f119 Dart oracle', () => {
  for (const codepoint of oracle.trim) {
    const value = String.fromCodePoint(codepoint);
    assert.equal(dartTrim(`${value}value${value}`), 'value', `U+${codepoint.toString(16)}`);
    assert.equal(dartTrim(value), '');
    assert.equal(dartTrim(`a${value}b`), `a${value}b`);
  }
  for (const codepoint of [0x180e, 0x200b, 0x2060, 0x037f]) {
    const value = String.fromCodePoint(codepoint); assert.equal(dartTrim(`${value}x${value}`), `${value}x${value}`);
  }
});

test('canonical apparatus helper reuses the existing validator while withholding unverified Unicode IDs', () => {
  const ascii = 'apparatus:default:asset-007';
  assert.equal(isAsciiCanonicalApparatusId(`\u0085${ascii}\u0085`), true);
  for (const value of ['', 'APPARATUS:DEFAULT:ASSET-007', 'apparatus:default:', 'apparatus:default:ab c',
    'apparatus:default:\u037f', 'apparatus:default:\u0130', 'apparatus:default:\u212a']) {
    assert.equal(isAsciiCanonicalApparatusId(value), false, value);
  }
  assert.equal(isAscii('ascii'), true); assert.equal(isAscii('\u0085'), false);
});
