const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/loginLogic.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { loginCodeUsesNumericKeyboard, bootstrapSession } = mod.exports;

test('login code keyboard follows V2 prefixes', () => {
  for (const input of ['', ' ', ' 4 ', '40ABC', ' 50x', '80', '92']) assert.equal(loginCodeUsesNumericKeyboard(input), true, input);
  for (const input of ['41', '70ABCDEF', 'abc', '1x']) assert.equal(loginCodeUsesNumericKeyboard(input), false, input);
});

test('bootstrap refreshes local sessions but retains them on failure or timeout', async () => {
  const session = { token: 'token' }; let refreshed = 0;
  assert.equal(await bootstrapSession(async () => null, async () => { refreshed++; }, () => true), null);
  assert.equal(await bootstrapSession(async () => session, async value => { assert.equal(value, session); refreshed++; throw new Error('offline'); }, () => true), session);
  assert.equal(refreshed, 1);
  assert.equal(await bootstrapSession(async () => session, () => new Promise(() => {}), () => true, 1), session);
  assert.equal(await bootstrapSession(async () => session, async () => {}, () => false), null);
  assert.equal(await bootstrapSession(async () => ({ token: 'test-mode-token' }), async () => { throw new Error('must not refresh'); }, () => true).then(x => x.token), 'test-mode-token');
});
