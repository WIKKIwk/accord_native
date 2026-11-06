const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/profileEditing.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);

test('empty editor nickname retains the previous name', () => {
  assert.equal(mod.exports.profileNickname('  ', 'Ali'), 'Ali');
  assert.equal(mod.exports.profileNickname(' Vali ', 'Ali'), 'Vali');
});

test('avatar save follows nickname save even when the nickname request fails', async () => {
  const calls = [];
  const result = await mod.exports.saveProfileChanges(async () => { calls.push('name'); throw Error('offline'); },
    async () => { calls.push('avatar'); }, () => true);
  assert.deepEqual(calls, ['name', 'avatar']);
  assert.equal(result, null);
  assert.equal(await mod.exports.saveProfileChanges(null, async () => { throw Error('offline'); }, () => true), 'avatar');
});

test('avatar save does not start after the session becomes inactive', async () => {
  const calls = [];
  await mod.exports.saveProfileChanges(async () => { calls.push('name'); }, async () => { calls.push('avatar'); }, () => false);
  assert.deepEqual(calls, ['name']);
});
