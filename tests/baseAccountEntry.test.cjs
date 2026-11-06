const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/accountEntryLogic.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);

test('saved account names fall back from blank display name to legal name and reference', () => {
  assert.equal(mod.exports.savedAccountDisplayName({ profile: { display_name: ' ', legal_name: ' Ali ', ref: 'one' } }), 'Ali');
  assert.equal(mod.exports.savedAccountDisplayName({ profile: { display_name: '', legal_name: '', ref: 'one' } }), 'one');
});

test('worker account subtitle uses the compact apparatus label and remaining count', () => {
  const account = { profile: { role: 'aparatchi', assigned_apparatus_labels: ['Bosma apparati', 'Laminatsiya apparati'], assigned_apparatus: ['a', 'b', 'c'] } };
  assert.equal(mod.exports.savedAccountSubtitle(account), 'Bosma +2');
  assert.equal(mod.exports.savedAccountSubtitle({ profile: { role: 'aparatchi' } }), 'Aparatchi');
  assert.equal(mod.exports.savedAccountSubtitle({ profile: { role: 'werka' } }), 'Werka');
});
