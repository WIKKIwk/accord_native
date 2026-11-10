const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/dailyWorkCorrection.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const api = loaded.exports;
const session = { profile: { role: 'aparatchi', ref: 'me' } };
const batch = (extra = {}) => ({ id: 'b', unit: 'm', source: { batch_id: 'b', revision: 3, wip_status: 'waiting', worker_ref: 'me',
  produced_qty: 100, finished_goods_meter: 100, finished_goods_kg: 50, bobina_kg: 5, diameter: 200, description: ' old ', ...extra } });

test('only waiting WIP is editable; Rezka master is restricted to its own worker', () => {
  assert.equal(api.canCorrectDailyWip(session, batch({ worker_ref: 'other' })), true);
  for (const status of ['in_use', 'processed', 'used', '']) assert.equal(api.canCorrectDailyWip(session, batch({ wip_status: status })), false);
  const master = { profile: { role: 'rezka_master', ref: 'me' } };
  assert.equal(api.canCorrectDailyWip(master, batch()), true);
  assert.equal(api.canCorrectDailyWip(master, batch({ worker_ref: 'other' })), false);
});

test('operation-specific fields preserve V2 conditional weights, waste and leftover rules', () => {
  const keys = (op, extra = {}) => api.dailyWipCorrectionFields(batch(extra), op).map(row => row.key);
  assert.deepEqual(keys('print'), ['meter', 'finished_goods_kg', 'bobina_kg']);
  assert.deepEqual(keys(' CUT ', { payload_json: { include_bobina_in_net: true } }), ['meter', 'finished_goods_kg', 'diameter']);
  assert(keys('print', { return_ink_kg: 0 }).includes('return_ink_kg'));
  assert(keys('laminate', { lamination_film_leftover_rolls: 2 }).includes('lamination_film_leftover_rolls'));
  assert(keys('glue', { lamination_print_leftover_rolls: 3 }).includes('lamination_print_leftover_rolls'));
  assert(!keys('print', { lamination_film_leftover_rolls: 2 }).includes('lamination_film_leftover_rolls'));
  const cut = api.dailyWipCorrectionFields(batch({ total_waste: 5 }), 'cut');
  assert.equal(cut.find(row => row.key === 'total_waste').required, true);
  assert.equal(cut.find(row => row.key === 'rezka_edge_waste').required, false);
  assert.deepEqual(keys('other'), ['meter']);
});

// @v2-test test/aparatchi_daily_work_test.dart
test('prefilled edit validates kg/bobina, decimal commas and a mandatory reason before one revisioned save', async () => {
  const h = harness(); h.controller.open(h.row);
  assert.equal(h.controller.getSnapshot().edit.values.diameter, '200');
  h.controller.change('meter', '120,5'); h.controller.change('bobina_kg', '808'); h.controller.next();
  assert.equal(h.controller.getSnapshot().edit.error.key, 'worker.progress.qty.bobina_exceeds_gross');
  h.controller.change('bobina_kg', '5'); h.controller.next();
  assert.equal(h.controller.getSnapshot().edit.step, 'reason');
  await h.controller.confirm(); assert.equal(h.writes.length, 0);
  assert.equal(h.controller.getSnapshot().edit.error.key, 'worker.daily.correction.required');
  h.controller.reason('  Metraj noto‘g‘ri  '); await h.controller.confirm();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].expected_revision, 3);
  assert.equal(h.writes[0].produced_qty, 120.5); assert.equal(h.writes[0].finished_goods_meter, 120.5);
  assert.equal(h.writes[0].reason, 'Metraj noto‘g‘ri'); assert.equal(h.writes[0].diameter, 200);
  assert.equal(h.writes[0].description, 'old'); assert.equal(h.replaced.length, 1);
  assert.equal(h.controller.getSnapshot().notice, 'worker.daily.wip_updated');
});

// @v2-test test/roll_weight_validation_test.dart
test('tare-only corrections retain measured gross and compare weight at six decimal places', () => {
  assert.equal(api.correctedDailyGross(10, 10, 12), 12);
  assert.equal(api.correctedDailyGross(10, 10.0000002, 12), 12);
  assert.equal(api.correctedDailyGross(10, 9, 12), 9);
  assert.equal(api.correctedDailyGross(10, null, 12), null);
  assert.equal(api.correctedDailyGross(10, 10, 'invalid'), null);
  assert.equal(api.correctedDailyGross(10, 10, null), 10);
  const row = batch({ finished_goods_kg: 10, payload_json: { gross_qty: 12 } });
  const fields = api.dailyWipCorrectionFields(row, 'print'), values = api.dailyWipCorrectionValues(row);
  values.bobina_kg = '12'; assert.equal(api.dailyWipCorrectionError(row, fields, values), null);
  values.bobina_kg = '12.0000001'; assert.equal(api.dailyWipCorrectionError(row, fields, values), null);
  values.bobina_kg = '12.000001'; assert.equal(api.dailyWipCorrectionError(row, fields, values).message.key, 'worker.progress.qty.bobina_exceeds_gross');
  values.finished_goods_kg = '9'; values.bobina_kg = '11'; assert(api.dailyWipCorrectionError(row, fields, values));
});

test('required and optional visible values must be finite and positive; hidden metrics are retained', () => {
  const row = batch({ total_waste: 1, return_ink_kg: 3 }), fields = api.dailyWipCorrectionFields(row, 'cut'), values = api.dailyWipCorrectionValues(row);
  for (const input of ['', '0', '1,2,3', '1e999']) {
    values.meter = input; assert(api.dailyWipCorrectionError(row, fields, values));
  }
  values.meter = '100'; values.rezka_edge_waste = '0'; assert(api.dailyWipCorrectionError(row, fields, values));
  values.rezka_edge_waste = ''; assert.equal(api.dailyWipCorrectionError(row, fields, values), null);
  assert.equal(api.dailyWipCorrectionInput(row, values, 'reason').return_ink_kg, 3);
});

function harness() {
  const h = { row: batch(), valid: true, writes: [], replaced: [], reconciles: 0 };
  h.save = async input => ({ ...h.row.source, ...input, revision: 4 });
  h.controller = new api.DailyWorkCorrectionController({ current: () => h.valid, canEdit: row => api.canCorrectDailyWip(session, row),
    latest: () => h.row, operation: () => 'cut', save: (input, current) => { if (!current()) throw new Error('stale'); h.writes.push(input); return h.save(input, current); },
    replace: value => h.replaced.push(value), reconcile: () => h.reconciles++ });
  h.ready = () => { h.controller.open(h.row); h.controller.next(); h.controller.reason('reason'); };
  return h;
}

test('cancel and stale or consumed WIP never write, including a revision changed while the reason form is open', async () => {
  const h = harness(); h.ready(); h.controller.cancel(); await h.controller.confirm(); assert.equal(h.writes.length, 0);
  h.ready(); h.row = batch({ revision: 4 }); await h.controller.confirm(); assert.equal(h.writes.length, 0);
  h.ready(); h.row = batch({ revision: 4, wip_status: 'in_use' }); await h.controller.confirm(); assert.equal(h.writes.length, 0);
  h.row = batch(); h.ready(); h.valid = false; await h.controller.confirm(); assert.equal(h.writes.length, 0);
});

test('pending save locks repeat taps and editor cancellation; lost response reconciles without retry', async () => {
  const h = harness(); let reject; h.save = () => new Promise((_, failure) => { reject = failure; }); h.ready();
  const pending = h.controller.confirm(); await h.controller.confirm(); h.controller.cancel(); h.controller.open(h.row);
  assert.equal(h.controller.getSnapshot().edit.step, 'saving'); assert.equal(h.writes.length, 1);
  reject(new Error('lost response')); await pending;
  assert.equal(h.writes.length, 1); assert.equal(h.replaced.length, 0); assert.equal(h.reconciles, 1);
  assert.equal(h.controller.getSnapshot().notice, 'worker.daily.correction_failed');
});

test('retired account cannot be revived by scope ABA and does not apply a late save', async () => {
  const h = harness(); let resolve; h.save = () => new Promise(success => { resolve = success; }); h.ready();
  const pending = h.controller.confirm(); h.controller.invalidate(); h.valid = true; h.controller.open(h.row);
  resolve(h.row.source); await pending;
  assert.equal(h.controller.getSnapshot().edit, null); assert.equal(h.replaced.length, 0); assert.equal(h.writes.length, 1);
});
