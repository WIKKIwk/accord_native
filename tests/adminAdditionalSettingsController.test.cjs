const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/admin/additionalSettingsController.ts');
const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { AdditionalSettingsController } = mod.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  const calls = []; let current = true, scope = 'A', allowed = true, operator = false;
  let paddon = { free_movement_enabled: false, worker_visibility_enabled: false };
  let app = false, lamination = { print_wip_remainder_labels: true, print_film_remainder_labels: true };
  let qolip = { automatic_confirmation_enabled: false, revision: 1 };
  const deps = { isCurrent: () => current, scope: () => scope, canOpen: () => allowed, isOperator: () => operator,
    readPaddon: async () => { calls.push('readPaddon'); return paddon; },
    writePaddon: async change => { calls.push(['writePaddon', change]); paddon = { ...paddon,
      ...(change.freeMovementEnabled == null ? {} : { free_movement_enabled: change.freeMovementEnabled }),
      ...(change.workerVisibilityEnabled == null ? {} : { worker_visibility_enabled: change.workerVisibilityEnabled }) }; return paddon; },
    readAppUpdate: async () => { calls.push('readApp'); return app; }, writeAppUpdate: async value => { calls.push(['writeApp', value]); return app = value; },
    readLamination: async () => { calls.push('readLamination'); return lamination; },
    writeLamination: async change => { calls.push(['writeLamination', change]); lamination = { ...lamination,
      ...(change.printWipRemainderLabels == null ? {} : { print_wip_remainder_labels: change.printWipRemainderLabels }),
      ...(change.printFilmRemainderLabels == null ? {} : { print_film_remainder_labels: change.printFilmRemainderLabels }) }; return lamination; },
    readQolip: async () => { calls.push('readQolip'); return qolip; }, writeQolip: async value => { calls.push(['writeQolip', value]);
      qolip = { automatic_confirmation_enabled: value, revision: qolip.revision + 1 }; return qolip; } };
  return { deps, calls, setCurrent: value => { current = value; }, setScope: value => { scope = value; },
    setAllowed: value => { allowed = value; }, setOperator: value => { operator = value; } };
}
test('admin loads paddon before independent cards and keeps server values', async () => {
  const f = fixture(), controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  assert.deepEqual(f.calls, ['readPaddon', 'readApp', 'readLamination', 'readQolip']);
  const state = controller.getSnapshot(); assert.equal(state.screen, 'content'); assert.equal(state.operator, false);
  assert.equal(state.appUpdate.value, false); assert.equal(state.lamination.value.print_wip_remainder_labels, true);
  assert.equal(state.qolip.value.revision, 1); assert.equal(state.paddon.value.free_movement_enabled, false);
});
test('rezka operator reads only paddon settings, forbidden roles do not read', async () => {
  const f = fixture(); f.setOperator(true); const controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  assert.deepEqual(f.calls, ['readPaddon']); assert.equal(controller.getSnapshot().operator, true);
  controller.setAppUpdate(true); controller.setQolip(true); await tick(); assert.deepEqual(f.calls, ['readPaddon']);
  const g = fixture(); g.setAllowed(false); const forbidden = new AdditionalSettingsController(g.deps); forbidden.start();
  assert.equal(forbidden.getSnapshot().screen, 'forbidden'); assert.deepEqual(g.calls, []);
});
test('enabling free movement requires confirmation and rechecks identity, scope and role after it', async () => {
  const f = fixture(), controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  controller.requestFreeMovement(true); assert.equal(controller.getSnapshot().confirmFreeMovement, true);
  controller.resolveFreeMovement(false); await tick(); assert.equal(f.calls.filter(Array.isArray).length, 0);
  controller.requestFreeMovement(true); f.setScope('B'); controller.resolveFreeMovement(true); await tick();
  assert.equal(f.calls.filter(Array.isArray).length, 0);
  f.setScope('A'); controller.requestFreeMovement(true); f.setAllowed(false); controller.resolveFreeMovement(true); await tick();
  assert.equal(f.calls.filter(Array.isArray).length, 0);
  f.setAllowed(true); controller.requestFreeMovement(true); f.setCurrent(false); controller.resolveFreeMovement(true); await tick();
  assert.equal(f.calls.filter(Array.isArray).length, 0);
  f.setCurrent(true); controller.requestFreeMovement(true); controller.resolveFreeMovement(true); await tick();
  assert.deepEqual(f.calls.at(-1), ['writePaddon', { freeMovementEnabled: true }]);
  assert.equal(controller.getSnapshot().paddon.value.free_movement_enabled, true);
  controller.requestFreeMovement(false); await tick();
  assert.deepEqual(f.calls.at(-1), ['writePaddon', { freeMovementEnabled: false }]);
});
test('stale async work is dropped after account reset, including a pending confirmation', async () => {
  const f = fixture(), pending = deferred(); f.deps.readPaddon = () => pending.promise;
  const controller = new AdditionalSettingsController(f.deps); controller.start(); f.setCurrent(false); controller.invalidate();
  pending.resolve({ free_movement_enabled: true, worker_visibility_enabled: true }); await tick();
  assert.equal(controller.getSnapshot().screen, 'forbidden'); assert.equal(controller.getSnapshot().paddon.value, null);
  f.setCurrent(true); controller.start(); await tick(); controller.requestFreeMovement(true);
  f.setCurrent(false); controller.invalidate(); controller.resolveFreeMovement(true); await tick();
  assert.equal(f.calls.filter(Array.isArray).length, 0);
});
test('card save failure shows V2 message and rereads authoritative value', async () => {
  const f = fixture(), controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  f.deps.writeAppUpdate = async () => { f.calls.push('failedWrite'); throw new Error('timeout'); };
  controller.setAppUpdate(true); await tick();
  assert.equal(controller.getSnapshot().appUpdate.value, false);
  assert.equal(controller.getSnapshot().appUpdate.busy, false);
  assert.deepEqual(controller.getSnapshot().notice, { source: 'getter', key: 'appUpdateSettingsSaveFailed', serial: 1 });
  assert.equal(f.calls.filter(call => call === 'readApp').length, 2);
});
test('refresh during a card write reconciles again after a stale write finishes', async () => {
  const f = fixture(), pending = deferred(); let serverValue = false;
  f.deps.readAppUpdate = async () => { f.calls.push('readApp'); return serverValue; };
  f.deps.writeAppUpdate = async value => { f.calls.push(['writeApp', value]); await pending.promise; serverValue = value; return value; };
  const controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  controller.setAppUpdate(true); await controller.refresh(); await tick();
  assert.equal(controller.getSnapshot().appUpdate.value, false);
  pending.resolve(); await tick(); await tick();
  assert.equal(controller.getSnapshot().appUpdate.value, true);
  assert.equal(f.calls.filter(call => call === 'readApp').length, 3);
});

test('scope is checked again immediately before sending after state listeners run', async () => {
  const f = fixture(), controller = new AdditionalSettingsController(f.deps); controller.start(); await tick();
  controller.subscribe(() => { if (controller.getSnapshot().paddon.busy) f.setScope('B'); });
  controller.requestFreeMovement(true); controller.resolveFreeMovement(true); await tick();
  assert.equal(f.calls.filter(Array.isArray).length, 0);
});
