const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/rezka/rezkaWorkerController.ts'), loaded = new Module(file, module);
loaded.filename = file; loaded.paths = module.paths;
loaded.require = id => id === '../workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[^:\s]+:[^\s]+$/.test(value.trim()) } :
  id === './rezkaSessionGuard' ? { RezkaScopeChanged: class extends Error { constructor(mayHaveExecuted) { super('scope'); this.mayHaveExecuted = mayHaveExecuted; } } } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { RezkaWorkerSettingsController, RezkaWorkerWriteLocks, prepareAssignment } = loaded.exports;
const locking = (writeLocks = new RezkaWorkerWriteLocks()) => ({ writeLocks, lockKey: id => `account:${id}` });
const a = 'apparatus:default:asset-010', b = 'apparatus:default:asset-011';
const workers = [{ id: 'worker-ali', name: 'Ali', phone: '', level: 'Master' }];
const apparatus = [{ id: a, name: 'Rezka 1' }, { id: b, name: 'Rezka 2' }];
const assignment = { principal_role: 'aparatchi', principal_ref: 'worker-ali', role_id: 'aparatchi', assigned_apparatus: [a], assigned_item_groups: [] };
function setup() {
  let current = true, assignments = [assignment], calls = [], fail = null;
  const controller = new RezkaWorkerSettingsController({ ...locking(), isCurrent: () => current, canWrite: () => true,
    loadTeam: async () => ({ workers, assignments }), loadApparatus: async () => apparatus,
    save: async (...args) => { calls.push(args); if (fail) { const value = fail; fail = null; throw value; }
      assignments = [{ ...assignment, assigned_apparatus: args[1] }]; } });
  return { controller, calls, deactivate: () => { current = false; }, fail: error => { fail = error; } };
}
test('cannot save none, open run remains on sheet, then retries and adds machine', async () => {
  const t = setup(), c = t.controller; await c.load(); c.expand('worker-ali'); c.openPicker('worker-ali');
  c.toggle(a, false); await c.save(); assert.equal(t.calls.length, 0);
  c.toggle(b, true); t.fail({ code: 'rezka_worker_has_open_run', statusCode: 409, details: [a] }); await c.save();
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
  t.fail({ code: 'rezka_assignment_changed', statusCode: 409 }); await c.save();
  assert.equal(c.getSnapshot().notice.key, 'rezka_master.rezka_assignment_changed'); assert.equal(c.getSnapshot().picker, null); assert.equal(c.getSnapshot().phase, 'ready');
});
test('a switched account cannot receive a stale load or completion', async () => {
  let resolveLoad; let active = true;
  const c = new RezkaWorkerSettingsController({ ...locking(), isCurrent: () => active, canWrite: () => true, loadTeam: () => new Promise(resolve => { resolveLoad = resolve; }),
    loadApparatus: async () => apparatus, save: async () => {} });
  const pending = c.load(); active = false; resolveLoad({ workers, assignments: [assignment] }); await pending;
  assert.equal(c.getSnapshot().phase, 'loading'); assert.equal(c.getSnapshot().team, null);
  const t = setup(); await t.controller.load(); t.deactivate(); t.controller.openPicker('worker-ali'); await t.controller.save();
  assert.equal(t.calls.length, 0); assert.equal(t.controller.getSnapshot().picker, null);
});


test('reset redacts previous account while an in-flight write remains uncertain', async () => {
  let active = true, resolveSave, calls = 0;
  const c = new RezkaWorkerSettingsController({ ...locking(), isCurrent: () => active, canWrite: () => true, loadTeam: async () => ({ workers, assignments: [assignment] }),
    loadApparatus: async () => apparatus, save: () => { calls++; return new Promise(resolve => { resolveSave = resolve; }); } });
  await c.load(); c.openPicker('worker-ali'); c.toggle(b, true); const pending = c.save();
  active = false; c.invalidate(); resolveSave(); await pending;
  assert.equal(calls, 1); assert.equal(c.getSnapshot().team, null); assert.equal(c.getSnapshot().picker, null); assert.equal(c.getSnapshot().notice, null);
});
test('platform dismissal during save does not reopen a blocked sheet or allow duplicate writes', async () => {
  let rejectSave, calls = 0;
  const c = new RezkaWorkerSettingsController({ ...locking(), isCurrent: () => true, canWrite: () => true, loadTeam: async () => ({ workers, assignments: [assignment] }),
    loadApparatus: async () => apparatus, save: () => { calls++; return new Promise((_, reject) => { rejectSave = reject; }); } });
  await c.load(); c.openPicker('worker-ali'); c.toggle(b, true); const pending = c.save();
  c.closePicker(); assert.ok(c.getSnapshot().picker, 'the in-sheet close control is disabled while saving');
  c.dismissPicker(); assert.equal(c.getSnapshot().picker, null);
  c.openPicker('worker-ali'); assert.equal(c.getSnapshot().picker, null, 'the same worker remains busy');
  rejectSave({ code: 'rezka_worker_has_open_run', statusCode: 409, details: [a] }); await pending;
  assert.equal(calls, 1); assert.equal(c.getSnapshot().picker, null); assert.deepEqual(c.getSnapshot().savingIds, []);
});

test('read-only shell cannot open an assignment picker or write', async () => {
  let calls = 0;
  const c = new RezkaWorkerSettingsController({ ...locking(), isCurrent: () => true, canWrite: () => false,
    loadTeam: async () => ({ workers, assignments: [assignment] }), loadApparatus: async () => apparatus, save: async () => { calls++; } });
  await c.load(); c.openPicker('worker-ali'); await c.save();
  assert.equal(c.getSnapshot().picker, null); assert.equal(calls, 0);
});

test('unknown assignment outcome remains locked across reopened screens and never reports success', async () => {
  const locks = new RezkaWorkerWriteLocks(); let sends = 0;
  const deps = { ...locking(locks), isCurrent: () => true, canWrite: () => true,
    loadTeam: async () => ({ workers, assignments: [assignment] }), loadApparatus: async () => apparatus,
    save: async () => { sends++; throw new Error('request timed out'); } };
  const stale = new RezkaWorkerSettingsController(deps); await stale.load(); stale.openPicker('worker-ali');
  const first = new RezkaWorkerSettingsController(deps); await first.load(); first.openPicker('worker-ali'); first.toggle(b, true); await first.save();
  assert.equal(sends, 1); assert.equal(first.getSnapshot().notice.key, 'scope.outcome_unknown');
  assert.equal(first.getSnapshot().picker.blocked.key, 'scope.outcome_unknown'); assert.equal(first.isWriteLocked('worker-ali'), true);
  first.toggle(b, false);
  assert.deepEqual(first.getSnapshot().picker.selected, [a, b], 'an uncertain assignment cannot be edited');
  assert.equal(first.getSnapshot().picker.blocked.key, 'scope.outcome_unknown', 'the warning stays visible');
  await first.save(); assert.equal(sends, 1);
  assert.equal(first.getSnapshot().notice.key, 'scope.outcome_unknown', 'locked or stale saves never announce success');
  await stale.save();
  assert.equal(stale.getSnapshot().notice.key, 'scope.outcome_unknown', 'unchanged selections cannot mask another screen’s uncertain write');
  assert.equal(stale.getSnapshot().picker.blocked.key, 'scope.outcome_unknown'); assert.equal(sends, 1);
  const reopened = new RezkaWorkerSettingsController(deps); await reopened.load(); reopened.openPicker('worker-ali');
  assert.equal(reopened.getSnapshot().picker, null); assert.equal(reopened.getSnapshot().notice.key, 'scope.outcome_unknown'); assert.equal(sends, 1);
});

test('an account switch during an assignment leaves an uncertain cross-screen lock', async () => {
  const locks = new RezkaWorkerWriteLocks(); let active = true, release, sends = 0;
  const deps = { ...locking(locks), isCurrent: () => active, canWrite: () => active,
    loadTeam: async () => ({ workers, assignments: [assignment] }), loadApparatus: async () => apparatus,
    save: () => { sends++; return new Promise(resolve => { release = resolve; }); } };
  const first = new RezkaWorkerSettingsController(deps); await first.load(); first.openPicker('worker-ali'); first.toggle(b, true);
  const pending = first.save(); active = false; first.invalidate(); release(); await pending;
  assert.equal(sends, 1); assert.equal(locks.status('account:worker-ali'), 'uncertain'); assert.equal(first.getSnapshot().notice, null);
  active = true; const reopened = new RezkaWorkerSettingsController(deps); await reopened.load(); reopened.openPicker('worker-ali');
  assert.equal(reopened.getSnapshot().picker, null); assert.equal(reopened.getSnapshot().notice.key, 'scope.outcome_unknown');
});
