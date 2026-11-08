const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaWorkerSettings.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = module.paths;
loaded.require = id => id === '../workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[^:\s]+:[^\s]+$/.test(value.trim()) } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { RezkaWorkerSettingsController, prepareAssignment } = loaded.exports;
const a = 'apparatus:default:asset-010', b = 'apparatus:default:asset-011';
const workers = [{ id: 'worker-ali', name: 'Ali', phone: '', level: 'Master' }];
const apparatus = [{ id: a, name: 'Rezka 1' }, { id: b, name: 'Rezka 2' }];
const assignment = { principal_role: 'aparatchi', principal_ref: 'worker-ali', role_id: 'aparatchi', assigned_apparatus: [a], assigned_item_groups: [] };
function setup() {
  let current = true, assignments = [assignment], calls = [], fail = null;
  const controller = new RezkaWorkerSettingsController({ isCurrent: () => current,
    loadTeam: async () => ({ workers, assignments }), loadApparatus: async () => apparatus,
    save: async (...args) => { calls.push(args); if (fail) { const value = fail; fail = null; throw value; }
      assignments = [{ ...assignment, assigned_apparatus: args[1] }]; } });
  return { controller, calls, deactivate: () => { current = false; }, fail: error => { fail = error; } };
}
test('cannot save none, open run remains on sheet, then retries and adds machine', async () => {
  const t = setup(), c = t.controller; await c.load(); c.expand('worker-ali'); c.openPicker('worker-ali');
  c.toggle(a, false); await c.save(); assert.equal(t.calls.length, 0);
  c.toggle(b, true); t.fail({ code: 'rezka_worker_has_open_run', details: [a] }); await c.save();
  assert.deepEqual(c.getSnapshot().picker.blocked, { key: 'rezka_master.rezka_worker_has_open_run_details', values: { worker: 'Ali', apparatus: 'Rezka 1' }, tone: 'error' });
  await c.save(); assert.deepEqual(t.calls[1], ['worker-ali', [b], [a]]); assert.equal(c.getSnapshot().picker, null);
  c.openPicker('worker-ali'); c.toggle(a, true); await c.save();
  assert.deepEqual(t.calls[2], ['worker-ali', [a, b], [b]]);
});
test('unchanged canonical set does not make a write', async () => {
  const t = setup(), c = t.controller; await c.load(); c.openPicker('worker-ali'); await c.save();
  assert.equal(t.calls.length, 0); assert.equal(c.getSnapshot().notice.key, 'scope.already_assigned');
  assert.equal(prepareAssignment([` ${a} `, a], assignment, apparatus).alreadySaved, true);
});
test('assignment conflict closes picker and reloads current state', async () => {
  const t = setup(), c = t.controller; await c.load(); c.openPicker('worker-ali'); c.toggle(b, true);
  t.fail({ code: 'rezka_assignment_changed' }); await c.save();
  assert.equal(c.getSnapshot().notice.key, 'rezka_master.rezka_assignment_changed'); assert.equal(c.getSnapshot().picker, null); assert.equal(c.getSnapshot().phase, 'ready');
});
test('a switched account cannot receive a stale load or completion', async () => {
  let resolveLoad; let active = true;
  const c = new RezkaWorkerSettingsController({ isCurrent: () => active, loadTeam: () => new Promise(resolve => { resolveLoad = resolve; }),
    loadApparatus: async () => apparatus, save: async () => {} });
  const pending = c.load(); active = false; resolveLoad({ workers, assignments: [assignment] }); await pending;
  assert.equal(c.getSnapshot().phase, 'loading'); assert.equal(c.getSnapshot().team, null);
  const t = setup(); await t.controller.load(); t.deactivate(); t.controller.openPicker('worker-ali'); await t.controller.save();
  assert.equal(t.calls.length, 0); assert.equal(t.controller.getSnapshot().picker, null);
});


test('reset redacts previous account while an in-flight write remains uncertain', async () => {
  let active = true, resolveSave, calls = 0;
  const c = new RezkaWorkerSettingsController({ isCurrent: () => active, loadTeam: async () => ({ workers, assignments: [assignment] }),
    loadApparatus: async () => apparatus, save: () => { calls++; return new Promise(resolve => { resolveSave = resolve; }); } });
  await c.load(); c.openPicker('worker-ali'); c.toggle(b, true); const pending = c.save();
  active = false; c.invalidate(); resolveSave(); await pending;
  assert.equal(calls, 1); assert.equal(c.getSnapshot().team, null); assert.equal(c.getSnapshot().picker, null); assert.equal(c.getSnapshot().notice, null);
});
