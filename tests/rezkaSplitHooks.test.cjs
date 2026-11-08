const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/useRezkaSplit.ts');
function setup(session) {
  const calls = [], effects = []; let controller;
  class SplitController {
    constructor(deps) { this.deps = deps; this.state = { notice: null }; controller = this; }
    subscribe = () => () => {};
    getSnapshot = () => this.state;
    setPrinter(value) { calls.push(['setPrinter', value]); }
    async scan(value) { calls.push(['scan', value]); }
    invalidate() { calls.push('invalidate'); }
    dispose() { calls.push('dispose'); }
  }
  const api = Object.fromEntries(['rezkaSource', 'rezkaSplit', 'rezkaSplitClientPrintPrepare', 'rezkaSplitClientPrintConfirm']
    .map(name => [name, async (...args) => { calls.push([name, ...args]); return {}; }]));
  const react = { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (subscribe, get) => { const unsubscribe = subscribe(() => {}); unsubscribe(); return get(); }, useEffect: fn => effects.push(fn) };
  const mocks = { react, '../auth': { activeSessionToken: s => s.active ? s.token : null, registerSessionResetHook: fn => { calls.push(['resetHook', fn]); return () => {}; } },
    '../shared/catalogApi': {}, '../shared/appRoutes': { appRoutes: { rezkaSplit: '/split' }, canOpenRoute: s => s.profile.role !== 'rezka_master' && s.capabilities.includes('rezka.split.manage') },
    '../shared/localization': { uiText: value => value }, '../shared/localization/runtime': { localeController: { addListener: () => () => {}, locale: 'uz' } },
    './rezkaSplitApi': api, './rezkaSessionGuard': { currentRezkaScope: s => s.scope }, './rezkaItemPickerController': {},
    './rezkaSplitController': { RezkaSplitController: SplitController } };
  const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths; mod.require = id => mocks[id] ?? require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const printer = { marker: 'device', subscribe() { assert.equal(this.marker, 'device'); return () => {}; },
    getSnapshot() { assert.equal(this.marker, 'device'); return { title: 'real', subtitle: '' }; },
    async choose() { assert.equal(this.marker, 'device'); return { transport: 'bluetooth' }; },
    async resolve() { assert.equal(this.marker, 'device'); return {}; }, async print() { assert.equal(this.marker, 'device'); return { ok: true }; } };
  const hook = mod.exports.useRezkaSplit(session, printer); effects.forEach(fn => fn());
  return { calls, hook, controller, printer };
}
test('split hook binds printer bridge methods and passes the captured scope to APIs', async () => {
  const session = { active: true, token: 'x', scope: 'old', profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session); assert.equal(t.hook.device.title, 'real');
  await t.controller.deps.loadSource('barcode'); await t.controller.deps.split({}); await t.controller.deps.prepare({}); await t.controller.deps.confirm({});
  assert.equal(t.calls.find(x => x[0] === 'rezkaSource')[3], 'old');
  for (const name of ['rezkaSplit', 'rezkaSplitClientPrintPrepare', 'rezkaSplitClientPrintConfirm']) assert.equal(t.calls.find(x => x[0] === name)[3], 'old');
  await t.hook.choosePrinter(); assert.deepEqual(t.calls.at(-1), ['setPrinter', { transport: 'bluetooth' }]);
  await t.controller.deps.resolvePrinter({}); await t.controller.deps.print({}, {});
  session.scope = 'new'; assert.equal(t.hook.isCurrent(), false); await t.hook.choosePrinter();
  assert.equal(t.calls.filter(x => Array.isArray(x) && x[0] === 'setPrinter').length, 1);
});
test('a scanner result arriving after scope change is discarded', async () => {
  const session = { active: true, token: 'x', scope: 'old', profile: { role: 'admin' }, capabilities: ['rezka.split.manage'] };
  const t = setup(session); let finish;
  const pending = t.hook.scan(() => new Promise(resolve => { finish = resolve; })); session.scope = 'new'; finish('QR'); await pending;
  assert.equal(t.calls.some(x => Array.isArray(x) && x[0] === 'scan'), false);
});
