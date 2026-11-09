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
const model = load('admin/adminActivityModel', { '../shared/localization': l10n });
const store = { loadingActivity: false, loadedActivity: false, activityError: null, activityItems: [] };
test('activity displays loading and retry only before initial load and without visible rows', () => {
  assert.equal(model.adminActivityViewState({ ...store, loadingActivity: true }, new Set()), 'loading');
  assert.equal(model.adminActivityViewState({ ...store, activityError: new Error('offline') }, new Set()), 'error');
  assert.equal(model.adminActivityViewState({ ...store, loadedActivity: true, activityError: new Error('offline') }, new Set()), 'empty');
  const populated = { ...store, loadingActivity: true, activityItems: [{ id: 'A' }, { id: 'B' }] };
  assert.equal(model.adminActivityViewState(populated, new Set(['B'])), 'list');
  assert.equal(model.adminActivityViewState(populated, new Set(['A', 'B'])), 'loading');
  assert.deepEqual(model.adminActivityVisibleItems(populated.activityItems, new Set(['B'])), [{ id: 'A' }]);
  assert.deepEqual(model.adminActivityClearIds(populated.activityItems), ['A', 'B']);
});
test('activity push refresh only accepts new admin events', () => {
  assert.equal(model.adminActivityShouldRefresh('admin', 2, 1), true);
  assert.equal(model.adminActivityShouldRefresh('admin', 2, 2), false);
  assert.equal(model.adminActivityShouldRefresh('supplier', 3, 2), false);
});
test('activity badge icons follow all V2 dispatch statuses', () => {
  assert.deepEqual(['draft', 'pending', 'accepted', 'partial', 'rejected', 'cancelled'].map(model.adminActivityStatusIcon),
    ['schedule_rounded', 'schedule_outlined', 'done_all_rounded', 'check_rounded', 'close_rounded', 'remove_rounded']);
});
test('activity quantity text uses V2 locale strings and fixed-digit rounding', () => {
  assert.equal(model.adminActivityMetricLine({ sent_qty: 12.5, accepted_qty: 2.5, uom: 'kg' }, 'uz'), '13 kg jo‘natildi • 3 kg qabul qilindi');
  assert.equal(model.adminActivityMetricLine({ sent_qty: 12.5, accepted_qty: 2.5, uom: 'kg' }, 'en'), '13 kg sent • 3 kg accepted');
  assert.equal(model.adminActivityMetricLine({ sent_qty: 12.5, accepted_qty: 2.5, uom: 'kg' }, 'ru'), 'Отправлено: 13 kg • принято: 3 kg');
  assert.equal(model.adminActivityMetricLine({ sent_qty: 12.5, accepted_qty: 2.5, uom: 'kg' }, 'ur'), '13 kg بھیجے گئے • 3 kg قبول کیے گئے');
  assert.equal(model.adminActivityMetricLine({ sent_qty: -0, accepted_qty: 0, uom: 'm' }, 'en'), '-0 m sent');
  assert.equal(model.adminActivityMetricLine({ sent_qty: 1.5, accepted_qty: -1, uom: 'kg' }, 'ru'), 'Отправлено: 2 kg');
  const values = [0, -0, 0.5, -0.5, 1.5, -1.5, 2.5, 12.49, 12.5, -0.01, 1e21];
  const expected = ['0', '-0', '1', '-1', '2', '-2', '3', '12', '13', '-0', '1e+21'];
  assert.deepEqual(values.map(sent_qty => model.adminActivityMetricLine({ sent_qty, accepted_qty: 0, uom: 'kg' }, 'en')),
    expected.map(value => `${value} kg sent`));
});
