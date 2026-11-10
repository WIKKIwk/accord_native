const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
function load(name) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { workerHandoffBatch } = load('workerHandoff'), { workerCompletionMode } = load('workerCompletion');
const apparatus = 'apparatus:default:lamination', order = 'order';
const valid = { batch_id: 'batch', order_id: order, wip_status: 'in_use', used_by_apparatus: apparatus, current_apparatus: 'other', payload_json: { worker_handoff: true } };
// @v2-test test/admin_production_map_test_screen_test.dart
test('handoff menu requires an in-use roll left on exactly this order and apparatus', () => {
  assert.equal(workerHandoffBatch([valid], apparatus, order), valid);
  for (const change of [{ order_id: 'other' }, { wip_status: 'waiting' }, { wip_status: 'processed' }, { used_by_apparatus: 'other' },
    { payload_json: { worker_handoff: false } }, { payload_json: { worker_handoff: 'true' } }, { batch_id: '' }]) {
    assert.equal(workerHandoffBatch([{ ...valid, ...change }], apparatus, order), null);
  }
});
test('handoff uses current apparatus only when used-by apparatus is empty and retains first server match', () => {
  const fallback = { ...valid, used_by_apparatus: ' ', current_apparatus: apparatus, wip_status: ' IN_USE ' };
  assert.equal(workerHandoffBatch([fallback, valid], apparatus, order), fallback);
  assert.equal(workerHandoffBatch([{ ...fallback, current_apparatus: 'other' }], apparatus, order), null);
});
test('detaching a handed-off roll requires real output metrics even when a description is present', () => {
  const mode = workerCompletionMode({ action: 'detach_roll', orderId: order, closingOutputId: '', safeStopRequest: null,
    description: 'Rulonni chiqarish', meter: '', kg: '', bobina: '', waste: '' });
  assert.equal(mode.needsOutput, true); assert.equal(mode.completionIssue, false); assert.equal(mode.safeStopIssue, false);
});

function removalHarness(options = {}) {
  const source = ts.createSourceFile('OrderScreen.tsx', fs.readFileSync(path.resolve(__dirname, '../src/OrderScreen.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fn; const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'submit') fn = node.getText(source); ts.forEachChild(node, visit); }; visit(source);
  assert.ok(fn);
  const h = { writes: [], printers: 0, errors: [], closed: 0, current: true, reads: 0 };
  const state = { actionInFlight: { current: false }, loadVersion: { current: 0 }, closeAfterProgress: { current: false }, screenMounted: { current: true } };
  const no = () => {};
  const context = { ...state, synchronized: true, canOpenInitialAstatka: false, allowed: ['detach_roll'], laminationReport: true, isCurrent: () => h.current,
    control: { stage_node_id: 'stage' }, interaction: { resume_input_required: options.inputRequired === true }, bootstrap: {}, latestCursor: { current: { epoch: 'epoch', rev: 1 } }, scanBootstrapUnsupported: {},
    selected: options.action === 'resume' ? '' : 'detach_roll', initialAction: options.action ?? 'detach_roll', initialSwitchQr: '', switchProgress: null, setSwitchProgress: no, session: {}, apparatusId: apparatus, orderId: order, order: {}, preview: {},
    kg: '10', meter: '100', bobina: '1', waste: '', freezeNote: '', completionNote: '', leftoverWip: '', leftoverFilm: '', safeStopRequest: null,
    materials: [], effectiveQolips: [], paint: {}, paintDynamic: {}, paintImageId: '', materialState: { ready: true },
    automaticQolip: false, automaticConfirmation: null, qolipRequired: false, inputBatch: null,
    numberValue: value => Number(value.replace(',', '.')), returnedPaintItemsFromDraft: () => [], workerCompletionMode, workerHandoffBatch,
    p: key => key, selectOutputPrinter: async () => { h.printers++; throw new Error('Must not select a printer'); },
    validOrderControl: () => true, scanBootstrap: async () => { h.reads++; return { control_state: { control: { state: 'paused', stage_node_id: options.stage ?? 'stage', allowed_actions: ['detach_roll'] } } }; },
    adminWipBatches: async () => { if (options.expire) h.current = false; return options.batches ?? [valid]; },
    adminApparatusQueueActionResult: async (_session, body, guard) => { assert(guard()); h.writes.push(body); return {}; },
    WorkerPrintCancelled: class extends Error {}, Platform: { OS: options.platform ?? 'ios' },
    setError: value => { if (value) h.errors.push(value); }, closeSheet: () => h.closed++,
    setDescriptionRevealed: no, setControlRetired: no, setBusy: no, setSuccess: no, selectProgressAction: no, setMaterials: no, setQolips: no,
    setQolipsReset: no, setInputBatch: no, setFreezeNote: no, setCompletionNote: no, setKg: no, setMeter: no, setBobina: no, setSelectedQolipSet: no, onChanged: no, setRefresh: no,
  };
  if (options.action === 'resume') context.allowed = ['resume'];
  h.state = state;
  h.submit = vm.runInNewContext(`${ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; submit`, context);
  return h;
}
test('native roll removal submits exact detach metrics without a printer and waits for iOS modal dismissal', async () => {
  for (const platform of ['ios', 'android']) {
    const h = removalHarness({ platform }); await h.submit('detach_roll'); assert.deepEqual(h.errors, []); assert.equal(h.printers, 0); assert.equal(h.reads, 1);
    assert.equal(h.writes.length, 1); assert.equal(JSON.stringify(h.writes[0]), JSON.stringify({ apparatus, order_id: order, action: 'detach_roll', include_control: true,
      finished_goods_kg: 10, finished_goods_meter: 100, bobina_kg: 1, uom: 'm', remove_roll_from_apparatus: true }));
    assert.equal(h.closed, platform === 'ios' ? 0 : 1); assert.equal(h.state.closeAfterProgress.current, platform === 'ios');
  }
});
test('native removal refuses a changed stage, missing handoff roll or expired account before mutation', async () => {
  for (const options of [{ stage: 'new-stage' }, { batches: [] }, { expire: true }]) {
    const h = removalHarness(options); await h.submit('detach_roll'); assert.equal(h.writes.length, 0); assert.equal(h.printers, 0); assert.equal(h.closed, 0);
  }
});
test('native resume sends no invented QR or output and closes on acknowledgment; required input blocks it', async () => {
  const h = removalHarness({ action: 'resume' }); await h.submit('resume'); assert.deepEqual(h.errors, []);
  assert.equal(h.closed, 1); assert.equal(h.printers, 0);
  assert.equal(JSON.stringify(h.writes[0]), JSON.stringify({ apparatus, order_id: order, action: 'resume', include_control: true }));
  const missing = removalHarness({ action: 'resume', inputRequired: true }); await missing.submit('resume');
  assert.equal(missing.writes.length, 0); assert.equal(missing.closed, 0); assert.equal(missing.errors.length, 1);
});
