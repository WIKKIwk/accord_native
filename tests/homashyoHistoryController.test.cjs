// Source-derived state transitions from raw_material_split_history_screen.dart.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(name, mocks = {}) { const filename = path.resolve(__dirname, `../src/homashyo/${name}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const syncGuard = load('../shared/camera/synchronousGuard');
const model = load('rawSplitModel'), { RawSplitHistoryController } = load('rawSplitHistoryController', { '../shared/camera/synchronousGuard': syncGuard, './rawSplitApi': { rawSplitSessionIsCurrent: ticket => { try { ticket.check(); return true; } catch { return false; } } } });
const source = { revision: '1', stock_id: 'parent', barcode: 'parent', warehouse: 'Raw W', item_code: 'FILM', item_name: 'Film', kg: '100', width_mm: '1000', micron: '20' };
const result = new model.RawSplitResult({ id: 'result', source, source_kg: '100', output_kg: '98', waste_kg: '2', outputs: [
  { ...source, stock_id: 'c1', barcode: 'c1', kg: '39', gross_kg: '40', bobina_kg: '1', width_mm: '400' },
  { ...source, stock_id: 'c2', barcode: 'c2', kg: '59', gross_kg: '60', bobina_kg: '1', width_mm: '600' }] });
function setup() {
  let selection = { transport: 'bluetooth', printer: {} }, calls = [], notices = [];
  const options = { ticket: { session: {}, check() {} }, canMutate: () => true, snapshot: async () => new model.RawSplitSnapshot({ warehouses: ['Raw W'], history: [], issues: [] }),
    scope: () => 'account-1', selectPrinter: async () => selection, printOne: async (_result, output) => { calls.push(output.barcode); }, onMessage: message => notices.push(message),
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

test('account change during device selection cannot print or select for the new account', async () => {
  const h = setup(); let account = 'account-1', complete; h.options.scope = () => account;
  const scoped = new RawSplitHistoryController(h.options);
  h.options.selectPrinter = () => new Promise(resolve => { complete = resolve; });
  const pending = scoped.reprint(result); account = 'account-2'; complete({ transport: 'bluetooth', printer: {} }); await pending;
  assert.deepEqual(h.calls, []); assert.equal(scoped.getSnapshot().printer, null); assert.equal(scoped.getSnapshot().error, null);
});
test('account change between physical labels prevents later labels and success notice', async () => {
  const h = setup(); let account = 'account-1'; h.options.scope = () => account; const scoped = new RawSplitHistoryController(h.options);
  h.options.printOne = async (_result, output, _printer, _kind, guard) => { guard(); h.calls.push(output.barcode); account = 'account-2'; };
  await scoped.reprint(result); assert.deepEqual(h.calls, ['c1']); assert.deepEqual(h.notices, []);
  assert.equal(scoped.getSnapshot().error, null);
});

test('same-account new login while history loads suppresses old controller state and callbacks', async () => {
  let resolve, current = true, updates = 0; const h = setup(); h.options.ticket = { session: {}, check() { if (!current) throw new Error('old session'); } };
  h.options.snapshot = () => new Promise(r => { resolve = r; }); const controller = new RawSplitHistoryController(h.options);
  controller.subscribe(() => updates++); const pending = controller.reload(); current = false; const count = updates;
  resolve(new model.RawSplitSnapshot({ warehouses: ['old'], history: [], issues: [] })); await pending;
  assert.equal(controller.getSnapshot().snapshot, null); assert.equal(updates, count); assert.deepEqual(h.notices, []);
});

test('a pending reprint blocks a rapid second request while continuing the first job sequentially', async () => {
  const h = setup(); let complete;
  h.options.printOne = async (_result, output, _printer, _kind, guard) => {
    guard(); h.calls.push(output.barcode);
    if (output.barcode === 'c1') await new Promise(resolve => { complete = resolve; });
  };
  const first = h.c.reprint(result); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.calls, ['c1']); assert.equal(h.c.getSnapshot().busy, true);
  await h.c.reprint(result); assert.deepEqual(h.calls, ['c1']);
  complete(); await first; assert.deepEqual(h.calls, ['c1', 'c2']); assert.deepEqual(h.notices, ['Chop etildi']);
  assert.equal(h.c.getSnapshot().busy, false);
});

test('same-account login change during a pending print suppresses remaining jobs and old-owner updates', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const h = setup(); let current = true, finish, updates = 0;
    h.options.ticket.check = () => { if (!current) throw new Error('old session'); };
    h.options.printOne = async (_result, output, _printer, _kind, guard) => {
      guard(); h.calls.push(output.barcode); await new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; });
    };
    h.c.subscribe(() => updates++); const pending = h.c.reprint(result); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, ['c1']); current = false; const oldUpdates = updates;
    finish(new Error('late printer result')); await pending;
    assert.deepEqual(h.calls, ['c1']); assert.deepEqual(h.notices, []); assert.equal(updates, oldUpdates);
    assert.equal(h.c.getSnapshot().error, null);
  }
});

test('disposing a history owner during a pending print prevents later outputs and notices', async () => {
  const h = setup(); let finish, updates = 0;
  h.options.printOne = async (_result, output) => { h.calls.push(output.barcode); await new Promise(resolve => { finish = resolve; }); };
  h.c.subscribe(() => updates++); const pending = h.c.reprint(result); await new Promise(resolve => setImmediate(resolve));
  h.c.dispose(); const oldUpdates = updates; finish(); await pending;
  assert.deepEqual(h.calls, ['c1']); assert.deepEqual(h.notices, []); assert.equal(updates, oldUpdates);
});


test('read-only session blocks reprints before device selection or printer calls', async () => {
  const h = setup(); let picked = 0; h.options.canMutate = () => false; h.options.selectPrinter = async () => { picked++; return null; };
  await h.c.reprint(result); assert.equal(picked, 0); assert.deepEqual(h.calls, []); assert.match(h.notices[0], /Sessiya xavfsizligi/);
});

test('write witness revoked during a print prevents later output and success notice', async () => {
  const h = setup(); let allowed = true; h.options.canMutate = () => allowed;
  h.options.printOne = async (_result, output, _printer, _kind, guard) => { guard(); h.calls.push(output.barcode); allowed = false; guard(); };
  await h.c.reprint(result); assert.deepEqual(h.calls, ['c1']); assert.deepEqual(h.notices, []);
  assert.match(h.c.getSnapshot().error, /Sessiya xavfsizligi/);
});
