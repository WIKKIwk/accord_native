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
const policy = compile('gscale/gscaleMaterialPolicy');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const usb = { transport: 'offline', offlinePrinter: { kind: 'zebra', printer: 'zebra', vendorId: 0x0a5f, productId: 1,
  deviceName: '/dev/usb/1', manufacturerName: 'Zebra', productName: 'ZD' } };
const wifi = { transport: 'wifi', server: { endpoint: { baseUrl: 'http://scale:39117' } } };
const activeBatch = { id: 'b', revision: 3, active: true, printer: 'zebra', driver_url: 'usb://local' };
function harness(role = 'material_taminotchi', restricted = true) {
  const calls = [], pending = deferred(); let current = true, scope = 'one', batchStore, deviceOptions;
  class FakeBatch {
    constructor(api, options) { this.api = api; this.options = options; batchStore = this; }
    getSnapshot() { return { resolved: true, batch: null }; }
    refresh() { calls.push('refresh'); return Promise.resolve(); }
  }
  class FakeOperator {
    constructor(_role, _args, deps, writePolicy) { this.deps = deps; this.policy = writePolicy;
      this.state = { device: { selection: usb, transport: 'offline' }, draft: { printer: 'zebra' }, batch: { resolved: true, batch: null } }; }
    getSnapshot() { return this.state; } isActive() { return true; } currentArgs() { return {}; }
  }
  const mocks = {
    '../auth': { activeSessionToken: () => current ? 'token' : null }, '../sessionReadScope': { sessionReadScope: () => scope },
    '../appPreferences': { appPreferences: { async getItem() { return null; }, async setItem() { calls.push('shared-save'); }, async removeItem() { calls.push('shared-delete'); } } },
    '../preparationReadApi': {}, '../preparation/preparationCommandApi': {}, '../printing/printService': { PrintService: {} }, '../profileApi': {},
    '../shared/catalogApi': { adminWarehouseAssignments: async () => [], gscaleItemsPage: async () => [] },
    './gscaleBatchState': { GScaleBatchStateStore: FakeBatch }, './gscaleBatchApi': {
      gscaleRpsBatchState: async () => ({}), gscaleRpsBatchStop: async (_s, _id, _revision, guard) => { if (guard) calls.push(['stop-guard', guard]); calls.push('stop-post'); },
      gscaleRpsBatchStart: async (_s, _request, guard) => { if (guard) calls.push(['start-guard', guard]); calls.push('start-post'); return {}; },
    }, './gscaleBatchPrintRuntime': { printGScaleBatch: async (_s, _c, _refresh, guard) => {
      await pending.promise; guard?.(); calls.push('print-post'); return {};
    } },
    './gscaleBatchStart': { startGScaleBatch: async (_context, deps) => { await pending.promise;
      return deps.start({ printer: 'zebra', driver_url: 'usb://local' }); } },
    './gscaleDeviceRuntime': { createGScaleDeviceStore: options => { deviceOptions = options; return {}; } },
    './gscaleDraft': {}, './gscaleLive': {}, './gscaleLiveRuntime': {}, './gscalePreparation': {},
    './gscaleOperatorState': { GScaleOperatorStore: FakeOperator }, './gscaleCatalogRuntime': { createGScaleCatalogRuntime: () => ({}) },
    './gscaleArchiveRuntime': { loadGScaleArchive: async () => [],
      printGScaleArchiveSession: async (_context, _entry, guard) => { await pending.promise; guard?.(); calls.push('archive-print'); return ''; },
      reprintGScaleArchiveReceipt: async (_s, _context, _entry, guard) => { await pending.promise; guard?.(); calls.push('reprint-post'); return null; } },
    './gscaleMaterialPolicy': policy,
  };
  const runtime = compile('gscale/gscaleOperatorRuntime', mocks), session = { profile: { role }, assigned_warehouses: [], capabilities: [] };
  const store = runtime.createGScaleOperatorStore(session, {}, restricted ? { materialPrinterSafety: true } : {});
  return { calls, pending, store, batch: batchStore, options: deviceOptions, switchAccount: () => { current = false; },
    changeScope: () => { scope = 'two'; }, runtime, session };
}
const startContext = { transport: 'offline', offlinePrinter: usb.offlinePrinter, bluetoothPrinter: null, server: null };
const printContext = { transport: 'offline', offlinePrinter: usb.offlinePrinter, bluetoothPrinter: null, server: null, batch: activeBatch };
const archiveContext = { selection: usb, transport: 'offline' };

test('restricted runtime rejects unsupported selection and preserves the shared preference store', async () => {
  const h = harness(); assert.equal(h.options.rememberBluetooth, false);
  assert.equal(h.options.allowSelection(wifi), false); assert.equal(h.options.allowSelection(usb), true);
  await h.options.storage.setItem('device', 'new'); await h.options.storage.removeItem('draft');
  assert.deepEqual(h.calls, []);
  h.store.state.device = { selection: wifi, transport: 'wifi' };
  assert.throws(() => h.store.deps.startBatch({ ...startContext, transport: 'wifi', server: wifi.server }, () => null), /Printer ulanmagan/);
  assert.deepEqual(h.calls, []);
});

test('queued start cannot POST after account switch, scope change or device change', async () => {
  for (const change of ['account', 'scope', 'device']) {
    const h = harness(), work = h.store.deps.startBatch(startContext, () => null);
    if (change === 'account') h.switchAccount(); else if (change === 'scope') h.changeScope();
    else h.store.state.device = { selection: wifi, transport: 'wifi' };
    h.pending.resolve(); await assert.rejects(work); assert.ok(!h.calls.includes('start-post'), change);
  }
});

test('queued print and both archive writes cannot reach their boundaries after account switch', async () => {
  for (const operation of ['print', 'archive', 'reprint']) {
    const h = harness(); if (operation === 'print') h.store.state.batch.batch = activeBatch;
    const work = operation === 'print' ? h.store.deps.printBatch(printContext) : operation === 'archive'
      ? h.store.deps.printArchive(archiveContext, {}) : h.store.deps.reprintArchiveReceipt(archiveContext, {});
    h.switchAccount(); h.pending.resolve(); await assert.rejects(work); assert.deepEqual(h.calls, [], operation);
  }
});

test('automatic and manual stop cannot POST for GoDEX, unknown or stale account', async () => {
  for (const printer of ['godex', '']) {
    const h = harness(), unsafe = { ...activeBatch, printer }; h.store.state.batch.batch = unsafe;
    const guard = h.batch.options.prepareAutomaticStop(unsafe);
    assert.equal(guard(), false); assert.throws(() => h.batch.api.stop('b', 3)); assert.deepEqual(h.calls, []);
  }
  const h = harness(); h.store.state.batch.batch = activeBatch;
  const guard = h.batch.options.prepareAutomaticStop(activeBatch); assert.equal(guard(), true);
  h.switchAccount(); assert.equal(guard(), false); assert.throws(() => h.batch.api.stop('b', 3)); assert.deepEqual(h.calls, []);
});

test('policy is not enabled by default and Preparation retains the old write path', async () => {
  const h = harness('tayyorlov_masteri', false); assert.equal(h.store.policy, undefined);
  h.store.state.device = { selection: wifi, transport: 'wifi' }; h.switchAccount();
  const work = h.store.deps.startBatch({ transport: 'wifi', server: wifi.server }, () => null); h.pending.resolve(); await work;
  assert.deepEqual(h.calls, ['start-post']);
  const other = harness('tayyorlov_masteri', false);
  assert.throws(() => other.runtime.createGScaleOperatorStore(other.session, {}, { materialPrinterSafety: true }), /requires Material role/);
});


test('restricted start and automatic stop pass the same current-scope guard to the API retry boundary', async () => {
  const start = harness(), work = start.store.deps.startBatch(startContext, () => null); start.pending.resolve(); await work;
  const startGuard = start.calls.find(item => Array.isArray(item) && item[0] === 'start-guard')?.[1];
  assert.equal(typeof startGuard, 'function'); start.switchAccount(); assert.throws(startGuard, /Sessiya tugagan/);
  const stop = harness(); stop.store.state.batch.batch = activeBatch;
  const autoGuard = stop.batch.options.prepareAutomaticStop(activeBatch); assert.equal(autoGuard(), true);
  await stop.batch.api.stop('b', 3); const stopGuard = stop.calls.find(item => Array.isArray(item) && item[0] === 'stop-guard')?.[1];
  assert.equal(typeof stopGuard, 'function'); stop.changeScope(); assert.equal(autoGuard(), false); assert.throws(stopGuard, /Sessiya tugagan/);
});
