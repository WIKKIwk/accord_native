const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/useRezkaSplit.ts');
function setup(session) {
  const calls = [], effects = []; let controller, picker;
  class SplitController {
    constructor(deps) { this.deps = deps; this.state = { notice: null }; controller = this; }
    subscribe = () => () => {};
    getSnapshot = () => this.state;
    setPrinter(value) { calls.push(['setPrinter', value]); }
    async scan(value) { calls.push(['scan', value]); }
    resume() {} suspend() {}
    invalidate() { calls.push('invalidate'); }
    dispose() { calls.push('dispose'); }
  }
  class PickerController {
    constructor(deps) { this.deps = deps; this.state = { items: [], loading: true }; picker = this; }
    subscribe = () => () => {}; getSnapshot = () => this.state; start() {} resume() {} suspend() {} invalidate() {} dispose() {}
  }
  const api = Object.fromEntries(['rezkaSource', 'rezkaSplit', 'rezkaSplitClientPrintPrepare', 'rezkaSplitClientPrintConfirm']
    .map(name => [name, async (...args) => { calls.push([name, ...args]); return {}; }]));
  const react = { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (subscribe, get) => { const unsubscribe = subscribe(() => {}); unsubscribe(); return get(); }, useEffect: fn => effects.push(fn) };
  const mocks = { react, '../appPreferences': { appPreferences: {} }, '../shared/searchActivityStore': { SearchActivityStore: class {} }, '../auth': { activeSessionEpoch: s => s.active ? s.epoch : null, registerSessionResetHook: fn => { calls.push(['resetHook', fn]); return () => {}; }, subscribeSessionWitness: () => () => {} },
    '../shared/catalogApi': { gscaleItemsPage: async (...args) => { calls.push(['catalog', ...args]); return []; } }, '../shared/appRoutes': { appRoutes: { rezkaSplit: '/split' }, canOpenRoute: s => s.profile.role !== 'rezka_master' && s.capabilities.includes('rezka.split.manage') },
    '../shared/localization': { uiText: value => value }, '../shared/localization/runtime': { localeController: { addListener: () => () => {}, locale: 'uz' } },
    './rezkaSplitApi': api, './rezkaSessionGuard': { captureRezkaSession: s => Object.freeze({ session: s, scope: s.scope, epoch: s.epoch }),
      guardedRezkaRequest: (_s, _a, _snap, _m, send) => send(() => {}),
      isRezkaSessionCurrent: (snapshot, access) => !!snapshot && snapshot.session.active && snapshot.session.epoch === snapshot.epoch &&
        snapshot.session.scope === snapshot.scope && access === 'split' && snapshot.session.profile.role !== 'rezka_master' &&
        snapshot.session.capabilities.includes('rezka.split.manage') }, './rezkaItemPickerController': { RezkaItemPickerController: PickerController },
    './rezkaSplitController': { RezkaSplitController: SplitController } };
  const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths; mod.require = id => mocks[id] ?? require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const printer = { marker: 'device', subscribe() { assert.equal(this.marker, 'device'); return () => {}; },
    getSnapshot() { assert.equal(this.marker, 'device'); return { title: 'real', subtitle: '' }; },
    async choose() { assert.equal(this.marker, 'device'); return { transport: 'bluetooth' }; },
    async resolve() { assert.equal(this.marker, 'device'); return {}; }, async print() { assert.equal(this.marker, 'device'); return { ok: true }; } };
  const hook = mod.exports.useRezkaSplit(session, printer); effects.forEach(fn => fn());
  return { calls, hook, controller, printer, usePicker: snapshot => { mod.exports.useRezkaItemPicker(snapshot); return picker; } };
}
test('split hook binds printer bridge methods and passes the captured scope to APIs', async () => {
  const session = { active: true, token: 'x', scope: 'old', epoch: 7, profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session); assert.equal(t.hook.device.title, 'real');
  await t.controller.deps.loadSource('barcode'); await t.controller.deps.split({}); await t.controller.deps.prepare({}); await t.controller.deps.confirm({});
  assert.deepEqual(t.calls.find(x => x[0] === 'rezkaSource')[3], { session, scope: 'old', epoch: 7 });
  for (const name of ['rezkaSplit', 'rezkaSplitClientPrintPrepare', 'rezkaSplitClientPrintConfirm']) assert.deepEqual(t.calls.find(x => x[0] === name)[3], { session, scope: 'old', epoch: 7 });
  await t.hook.choosePrinter(); assert.deepEqual(t.calls.at(-1), ['setPrinter', { transport: 'bluetooth' }]);
  await t.controller.deps.resolvePrinter({}); await t.controller.deps.print({}, {});
  session.scope = 'new'; assert.equal(t.hook.isCurrent(), false); await t.hook.choosePrinter();
  assert.equal(t.calls.filter(x => Array.isArray(x) && x[0] === 'setPrinter').length, 1);
});
test('a scanner result arriving after scope change is discarded', async () => {
  const session = { active: true, token: 'x', scope: 'old', epoch: 7, profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session); let finish;
  const pending = t.hook.scan(() => new Promise(resolve => { finish = resolve; })); session.scope = 'new'; finish('QR'); await pending;
  assert.equal(t.calls.some(x => Array.isArray(x) && x[0] === 'scan'), false);
});

test('a failed-login epoch change invalidates an older split hook without changing the session object', async () => {
  const session = { active: true, token: 'x', scope: 'old', epoch: 7, profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session); session.epoch = 8;
  assert.equal(t.hook.isCurrent(), false); await t.hook.choosePrinter();
  assert.equal(t.calls.some(x => Array.isArray(x) && x[0] === 'setPrinter'), false);
});


test('item picker retains the parent view snapshot instead of recapturing after a transition', async () => {
  const session = { active: true, token: 'x', scope: 'old', epoch: 7, profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session), snapshot = t.hook.snapshot; session.epoch = 8;
  const picker = t.usePicker(snapshot); assert.equal(picker.deps.isCurrent(), false);
  await picker.deps.load('film', 30);
  assert.equal(t.calls.find(row => Array.isArray(row) && row[0] === 'catalog')[1], session);
  assert.deepEqual(t.calls.find(row => Array.isArray(row) && row[0] === 'catalog')[2], { query: 'film', limit: 30 });
  const catalog = t.calls.find(row => Array.isArray(row) && row[0] === 'catalog');
  assert.equal(typeof catalog[3], 'function'); assert.ok(catalog[4]);
});
