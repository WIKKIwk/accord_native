const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(relative, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${relative}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const errors = compile('shared/mobileApiException'), model = compile('gscale/gscaleBatchModel'), { MaterialGScalePolicy } = compile('gscale/gscaleMaterialPolicy');
const selected = { transport: 'offline', offlinePrinter: { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f, productId: 1,
  deviceName: '/dev/usb/1', manufacturerName: 'Zebra', productName: 'ZD' } };
const active = { id: 'b', revision: 2, active: true, printer: 'zebra', driver_url: 'usb://local' };
const body = { batch_id: 'b', expected_revision: 2, expected_item_code: 'I', expected_warehouse: 'W', gross_qty: 2, driver_url: 'usb://local' };
const start = { client_batch_id: '', item_code: 'I', item_name: 'Item', warehouse: 'W', printer: 'zebra', print_mode: 'rfid',
  driver_url: 'usb://local', quantity_source: 'manual' };
function setup(change) {
  const session = { token: 'old', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'x' }, capabilities: ['gscale.print'] };
  let activeSession = true, fetches = 0, guards = 0;
  const scope = () => JSON.stringify([session.profile.role, session.profile.ref, session.capabilities]), initialScope = scope();
  const auth = { activeSessionToken: () => activeSession ? session.token : null, refreshSession: async () => {
    session.token = 'fresh';
    if (change === 'role') session.profile.role = 'tayyorlov_masteri';
    if (change === 'capability') session.capabilities = [];
    if (change === 'account') activeSession = false;
    return true;
  } };
  const authorized = compile('authorizedFetch', { './auth': auth });
  const batch = compile('gscale/gscaleBatchApi', { '../authorizedFetch': authorized, '../shared/mobileApiException': errors, './gscaleBatchModel': model });
  const print = compile('shared/printApi', { '../authorizedFetch': authorized, './mobileApiException': errors,
    '../workerPrintJob': { printJobFromJson: () => ({}) } });
  const previousFetch = global.fetch; global.fetch = async () => {
    fetches++; return new Response(fetches === 1 ? '{"error":"expired"}' : '{"ok":true,"batch":{},"stock":{},"print":{}}',
      { status: fetches === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } });
  };
  const policy = new MaterialGScalePolicy(() => activeSession && scope() === initialScope);
  const guard = operation => () => { guards++; policy.assertOperation(operation, { device: { selection: selected, transport: 'offline', needsAttention: false },
    draft: { printer: 'zebra' }, batch: { resolved: true, batch: operation === 'stop' || operation === 'print' ? active : null } }); };
  return { session, batch, print, guard, counts: () => ({ fetches, guards }), restore: () => { global.fetch = previousFetch; } };
}
const operations = {
  start: h => h.batch.gscaleRpsBatchStart(h.session, start, h.guard('start')),
  stop: h => h.batch.gscaleRpsBatchStop(h.session, 'b', 2, h.guard('stop')),
  remotePrint: h => h.batch.gscaleRpsBatchPrint(h.session, body, h.guard('print')),
  prepare: h => h.batch.gscaleRpsBatchClientPrintPrepare(h.session, body, h.guard('print')),
  confirm: h => h.batch.gscaleRpsBatchClientPrintConfirm(h.session, body, 'EPC', h.guard('print')),
  reprintPrepare: h => h.print.adminPrepareRawMaterialStockReprint(h.session, 'EPC', '', h.guard('reprint')),
  reprintConfirm: h => h.print.adminConfirmRawMaterialStockReprint(h.session, 'EPC', 'id', h.guard('reprint')),
};
for (const [operation, send] of Object.entries(operations)) for (const change of ['role', 'capability', 'account']) {
  test(`${operation} does not retry its 401 after ${change} changes`, async () => {
    const h = setup(change);
    try { await assert.rejects(send(h)); const { fetches, guards } = h.counts(); assert.equal(fetches, 1); assert.ok(guards >= 1); }
    finally { h.restore(); }
  });
}
test('without an optional guard, existing GScale and shared reprint calls retain their normal 401 retry', async () => {
  for (const send of [h => h.batch.gscaleRpsBatchStart(h.session, start),
    h => h.print.adminConfirmRawMaterialStockReprint(h.session, 'EPC', 'id')]) {
    const h = setup('none');
    try { await send(h); assert.deepEqual(h.counts(), { fetches: 2, guards: 0 }); } finally { h.restore(); }
  }
});

test('late-error automatic stop cannot retry after 401 refresh changes capabilities', async () => {
  const h = setup('capability'), { materialPrinterSelectionKey } = compile('gscale/gscaleMaterialPolicy');
  const batchModule = compile('gscale/gscaleBatchState', { './gscaleControlLogic': {
    hasExactRpsBatchContext: item => !!item?.id && !!item?.revision && !!item?.item_code && !!item?.warehouse,
    rpsBatchActionErrorMessage: String,
  } });
  const state = { device: { selection: selected, transport: 'offline', needsAttention: false }, draft: { printer: 'zebra' },
    batch: { resolved: true, batch: null } };
  const initialScope = JSON.stringify(h.session.capabilities), policy = new MaterialGScalePolicy(() => JSON.stringify(h.session.capabilities) === initialScope);
  let store;
  const api = { state: async () => ({}), stop: (id, revision) => {
    const expected = materialPrinterSelectionKey(state.device.selection);
    const guard = () => policy.assertOperation('stop', state, { selection: expected, batchId: id, batchRevision: revision });
    guard(); return h.batch.gscaleRpsBatchStop(h.session, id, revision, guard);
  } };
  store = new batchModule.GScaleBatchStateStore(api, { prepareAutomaticStop: expected => {
    const key = materialPrinterSelectionKey(state.device.selection);
    return () => { try { policy.assertOperation('stop', state, { selection: key, batchId: expected.id, batchRevision: expected.revision }); return true; }
      catch { return false; } };
  } });
  store.subscribe(() => { state.batch = store.getSnapshot(); });
  try {
    store.apply({ ...active, item_code: 'I', warehouse: 'W', last_error: 'failed', last_error_at: 'now' });
    await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(h.counts().fetches, 1);
    assert.deepEqual(h.session.capabilities, []);
  } finally { store.dispose(); h.restore(); }
});
