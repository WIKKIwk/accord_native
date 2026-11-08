const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/localization/index.ts');
const catalog = require('../src/shared/localization/catalog.json');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod.require = name => name === './catalog.json' ? catalog : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { localizedGetter, localizedMethod, productionText, adminText, extensionText, uiText, LocaleController } = mod.exports;

test('baseline catalog provides static strings in four V2 locales', () => {
  assert.equal(catalog.baseline, fs.readFileSync(path.resolve(__dirname, '../docs/port/V2_BASELINE'), 'utf8').trim());
  assert.equal(localizedGetter('loginFailed', 'uz'), 'Kirish muvaffaqiyatsiz');
  assert.equal(localizedGetter('loginFailed', 'en'), 'Login failed');
  assert.equal(localizedGetter('loginFailed', 'ru'), 'Не удалось войти');
  assert.equal(localizedGetter('loginFailed', 'ur-PK'), 'لاگ اِن ناکام ہو گیا');
  assert.equal(localizedGetter('loginFailed', 'fr'), 'Login failed');
  assert.throws(() => localizedGetter('missing', 'uz'), /Unknown localization getter/);
});

test('parameterized methods and table strings substitute V2 placeholders', () => {
  assert.equal(localizedMethod('accountPinPrompt', 'uz', { name: 'Ali' }), 'Ali uchun PIN kiriting');
  assert.equal(localizedMethod('accountPinPrompt', 'ur', { name: 'Ali' }), 'Ali کے لیے PIN درج کریں');
  assert.equal(productionText('worker.queue.empty.orders', 'en', { apparatus: 'A' }), 'No orders for A');
  assert.equal(adminText('action.add', 'ru'), 'Добавить');
  assert.equal(extensionText('qolipManagementText', 'matches', 'en', { count: 3 }), 'Matching sets (3)');
  assert.equal(productionText('unknown', 'uz'), 'unknown');
  assert.equal(localizedMethod('appUpdateDownloadProgress', 'en', { downloadedMb: 1.25, totalMb: 10 }), '1.3 / 10.0 MB');
  assert.equal(localizedMethod('archiveTotalByUomLabel', 'uz', { qty: 1.5, uom: 'kg' }), '1.50 kg');
  assert.equal(localizedMethod('sentToCustomerLine', 'en', { qty: 2, uom: 'kg' }), '2.00 kg sent to customer');
});

test('conditional localization methods retain V2 locale and fallback rules', () => {
  assert.equal(localizedMethod('statusWithName', 'en', { name: 'A', status: 'Open' }), 'Open • A');
  assert.equal(localizedMethod('receiptCountLabel', 'uz', { count: 3 }), '3 ta receipt');
  assert.equal(localizedMethod('receiptCountLabel', 'ru', { count: 3 }), '3 receipts');
  assert.equal(localizedMethod('recordCountLabel', 'ur', { count: 2 }), '2 ریکارڈ');
  assert.equal(localizedMethod('customerFlowMetric', 'en', { qty: 4.2, uom: 'kg' }), '4 kg sent to customer');
  assert.equal(localizedMethod('acceptedQtyLabel', 'uz', { qty: 2, uom: 'kg' }), 'Qabul: 2 kg');
  assert.equal(localizedMethod('adminRoleKindLabel', 'en', { system: true }), 'system');
  assert.equal(localizedMethod('adminRoleKindLabel', 'en', { system: false }), 'custom');
  assert.equal(localizedMethod('adminTelegramQrError', 'en', { code: 'invalid_password' }), 'Incorrect Telegram password. Try again.');
  assert.equal(localizedMethod('adminTelegramQrError', 'en', { code: 'other' }), 'Could not connect to Telegram. Try again.');
  assert.equal(localizedMethod('recordsLoadFailedWith', 'en', { error: 'ignored' }), 'Server disconnected. Try again.');
  assert.equal(localizedMethod('productionCount', 'en', { count: 1, kind: 'molds' }), '1 mold');
  assert.equal(localizedMethod('productionCount', 'en', { count: 2, kind: 'materials' }), '2 materials');
  assert.equal(localizedMethod('qolipQuantityShort', 'uz', { count: 3 }), '3 ta');
  assert.equal(localizedMethod('qolipCount', 'uz', { count: 3 }), '3 ta qolip');
  assert.equal(localizedMethod('adminCapabilityLabel', 'en', { code: 'production.map.read', fallback: '?' }), 'View work map');
  assert.equal(localizedMethod('adminCapabilityLabel', 'en', { code: 'missing', fallback: 'Fallback' }), 'Fallback');
  assert.equal(localizedMethod('systemRoleLabel', 'en', { id: '  CUSTOMER ', fallback: '?' }), localizedGetter('customerRoleName', 'en'));
  assert.equal(localizedMethod('roleLabelForCode', 'en', { code: 'unknown' }), 'unknown');
  assert.equal(localizedMethod('qolipColorName', 'en', { raw: ' qizil ' }), productionText('qolip.color.red', 'en'));
  assert.equal(localizedMethod('qolipColorName', 'en', { raw: ' custom ' }), ' custom ');
});

test('locale selection defaults to Uzbek and persists explicit Urdu', async () => {
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => data.set(key, value) };
  const controller = new LocaleController(storage); let notifications = 0;
  controller.addListener(() => { notifications++; }); await controller.load();
  assert.equal(controller.locale, 'uz'); assert.equal(controller.hasExplicitSelection, false);
  await controller.setLocale('ur-PK'); assert.equal(controller.locale, 'ur-PK');
  assert.equal(controller.isUrdu, true); assert.equal(data.get('app_locale_code'), 'ur');
  await controller.setLocale('ur-PK'); assert.equal(notifications, 2);
  const restored = new LocaleController(storage); await restored.load(); assert.equal(restored.locale, 'ur-PK');
});


test('Urdu UI text translates literal, interpolated and English fallback strings', () => {
  assert.equal(uiText('4 xonali PIN kiriting', 'ur-PK'), 'اپنا 4 ہندسوں کا PIN درج کریں');
  assert.equal(uiText('Ali uchun PIN kiriting', 'ur'), 'Ali کے لیے PIN درج کریں');
  assert.equal(uiText('Login failed', 'ur'), 'لاگ اِن ناکام ہو گیا');
  assert.equal(uiText('4 xonali PIN kiriting', 'uz'), '4 xonali PIN kiriting');
});
