const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const catalog = require('../src/shared/localization/catalog.json');
const l10n = load('shared/localization/index', { './catalog.json': catalog });
const model = load('admin/additionalSettingsViewModel', { '../shared/localization': l10n });
const golden = require('./contracts/f11910bb/admin_additional_l10n_probe.json');
const card = value => ({ value, busy: false, failed: false });
const state = { screen: 'content', operator: false, paddon: card({ free_movement_enabled: false, worker_visibility_enabled: true }),
  appUpdate: card(false), lamination: card({ print_wip_remainder_labels: true, print_film_remainder_labels: false }),
  qolip: card({ automatic_confirmation_enabled: false, revision: 2 }), confirmFreeMovement: false, confirmationSerial: 0, notice: null };
// Source-derived locally authored f119 oracle probe, not an upstream V2 test.
test('additional settings catalog strings match f119 in four supported languages', () => {
  assert.equal(golden.baseline, fs.readFileSync(path.resolve(__dirname, '../docs/port/V2_BASELINE'), 'utf8').trim());
  for (const [locale, value] of Object.entries(golden.locales)) {
    for (const [key, expected] of Object.entries(value.getters)) assert.equal(l10n.localizedGetter(key, locale), expected, `${locale} ${key}`);
    for (const [key, expected] of Object.entries(value.production)) assert.equal(l10n.productionText(key, locale), expected, `${locale} ${key}`);
    assert.equal(value.forbidden, '');
  }
});
test('admin and brigader see ordered cards; rezka operator sees only Paddon switches', () => {
  assert.deepEqual(model.additionalSettingsCards(state, 'uz').map(item => item.id), ['appUpdate', 'freeMovement', 'workerVisibility', 'lamination', 'qolip']);
  assert.deepEqual(model.additionalSettingsCards({ ...state, operator: true }, 'uz').map(item => item.id), ['freeMovement', 'workerVisibility']);
  assert.deepEqual(model.additionalSettingsCards({ ...state, screen: 'loading' }, 'uz'), []);
});
test('unloaded, busy and failed cards are disabled with V2 initial values', () => {
  const cards = model.additionalSettingsCards({ ...state, appUpdate: { value: null, busy: true, failed: false },
    lamination: { value: null, busy: false, failed: true }, paddon: { ...state.paddon, busy: true } }, 'en');
  assert.equal(cards[0].rows[0].value, false); assert.equal(cards[0].rows[0].enabled, false);
  assert.equal(cards[1].rows[0].enabled, false); assert.equal(cards[2].rows[0].enabled, false);
  assert.ok(cards[3].rows.every(row => row.value === true && !row.enabled));
  assert.equal(cards[3].error, l10n.productionText('lamination.settings.load_failed', 'en'));
});
test('notices use existing localized getters or production catalog', () => {
  assert.equal(model.additionalSettingsNotice({ source: 'getter', key: 'settingsSaved', serial: 1 }, 'uz'), l10n.localizedGetter('settingsSaved', 'uz'));
  assert.equal(model.additionalSettingsNotice({ source: 'production', key: 'paddon.management.settings.failed', serial: 2 }, 'en'),
    l10n.productionText('paddon.management.settings.failed', 'en'));
});

test('shared action dispatch reaches the intended controller method', () => {
  const calls = [], controller = Object.fromEntries(['setAppUpdate', 'requestFreeMovement', 'setWorkerVisibility', 'setLaminationWip', 'setLaminationFilm', 'setQolip']
    .map(name => [name, value => calls.push([name, value])]));
  for (const action of ['appUpdate', 'freeMovement', 'workerVisibility', 'laminationWip', 'laminationFilm', 'qolip']) model.changeAdditionalSetting(controller, action, true);
  assert.deepEqual(calls.map(call => call[0]), ['setAppUpdate', 'requestFreeMovement', 'setWorkerVisibility', 'setLaminationWip', 'setLaminationFilm', 'setQolip']);
});
