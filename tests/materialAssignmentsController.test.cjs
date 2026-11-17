const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(name, mocks = {}) {
  const file = path.resolve(__dirname, `../src/material/${name}.ts`), mod = new Module(file, module);
  mod.filename = file; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
const { MaterialAssignmentsController, materialAssignmentKey } = compile('materialAssignmentsController', {
  '../shared/barcode/rawMaterialBarcode': { rawMaterialBarcodeFromQr: raw => raw.trim() },
  '../shared/productionMapAuthorizedApparatus': { productionMapAuthorizedOrderApparatus: map => map.apparatus },
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const apparatus = 'apparatus:default:one', other = 'apparatus:default:two';
const order = id => ({ map: { id, apparatus: [apparatus, other] } });
const assignment = (barcode = 'RM', order_id = 'zakaz-1') => ({ order_id, barcode, apparatus, stock_status: 'available', consumed_qty: 0 });
const lookup = (barcode, assigned = null) => ({ barcode, assignment: assigned, status: 'available', reserved_order_id: '', order: null, queue_states: {}, logs: [] });
function setup(changes = {}, initial = '') {
  let active = true;
  const sends = [], dep = {
    current: () => active, assignedApparatus: [apparatus, other], text: key => key,
    orders: async () => [order('zakaz-1'), order('zakaz-2')], assignments: async () => [], apparatus: async () => [],
    candidates: async () => [], lookup: async barcode => lookup(barcode), diagnostic: async () => ({ compatible: true }),
    assign: async (id, barcode, machine) => { sends.push({ id, barcode, machine }); return assignment(barcode, id); },
    unlink: async row => { sends.push({ unlink: materialAssignmentKey(row) }); }, ...changes,
  };
  return { controller: new MaterialAssignmentsController(dep, initial), sends, retire: () => { active = false; } };
}

// @v2-test test/admin_raw_material_api_test.dart
test('source initialization chooses first order/apparatus and manual candidates; initial QR loads only scan flow', async () => {
  const reads = [], a = setup({ candidates: async (...args) => { reads.push(args); return []; } });
  await a.controller.start();
  assert.equal(a.controller.getSnapshot().selectedOrderId, 'zakaz-1');
  assert.equal(a.controller.getSnapshot().selectedApparatus, apparatus);
  assert.deepEqual(reads, [['zakaz-1', apparatus]]);
  const scans = [], b = setup({ candidates: async () => { throw Error('manual must not load'); }, lookup: async code => { scans.push(code); return lookup(code); } }, ' RM ');
  await b.controller.start(' RM ');
  assert.equal(b.controller.getSnapshot().tab, 'qr'); assert.deepEqual(scans, ['RM']);
  assert.equal(b.controller.getSnapshot().lookup.barcode, 'RM');
});

test('late scan and diagnostic results cannot replace a later scanned material', async () => {
  const a = deferred(), b = deferred(), s = setup({ lookup: code => code === 'A' ? a.promise : b.promise });
  await s.controller.start();
  const first = s.controller.scan('A'), second = s.controller.scan('B');
  b.resolve(lookup('B')); await second; a.resolve(lookup('A')); await first;
  assert.equal(s.controller.getSnapshot().lookup.barcode, 'B'); assert.equal(s.controller.getSnapshot().scanLoading, false);
});

test('initial QR lookup starts while source list reads are still pending', async () => {
  const pending = deferred(), scans = [], s = setup({ orders: () => pending.promise,
    lookup: async code => { scans.push(code); return lookup(code); } }, 'RM');
  const start = s.controller.start('RM'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(scans, ['RM']); pending.resolve([order('zakaz-1')]); await start;
});

test('old candidate reads cannot replace a newly selected apparatus window', async () => {
  const old = deferred(); let calls = 0;
  const s = setup({ candidates: async (id, machine) => { if (++calls === 1) return old.promise; return [{ barcode: machine }]; } });
  const start = s.controller.start(); await new Promise(resolve => setImmediate(resolve));
  // Source ignores apparatus selection while its candidate request is loading.
  s.controller.selectApparatus(other); assert.equal(s.controller.getSnapshot().selectedApparatus, apparatus);
  old.resolve([]); await start;
  s.controller.selectApparatus(other); await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.controller.getSnapshot().candidates[0].barcode, other);
});

test('scanned assignment retries only source ambiguity with the chosen apparatus, clears scan on success', async () => {
  let sends = 0; const values = [];
  const s = setup({ assign: async (id, code, machine) => { sends++; values.push(machine);
    if (sends === 1) throw Object.assign(Error('choose'), { code: 'raw_material_group_ambiguous', diagnostics: { apparatus_options: [apparatus, other] } });
    return assignment(code, id);
  } });
  await s.controller.start(); await s.controller.scan(' RM ');
  await s.controller.save(async options => { assert.deepEqual(options, [apparatus, other]); return other; });
  assert.deepEqual(values, ['', other]); assert.equal(s.controller.getSnapshot().barcode, '');
  assert.equal(s.controller.getSnapshot().assignments[0].barcode, 'RM'); assert.equal(s.controller.getSnapshot().notice, 'raw_material.assigned');
});

test('cancelled ambiguity and transport failure do not emit a second write', async () => {
  let attempts = 0; const s = setup({ assign: async () => { attempts++; throw Object.assign(Error('choose'),
    { code: 'raw_material_group_ambiguous', diagnostics: { apparatus_options: [apparatus] } }); } });
  await s.controller.start(); await s.controller.scan('RM'); await s.controller.save(async () => null);
  assert.equal(attempts, 1); assert.equal(s.controller.getSnapshot().notice, 'raw_material.assign_cancelled');
  const t = setup({ assign: async () => { throw Error('timeout'); } });
  await t.controller.start(); await t.controller.scan('RM'); let choices = 0;
  await t.controller.save(async () => { choices++; return apparatus; }); assert.equal(choices, 0);
  assert.equal(t.controller.getSnapshot().notice, 'raw_material.assign_failed');
});

test('manual candidate confirmation precedes apparatus choice and assigns exact selected apparatus', async () => {
  const events = [], s = setup({ assign: async (id, code, machine) => { events.push(['assign', id, code, machine]); return assignment(code, id); } });
  await s.controller.start();
  await s.controller.assignCandidate({ barcode: 'RM', apparatus_options: [apparatus, other] }, async () => { events.push('confirm'); return true; },
    async () => { events.push('choose'); return other; });
  assert.deepEqual(events, ['confirm', 'choose', ['assign', 'zakaz-1', 'RM', other]]);
  await s.controller.assignCandidate({ barcode: 'X', apparatus_options: [apparatus] }, async () => false, async () => { throw Error('cancelled'); });
  assert.equal(events.length, 3);
});

test('unlink removes exact source identity and clears scanned order/assignment only after confirmation', async () => {
  const row = assignment('RM'), s = setup({ assignments: async () => [row, assignment('rm')], lookup: async code => lookup(code, row) });
  await s.controller.start(); await s.controller.scan('RM');
  await s.controller.unlink(row, async () => false); assert.equal(s.controller.getSnapshot().assignments.length, 2);
  await s.controller.unlink(row, async () => true);
  assert.equal(s.controller.getSnapshot().assignments.length, 1); assert.equal(s.controller.getSnapshot().assignments[0].barcode, 'rm');
  assert.equal(s.controller.getSnapshot().lookup.assignment, null); assert.equal(s.controller.getSnapshot().lookup.status, 'available');
});

test('account retirement during a picker blocks dispatch and late results after disposal do not publish', async () => {
  const s = setup(); await s.controller.start();
  await s.controller.assignCandidate({ barcode: 'RM', apparatus_options: [apparatus] }, async () => { s.retire(); return true; }, async () => apparatus);
  assert.equal(s.sends.length, 0);
  const pending = deferred(), a = setup({ orders: () => pending.promise }); let publications = 0;
  a.controller.subscribe(() => publications++); const start = a.controller.start(); a.controller.dispose(); const before = publications;
  pending.resolve([order('zakaz-1')]); await start; assert.equal(publications, before);
});

const presentation = compile('materialAssignmentPresentation', { '../qolip/qolipApiCommon': compile('../qolip/qolipApiCommon', {
  '../shared/mobileApiException': { MobileApiException: Error },
}) });
test('diagnostics preserve source narrow/wide/generic branches and consumed precedence', () => {
  const t = (key, values) => ({ key, values });
  const d = { reason: 'raw_material_roll_size_mismatch', roll_width_mm: 97, minimum_width_mm: 98, order_width_mm: 100, maximum_width_mm: 103 };
  assert.deepEqual(presentation.materialDiagnosticMessage(d, t), { key: 'production.assignment.diagnostic_roll_too_narrow', values: { actual: '97 mm', min: '98 mm' } });
  assert.equal(presentation.materialDiagnosticMessage({ ...d, roll_width_mm: 105 }, t).key, 'production.assignment.diagnostic_roll_too_wide');
  assert.equal(presentation.materialDiagnosticMessage({ ...d, reason: 'apparatus_not_assigned' }, t).key, 'production.assignment.apparatus_access_message');
  assert.equal(presentation.materialDiagnosticMessage({ ...d, reason: 'constructor' }, t).key, 'production.assignment.diagnostic_generic');
  assert.equal(presentation.materialStockStatusLabel('constructor', key => key), 'constructor');
  assert.equal(presentation.materialScannedStatus(lookup('RM'), { ...assignment(), consumed_qty: 1 }), 'consumed');
  assert.equal(presentation.materialAssignmentTimestamp('   '), '');
});
