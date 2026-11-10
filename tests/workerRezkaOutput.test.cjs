const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === '../workerControlsApi' ? { isCanonicalApparatusId: value => /^apparatus:[a-z0-9_-]+:[a-z0-9_-]+$/.test(value) }
    : id.startsWith('./') ? load(path.posix.join(path.posix.dirname(name), id)) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const model = load('workerRezkaOutputModel'), { WorkerRezkaOutputWorkflow } = load('workerRezkaOutputWorkflow');
const draft = (change = {}) => ({ meter: '100', kg: '10', bobina: '0,5', diameter: '45', note: '', ...change });
const input = (change = {}) => model.rezkaFrameInput(draft(change), false);
const slot = (index, value = input()) => ({ index, input: value, batch_id: value.issue_note ? '' : `batch-${index}`, qr_payload: value.issue_note ? '' : `QR${index}` });
const snapshot = (frames = [], count = 3) => ({ epoch: 'server-epoch', revision: 4, kadr_counts: Array(count).fill(1),
  report: { cycle_id: 'cycle-1', frames, reference_frame_index: null, include_bobina_in_net: false, layout_outputs: [], atomic_save_epoch: 'server-epoch', peremotka_supported: true } });
const job = (qr, count = 1) => ({ epc: qr, label_kind: 'progress', print_count: count });
const clone = value => structuredClone(value);
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
async function until(predicate) { for (let n = 0; n < 200; n++) { if (predicate()) return; await new Promise(setImmediate); } assert.fail('workflow did not reach expected state'); }
function harness(options = {}) {
  const context = { apparatus: 'apparatus:default:asset-010', orderId: 'order-1', stage: 'cut', action: 'complete', includeBobina: false, autofill: false, printCount: 1, ...options.context };
  const h = { current: true, snapshot: options.snapshot ?? snapshot(), control: { stage: 'cut', allowed: [context.action], fullReport: false, totalWasteOnly: false, ...options.control },
    events: [], writes: [], prints: [], reprints: [], confirmations: [], attempts: 0, commits: [], selections: 0, reads: 0 };
  h.read = async () => clone(h.snapshot); h.pick = async () => ({ device: 'bluetooth' }); h.confirm = async () => true; h.print = async () => {};
  h.save = async body => {
    const created = [];
    const saveSlot = (index, value) => {
      if (h.snapshot.report.frames.some(frame => frame.index === index)) return;
      const saved = slot(index, clone(value)); h.snapshot.report.frames.push(saved); if (!value.issue_note) created.push(saved);
    };
    if (body.rezka_record_frame_index) saveSlot(body.rezka_record_frame_index, body.rezka_frames[0]);
    else body.rezka_frames?.forEach((value, index) => saveSlot(index + 1, value));
    h.snapshot.revision++;
    return { rezka_output_report: clone(h.snapshot.report), progress_batch: created[0] ?? null, progress_batches: clone(created),
      print_jobs: created.map(frame => job(frame.qr_payload, context.printCount)) };
  };
  const workflow = h.workflow = new WorkerRezkaOutputWorkflow({ context, current: () => h.current,
    read: async () => { h.reads++; return h.read(); }, control: async () => clone(h.control),
    save: (body, current) => { assert(current()); h.writes.push(clone(body)); h.events.push('save'); return h.save(body); },
    selectPrinter: () => { h.selections++; h.events.push('pick'); return h.pick(); }, printerFields: () => ({ print_transport: 'bluetooth', driver_url: 'offline://usb', printer: 'zebra' }),
    reprint: async (frame, printer, count) => { h.reprints.push({ frame: clone(frame), printer, count }); return { ok: true, print_job: job(frame.qr_payload, count) }; },
    print: async (result, printer) => { h.prints.push({ result: clone(result), printer }); h.events.push('print'); return h.print(result, printer); },
    confirm: async value => { h.confirmations.push(clone(value)); return h.confirm(value); }, attempted: () => h.attempts++, committed: final => h.commits.push(final) });
  h.fill = (index, value = {}) => { for (const [field, text] of Object.entries(draft(value))) workflow.change(index, field, text); };
  h.idle = () => until(() => !workflow.getSnapshot().processing);
  return h;
}

// @v2-test test/rezka_output_deviation_test.dart
test('quantity parsing follows finite Dart decimal syntax and rejects JavaScript-only numeric literals', () => {
  for (const value of ['', ' ', '0xff', '0b10', '12px', '1,2,3', 'Infinity', 'NaN', null]) assert.equal(model.rezkaQty(value), null, String(value));
  assert.equal(model.rezkaQty('  +1,25e2 '), 125); assert.equal(model.rezkaQty('.5'), .5);
});
test('every healthy roll requires meter, weight and diameter; terminal net mode alone omits tare', () => {
  assert.deepEqual(input(), { produced_qty: 100, finished_goods_meter: 100, gross_qty: 10, finished_goods_kg: 10, bobina_kg: .5, diameter: 45 });
  for (const field of ['meter', 'kg', 'diameter', 'bobina']) for (const value of ['', '0', '-1', 'Infinity']) assert.throws(() => input({ [field]: value }), /fill_roll/);
  assert.equal(model.rezkaFrameInput(draft({ bobina: '' }), true).bobina_kg, undefined);
});
test('tare is compared at six-decimal precision and equal or unknown-weight comparisons follow V2', () => {
  assert.doesNotThrow(() => input({ kg: '1.0000001', bobina: '1.0000002' }));
  assert.throws(() => input({ kg: '1.0000001', bobina: '1.0000006' }), /bobina_exceeds_gross/);
  assert.doesNotThrow(() => input({ kg: '0.0000001', bobina: '0.000001' }));
  assert.doesNotThrow(() => input({ kg: '1000000000000', bobina: '2000000000000' }));
});
test('saved input aliases and exact issue/peremotka identity are retained for replays', () => {
  const saved = slot(1, { finished_goods_meter: 100, finished_goods_kg: 10, bobina_kg: .5, diameter: 45, peremotka_reason: 'hold' });
  assert.equal(model.rezkaSavedMatches(saved, { ...input(), peremotka_reason: 'hold' }), true);
  assert.equal(model.rezkaSavedMatches(saved, input()), false); assert.equal(model.rezkaSavedMatches(saved, { ...input(), diameter: 46, peremotka_reason: 'hold' }), false);
  assert.deepEqual(model.rezkaSavedInput(slot(1, { issue_note: '  broken  ' })), { issue_note: 'broken' });
});
test('the ±10 percent threshold is inclusive and finite overflow is warned', () => {
  for (const value of [90, 100, 110, 110.00000000001]) assert.equal(model.rezkaDeviationPercent(100, value), null);
  assert(model.rezkaDeviationPercent(100, 110.01) > 10); assert(model.rezkaDeviationPercent(100, 89.99) < -10);
  assert.equal(model.rezkaDeviationPercent(Number.MIN_VALUE, Number.MAX_VALUE), Number.MAX_VALUE);
  assert.equal(model.rezkaDeviationPercent(0, 1), null); assert.equal(model.rezkaDeviationPercent(1, -1), null);
});
test('deviations use server reference rather than card order and skip issues, saved cards and held references', () => {
  const report = snapshot([slot(3), slot(1, { ...input(), peremotka_reason: 'hold' })]).report; report.reference_frame_index = 3;
  const warnings = model.rezkaOutputDeviations(report, new Map([[1, input({ kg: '12' })], [0, input({ kg: '15' })], [3, { issue_note: 'broken' }]]));
  assert.equal(warnings.length, 1); assert.equal(warnings[0].referenceIndex, 2); assert.equal(warnings[0].field, 'kg');
  assert.notEqual(warnings[0].approval, model.rezkaOutputDeviations({ ...report, cycle_id: 'new' }, new Map([[1, input({ kg: '12' })]]))[0].approval);
});
const node = (id, kind = 'apparatus', extra = {}) => ({ id, kind, apparatus_id: `apparatus:default:${id}`, ...extra });
const chain = (nodes, edges, extra = {}) => ({ nodes: [node('s', 'start'), ...nodes, node('e', 'end')], edges: edges.map(([from, to, branch = '']) => ({ from, to, branch })), include_bobina_in_net: true, duplicate_rezka_labels: true, ...extra });
test('only the terminal reachable physical stage includes bobina and uses duplicate labels', () => {
  const map = chain([node('cut'), node('pack')], [['s', 'cut'], ['cut', 'pack'], ['pack', 'e']]);
  assert.deepEqual(model.rezkaStageOptions(map, 'cut'), { includeBobina: false, printCount: 1 });
  assert.deepEqual(model.rezkaStageOptions(map, 'pack'), { includeBobina: true, printCount: 2 });
  assert.deepEqual(model.rezkaStageOptions(map, 'absent'), { includeBobina: false, printCount: 1 });
});
test('terminal-stage routing follows alternatives, conditions and virtual tasks while excluding unreachable/invalid apparatus', () => {
  const map = chain([node('cut', 'apparatus', { alternative_group_id: 'g' }), node('alt', 'apparatus', { alternative_group_id: 'g' }), node('c', 'condition'), node('t', 'task'), node('pack'), node('orphan')],
    [['s', 'cut'], ['alt', 'c'], ['c', 'pack', 'maybe'], ['c', 't', 'yes'], ['t', 'e']]);
  assert.deepEqual(model.rezkaStageOptions(map, 'alt'), { includeBobina: true, printCount: 2 });
  assert.deepEqual(model.rezkaStageOptions(map, 'orphan'), { includeBobina: false, printCount: 1 });
  map.edges.push({ from: 'c', to: 'pack', branch: 'no' }); assert.equal(model.rezkaStageOptions(map, 'cut').printCount, 1);
  map.nodes.find(value => value.id === 'pack').apparatus_id = 'unassigned'; assert.equal(model.rezkaStageOptions(map, 'cut').printCount, 2);
});
test('final body uses the first healthy frame, optional waste and note; all-issue reports never invent output metrics', () => {
  const common = { apparatus: 'apparatus:default:asset-010', orderId: 'order-1', action: 'complete', report: snapshot().report, waste: { total: '', print: '1,5', lamination: '', edge: '' }, note: ' note ', fullReport: true, totalWasteOnly: false };
  const body = model.rezkaOutputBody({ ...common, frames: [{ issue_note: 'broken' }, input()] });
  assert.equal(body.produced_qty, 100); assert.equal(body.rezka_bosma_waste, 1.5); assert.equal(body.total_waste, undefined);
  assert.equal(body.full_completion_report_required, true); assert.equal(body.completion_request_note, 'note');
  assert.throws(() => model.rezkaOutputBody({ ...common, frames: [input()], waste: { total: '', print: '', lamination: '', edge: '' } }), /completion_reason/);
  const allIssues = model.rezkaOutputBody({ ...common, frames: [{ issue_note: 'broken' }], waste: { total: '', print: '', lamination: '', edge: '' } });
  assert.equal(allIssues.produced_qty, undefined); assert.equal(allIssues.gross_qty, undefined);
});
test('total-only completion accepts zero and omits hidden waste categories and the full-report flag', () => {
  const body = model.rezkaOutputBody({ apparatus: 'machine', orderId: 'order', action: 'complete', report: snapshot().report, frames: [input()],
    waste: { total: '0', print: '9', lamination: '5', edge: '3' }, note: '', fullReport: true, totalWasteOnly: true });
  assert.equal(body.total_waste, 0); assert.equal(body.rezka_bosma_waste, undefined); assert.equal(body.full_completion_report_required, undefined);
});

// @v2-test test/rezka_output_report_api_test.dart
test('individual card save binds cycle, one-based slot and atomic layout; repeated taps create one WIP', async () => {
  const h = harness(); await h.workflow.load(); h.fill(1); const saved = deferred(), normal = h.save; h.save = body => saved.promise.then(() => normal(body));
  h.workflow.enqueue(1); h.workflow.enqueue(1); await until(() => h.writes.length === 1);
  assert.equal(h.writes[0].rezka_record_frame_index, 2); assert.equal(h.writes[0].rezka_output_cycle, 'cycle-1');
  assert.equal(h.writes[0].rezka_expected_epoch, 'server-epoch'); assert.deepEqual(h.writes[0].rezka_expected_kadr_counts, [1, 1, 1]);
  assert.deepEqual(h.writes[0].rezka_frames, [input()]); assert.deepEqual(h.events, ['pick', 'save']);
  saved.resolve(); await h.idle(); assert.equal(h.writes.length, 1); assert.equal(h.prints.length, 1); assert.equal(h.reprints.length, 0);
  assert.deepEqual(h.commits, [false]); assert.equal(h.workflow.getSnapshot().statuses[1], 'worker.rezka.print.printed');
});
test('lost card-save response reconciles; explicit retry prepares the original QR without another output write', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); const normal = h.save; h.save = async body => { await normal(body); throw new Error('lost response'); };
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.workflow.getSnapshot().paused, true); assert.equal(h.workflow.getSnapshot().frames[0].kg, '10');
  h.workflow.change(0, 'kg', '999'); assert.equal(h.workflow.getSnapshot().frames[0].kg, '10');
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes.length, 1); assert.equal(h.reprints[0].frame.qr_payload, 'QR1'); assert.equal(h.prints.length, 1);
});
test('printer failure retains the saved slot and paused queue; retry never duplicates production', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.fill(1); h.print = async () => { throw new Error('printer disconnected'); };
  h.workflow.enqueue(0); h.workflow.enqueue(1); await h.idle(); assert.equal(h.writes.length, 1); assert.deepEqual(h.workflow.getSnapshot().queued, [0, 1]);
  h.print = async () => {}; h.workflow.enqueue(0); await h.idle(); assert.deepEqual(h.writes.map(body => body.rezka_record_frame_index), [1, 2]);
  assert.equal(h.reprints.length, 1); assert.equal(h.reprints[0].frame.qr_payload, 'QR1'); assert.equal(h.workflow.getSnapshot().paused, false);
});
test('queue serializes writes but other unsaved cards remain editable until queued', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); const save = deferred(), normal = h.save; h.save = body => save.promise.then(() => normal(body));
  h.workflow.enqueue(0); await until(() => h.writes.length === 1); h.fill(1, { meter: '105' }); h.workflow.enqueue(1); h.workflow.change(1, 'meter', '999');
  assert.equal(h.workflow.getSnapshot().frames[1].meter, '105'); assert.equal(h.writes.length, 1);
  save.resolve(); await h.idle(); assert.deepEqual(h.writes.map(body => body.rezka_frames[0].produced_qty), [100, 105]);
});
test('another writer saved an atomic slot: show recovered state and require a deliberate reprint', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.save = async body => { h.snapshot.report.frames.push(slot(1, body.rezka_frames[0])); return { rezka_output_report: clone(h.snapshot.report) }; };
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.workflow.getSnapshot().paused, true); assert.equal(h.prints.length, 0);
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes.length, 1); assert.equal(h.reprints.length, 1); assert.equal(h.prints.length, 1);
});
test('a conflicting saved slot pauses synchronization and never reprints another measurement', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.pick = async () => { h.snapshot.report.frames.push(slot(1, input({ kg: '50' }))); return {}; };
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.workflow.getSnapshot().syncRequired, true); assert.equal(h.writes.length, 0); assert.equal(h.prints.length, 0);
});
test('wrong cycle, epoch, layout or revision is rejected before writing', async () => {
  for (const mutate of [s => { s.report.cycle_id = 'new'; }, s => { s.epoch = 'new'; }, s => { s.kadr_counts = [1, 2, 1]; }, s => { s.revision = 1; }]) {
    const h = harness(); await h.workflow.load(); h.fill(0); mutate(h.snapshot); h.workflow.enqueue(0); await h.idle();
    assert.equal(h.workflow.getSnapshot().syncRequired, true); assert.equal(h.writes.length, 0); assert.equal(h.prints.length, 0);
  }
});
test('a write acknowledgment raises the minimum accepted report revision; a lagging read cannot erase a saved slot', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); const normal = h.save;
  h.save = async body => ({ ...await normal(body), has_snapshot_cursor: true, epoch: 'server-epoch', rev: 8 });
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.workflow.getSnapshot().snapshot.revision, 8);
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes.length, 1); assert.equal(h.workflow.getSnapshot().syncRequired, true);
  const other = harness({ snapshot: snapshot([slot(1)]) }); await other.workflow.load(); other.snapshot.report.frames = [];
  other.workflow.enqueue(0); await other.idle(); assert.equal(other.workflow.getSnapshot().syncRequired, true); assert.equal(other.writes.length, 0);
});
test('changed stage or removed action blocks a new write', async () => {
  for (const change of [{ stage: 'next' }, { allowed: [] }]) {
    const h = harness(); await h.workflow.load(); h.fill(0); Object.assign(h.control, change); h.workflow.enqueue(0); await h.idle();
    assert.equal(h.writes.length, 0); assert.equal(h.prints.length, 0);
  }
});
test('expired account during printer selection cannot save or print, including an invalidated ABA owner', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); const pick = deferred(); h.pick = () => pick.promise;
  h.workflow.enqueue(0); await until(() => h.selections === 1); h.workflow.invalidate(); h.current = true; pick.resolve({});
  await new Promise(setImmediate); await h.workflow.load(); h.workflow.enqueue(0);
  assert.equal(h.workflow.getSnapshot().phase, 'invalid'); assert.equal(h.writes.length, 0); assert.equal(h.prints.length, 0);
});
test('issue save has no printer, output metrics or atomic expectations and reconciles a lost acknowledgement', async () => {
  const h = harness(); await h.workflow.load(); const normal = h.save; h.save = async body => { await normal(body); throw new Error('lost'); };
  await h.workflow.saveIssue(1, ' broken '); assert.equal(h.selections, 0); assert.equal(h.writes.length, 1);
  assert.deepEqual(h.writes[0].rezka_frames, [{ issue_note: 'broken' }]); assert.equal(h.writes[0].rezka_expected_epoch, undefined);
  assert.equal(h.workflow.getSnapshot().statuses[1], 'worker.rezka.print.issue_saved'); h.workflow.enqueue(1); await h.idle(); assert.equal(h.writes.length, 1);
});
test('a card saved while its issue dialog was open cannot be converted into an issue', async () => {
  const h = harness(); await h.workflow.load(); h.snapshot.report.frames.push(slot(1)); await h.workflow.saveIssue(0, 'broken');
  assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().frames[0].kg, '10');
});
test('peremotka saves the held roll before printer selection and skips deviation approval', async () => {
  const h = harness({ snapshot: snapshot([slot(1)]) }); await h.workflow.load(); h.fill(1, { kg: '50' }); h.pick = async () => { throw new Error('cancel'); };
  h.workflow.enqueue(1, '  hold for inspection  '); await h.idle(); assert.deepEqual(h.events, ['save', 'pick']);
  assert.equal(h.writes[0].rezka_frames[0].peremotka_reason, 'hold for inspection'); assert.equal(h.confirmations.length, 0);
  assert.equal(h.workflow.getSnapshot().paused, true); assert.equal(h.workflow.getSnapshot().frames[1].kg, '50');
});
test('peremotka requires support and a nonblank reason within 250 Unicode code points', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.workflow.enqueue(0, '😀'.repeat(251)); await h.idle(); assert.equal(h.writes.length, 0);
  h.snapshot.report.peremotka_supported = false; await h.workflow.load(); h.workflow.enqueue(0, 'hold'); await h.idle(); assert.equal(h.writes.length, 0);
  assert.equal(h.workflow.getSnapshot().statuses[0], 'worker.rezka.print.peremotka_unsupported');
});
test('rejecting a deviation returns focus to that exact field without picking or saving', async () => {
  const h = harness({ snapshot: snapshot([slot(1)]) }); await h.workflow.load(); h.fill(1, { kg: '12' }); h.confirm = async () => false;
  h.workflow.enqueue(1); await h.idle(); assert.equal(h.selections, 0); assert.equal(h.writes.length, 0);
  assert.deepEqual(h.workflow.getSnapshot().focus, { index: 1, field: 'kg', serial: 1 }); assert.equal(h.workflow.getSnapshot().queued.length, 0);
});
test('a corrected reference reopens approval instead of reusing an obsolete warning', async () => {
  const h = harness({ snapshot: snapshot([slot(1)]) }); await h.workflow.load(); h.fill(1, { kg: '12' }); let changed = false;
  h.confirm = async () => { if (!changed) { changed = true; h.snapshot.report.frames[0] = slot(1, input({ kg: '8' })); h.snapshot.revision++; } return true; };
  h.workflow.enqueue(1); await h.idle(); assert.deepEqual(h.confirmations.map(value => value.reference), [10, 8]); assert.equal(h.writes.length, 1);
});
test('correction during printer choice must be approved before the write', async () => {
  const h = harness({ snapshot: snapshot([slot(1)]) }); await h.workflow.load(); h.fill(1); h.pick = async () => { h.snapshot.report.frames[0] = slot(1, input({ kg: '8' })); h.snapshot.revision++; return {}; };
  h.confirm = async () => false; h.workflow.enqueue(1); await h.idle(); assert.equal(h.writes.length, 0); assert.equal(h.confirmations[0].reference, 8);
});
test('bobina mode conflict clears captured queue values and preserves the editable drafts', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.fill(1); h.save = async () => { h.snapshot.report.include_bobina_in_net = true;
    throw Object.assign(new Error('changed'), { code: 'rezka_bobina_mode_changed', diagnostics: { include_bobina_in_net: true } }); };
  h.workflow.enqueue(0); h.workflow.enqueue(1); await h.idle(); const state = h.workflow.getSnapshot();
  assert.equal(state.includeBobina, true); assert.deepEqual(state.queued, []); assert.equal(state.paused, false); assert.equal(state.frames[1].bobina, '0,5');
  assert.equal(h.writes.length, 1); assert.equal(h.prints.length, 0);
});
test('mode changed during a printer picker clears the captured queue before POST and requires reconfirmation', async () => {
  const h = harness(); await h.workflow.load(); h.fill(0); h.pick = async () => { h.snapshot.report.include_bobina_in_net = true; return {}; };
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().includeBobina, true); assert.deepEqual(h.workflow.getSnapshot().queued, []);
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes.length, 1); assert.equal(h.writes[0].rezka_frames[0].bobina_kg, undefined);
});
test('final completion uses fresh canonical saved metrics after a corrected reference approval', async () => {
  const h = harness({ snapshot: snapshot([slot(1)]) }); await h.workflow.load(); h.fill(1); h.fill(2);
  h.pick = async () => { h.snapshot.report.frames[0] = slot(1, input({ kg: '8' })); h.snapshot.revision++; return {}; };
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.writes[0].rezka_frames[0].gross_qty, 8); assert.equal(h.writes[0].gross_qty, 8);
});
test('autofill starts from the first saved healthy roll only once; edits and corrected references survive refresh', async () => {
  const h = harness({ context: { autofill: true }, snapshot: snapshot([slot(1)]) }); await h.workflow.load();
  assert.equal(h.workflow.getSnapshot().frames[1].meter, '100'); h.workflow.change(1, 'kg', '15'); assert.equal(h.workflow.getSnapshot().frames[1].meter, '150');
  for (const field of ['kg', 'meter', 'diameter', 'bobina']) h.workflow.change(2, field, '');
  h.snapshot.report.frames[0] = slot(1, input({ meter: '200' })); await h.workflow.load();
  assert.equal(h.workflow.getSnapshot().frames[1].meter, '150'); assert.equal(h.workflow.getSnapshot().frames[2].meter, '');
  h.workflow.change(1, 'kg', '12'); assert.equal(h.workflow.getSnapshot().frames[1].meter, '240');
});
test('incomplete frames first reveal issue fields; all-empty completion can report all issues without a printer', async () => {
  const h = harness({ control: { fullReport: true } }); await h.workflow.load(); h.workflow.changeNote('no output possible');
  await h.workflow.submit(); assert.deepEqual(h.workflow.getSnapshot().issuePrompted, [0, 1, 2]); assert.equal(h.writes.length, 0);
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.selections, 0);
  assert.deepEqual(h.writes[0].rezka_frames, Array(3).fill({ issue_note: 'no output possible' })); assert.equal(h.writes[0].produced_qty, undefined);
});
test('a partially entered healthy card cannot borrow the global issue reason', async () => {
  const h = harness(); await h.workflow.load(); h.workflow.change(0, 'kg', '5'); h.workflow.changeNote('problem'); await h.workflow.submit(); await h.workflow.submit();
  assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().error, 'worker.progress.qty.completion_reason');
  for (let index = 0; index < 3; index++) h.workflow.change(index, 'note', 'broken'); await h.workflow.submit(); assert.equal(h.writes.length, 1);
});
test('safe stop sends an issue only when every output and waste field is blank', async () => {
  const h = harness({ context: { action: 'pause' }, control: { freezeRequest: 'freeze-1' } }); await h.workflow.load(); await h.workflow.submit();
  assert.equal(h.workflow.getSnapshot().error, 'worker.freeze.safe_stop.output_or_issue_required');
  h.workflow.changeNote('machine failure'); await h.workflow.submit(); assert.equal(h.selections, 0); assert.equal(h.writes.length, 1);
  assert.deepEqual(h.writes[0], { apparatus: 'apparatus:default:asset-010', order_id: 'order-1', action: 'pause', freeze_request_id: 'freeze-1', completion_request_note: 'machine failure', include_control: true });
  const partial = harness({ context: { action: 'pause' }, control: { freezeRequest: 'freeze-1' } }); await partial.workflow.load();
  partial.workflow.changeNote('machine failure'); partial.workflow.changeWaste('total', '2'); await partial.workflow.submit(); assert.equal(partial.writes.length, 0);
});
test('safe-stop refresh disables single-card print and issue writes', async () => {
  const h = harness({ control: { freezeRequest: 'freeze-1' } }); await h.workflow.load(); h.fill(0); h.workflow.enqueue(0); await h.workflow.saveIssue(1, 'broken'); await h.idle(); assert.equal(h.writes.length, 0);
});
test('complete with saved rolls needs no printer and preserves canonical saved metrics', async () => {
  const h = harness({ snapshot: snapshot([slot(1), slot(2), slot(3)]) }); await h.workflow.load(); h.workflow.change(0, 'kg', '99'); await h.workflow.submit();
  assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.selections, 0); assert.equal(h.writes[0].rezka_frames[0].gross_qty, 10); assert.equal(h.prints.length, 0);
});
test('mixed saved, issue and new frames print only the newly committed healthy QR with the stage label count', async () => {
  const h = harness({ context: { printCount: 2 }, snapshot: snapshot([slot(1), slot(2, { issue_note: 'broken' })]) }); await h.workflow.load(); h.fill(2);
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.selections, 1); assert.equal(h.prints.length, 1);
  assert.deepEqual(h.prints[0].result.print_job, job('QR3', 2)); assert.equal(h.writes[0].rezka_frames[1].issue_note, 'broken');
});
test('older non-atomic servers omit expected epoch/layout and prepare a saved QR when no valid progress label is returned', async () => {
  const report = snapshot(); report.report.atomic_save_epoch = ''; const h = harness({ snapshot: report }); await h.workflow.load(); h.fill(0); const normal = h.save;
  h.save = async body => ({ ...await normal(body), print_jobs: [{ ...job('QR1'), label_kind: 'stock' }] });
  h.workflow.enqueue(0); await h.idle(); assert.equal(h.writes[0].rezka_expected_epoch, undefined); assert.equal(h.writes[0].rezka_expected_kadr_counts, undefined);
  assert.equal(h.reprints.length, 1); assert.equal(h.prints[0].result.print_job.label_kind, 'progress');
});
test('issue writes are single-flight and never run while another card queue is paused', async () => {
  const h = harness(); await h.workflow.load(); const save = deferred(), normal = h.save; h.save = body => save.promise.then(() => normal(body));
  const first = h.workflow.saveIssue(0, 'broken'); await until(() => h.writes.length === 1); await h.workflow.saveIssue(0, 'different'); assert.equal(h.writes.length, 1);
  save.resolve(); await first; h.fill(1); h.print = async () => { throw new Error('disconnected'); }; h.workflow.enqueue(1); await h.idle();
  await h.workflow.saveIssue(2, 'broken'); assert.equal(h.writes.length, 2); assert.equal(h.workflow.getSnapshot().paused, true);
});
test('final print failure retries only saved QR jobs, and never resends the completion or edits acknowledged output', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i);
  let failures = 1; h.print = async () => { if (h.prints.length === 2 && failures--) throw new Error('disconnected'); };
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'print_pending'); assert.equal(h.writes.length, 1); assert.equal(h.commits.length, 1);
  h.workflow.change(0, 'kg', '99'); h.workflow.changeNote('new'); assert.equal(h.workflow.getSnapshot().frames[0].kg, '10'); assert.equal(h.workflow.getSnapshot().note, '');
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.writes.length, 1);
  assert.deepEqual(h.prints.map(value => value.result.print_job.epc), ['QR1', 'QR2', 'QR2', 'QR3']); assert.equal(h.selections, 2);
});
test('missing prepared labels are recovered from acknowledged batch identities without another production write', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); const normal = h.save;
  h.save = async body => ({ ...await normal(body), print_jobs: [] }); await h.workflow.submit();
  assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.writes.length, 1); assert.equal(h.reprints.length, 3); assert.equal(h.prints.length, 3);
});
test('acknowledgement without recoverable print identities never reports printing success or repeats completion', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); h.save = async () => ({});
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'print_pending'); assert.equal(h.prints.length, 0);
  await h.workflow.submit(); assert.equal(h.writes.length, 1); assert.equal(h.workflow.getSnapshot().phase, 'print_pending');
});
test('uncertain final action is read-only and cannot be automatically or manually re-POSTed', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); h.save = async () => { throw new Error('lost final response'); };
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'error'); assert.equal(h.workflow.getSnapshot().canReload, false);
  await h.workflow.submit(); await h.workflow.load(); assert.equal(h.writes.length, 1);
});
test('an explicit server rejection preserves editable values for a newly validated manual retry', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); const normal = h.save;
  h.save = async () => { throw Object.assign(new Error('choose paddon'), { code: 'active_paddon_required', statusCode: 409 }); };
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'edit'); assert.equal(h.workflow.getSnapshot().error, 'worker.paddon.active.required');
  h.workflow.change(0, 'kg', '11'); h.save = normal; await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.writes[1].rezka_frames[0].gross_qty, 11);
});
test('a pending completion approval never prints uncommitted output or claims the stage was completed', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); h.save = async () => ({ completion_request: { request_id: 'approval' } });
  await h.workflow.submit(); assert.equal(h.workflow.getSnapshot().phase, 'done'); assert.equal(h.workflow.getSnapshot().completed, false);
  assert.equal(h.workflow.getSnapshot().notice, 'worker.notice.completion_request_sent'); assert.equal(h.prints.length, 0);
});
test('confirmation and printer handoff lock final double taps and reject a changed full-report contract', async () => {
  const h = harness(); await h.workflow.load(); for (let i = 0; i < 3; i++) h.fill(i); const pick = deferred(); h.pick = () => pick.promise;
  const first = h.workflow.submit(); await until(() => h.selections === 1); assert.equal(h.workflow.getSnapshot().confirming, true);
  await h.workflow.submit(); h.workflow.change(0, 'kg', '99'); h.control.fullReport = true; pick.resolve({}); await first;
  assert.equal(h.writes.length, 0); assert.equal(h.workflow.getSnapshot().frames[0].kg, '10'); assert.equal(h.workflow.getSnapshot().phase, 'edit');
});
test('pause automatically confirms after every healthy card was saved and printed, without another printer or WIP', async () => {
  const h = harness({ context: { action: 'pause' }, snapshot: snapshot([], 2) }); await h.workflow.load(); h.fill(0); h.fill(1); h.workflow.enqueue(0); h.workflow.enqueue(1);
  await until(() => h.workflow.getSnapshot().phase === 'done'); assert.deepEqual(h.writes.map(body => body.action), ['roll_complete', 'roll_complete', 'pause']);
  assert.equal(h.prints.length, 2); assert.equal(h.selections, 1); assert.equal(h.writes[2].print_transport, undefined);
});
