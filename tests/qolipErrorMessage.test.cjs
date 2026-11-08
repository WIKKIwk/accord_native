const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', name), m = new Module(filename, module);
  m.require = key => key in dependencies ? dependencies[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return m.exports;
}
const { MobileApiException } = load('shared/mobileApiException.ts');
const common = load('qolip/qolipApiCommon.ts', { '../shared/mobileApiException': { MobileApiException } });
const localization = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const { qolipErrorMessage } = load('qolip/qolipErrorMessage.ts', { '../shared/localization': localization,
  '../shared/mobileApiException': { MobileApiException }, './qolipApiCommon': common });
const error = code => new MobileApiException({ code, message: 'server detail' });
test('Qolip errors select localized block keys and never expose server text by default', () => {
  for (const code of ['block_in_use', 'block_exists', 'block_not_found', 'forbidden', 'unauthorized']) {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      assert.equal(qolipErrorMessage(error(code), locale, 'fallback'), localization.productionText(`qolip.error.${code}`, locale));
    }
  }
  assert.equal(qolipErrorMessage(error('unexpected'), 'en', 'Could not update the block'), 'Could not update the block');
});
test('Qolip error handling retains special localization, case and substring behavior', () => {
  assert.equal(qolipErrorMessage(error('qolip_set_changed'), 'en'), localization.extensionText('qolipSharedSetText', 'changed', 'en'));
  assert.equal(qolipErrorMessage(error('session_scope_changed'), 'ru'), localization.extensionText('qolipReworkText', 'session_changed', 'ru'));
  assert.equal(qolipErrorMessage(error('  QOLIP_HISTORY_LOCKED  '), 'en'), localization.extensionText('qolipReworkText', 'history_locked', 'en'));
  assert.equal(qolipErrorMessage(error('server-insufficient_stock-other'), 'en'), localization.productionText('qolip.error.insufficient_stock', 'en'));
  assert.equal(qolipErrorMessage(error('server-INSUFFICIENT_STOCK-other'), 'en'), 'Joyda yetarli qolip qolmadi');
});
