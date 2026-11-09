// @v2-test test/raw_material_split_test.dart: passing lost-response and widget scenarios; source-derived controller transitions.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('homashyo/rawSplitModel'); const width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, '../../modules/accord-native-clock/src/AccordNativeClockModule': {}, 'expo-crypto': {} });
const inventory = load('preparation/preparationInventory', { '../auth': {}, '../shared/appRoutes': {}, '../shared/inventoryViewRuntime': {},
  '../inventoryReadApi': {}, './preparationInventoryTransfers': {} });
const sharedBarcode = load('shared/barcode/rawMaterialBarcode');
const barcode = load('homashyo/rawSplitBarcode', { '../preparation/preparationInventory': inventory, '../shared/barcode/rawMaterialBarcode': sharedBarcode });
const syncGuard = load('shared/camera/synchronousGuard');
const { RawSplitController } = load('homashyo/rawSplitController', { '../shared/camera/synchronousGuard': syncGuard, './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true }, './rawSplitBarcode': barcode,
  './rawSplitApi': {}, './rawSplitDraft': draft, './rawSplitModel': model, './rawSplitWidthPlan': width });
const raw = { revision: '1.000000', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM',
  item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const source = new model.RawSplitRoll(raw);
const result = new model.RawSplitResult({ id: 'split-result', source: raw, source_kg: '100', output_kg: '98', waste_kg: '2', outputs: [
  { ...raw, stock_id: 'child1', barcode: 'child1', kg: '39', gross_kg: '40', bobina_kg: '1', width_mm: '400' },
  { ...raw, stock_id: 'child2', barcode: 'child2', kg: '59', gross_kg: '60', bobina_kg: '1', width_mm: '600' }] });
function setup(overrides = {}) {
  let scope = 'account-a', pending = null, pendingIssue = null, stockCalls = [], issueCalls = [], prints = [], notices = [], pick = { transport: 'bluetooth', printer: {} };
  const snapshot = new model.RawSplitSnapshot({ warehouses: ['Raw W'], history: [], issues: [] });
  const ops = { rawSplitScope: () => scope, rawSplitSessionIsCurrent: () => true, rawSplitPending: async () => pending, rawSplitIssuePending: async () => pendingIssue,
    rawSplitSnapshot: async () => snapshot, rawSplitSource: async () => source, rawSplitSave: async (_session, payload) => { stockCalls.push(payload); return result; },
    rawSplitReportIssue: async (_session, payload) => { issueCalls.push(payload); return { id: 'issue-1' }; }, ...overrides };
  const options = { ticket: { session: {}, check() {} }, canMutate: () => true, operations: ops, requestId: async () => 'split-id', selectPrinter: async () => pick,
    print: async (...args) => { prints.push(args); }, onMessage: value => notices.push(value), onIssueVisible: () => notices.push('issue-visible'),
    printerSupported: () => true, onUnsupportedPrinter: () => notices.push('unsupported-printer') };
  const controller = new RawSplitController(options);
  return { controller, ops, stockCalls, issueCalls, prints, notices, options, setScope: value => { scope = value; },
    setPending: value => { pending = value; }, setPendingIssue: value => { pendingIssue = value; }, setPick: value => { pick = value; } };
}
async function fill(c) {
  await c.reload(); await c.lookup('parent');
  for (const [key, value] of Object.entries({ width: '400', gross: '40', bobina: '1', length: '1000' })) c.setOutput(0, key, value);
  c.addRoll();
  for (const [key, value] of Object.entries({ width: '600', gross: '60', bobina: '1', length: '1500' })) c.setOutput(1, key, value);
  c.setWaste('2');
}
test('initial reload locks input for pending stock and issue commands', async () => {
  const h = setup(); h.setPending({ request_id: 'old' }); h.setPendingIssue({ command: { request_id: 'issue' }, note: 'x' });
  await h.controller.reload(); assert.equal(h.controller.locked, true); assert.equal(h.controller.getSnapshot().snapshot.warehouses[0], 'Raw W');
  h.controller.setBarcode('ignored'); assert.equal(h.controller.getSnapshot().barcode, '');
});
test('initial reload locks immediately while the durable pending command is being read', async () => {
  let resolvePending, sourceCalls = 0;
  const h = setup({ rawSplitPending: () => new Promise(resolve => { resolvePending = resolve; }),
    rawSplitSource: async () => { sourceCalls++; return source; } });
  const loading = h.controller.reload();
  assert.equal(h.controller.getSnapshot().busy, true); assert.equal(h.controller.locked, true);
  h.controller.setBarcode('ignored'); await h.controller.lookup('parent'); await h.controller.save();
  assert.equal(h.controller.getSnapshot().barcode, ''); assert.equal(sourceCalls, 0); assert.deepEqual(h.stockCalls, []);
  resolvePending({ request_id: 'old' }); await loading;
  assert.equal(h.controller.getSnapshot().busy, false); assert.equal(h.controller.locked, true);
  assert.equal(h.controller.getSnapshot().pending.request_id, 'old');
});
test('lookup and width actions preserve partial rows, but remove empty excess rows only', async () => {
  const { controller: c } = setup(); await c.reload(); await c.lookup(' parent '); assert.equal(c.getSnapshot().source.barcode, 'parent');
  c.setOutput(0, 'width', '600'); c.addRoll(); assert.equal(c.getSnapshot().outputs.length, 2);
  c.setOutput(0, 'width', '700'); c.confirmWidth(); assert.equal(c.getSnapshot().outputs.length, 1);
  c.setOutput(0, 'width', '600'); c.addRoll(); c.setOutput(1, 'gross', '7'); c.setOutput(0, 'width', '700'); c.confirmWidth();
  assert.equal(c.getSnapshot().outputs.length, 2); assert.equal(c.getSnapshot().outputs[1].gross, '7');
  const secondId = c.getSnapshot().outputs[1].id; c.removeRoll(0);
  assert.equal(c.getSnapshot().outputs[0].id, secondId); assert.equal(c.getSnapshot().outputs[0].gross, '7');
});
test('cancelling printer selection does not mutate stock', async () => {
  const h = setup(); await fill(h.controller); h.setPick(null); await h.controller.save();
  assert.equal(h.stockCalls.length, 0); assert.equal(h.prints.length, 0); assert.equal(h.controller.getSnapshot().source.barcode, 'parent');
});
test('waste discrepancy displays issue, records note, then allows same measured stock with issue ID', async () => {
  const h = setup(); await fill(h.controller); h.controller.setWaste('1'); await h.controller.save();
  assert.equal(h.stockCalls.length, 0); assert.equal(h.controller.getSnapshot().showIssue, true); assert.deepEqual(h.notices, ['issue-visible']);
  h.controller.setIssueNote('  Tarozi  '); await h.controller.saveIssue();
  assert.equal(h.issueCalls.length, 1); assert.equal(h.issueCalls[0].note, 'Tarozi');
  assert.equal(h.controller.getSnapshot().savedIssueId, 'issue-1');
  await h.controller.save(); assert.equal(h.stockCalls[0].issue_id, 'issue-1'); assert.equal(h.stockCalls[0].waste_kg, '1.000000');
  assert.equal(h.prints.length, 1); assert.equal(h.controller.getSnapshot().source, null); assert.ok(h.notices.includes('Chop etildi'));
});
test('validation happens before requesting a new ID for stock or issue commands', async () => {
  const h = setup(); let ids = 0;
  h.options.requestId = async () => { ids++; throw new Error('clock unavailable'); };
  await fill(h.controller); h.controller.setWaste('1'); await h.controller.save();
  assert.equal(ids, 0); assert.equal(h.controller.getSnapshot().showIssue, true);
  assert.deepEqual(h.notices, ['issue-visible']); assert.deepEqual(h.stockCalls, []);
  h.controller.setIssueNote('cause'); h.controller.setOutput(0, 'length', ''); await h.controller.saveIssue();
  assert.equal(ids, 0); assert.match(h.controller.getSnapshot().issueError, /metrajini kiriting/); assert.deepEqual(h.issueCalls, []);
  h.controller.setOutput(0, 'length', '1000'); await h.controller.saveIssue();
  assert.equal(ids, 1); assert.equal(h.controller.getSnapshot().issueError, 'clock unavailable'); assert.deepEqual(h.issueCalls, []);
});
test('Home and issue form render Dart validation exceptions using their V2 handlers', async () => {
  const h = setup(); await h.controller.reload(); await h.controller.lookup('parent');
  await h.controller.save();
  assert.equal(h.controller.getSnapshot().error, 'FormatException: Har bir rulon enini kiriting');
  await fill(h.controller); h.controller.setIssueNote('cause'); await h.controller.saveIssue();
  assert.equal(h.controller.getSnapshot().issueError, 'Bad state: Hisob teng, vazn xatosi yo‘q');
  h.controller.setIssueNote(''); await h.controller.saveIssue();
  assert.equal(h.controller.getSnapshot().issueError, 'Farq sababini yozing');
  h.controller.setIssueNote('cause'); h.controller.setOutput(0, 'length', ''); await h.controller.saveIssue();
  assert.equal(h.controller.getSnapshot().issueError, 'Har bir rulonning metrajini kiriting');
  assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []);
});
test('Home shows the V2 FormatException text for a source without a revision', async () => {
  const h = setup({ rawSplitSource: async () => { throw new model.RawSplitFormatException('Rulon versiyasi olinmadi'); } });
  await h.controller.reload(); await h.controller.lookup('parent');
  assert.equal(h.controller.getSnapshot().error, 'FormatException: Rulon versiyasi olinmadi');
});
test('after committed stock, print failure reports reprint context and never resubmits stock', async () => {
  const h = setup(); h.options.print = async () => { throw new Error('printer offline'); };
  // The controller retains the same options object, so the simulated printer can fail after save.
  await fill(h.controller); await h.controller.save();
  assert.equal(h.stockCalls.length, 1); assert.equal(h.controller.getSnapshot().saved.id, 'split-result');
  assert.equal(h.controller.getSnapshot().error, 'Omborga saqlandi. Chop etish: printer offline');
  assert.equal(h.controller.getSnapshot().source, null);
});
test('account change while lookup is pending does not apply another account’s source', async () => {
  let resolve; const h = setup({ rawSplitSource: () => new Promise(r => { resolve = r; }) });
  await h.controller.reload(); const pending = h.controller.lookup('parent'); h.setScope('account-b'); resolve(source); await pending;
  assert.equal(h.controller.getSnapshot().source, null); assert.equal(h.controller.getSnapshot().error, null);
});
test('lost response reloads durable command and retry reuses exactly that command', async () => {
  const h = setup(); let count = 0;
  h.ops.rawSplitSave = async (_session, payload) => {
    h.stockCalls.push(payload); count++; if (count === 1) { h.setPending(payload); throw new Error('lost'); }
    h.setPending(null); return result;
  };
  await fill(h.controller); await h.controller.save(); const pending = h.controller.getSnapshot().pending;
  assert.equal(h.controller.locked, true); assert.equal(pending.request_id, 'split-id');
  await h.controller.save(true); assert.deepEqual(h.stockCalls, [pending, pending]); assert.equal(h.controller.getSnapshot().pending, null);
});

test('unsupported printer is reported before any stock write', async () => {
  const h = setup(); h.options.printerSupported = () => false; await fill(h.controller); await h.controller.save();
  assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.prints, []); assert.ok(h.notices.includes('unsupported-printer'));
  assert.equal(h.controller.getSnapshot().source.barcode, 'parent');
});

test('same-account new login cannot apply an old controller lookup result or emit state updates', async () => {
  let resolve, current = true, updates = 0; const h = setup({ rawSplitSource: () => new Promise(r => { resolve = r; }),
    rawSplitSessionIsCurrent: () => current }); await h.controller.reload(); h.controller.subscribe(() => updates++);
  const pending = h.controller.lookup('parent'); current = false; const count = updates; resolve(source); await pending;
  assert.equal(h.controller.getSnapshot().source, null); assert.equal(updates, count); assert.deepEqual(h.notices, []);
});

test('manual lookup uses the V2 last duplicate barcode and rejects invalid UTF-8 before any API call', async () => {
  const requested = [], h = setup({ rawSplitSource: async (_ticket, code) => { requested.push(code); return source; } });
  await h.controller.reload(); await h.controller.lookup('https://example.test/path?barcode=A&barcode=B');
  await h.controller.lookup('https://%FF/a'); await h.controller.lookup('https:30/40');
  assert.deepEqual(requested, ['B', 'a', 'https:30/40']);
  await assert.rejects(h.controller.lookup('https://example.test/path?barcode=%FF'), URIError);
  assert.deepEqual(requested, ['B', 'a', 'https:30/40']);
});


test('read-only security hold blocks stock and issue writes before picking a printer', async () => {
  const h = setup(); let picked = 0; h.options.canMutate = () => false; h.options.selectPrinter = async () => { picked++; return null; };
  await fill(h.controller); await h.controller.save(); assert.match(h.controller.getSnapshot().error, /Sessiya xavfsizligi/);
  h.controller.setWaste('1'); h.controller.setIssueNote('cause'); await h.controller.saveIssue();
  assert.equal(picked, 0); assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []);
  assert.match(h.controller.getSnapshot().issueError, /Sessiya xavfsizligi/);
});
test('session write permission lost during device choice prevents a later stock request', async () => {
  const h = setup(); let allowed = true, resolve; h.options.canMutate = () => allowed;
  h.options.selectPrinter = () => new Promise(done => { resolve = done; }); await fill(h.controller);
  const pending = h.controller.save(); await new Promise(done => setImmediate(done)); allowed = false;
  resolve({ transport: 'bluetooth', printer: {} }); await pending; assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.prints, []);
});

test('permission revoked after committed stock prevents printing without resending or erasing the saved result', async () => {
  const h = setup(); let allowed = true, printing = 0; h.options.canMutate = () => allowed;
  h.ops.rawSplitSave = async (_ticket, payload) => { h.stockCalls.push(payload); allowed = false; return result; };
  h.options.print = async (_result, _device, _wifi, guard) => { guard(); printing++; };
  await fill(h.controller); await h.controller.save(); assert.equal(h.stockCalls.length, 1); assert.equal(printing, 0);
  assert.equal(h.controller.getSnapshot().saved, result); assert.equal(h.controller.getSnapshot().source, null);
  assert.match(h.controller.getSnapshot().error, /Omborga saqlandi/); await h.controller.save(); assert.equal(h.stockCalls.length, 1);
});
test('async or throwing write guards fail closed without an unhandled rejection', async () => {
  for (const guard of [() => Promise.resolve(true), () => Promise.reject(new Error('no')), () => { throw new Error('no'); }]) {
    const h = setup(); h.options.canMutate = guard; await fill(h.controller); await h.controller.save(); h.controller.setWaste('1'); h.controller.setIssueNote('cause'); await h.controller.saveIssue();
    assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('read-only mode still performs local waste validation and reveals the issue form without writing', async () => {
  const h = setup(); h.options.canMutate = () => false; await fill(h.controller); h.controller.setWaste('1'); await h.controller.save();
  assert.equal(h.controller.getSnapshot().showIssue, true); assert.ok(h.notices.includes('issue-visible'));
  assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []); assert.deepEqual(h.prints, []);
});

test('same-kind USB Zebra replacement cannot reach stock save or a print bridge', async () => {
  const runtime = load('homashyo/rawSplitPrintRuntime', { './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true }, 'react-native': { Platform: { OS: 'android' } }, '../printing/printService': {}, './rawSplitApi': {}, './rawSplitPrinting': {} });
  for (const deviceName of ['Zebra-A', 'Zebra-B']) {
    const h = setup(); h.setPick({ transport: 'offline', printer: { kind: 'zebra', deviceName } });
    h.options.printerSupported = runtime.rawSplitPrinterSupported; await fill(h.controller); await h.controller.save();
    assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.prints, []); assert.ok(h.notices.includes('unsupported-printer'));
  }
});

test('iOS Bluetooth without native selected-UUID recheck cannot commit stock', async () => {
  const runtime = load('homashyo/rawSplitPrintRuntime', { './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true }, 'react-native': { Platform: { OS: 'ios' } }, '../printing/printService': {}, './rawSplitApi': {}, './rawSplitPrinting': {} });
  const h = setup(); h.setPick({ transport: 'bluetooth', printer: { address: 'A' } }); h.options.printerSupported = runtime.rawSplitPrinterSupported;
  await fill(h.controller); await h.controller.save(); assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.prints, []); assert.ok(h.notices.includes('unsupported-printer'));
});

test('a rejected mismatched stock response cannot start any label printing', async () => {
  const h = setup(); h.ops.rawSplitSave = async () => { throw new Error('Boshqa bo‘lish natijasi olindi. Natijani qayta tekshiring.'); };
  await fill(h.controller); await h.controller.save(); assert.deepEqual(h.prints, []);
  assert.match(h.controller.getSnapshot().error, /Boshqa bo‘lish natijasi/);
});

// Pending-key safety regressions. All storage, requests, printer and session boundaries are in memory.
const tick = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('unread gate blocks every stock and issue entry point, lookup, printer and edits from construction', async () => {
  const h = setup(); let picks = 0, sources = 0, ids = 0;
  h.options.selectPrinter = async () => { picks++; return { transport: 'bluetooth', printer: {} }; };
  h.options.requestId = async () => { ids++; return 'id'; }; h.ops.rawSplitSource = async () => { sources++; return source; };
  assert.equal(h.controller.getSnapshot().pendingCheck, 'unread'); assert.equal(h.controller.locked, true);
  h.controller.setBarcode('old'); h.controller.setWaste('2'); h.controller.setIssueNote('x'); h.controller.setWifiPrinter('zebra');
  await h.controller.lookup('parent'); await h.controller.save(); await h.controller.save(true);
  await h.controller.saveIssue(); await h.controller.saveIssue(true); await h.controller.selectPrinter();
  assert.equal(h.controller.getSnapshot().barcode, ''); assert.equal(h.controller.getSnapshot().wifiPrinter, 'godex');
  assert.deepEqual([picks, sources, ids, h.stockCalls.length, h.issueCalls.length, h.prints.length], [0, 0, 0, 0, 0, 0]);
});
for (const failed of ['stock', 'issue']) test(`failed ${failed} pending read stays locked; explicit status-only recheck rereads both keys atomically`, async () => {
  let bad = true, stockReads = 0, issueReads = 0, snapshots = 0, sources = 0, picks = 0;
  const oldStock = { request_id: 'old-stock' }, oldIssue = { command: { request_id: 'old-issue' }, note: 'x' };
  const h = setup({ rawSplitPending: async () => { stockReads++; if (bad && failed === 'stock') throw new Error('stock storage failed'); return oldStock; },
    rawSplitIssuePending: async () => { issueReads++; if (bad && failed === 'issue') throw new Error('issue storage failed'); return oldIssue; },
    rawSplitSnapshot: async () => { snapshots++; return new model.RawSplitSnapshot({ warehouses: [], history: [], issues: [] }); },
    rawSplitSource: async () => { sources++; return source; } });
  h.options.selectPrinter = async () => { picks++; return null; };
  await h.controller.reload(); let state = h.controller.getSnapshot();
  assert.equal(state.pendingCheck, 'failed'); assert.match(state.pendingCheckError, /storage failed/); assert.equal(state.busy, false);
  assert.equal(state.pending, null); assert.equal(state.pendingIssue, null); assert.equal(h.controller.locked, true);
  await h.controller.lookup('parent'); await h.controller.save(); await h.controller.save(true);
  await h.controller.saveIssue(); await h.controller.saveIssue(true); await h.controller.selectPrinter();
  assert.deepEqual([sources, picks, h.stockCalls.length, h.issueCalls.length, h.prints.length], [0, 0, 0, 0, 0]);
  const previous = [stockReads, issueReads, snapshots]; bad = false; await h.controller.recheckPending(); state = h.controller.getSnapshot();
  assert.deepEqual([stockReads, issueReads, snapshots], [previous[0] + 1, previous[1] + 1, previous[2]]);
  assert.equal(state.pendingCheck, 'ready'); assert.equal(state.pendingCheckError, null); assert.deepEqual(state.pending, oldStock);
  assert.deepEqual(state.pendingIssue, oldIssue); assert.equal(h.controller.locked, true); assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []);
});
for (const pair of [[null, null], [{ request_id: 'stock' }, null], [null, { command: { request_id: 'issue' }, note: 'x' }],
  [{ request_id: 'stock' }, { command: { request_id: 'issue' }, note: 'x' }]]) test(`successful status check preserves ${pair.filter(Boolean).length} old pending keys`, async () => {
  const h = setup(); h.setPending(pair[0]); h.setPendingIssue(pair[1]); await h.controller.recheckPending();
  assert.equal(h.controller.getSnapshot().pendingCheck, 'ready'); assert.deepEqual(h.controller.getSnapshot().pending, pair[0]);
  assert.deepEqual(h.controller.getSnapshot().pendingIssue, pair[1]); assert.equal(h.controller.locked, pair.some(Boolean));
  assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.issueCalls, []); assert.deepEqual(h.prints, []);
});
test('snapshot-only failure leaves verified status usable and a later status check does not clear that separate error', async () => {
  const h = setup({ rawSplitSnapshot: async () => { throw new Error('snapshot offline'); } }); await h.controller.reload();
  assert.equal(h.controller.getSnapshot().pendingCheck, 'ready'); assert.equal(h.controller.locked, false);
  assert.equal(h.controller.getSnapshot().snapshotError, 'snapshot offline'); await h.controller.recheckPending();
  assert.equal(h.controller.getSnapshot().snapshotError, 'snapshot offline'); assert.equal(h.controller.getSnapshot().pendingCheck, 'ready');
  await h.controller.lookup('parent'); assert.equal(h.controller.getSnapshot().source.barcode, 'parent');
});
test('concurrent StrictMode reload and status retry share one read pair; an in-flight write rejects status recheck', async () => {
  const hold = defer(); let reads = 0, issues = 0; const h = setup({ rawSplitPending: () => { reads++; return hold.promise; },
    rawSplitIssuePending: async () => { issues++; return null; } });
  const first = h.controller.reload(); await h.controller.reload(); await h.controller.recheckPending(); assert.equal(reads, 1);
  hold.resolve(null); await first; assert.equal(issues, 1); assert.equal(h.controller.getSnapshot().pendingCheck, 'ready');
  const saving = defer(); await fill(h.controller); h.ops.rawSplitSave = async () => saving.promise;
  const op = h.controller.save(); await tick(); const before = reads; await h.controller.recheckPending(); assert.equal(reads, before);
  saving.reject(new Error('unknown')); await op; assert.equal(reads, before + 1); assert.equal(h.controller.getSnapshot().pendingCheck, 'ready');
});
for (const which of ['stock', 'issue']) test(`subscriber cannot exploit busy-release gap after uncertain ${which} write`, async () => {
  const h = setup(); await fill(h.controller); let failRead = false, sourceCalls = 0, attempts = 0;
  h.ops.rawSplitSource = async () => { sourceCalls++; return source; };
  h.ops.rawSplitPending = async () => { if (failRead) throw new Error('storage unavailable'); return null; };
  if (which === 'stock') h.ops.rawSplitSave = async (_ticket, payload) => { h.stockCalls.push(payload); failRead = true; throw new Error('lost'); };
  else { h.controller.setWaste('1'); h.controller.setIssueNote('cause'); h.ops.rawSplitReportIssue = async (_ticket, payload) => { h.issueCalls.push(payload); failRead = true; throw new Error('lost'); }; }
  h.controller.subscribe(() => { const s = h.controller.getSnapshot(); if (!s.busy && s.pendingCheck !== 'ready') {
    attempts++; void h.controller.lookup('parent'); void h.controller.save(); void h.controller.save(true);
    void h.controller.saveIssue(); void h.controller.saveIssue(true); void h.controller.selectPrinter();
  } });
  if (which === 'stock') await h.controller.save(); else await h.controller.saveIssue(); await tick();
  assert.ok(attempts > 0); assert.equal(h.controller.getSnapshot().pendingCheck, 'failed'); assert.equal(h.controller.getSnapshot().busy, false);
  assert.equal(sourceCalls, 0); assert.equal(h.stockCalls.length, which === 'stock' ? 1 : 0);
  assert.equal(h.issueCalls.length, which === 'issue' ? 1 : 0); assert.deepEqual(h.prints, []);
});
for (const at of ['stock', 'issue', 'snapshot']) test(`account change during ${at} await never publishes a verified pair to an old owner`, async () => {
  const wait = defer(); let current = true, secondReads = 0, updates = 0;
  const h = setup({ rawSplitSessionIsCurrent: () => current,
    rawSplitPending: at === 'stock' ? () => wait.promise : async () => ({ request_id: 'old' }),
    rawSplitIssuePending: at === 'issue' ? () => wait.promise : async () => { secondReads++; return null; },
    rawSplitSnapshot: at === 'snapshot' ? () => wait.promise : async () => new model.RawSplitSnapshot({ warehouses: [], history: [], issues: [] }) });
  h.controller.subscribe(() => updates++); const op = h.controller.reload(); await tick(); const before = updates; current = false;
  wait.resolve(at === 'snapshot' ? new model.RawSplitSnapshot({ warehouses: ['old'], history: [], issues: [] }) : null); await op;
  assert.equal(updates, before); if (at !== 'snapshot') { assert.equal(h.controller.getSnapshot().pendingCheck, 'checking'); assert.equal(h.controller.getSnapshot().pending, null); }
  else assert.equal(h.controller.getSnapshot().snapshot, null);
  await h.controller.lookup('parent'); await h.controller.save(true); assert.deepEqual(h.stockCalls, []); assert.equal(secondReads, at === 'stock' ? 0 : at === 'snapshot' ? 1 : 0);
});
test('a completed recheck cannot revive an old Home printer selection lease', async () => {
  const h = setup(); await h.controller.recheckPending(); const picker = defer(); h.options.selectPrinter = () => picker.promise;
  const old = h.controller.selectPrinter(); await h.controller.recheckPending(); picker.resolve({ transport: 'bluetooth', printer: {} });
  assert.equal(await old, false); assert.equal(h.controller.getSnapshot().printer, null);
});

test('an explicitly selected pending issue retry uses the original command after both reads are verified', async () => {
  const h = setup(), old = { command: { request_id: 'old-issue' }, note: 'x' }; h.setPendingIssue(old);
  h.ops.rawSplitReportIssue = async (_ticket, payload) => { h.issueCalls.push(payload); h.setPendingIssue(null); return { id: 'issue' }; };
  await h.controller.recheckPending(); await h.controller.saveIssue(); assert.deepEqual(h.issueCalls, []);
  await h.controller.saveIssue(true); assert.deepEqual(h.issueCalls, [old]); assert.equal(h.controller.getSnapshot().pendingIssue, null);
});
function sharedHistory(h, selectPrinter = h.options.selectPrinter, printOne = async () => {}) {
  const { RawSplitHistoryController } = load('homashyo/rawSplitHistoryController', { './rawSplitModel': model, '../shared/camera/synchronousGuard': syncGuard,
    './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => true }, './rawSplitApi': { rawSplitSessionIsCurrent: () => true } });
  const options = { ticket: h.options.ticket, scope: () => h.ops.rawSplitScope(), capturePrintLease: h.controller.captureClearLease,
    canMutate: () => true, selectPrinter, printOne, onMessage: value => h.notices.push(value), printerSupported: () => true, onUnsupportedPrinter: () => {} };
  return { controller: new RawSplitHistoryController(options), options };
}
test('deep-linked History cannot pick or print while unread, failed, or either old command remains', async () => {
  let picks = 0, labels = 0, bad = true;
  const h = setup({ rawSplitPending: async () => { if (bad) throw new Error('storage'); return null; } });
  const history = sharedHistory(h, async () => { picks++; return { transport: 'bluetooth', printer: {} }; }, async () => { labels++; });
  await history.controller.selectPrinter(); await history.controller.reprint(result); assert.deepEqual([picks, labels], [0, 0]);
  await h.controller.recheckPending(); await history.controller.selectPrinter(); await history.controller.reprint(result); assert.deepEqual([picks, labels], [0, 0]);
  bad = false; h.ops.rawSplitPending = async () => ({ request_id: 'old' }); await h.controller.recheckPending();
  await history.controller.selectPrinter(); await history.controller.reprint(result); assert.deepEqual([picks, labels], [0, 0]);
  h.ops.rawSplitPending = async () => null; h.setPendingIssue({ command: { request_id: 'issue' }, note: 'x' }); await h.controller.recheckPending();
  await history.controller.reprint(result); assert.deepEqual([picks, labels], [0, 0]);
  h.setPendingIssue(null); await h.controller.recheckPending(); await history.controller.reprint(result);
  assert.deepEqual([picks, labels], [1, 2]); history.controller.dispose();
});
test('History picker lease cannot revive after a completed status recheck', async () => {
  const h = setup(), picker = defer(); let labels = 0; await h.controller.recheckPending();
  const history = sharedHistory(h, () => picker.promise, async () => { labels++; }); const op = history.controller.reprint(result);
  await tick(); await h.controller.recheckPending(); picker.resolve({ transport: 'bluetooth', printer: {} }); await op;
  assert.equal(history.controller.getSnapshot().printer, null); assert.equal(labels, 0); assert.deepEqual(h.notices, []);
});
test('a recheck between History labels retires the original print lease even after successful verification', async () => {
  const h = setup(), wait = defer(); const labels = []; await h.controller.recheckPending();
  const history = sharedHistory(h, async () => ({ transport: 'bluetooth', printer: {} }), async (_r, output, _p, _w, guard) => {
    guard(); labels.push(output.barcode); if (labels.length === 1) await wait.promise;
  });
  const op = history.controller.reprint(result); await tick(); assert.deepEqual(labels, ['child1']);
  await h.controller.recheckPending(); wait.resolve(); await op; assert.deepEqual(labels, ['child1']); assert.deepEqual(h.notices, []);
});
test('History printer, reprint and status recheck stay blocked while Home stock persistence is in flight', async () => {
  const h = setup(); await fill(h.controller); let picks = 0, labels = 0, reads = 0; const wait = defer();
  h.ops.rawSplitPending = async () => { reads++; return null; }; h.ops.rawSplitSave = async () => wait.promise;
  const history = sharedHistory(h, async () => { picks++; return { transport: 'bluetooth', printer: {} }; }, async () => { labels++; });
  const save = h.controller.save(); await tick(); const before = reads; await h.controller.recheckPending();
  await history.controller.selectPrinter(); await history.controller.reprint(result); assert.deepEqual([reads, picks, labels], [before, 0, 0]);
  wait.resolve(result); await save; assert.equal(h.controller.getSnapshot().pendingCheck, 'ready'); history.controller.dispose();
});

test('a hanging independent snapshot does not hide the failure or block a status-only retry', async () => {
  const snapshot = defer(); let broken = true, reads = 0; const h = setup({
    rawSplitPending: async () => { reads++; if (broken) throw new Error('local read failed'); return null; },
    rawSplitSnapshot: () => snapshot.promise });
  const initial = h.controller.reload(); await tick(); assert.equal(h.controller.getSnapshot().pendingCheck, 'failed');
  assert.equal(h.controller.getSnapshot().busy, false); broken = false; await h.controller.recheckPending();
  assert.equal(h.controller.getSnapshot().pendingCheck, 'ready'); assert.equal(h.controller.locked, false); assert.equal(reads, 2);
  snapshot.resolve(new model.RawSplitSnapshot({ warehouses: ['Raw W'], history: [], issues: [] })); await initial;
  assert.equal(h.controller.getSnapshot().snapshot.warehouses[0], 'Raw W'); assert.deepEqual(h.stockCalls, []); assert.deepEqual(h.prints, []);
});
test('an older snapshot after a failed pending check cannot overwrite a newer independent snapshot', async () => {
  const old = defer(); let failed = true, snapshots = 0; const h = setup({ rawSplitPending: async () => { if (failed) throw new Error('disk'); return null; },
    rawSplitSnapshot: async () => { snapshots++; return snapshots === 1 ? old.promise : new model.RawSplitSnapshot({ warehouses: ['new'], history: [], issues: [] }); } });
  const first = h.controller.reload(); await tick(); failed = false; await h.controller.reload();
  old.resolve(new model.RawSplitSnapshot({ warehouses: ['old'], history: [], issues: [] })); await first;
  assert.equal(h.controller.getSnapshot().snapshot.warehouses[0], 'new'); assert.equal(h.controller.getSnapshot().pendingCheck, 'ready');
});

test('an old failing snapshot cannot overwrite committed-stock and print-failure feedback during post-save pending read', async () => {
  const oldSnapshot = defer(), postSaveRead = defer(); let phase = 'failed';
  const h = setup({ rawSplitPending: async () => { if (phase === 'failed') throw new Error('disk'); if (phase === 'after-save') return postSaveRead.promise; return { request_id: 'old' }; },
    rawSplitSnapshot: () => oldSnapshot.promise });
  const initial = h.controller.reload(); await tick(); assert.equal(h.controller.getSnapshot().pendingCheck, 'failed');
  phase = 'retry'; await h.controller.recheckPending(); h.options.print = async () => { throw new Error('printer failed'); };
  h.ops.rawSplitSave = async () => { phase = 'after-save'; return result; };
  const save = h.controller.save(true); await tick(); assert.equal(h.controller.getSnapshot().error, 'Omborga saqlandi. Chop etish: printer failed');
  oldSnapshot.reject(new Error('old snapshot failed')); await initial;
  assert.equal(h.controller.getSnapshot().error, 'Omborga saqlandi. Chop etish: printer failed');
  assert.equal(h.controller.getSnapshot().snapshotError, 'old snapshot failed');
  h.ops.rawSplitSnapshot = async () => new model.RawSplitSnapshot({ warehouses: [], history: [], issues: [] });
  postSaveRead.resolve(null); await save; assert.equal(h.controller.getSnapshot().error, 'Omborga saqlandi. Chop etish: printer failed');
});
test('production hold blocks all direct Home stock, issue, retry and printer paths after successful checks', async () => {
  const Held = load('homashyo/rawSplitController', { '../shared/camera/synchronousGuard': syncGuard, './rawSplitWritePolicy': { rawSplitWriteDispatchAllowed: () => false },
    './rawSplitBarcode': barcode, './rawSplitApi': {}, './rawSplitDraft': draft, './rawSplitModel': model, './rawSplitWidthPlan': width }).RawSplitController;
  const h = setup(); let picks = 0, ids = 0; h.options.selectPrinter = async () => { picks++; return null; }; h.options.requestId = async () => { ids++; return 'x'; };
  const c = new Held(h.options); await c.recheckPending(); assert.equal(c.writesHeld, true); await c.lookup('parent');
  await c.save(); await c.save(true); await c.saveIssue(); await c.saveIssue(true); await c.selectPrinter();
  assert.deepEqual([picks, ids, h.stockCalls.length, h.issueCalls.length, h.prints.length], [0, 0, 0, 0, 0]); c.dispose();
});
