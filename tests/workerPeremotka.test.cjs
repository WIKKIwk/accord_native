const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return mod.exports;
}
const { WorkerPeremotka, workerPeremotkaRows, workerRawQuantity, openWorkerCutPanel } = compile('workerPeremotka.ts');
const tick = () => new Promise(setImmediate), deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const batch = { batch_id: 'roll', label_item_name: 'Mahsulot', order_id: 'order-id', produced_qty: 12.3456, uom: 'kg',
  payload_json: { order_number: '00031', rezka_frame_index: 2, peremotka_reason: '  o‘ralmagan  ' } };
test('peremotka rows retain V2 order-number, slot, full raw quantity and reason order without trimming', () => {
  const rows = workerPeremotkaRows([batch], (key, values) => `${key}:${values.index}`);
  assert.deepEqual(rows, [{ id: 'roll', title: 'Mahsulot', subtitle: '#00031 · worker.rezka.print.peremotka_roll:2 · 12.3456 kg ·   o‘ralmagan  ' }]);
  assert.equal(workerPeremotkaRows([{ ...batch, payload_json: { order_number: 31, rezka_frame_index: 2.5, peremotka_reason: null } }], () => 'bad')[0].subtitle, 'order-id · 12.3456 kg');
  assert.equal(workerPeremotkaRows([{ ...batch, payload_json: { order_number: ' ', peremotka_reason: '' } }], () => '')[0].subtitle, '#  · 12.3456 kg · ');
});
test('raw quantities retain precision, Dart integer spelling and signed zero', () => {
  for (const [value, expected] of [[12, '12'], [12.00004, '12.00004'], [-0, '-0'], [1e-7, '1e-7'], [1e-6, '0.000001'], [1e20, '100000000000000000000'], [1e21, '1e+21']]) assert.equal(workerRawQuantity(value), expected);
});
function setup() {
  const h = { valid: true, reads: 0 }, request = deferred(); h.request = request;
  h.controller = new WorkerPeremotka({ current: () => h.valid, read: async (signal, current) => { assert(current()); h.signal = signal; h.current = current; h.reads++; return request.promise; } });
  h.controller.setVisible(true); return h;
}
test('opening is a single read, double taps do not duplicate it, and server order is retained', async () => {
  const h = setup(); assert.equal(h.reads, 0); const open = h.controller.open(); await h.controller.open(); assert.equal(h.reads, 1);
  assert.equal(h.controller.getSnapshot().phase, 'loading'); h.request.resolve([batch, { ...batch, batch_id: 'two' }]); await open;
  assert.equal(h.controller.getSnapshot().phase, 'ready'); assert.deepEqual(h.controller.getSnapshot().batches.map(row => row.batch_id), ['roll', 'two']);
});
test('dismiss aborts its read and ignores a delayed result', async () => {
  const h = setup(), open = h.controller.open(); h.controller.close(); assert(h.signal.aborted); h.request.resolve([batch]); await open;
  assert.equal(h.controller.getSnapshot().phase, 'closed'); assert.deepEqual(h.controller.getSnapshot().batches, []);
});
test('losing the route or session closes the picker and cannot revive an old result', async () => {
  for (const action of ['hide', 'invalidate']) { const h = setup(), open = h.controller.open();
    if (action === 'hide') h.controller.setVisible(false); else { h.valid = false; h.controller.invalidate(); }
    h.request.resolve([batch]); await open; assert.equal(h.controller.getSnapshot().phase, 'closed'); assert.equal(h.current(), false);
    await h.controller.open(); assert.equal(h.reads, 1);
  }
});
test('read failure shows sync error while a valid empty response stays ready/empty', async () => {
  for (const failed of [false, true]) {
    const owner = new WorkerPeremotka({ current: () => true, read: async () => { if (failed) throw Error('offline'); return []; } });
    owner.setVisible(true); await owner.open(); assert.equal(owner.getSnapshot().phase, failed ? 'error' : 'ready'); assert.deepEqual(owner.getSnapshot().batches, []);
  }
});
test('reopening starts a fresh read and cannot accept the prior closed request', async () => {
  const reads = [], owner = new WorkerPeremotka({ current: () => true, read: () => { const d = deferred(); reads.push(d); return d.promise; } });
  owner.setVisible(true); const first = owner.open(); owner.close(); const second = owner.open(); reads[1].resolve([{ ...batch, batch_id: 'fresh' }]); await second;
  reads[0].resolve([batch]); await first; assert.equal(owner.getSnapshot().batches[0].batch_id, 'fresh');
});

test('queued toolbar taps cannot present the pallet picker and peremotka sheet together', () => {
  for (const first of ['paddon', 'peremotka']) {
    let busy = false, phase = 'closed'; const opened = [];
    const paddon = { getSnapshot: () => ({ busy }), open: async () => { busy = true; opened.push('paddon'); } };
    const peremotka = { getSnapshot: () => ({ phase }), open: async () => { phase = 'loading'; opened.push('peremotka'); } };
    openWorkerCutPanel(first, paddon, peremotka); openWorkerCutPanel(first === 'paddon' ? 'peremotka' : 'paddon', paddon, peremotka);
    assert.deepEqual(opened, [first]);
  }
});

test('hook scopes the V2 one-shot peremotka read and invalidates a lost session', async () => {
  const effects = [], h = { valid: true, calls: [] }, session = { assigned_apparatus: ['apparatus:default:cut'] };
  const hook = compile('components/useWorkerPeremotka.ts', { react: { useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, get) => get() },
    'expo-router': { useFocusEffect: fn => effects.push(fn) }, '../auth': { captureSessionWitness: () => ({}), isSessionWitnessCurrent: () => h.valid, subscribeSessionWitness: fn => { h.witness = fn; return () => {}; } },
    '../sessionReadScope': { sessionReadScope: () => 'scope' }, '../workerPeremotka': { WorkerPeremotka, workerPeremotkaRows },
    '../workerWipApi': { adminWipBatches: async (_session, options) => { assert(options.current()); h.calls.push(options); return []; } },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ p: key => key }) } }).useWorkerPeremotka;
  const model = hook(session, session.assigned_apparatus[0], true), cleanup = effects.map(fn => fn()); assert.equal(h.calls.length, 0);
  await model.controller.open(); assert.deepEqual({ apparatus: h.calls[0].apparatus, status: h.calls[0].status, limit: h.calls[0].limit }, { apparatus: 'apparatus:default:cut', status: 'peremotka', limit: 500 });
  h.valid = false; h.witness(); assert.equal(model.controller.getSnapshot().phase, 'closed'); await model.controller.open(); assert.equal(h.calls.length, 1);
  cleanup.forEach(fn => fn?.()); await tick();
});
