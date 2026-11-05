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
  assert.match(catalog.baseline, /^7c87a54e/);
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
