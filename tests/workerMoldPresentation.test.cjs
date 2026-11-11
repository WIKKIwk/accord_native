const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const file = path.resolve(__dirname, '../src/workerMoldPresentation.ts'), mod = new Module(file, module);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { workerMoldPresentation: present, workerMoldBlockingText, workerMoldCountText } = mod.exports;
const empty = { automatic: true, status: 'ready', requiredQolips: [], scannedCodes: [], sets: [], validation: {} };

test('loaded automatic empty requirements show the source warning and zero-over-zero counter', () => {
  for (const blocking_reason_code of ['', 'qolip_scan_required']) {
    const state = present({ ...empty, validation: { blocking_reason_code } });
    assert.equal(state.titleKey, 'worker.molds'); assert.equal(state.countNumber, '0/0'); assert.equal(state.countKind, 'progress');
    assert.equal(state.expandable, false); assert.deepEqual(state.blocking, { key: 'worker.mold.requirements.empty' });
  }
});

test('automatic loading, failed reads and other server reasons never become an empty-mold warning', () => {
  assert.deepEqual(present({ ...empty, status: 'loading' }).blocking, { key: 'qolip.start.auto.checking' });
  assert.deepEqual(present({ ...empty, status: 'error', readError: 'Server detail' }).blocking, { message: 'Server detail' });
  assert.deepEqual(present({ ...empty, status: 'error' }).blocking, { key: 'qolip.start.auto.unavailable' });
  assert.deepEqual(present({ ...empty, validation: null }).blocking, { key: 'qolip.start.auto.unavailable' });
  assert.deepEqual(present({ ...empty, validation: { blocking_reason_code: 'qolip_in_rework' } }).blocking,
    { reason: 'qolip_in_rework', fallbackKey: 'qolip.start.auto.blocked' });
});

test('automatic counters use selected-set ready members plus shared extensions independently of overall confirmation', () => {
  const requiredQolips = [
    { qolip_set_id: 'A', ready: true }, { qolip_set_id: 'A', ready: true, blocking_reason_code: 'qolip_in_use' },
    { qolip_set_id: 'B', ready: true }, { is_extension: true, ready: true },
  ];
  const input = { ...empty, requiredQolips, sets: [{ set_id: 'A' }, { set_id: 'B' }], selectedSetId: 'A', confirmed: false };
  const partial = present(input); assert.equal(partial.countNumber, '2/3'); assert.equal(partial.titleKey, 'worker.molds');
  assert.equal(partial.molds.length, 3); assert.equal(partial.expandable, true);
  assert.equal(present({ ...input, status: 'loading' }).countNumber, '0/3');
  const choosing = present({ ...input, selectedSetId: null });
  assert.equal(choosing.titleKey, 'worker.mold.alternatives'); assert.equal(choosing.countKind, 'sets'); assert.equal(choosing.countNumber, '2');
  assert.deepEqual(choosing.blocking, { key: 'qolip.start.auto.choose_set' });
  assert.equal(present({ ...input, confirmed: true }).blocking, null);
});

test('manual empty requirements keep the source empty header and simple count without automatic red warning', () => {
  const manual = present({ ...empty, automatic: false });
  assert.equal(manual.manualStatusKey, 'worker.mold.requirements.empty'); assert.equal(manual.countKind, 'molds');
  assert.equal(manual.countNumber, '0'); assert.equal(manual.blocking, null); assert.equal(manual.expandable, false);
  assert.equal(present({ ...empty, automatic: false, status: 'loading' }).manualStatusKey, 'worker.mold.requirements.loading');
  assert.equal(present({ ...empty, automatic: false, status: 'error', readError: 'Read failed' }).manualStatusText, 'Read failed');
});

test('automatic blocking uses source production reasons and the automatic fallback, not the mold-management mapper', () => {
  const p = key => key, rework = key => `rework:${key}`;
  const format = reason => workerMoldBlockingText({ reason, fallbackKey: 'qolip.start.auto.blocked' }, p, rework);
  for (const [reason, key] of [
    ['QOLIP_POLICY_CHANGED', 'qolip.start.auto.settings_changed'],
    ['qolip_confirmation_invalid', 'qolip.start.auto.unknown_state'],
    ['qolip_automatic_confirmation_invalid', 'qolip.start.auto.unknown_state'],
    ['qolip_set_changed', 'qolip.start.auto.set_changed'],
    ['qolip_automatic_confirmation_unavailable', 'qolip.start.auto.unavailable'],
    ['qolip_scan_incomplete', 'worker.error.scan_molds'],
    ['apparatus_busy', 'worker.waiting.apparatus_busy'],
    ['order_frozen', 'worker.freeze.active'],
    ['qolip_in_rework', 'rework:order_unavailable'],
  ]) assert.equal(format(` ${reason} `), key);
  for (const reason of ['qolip_in_use', 'qolip_checkout_required', 'qolip_scan_required', 'future_reason', '__proto__', '']) {
    assert.equal(format(reason), 'qolip.start.auto.blocked');
  }
  assert.equal(workerMoldBlockingText({ key: 'worker.mold.requirements.empty' }, p, rework), 'worker.mold.requirements.empty');
  assert.equal(workerMoldBlockingText({ message: 'Server read detail' }, p, rework), 'Server read detail');
  assert.equal(workerMoldBlockingText(null, p, rework), '');
});

test('mold counters retain source progress, alternative-set and productionCount(0) language suffixes', () => {
  const catalog = require('../src/shared/localization/catalog.json').production;
  for (const [locale, language, suffix] of [['uz-UZ', 'uz', 'ta'], ['en', 'en', 'molds'], ['ru_RU', 'ru', 'форм'], ['ur', 'ur', 'مولڈز']]) {
    const p = (key, values = {}) => Object.entries(values).reduce((s, [name, value]) => s.replace(`{${name}}`, value), catalog[key][language]);
    assert.equal(workerMoldCountText(present(empty), locale, p), language === 'uz' ? '0/0 ta' : '0/0');
    assert.equal(workerMoldCountText(present({ ...empty, automatic: false }), locale, p), `0 ${suffix}`);
    assert.equal(workerMoldCountText(present({ ...empty, automatic: false, scannedCodes: ['one'] }), locale, p), `1 ${suffix}`);
    const sets = present({ ...empty, sets: [{ set_id: 'A' }, { set_id: 'B' }] });
    assert.equal(workerMoldCountText(sets, locale, p), `2 ${catalog['worker.mold.set_unit'][language]}`);
    const manualAlternatives = present({ ...empty, automatic: false, requiredQolips: [{ qolip_set_id: 'A' }, { qolip_set_id: 'B' }], scannedCodes: ['one'] });
    assert.equal(workerMoldCountText(manualAlternatives, locale, p), `1/2 ${catalog['worker.mold.set_unit'][language]}`, 'manual alternative progress keeps the source set-unit suffix');
  }
});
