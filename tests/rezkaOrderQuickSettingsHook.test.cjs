const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks) {
  const file = path.resolve(__dirname, '../src/rezka', name), mod = new Module(file, module);
  mod.filename = file; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
test('order hook preserves the parent snapshot and forwards V2 previous/new values', async () => {
  const calls = [], effects = []; let controller;
  class Controller { constructor(values, show, deps) { this.values = values; this.show = show; this.deps = deps; controller = this; }
    subscribe = () => () => {}; getSnapshot = () => ({}); resume() {} suspend() {} invalidate() {} dispose() {} }
  const react = { useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: fn => effects.push(fn),
    useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = { react, '../auth': { registerSessionResetHook: () => () => {}, subscribeSessionWitness: () => () => {} },
    '../shared/localization': { adminText: key => key, localizedGetter: key => key, productionText: key => key },
    '../shared/localization/runtime': { localeController: { addListener: () => () => {}, locale: 'uz' } },
    './rezkaMasterApi': { rezkaMasterSaveOrderSettings: async (...args) => { calls.push(['options', ...args]); } },
    './rezkaPrintSide': { rezkaMasterSavePrintSideGuarded: async (...args) => { calls.push(['side', ...args]); } },
    './rezkaSessionGuard': { isRezkaSessionCurrent: s => s.session.epoch === s.epoch },
    './rezkaOrderSettingsController': { RezkaOrderSettingsController: Controller, rezkaOrderWriteLocks: {} } };
  const { useRezkaOrderSettings } = load('useRezkaOrderSettings.ts', mocks);
  const session = { epoch: 3, baseUrl: 'https://example.test', profile: { role: 'rezka_master', ref: 'm' } };
  const snapshot = { session, epoch: 3, scope: 'old' }, map = { id: 'o', duplicate_rezka_labels: null,
    include_bobina_in_net: null, standard_print_side: null }, entry = { kind: 'watch' };
  useRezkaOrderSettings({ snapshot, map, entry, onSaved: () => calls.push(['saved']) }, true); effects.forEach(fn => fn());
  assert.deepEqual(controller.values, { duplicateLabels: false, includeBobina: false, standardPrintSide: true });
  await controller.deps.saveOptions({ duplicateLabels: true, includeBobina: false }, { duplicateLabels: false, includeBobina: true });
  await controller.deps.savePrintSide(false, true); controller.deps.onSaved();
  assert.deepEqual(calls[0], ['options', session, 'o', true, false, false, true, snapshot]);
  assert.deepEqual(calls[1], ['side', session, 'o', false, true, snapshot]); assert.deepEqual(calls[2], ['saved']);
  session.epoch = 4; assert.equal(controller.deps.isCurrent(), false);
});
test('confirmation uses V2 labels, supports cancel and does not confirm a dismissed ticket', async () => {
  const calls = []; let alert;
  const ctrl = { ticket: null, request: (option, enabled) => ctrl.ticket = { option, enabled },
    cancel: ticket => { if (ctrl.ticket === ticket) ctrl.ticket = null; calls.push('cancel'); },
    confirm: async ticket => { if (ctrl.ticket === ticket) calls.push('confirm'); } };
  const { showRezkaOrderConfirmation } = load('rezkaOrderQuickSettingsCommon.ts', { 'react-native': { Alert: { alert: (...args) => { alert = args; } } },
    './rezkaOrderEligibility': {}, './rezkaSessionGuard': {} });
  const text = { title: () => 'Tasdiqlash', confirmation: () => 'Savol', production: key => key === 'worker.action.cancel' ? 'Bekor qilish' : 'Tasdiqlash' };
  showRezkaOrderConfirmation(ctrl, 'printSide', false, text); assert.equal(alert[0], 'Tasdiqlash'); assert.equal(alert[1], 'Savol');
  assert.equal(alert[2][0].text, 'Bekor qilish'); alert[2][0].onPress(); alert[2][1].onPress(); assert.deepEqual(calls, ['cancel']);
  showRezkaOrderConfirmation(ctrl, 'printSide', false, text); alert[2][1].onPress(); assert.deepEqual(calls, ['cancel', 'confirm']);
});
