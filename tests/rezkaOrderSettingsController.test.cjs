const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
class RezkaScopeChanged extends Error { constructor(mayHaveExecuted) { super('scope'); this.mayHaveExecuted = mayHaveExecuted; } }
class WorkerControlException extends Error { constructor(code, statusCode = 409) { super(code); this.code = code; this.statusCode = statusCode; } }
const file = path.resolve(__dirname, '../src/rezka/rezkaOrderSettingsController.ts'), mod = new Module(file, module);
mod.filename = file; mod.paths = module.paths;
mod.require = id => id === './rezkaSessionGuard' ? { RezkaScopeChanged } : id === '../workerControlsApi' ? { WorkerControlException } : require(id);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { RezkaOrderSettingsController: Controller, RezkaOrderWriteLocks: Locks } = mod.exports;
const initial = { duplicateLabels: false, includeBobina: false, standardPrintSide: true };
function setup({ locks = new Locks(), showWorkOptions = true } = {}) {
  const calls = []; let current = true, reject = null, release = null, wait = false, saved = 0;
  const c = new Controller(initial, showWorkOptions, { isCurrent: () => current, locks, lockKey: 'server/account/order',
    saveOptions: async (next, previous) => { calls.push(['options', next, previous]); if (wait) await new Promise(resolve => { release = resolve; }); if (reject) throw reject; },
    savePrintSide: async (next, previous) => { calls.push(['side', next, previous]); if (wait) await new Promise(resolve => { release = resolve; }); if (reject) throw reject; },
    onSaved: () => saved++ });
  return { c, calls, locks, deactivate: () => { current = false; }, fail: value => { reject = value; }, saved: () => saved,
    wait: () => { wait = true; }, release: () => release() };
}
const save = async (c, option, enabled) => { const ticket = c.request(option, enabled); assert.ok(ticket); await c.confirm(ticket); };
test('f119 cancel is no write; consecutive confirmed changes send next and previous values', async () => {
  const t = setup(), ticket = t.c.request('duplicateLabels', true); assert.ok(ticket); assert.equal(t.c.request('includeBobina', true), null);
  t.c.cancel(ticket); await t.c.confirm(ticket); assert.equal(t.calls.length, 0);
  await save(t.c, 'duplicateLabels', true); await save(t.c, 'includeBobina', true); await save(t.c, 'duplicateLabels', false);
  assert.deepEqual(t.calls.map(row => [row[1].duplicateLabels, row[1].includeBobina, row[2].duplicateLabels, row[2].includeBobina]),
    [[true, false, false, false], [true, true, true, false], [false, true, true, true]]);
  assert.equal(t.saved(), 3); assert.equal(t.c.getSnapshot().values.includeBobina, true);
  await save(t.c, 'printSide', false); assert.deepEqual(t.calls.at(-1), ['side', false, true]);
});
test('print-side only state hides the other two actions', async () => {
  const t = setup({ showWorkOptions: false }); assert.equal(t.c.request('duplicateLabels', true), null); assert.equal(t.c.request('includeBobina', true), null);
  await save(t.c, 'printSide', false); assert.equal(t.saved(), 1);
});
test('only the explicitly rejected active-run error permits another attempt; conflicts require reopen', async () => {
  const t = setup(); t.fail(new WorkerControlException('rezka_weight_mode_run_active')); await save(t.c, 'includeBobina', true);
  assert.deepEqual(t.c.getSnapshot().error, { kind: 'admin', key: 'rezka_master.rezka_weight_mode_run_active' });
  assert.equal(t.c.getSnapshot().needsReopen, false); assert.equal(t.locks.status('server/account/order'), null);
  t.fail(new WorkerControlException('rezka_order_settings_changed')); await save(t.c, 'includeBobina', true);
  assert.equal(t.c.getSnapshot().needsReopen, true); assert.equal(t.c.request('printSide', false), null);
  const p = setup(); p.fail(new WorkerControlException('print_side_changed')); await save(p.c, 'printSide', false);
  assert.deepEqual(p.c.getSnapshot().error, { kind: 'production', key: 'order.print_side.changed' }); assert.equal(p.c.getSnapshot().needsReopen, true);
});
test('in-flight and uncertain result block other instances and never automatically resend or report success', async () => {
  const locks = new Locks(), a = setup({ locks }), b = setup({ locks }); a.wait();
  const ticket = a.c.request('duplicateLabels', true), pending = a.c.confirm(ticket);
  assert.equal(locks.status('server/account/order'), 'sending'); assert.equal(b.c.request('printSide', false), null);
  assert.equal(b.c.getSnapshot().error.kind, 'uncertain'); a.fail(new Error('timeout')); a.release(); await pending;
  assert.equal(locks.status('server/account/order'), 'uncertain'); assert.equal(a.c.getSnapshot().needsReopen, true);
  assert.equal(a.calls.length, 1); assert.equal(a.saved(), 0);
  const reopened = setup({ locks }); assert.equal(reopened.c.request('includeBobina', true), null); assert.equal(reopened.calls.length, 0);
});
test('an already-sent request after account or epoch change remains uncertain and never updates the old screen', async () => {
  const t = setup(); t.wait(); const ticket = t.c.request('printSide', false), pending = t.c.confirm(ticket);
  t.deactivate(); t.c.invalidate(); t.release(); await pending;
  assert.equal(t.calls.length, 1); assert.equal(t.saved(), 0); assert.equal(t.c.getSnapshot().values, null);
  assert.equal(t.locks.status('server/account/order'), 'uncertain');
});
test('pre-send scope rejection releases its lock while uncertain or unrecognized exceptions retain it', async () => {
  const t = setup(); t.fail(new RezkaScopeChanged(false)); await save(t.c, 'printSide', false); assert.equal(t.locks.status('server/account/order'), null);
  const u = setup(); u.fail(new RezkaScopeChanged(true)); await save(u.c, 'printSide', false); assert.equal(u.locks.status('server/account/order'), 'uncertain');
  const v = setup(); v.fail(new WorkerControlException('rezka_weight_mode_run_active', 500)); await save(v.c, 'printSide', false);
  assert.equal(v.locks.status('server/account/order'), 'uncertain');
});
test('unmounted screen cannot confirm an open native dialog and does not receive delayed success', async () => {
  const t = setup(); const ticket = t.c.request('printSide', false); t.c.suspend(); await t.c.confirm(ticket);
  assert.equal(t.calls.length, 0); t.c.resume(); t.c.cancel(ticket);
  t.wait(); const next = t.c.request('printSide', false), pending = t.c.confirm(next); t.c.suspend(); t.release(); await pending;
  assert.equal(t.calls.length, 1); assert.equal(t.saved(), 0); assert.equal(t.locks.status('server/account/order'), null);
});
