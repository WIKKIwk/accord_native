// @v2-test test/raw_material_split_test.dart: passing lost-response and widget scenarios; source-derived controller transitions.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('homashyo/rawSplitModel'); const width = load('homashyo/rawSplitWidthPlan', { './rawSplitModel': model });
const draft = load('homashyo/rawSplitDraft', { './rawSplitModel': model, './rawSplitWidthPlan': width, 'expo-crypto': {} });
const { RawSplitController } = load('homashyo/rawSplitController', { '../preparation/preparationInventory': { preparationInventoryBarcode: raw => raw.trim() },
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
  const ops = { rawSplitScope: () => scope, rawSplitPending: async () => pending, rawSplitIssuePending: async () => pendingIssue,
    rawSplitSnapshot: async () => snapshot, rawSplitSource: async () => source, rawSplitSave: async (_session, payload) => { stockCalls.push(payload); return result; },
    rawSplitReportIssue: async (_session, payload) => { issueCalls.push(payload); return { id: 'issue-1' }; }, ...overrides };
  const options = { session: {}, operations: ops, requestId: async () => 'split-id', selectPrinter: async () => pick,
    print: async (...args) => { prints.push(args); }, onMessage: value => notices.push(value), onIssueVisible: () => notices.push('issue-visible') };
  const controller = new RawSplitController(options);
  return { controller, ops, stockCalls, issueCalls, prints, notices, options, setScope: value => { scope = value; },
    setPending: value => { pending = value; }, setPendingIssue: value => { pendingIssue = value; }, setPick: value => { pick = value; } };
}
async function fill(c) {
  await c.lookup('parent');
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
test('lookup and width actions preserve partial rows, but remove empty excess rows only', async () => {
  const { controller: c } = setup(); await c.lookup(' parent '); assert.equal(c.getSnapshot().source.barcode, 'parent');
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
  const pending = h.controller.lookup('parent'); h.setScope('account-b'); resolve(source); await pending;
  assert.equal(h.controller.getSnapshot().source, null); assert.equal(h.controller.getSnapshot().error, 'Akkaunt o‘zgargan');
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
