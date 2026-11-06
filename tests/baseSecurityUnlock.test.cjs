const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/shared/securityUnlockRuntime.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);

test('login unlock applies once and only to the authenticated session', () => {
  const first = {}, other = {};
  mod.exports.unlockAfterLogin(first);
  assert.equal(mod.exports.consumeLoginUnlock(other), false);
  assert.equal(mod.exports.consumeLoginUnlock(first), true);
  assert.equal(mod.exports.consumeLoginUnlock(first), false);
});
