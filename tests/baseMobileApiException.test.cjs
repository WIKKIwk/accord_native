const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/mobileApiException.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { MobileApiException } = mod.exports;

test('mobile API errors preserve the V2 fields and message-only string', () => {
  const error = new MobileApiException({ code: 'blocked', message: 'Band', statusCode: 409, details: ['x'],
    activeKadrCount: 2, scannedKadrCount: 1, orderTitle: 'Order', requestId: 'req', diagnostics: { key: 2 } });
  assert.equal(String(error), 'Band'); assert.equal(error.statusCode, 409); assert.deepEqual(error.details, ['x']);
  assert.equal(error.activeKadrCount, 2); assert.equal(error.scannedKadrCount, 1); assert.equal(error.orderTitle, 'Order');
  assert.equal(error.requestId, 'req'); assert.deepEqual(error.diagnostics, { key: 2 });
  const empty = new MobileApiException({ code: 'x', message: '' });
  assert.equal(empty.statusCode, null); assert.deepEqual(empty.apparatusOptions, []); assert.equal(empty.activeKadrCount, null); assert.equal(empty.orderTitle, '');
});
