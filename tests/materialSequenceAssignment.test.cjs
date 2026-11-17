const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks) {
  const file = path.resolve(__dirname, `../src/material/${name}.ts`), m = new Module(file, module);
  m.filename = file; m.paths = module.paths; m.require = key => Object.hasOwn(mocks, key) ? mocks[key] : require(key);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return m.exports;
}
const { MaterialSequenceAssignmentController: Controller, sequenceAssignmentBarcodeKey } = load('materialSequenceAssignmentController', {
  '../shared/barcode/rawMaterialBarcode': { rawMaterialBarcodeFromQr: raw => raw.trim().replace(/^qr:/, '') },
  './materialAssignmentPresentation': { materialDiagnosticMessage: diagnostic => diagnostic.reason },
});
const presentation = load('materialSequenceAssignmentPresentation', {
  './materialSequenceAssignmentController': { sequenceAssignmentBarcodeKey },
});
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const text = (key, values = {}) => `${key}:${JSON.stringify(values)}`;
const candidate = (barcode, changes = {}) => ({ barcode, item_name: 'Film', item_code: 'IT', qty: 10, uom: 'kg', warehouse: 'Warehouse',
  item_group: 'Group', apparatus_options: ['print', 'laminate'], order_width_mm: 500, roll_width_mm: 510, leftover_width_mm: 10,
  match_type: 'closest_width', ...changes });
const assignment = barcode => ({ barcode, item_name: 'Film', item_code: 'IT', stock_warehouse: 'Warehouse', apparatus: 'print' });
function setup(overrides = {}, initial = 'print', options = ['print', 'laminate']) {
  let current = true, clock = 0; const calls = [];
  const deps = { current: () => current, text, now: () => clock,
    candidates: async id => { calls.push(['candidates', id]); return [candidate('A'), candidate('B'), candidate('C')]; },
    assignments: async id => { calls.push(['assignments', id]); return []; },
    diagnostic: async (code, id) => { calls.push(['diagnostic', code, id]); return { compatible: false, reason: 'not found' }; },
    assign: async (code, id) => { calls.push(['assign', code, id]); return assignment(code); }, ...overrides };
  const controller = new Controller(deps, 'order', options, initial);
  return { controller, calls, retire: () => { current = false; }, time: value => { clock = value; } };
}

test('sequence assignment selects the initial authorized apparatus and loads scoped candidates/assignments', async () => {
  const h = setup({}, 'laminate'); await h.controller.load();
  assert.equal(h.controller.getSnapshot().selectedApparatus, 'laminate');
  assert.deepEqual(h.calls, [['candidates', 'laminate'], ['assignments', 'laminate']]);
  const denied = setup({}, 'print', []); await denied.controller.load(); assert.deepEqual(denied.calls, []);
  assert.equal(denied.controller.getSnapshot().loading, false);
});

test('single candidate assignment sends explicit apparatus and updates both lists case-insensitively', async () => {
  const h = setup({ assignments: async () => [assignment(' a '), assignment('old')] }); await h.controller.load();
  await h.controller.assign(h.controller.getSnapshot().candidates[0]);
  assert.deepEqual(h.calls.at(-1), ['assign', 'A', 'print']);
  assert.deepEqual(h.controller.getSnapshot().candidates.map(row => row.barcode), ['B', 'C']);
  assert.deepEqual(h.controller.getSnapshot().assignments.map(row => row.barcode), ['A', 'old']);
  assert.equal(h.controller.getSnapshot().actionSucceeded, true);
});

test('bulk assignment uses candidate order, runs sequentially and updates each successful row', async () => {
  const first = deferred(), sent = [], h = setup({ assign: async code => { sent.push(code); return code === 'A' ? first.promise : assignment(code); } });
  await h.controller.load(); const rows = h.controller.getSnapshot().candidates;
  h.controller.toggleSelection(rows[2]); h.controller.toggleSelection(rows[0]);
  const pending = h.controller.assignSelected(); await flush(); assert.deepEqual(sent, ['A']);
  first.resolve(assignment('A')); await pending;
  assert.deepEqual(sent, ['A', 'C']); assert.deepEqual(h.controller.getSnapshot().candidates.map(row => row.barcode), ['B']);
  assert.equal(h.controller.getSnapshot().selectedKeys.size, 0);
  assert.equal(h.controller.getSnapshot().actionMessage, text('production.assignment.linked_count', { count: 2 }));
});

test('bulk stops on first error, reloads once and preserves unsent selection', async () => {
  let reads = 0; const sent = [], h = setup({ candidates: async () => ++reads === 1 ? [candidate('A'), candidate('B'), candidate('C')] : [candidate('B'), candidate('C')],
    assign: async code => { sent.push(code); if (code === 'B') throw Object.assign(Error('Backend failure'), { code: 'rejected' }); return assignment(code); } });
  await h.controller.load(); h.controller.getSnapshot().candidates.forEach(row => h.controller.toggleSelection(row));
  await h.controller.assignSelected();
  assert.deepEqual(sent, ['A', 'B']); assert.equal(reads, 2);
  assert.deepEqual([...h.controller.getSnapshot().selectedKeys], ['B', 'C']);
  assert.equal(h.controller.getSnapshot().actionSucceeded, false);
  assert.equal(h.controller.getSnapshot().actionMessage, text('production.assignment.partial_linked', { count: 1, error: 'Backend failure' }));
});

test('a retired owner stops a bulk batch before its next write', async () => {
  const first = deferred(), sent = [], h = setup({ assign: async code => { sent.push(code); return first.promise; } });
  await h.controller.load(); h.controller.getSnapshot().candidates.forEach(row => h.controller.toggleSelection(row));
  const pending = h.controller.assignSelected(); h.retire(); first.resolve(assignment('A')); await pending;
  assert.deepEqual(sent, ['A']);
});

test('camera selection is idempotent and suppresses repeated codes for less than two seconds', async () => {
  const h = setup(); await h.controller.load(); h.controller.toggleScanner();
  await h.controller.handleScan('qr:A'); assert.deepEqual([...h.controller.getSnapshot().selectedKeys], ['A']);
  const firstStatus = h.controller.getSnapshot().scannerStatus;
  h.time(1999); await h.controller.handleScan('A'); assert.equal(h.controller.getSnapshot().scannerStatus, firstStatus);
  h.time(2000); await h.controller.handleScan('A');
  assert.equal(h.controller.getSnapshot().scannerStatus, text('production.assignment.already_selected', { count: 1 }));
  assert.equal(h.calls.some(call => call[0] === 'assign'), false);
});

test('late unmatched QR diagnostics cannot replace a changed apparatus or closed scanner status', async () => {
  const pending = deferred(), h = setup({ diagnostic: async () => pending.promise }); await h.controller.load();
  h.controller.toggleScanner(); const read = h.controller.handleScan('unknown'); h.controller.selectApparatus('laminate'); await flush();
  pending.resolve({ compatible: false, reason: 'stale' }); await read;
  assert.equal(h.controller.getSnapshot().scannerStatus, text('production.assignment.qr_prompt'));
  assert.equal(h.controller.getSnapshot().selectedKeys.size, 0);
});

test('selection mode toggles cards without assigning and invalid apparatus emits no write', async () => {
  const h = setup(); await h.controller.load(); const rows = h.controller.getSnapshot().candidates;
  h.controller.toggleSelection(rows[0]); h.controller.candidateAction(rows[1]); assert.equal(h.controller.getSnapshot().selectedKeys.size, 2);
  assert.equal(h.calls.some(call => call[0] === 'assign'), false);
  h.controller.clearSelection(); await h.controller.assign(candidate('foreign', { apparatus_options: ['other'] }));
  assert.equal(h.calls.some(call => call[0] === 'assign'), false);
  assert.equal(h.controller.getSnapshot().actionMessage, text('production.assignment.apparatus_missing'));
});

test('width requirements use minimum candidate width, print +20 and lamination +30, with order fallback', () => {
  const order = { map: { width_mm: 800 } };
  assert.equal(presentation.materialSequenceWidthRequirement(order, [candidate('A'), candidate('B', { order_width_mm: 450 })], { operation: 'print' }, text),
    text('production.assignment.width_range', { min: '450 mm', max: '470 mm' }));
  assert.equal(presentation.materialSequenceWidthRequirement(order, [], { operation: 'laminate' }, text),
    text('production.assignment.width_range', { min: '800 mm', max: '830 mm' }));
  assert.equal(presentation.materialSequenceWidthRequirement(order, [], { operation: 'cut' }, text), '');
});

test('candidate projection preserves match, source detail order and multi-select action labels', async () => {
  const h = setup(); await h.controller.load(); const row = h.controller.getSnapshot().candidates[0];
  h.controller.toggleSelection(row); const item = presentation.materialSequenceCandidatePresentation(row, 0, h.controller.getSnapshot(), [{ id: 'print', name: 'Printer' }], text);
  assert.equal(item.rank, 1); assert.equal(item.title, 'Film'); assert.equal(item.subtitle, 'IT • QR A • 10 kg');
  assert.equal(item.matchLabel, text('production.assignment.closest')); assert.equal(item.selected, true);
  assert.equal(item.actionLabel, text('production.assignment.selected_label'));
  assert.deepEqual(item.details.map(value => value.split(':')[0]), ['production.assignment.warehouse', 'production.assignment.order_width',
    'production.assignment.roll_width', 'production.assignment.leftover_width']);
});
