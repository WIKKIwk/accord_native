const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/logoutSavedSession.ts'), loaded = new Module(filename, module);
loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
test('saved session logout skips empty tokens and sends a trimmed token directly', async () => {
  const original = global.fetch; let sent;
  global.fetch = async (url, init) => { sent = { url, ...init }; return { status: 401 }; };
  try {
    await loaded.exports.logoutSavedSession('  ', 'https://example.test'); assert.equal(sent, undefined);
    await loaded.exports.logoutSavedSession(' token ', 'https://example.test');
    assert.equal(sent.url, 'https://example.test/v1/mobile/auth/logout'); assert.equal(sent.headers.Authorization, 'Bearer token');
  } finally { global.fetch = original; }
});
