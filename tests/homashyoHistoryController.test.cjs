// Source-derived state transitions from raw_material_split_history_screen.dart.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/homashyo/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const model = load('rawSplitModel'), { RawSplitHistoryController } = load('rawSplitHistoryController', { './rawSplitApi': {} });
const source = { revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM', item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2', outputs: [
  { ...source, stock_id: 'c1', barcode: 'c1', kg: '39', gross_kg: '40', bobina_kg: '1', width_mm: '400' },
  { ...source, stock_id: 'c2', barcode: 'c2', kg: '59', gross_kg: '60', bobina_kg: '1', width_mm: '600' }] });
function setup() {
  let selection = { transport: 'bluetooth', printer: {} }, calls = [], notices = [];
  const options = { session: {}, snapshot: async () => new model.RawSplitSnapshot({ warehouses: ['Raw W'], history: [], issues: [] }),
    selectPrinter: async () => selection, printOne: async (_result, output) => { calls.push(output.barcode); }, onMessage: message => notices.push(message),
    printerSupported: () => true, onUnsupportedPrinter: () => notices.push('unsupported-printer') };
  return { c: new RawSplitHistoryController(options), options, calls, notices, setSelection: value => { selection = value; } };
}
test('history loads snapshot and surfaces errors without manufacturing data', async () => {
  const h = setup(); await h.c.reload(); assert.deepEqual(h.c.getSnapshot().snapshot.warehouses, ['Raw W']);
  h.options.snapshot = async () => { throw new Error('offline'); }; await h.c.reload();
  assert.equal(h.c.getSnapshot().error, 'offline'); assert.equal(h.c.getSnapshot().busy, false);
});
test('cancelling printer selection has no print or success message', async () => {
  const h = setup(); h.setSelection(null); await h.c.reprint(result); assert.deepEqual(h.calls, []); assert.deepEqual(h.notices, []);
});
test('single and all reprints use exact existing outputs, never a stock mutation', async () => {
  const h = setup(); await h.c.reprint(result, result.outputs[1]); await h.c.reprint(result);
  assert.deepEqual(h.calls, ['c2', 'c1', 'c2']); assert.deepEqual(h.notices, ['Chop etildi', 'Chop etildi']);
});
test('printer failure leaves history intact and does not continue subsequent outputs', async () => {
  const h = setup(); await h.c.reload(); h.options.printOne = async (_result, output) => { h.calls.push(output.barcode); throw new Error('offline'); };
  await h.c.reprint(result); assert.deepEqual(h.calls, ['c1']);
  assert.equal(h.c.getSnapshot().error, 'Ombordagi hisob o‘zgarmadi. Chop etish: offline');
  assert.deepEqual(h.c.getSnapshot().snapshot.warehouses, ['Raw W']);
});
test('disposal stops remaining output and success message', async () => {
  const h = setup(); h.options.printOne = async (_result, output) => { h.calls.push(output.barcode); h.c.dispose(); };
  await h.c.reprint(result); assert.deepEqual(h.calls, ['c1']); assert.deepEqual(h.notices, []);
});

test('unsupported printer reports the exclusion without attempting a reprint', async () => {
  const h = setup(); h.options.printerSupported = () => false; await h.c.reprint(result);
  assert.deepEqual(h.calls, []); assert.deepEqual(h.notices, ['unsupported-printer']);
});
