const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/useRezkaWorkerSettings.ts');
test('master settings hook keeps the captured session, epoch and scope for reads and writes', async () => {
  const calls = [], effects = []; let controller;
  class Controller {
    constructor(deps) { this.deps = deps; this.state = { notice: null }; controller = this; }
    subscribe = () => () => {};
    getSnapshot = () => this.state;
    async load() { calls.push('load'); }
    resume() {} suspend() {}
    invalidate() { calls.push('invalidate'); }
    dispose() { calls.push('dispose'); }
  }
  const session = { active: true, epoch: 5, scope: 'scope-a', profile: { role: 'rezka_master' } };
  const react = { useCallback: fn => fn, useMemo: fn => fn(), useRef: value => ({ current: value }),
    useSyncExternalStore: (subscribe, get) => { const done = subscribe(() => {}); done(); return get(); }, useEffect: fn => effects.push(fn) };
  const mocks = { react, '../auth': { activeSessionEpoch: s => s.active ? s.epoch : null, registerSessionResetHook: () => () => {}, subscribeSessionWitness: () => () => {} },
    '../apparatusApi': { adminApparatus: async (...args) => { calls.push(['apparatus', ...args]); return []; } },
    '../shared/localization': { adminText: key => key }, '../shared/localization/runtime': { localeController: { addListener: () => () => {}, locale: 'uz' } },
    './rezkaMasterApi': { rezkaMasterWorkers: async (...args) => { calls.push(['workers', ...args]); return {}; },
      rezkaMasterAssignWorker: async (...args) => { calls.push(['save', ...args]); } },
    './rezkaSessionGuard': { currentRezkaScope: s => s.scope, guardedRezkaRequest: (_s, _a, _snap, _m, send) => send(() => {}),
      isRezkaSessionCurrent: (snapshot, access) => snapshot.session.active && snapshot.epoch === snapshot.session.epoch &&
        snapshot.scope === snapshot.session.scope && access === 'master' && snapshot.session.profile.role === 'rezka_master' },
    './rezkaWorkerController': { RezkaWorkerSettingsController: Controller, rezkaWorkerWriteLocks: {} } };
  const mod = new Module(file, module); mod.filename = file; mod.paths = module.paths; mod.require = id => mocks[id] ?? require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  const supplied = Object.freeze({ session, scope: 'scope-a', epoch: 5 });
  mod.exports.useRezkaWorkerSettings(session, supplied, true); effects.forEach(fn => fn());
  assert.equal(controller.deps.isCurrent(), true);
  await controller.deps.loadTeam(); await controller.deps.loadApparatus(); await controller.deps.save('w', ['a'], ['b']);
  const snapshot = calls.find(row => Array.isArray(row) && row[0] === 'workers')[2];
  assert.equal(snapshot, supplied); assert.deepEqual(snapshot, { session, scope: 'scope-a', epoch: 5 });
  assert.equal(controller.deps.canWrite(), true);
  assert.equal(calls.find(row => Array.isArray(row) && row[0] === 'save')[5], snapshot);
  const apparatusOptions = calls.find(row => Array.isArray(row) && row[0] === 'apparatus')[2];
  assert.equal(apparatusOptions.limit, 500); assert.equal(typeof apparatusOptions.beforeSend, 'function');
  session.epoch++; assert.equal(controller.deps.isCurrent(), false);
});
