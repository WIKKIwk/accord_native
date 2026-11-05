const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/requireToken.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded.require = id => id === './auth' ? { activeSessionToken: session => session.token } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
test('require token trims valid tokens and rejects missing values', () => {
  assert.equal(loaded.exports.requireToken({ token: ' abc ' }), 'abc');
  assert.throws(() => loaded.exports.requireToken({ token: ' ' }), /No session token/);
});
