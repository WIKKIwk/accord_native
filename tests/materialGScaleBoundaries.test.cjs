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
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('batch prepare, physical print and confirm check the guard separately', async () => {
  const calls = [], pending = deferred(); let current = true;
  const runtime = compile('gscale/gscaleBatchPrintRuntime', {
    '../printing/printService': { PrintService: { printRps: async () => { calls.push('print'); return { ok: true }; } } },
    './gscaleBatchApi': { gscaleRpsBatchPrint: async () => { calls.push('remote'); },
      gscaleRpsBatchClientPrintPrepare: async () => { calls.push('prepare'); return pending.promise; },
      gscaleRpsBatchClientPrintConfirm: async () => { calls.push('confirm'); } },
    './gscaleBatchPrint': { printActiveGScaleBatch: async (_context, api) => {
      const value = await api.prepare({}); await api.printLocal(value, {}); await api.confirm({}, 'EPC');
    } },
  });
  const guard = () => { if (!current) throw new Error('stale'); };
  const work = runtime.printGScaleBatch({}, {}, async () => {}, guard);
  assert.deepEqual(calls, ['prepare']); current = false; pending.resolve({}); await assert.rejects(work, /stale/);
  assert.deepEqual(calls, ['prepare']);
  await assert.rejects(runtime.printGScaleBatch({}, {}, async () => {}, guard), /stale/); assert.deepEqual(calls, ['prepare']);
});

test('reprint checks before prepare, physical print and server confirmation', async () => {
  const calls = [], pending = deferred(); let current = true;
  const runtime = compile('gscale/gscaleArchiveRuntime', {
    '../printing/printService': { PrintService: { printRps: async () => { calls.push('print'); return { ok: true }; } } },
    '../shared/printApi': { adminPrepareRawMaterialStockReprint: async () => { calls.push('prepare'); return pending.promise; },
      adminConfirmRawMaterialStockReprint: async () => { calls.push('confirm'); } },
    './gscaleArchive': { reprintArchiveReceipt: async (_entry, _printer, api) => {
      const prepared = await api.prepare('EPC'); await api.print(prepared); await api.confirm('EPC', 'id'); return null;
    }, buildMaterialBatchPrintPlan: () => ({}), materialBatchUsbRequest: () => ({}) },
    './gscaleBatchApi': {}, './gscaleControlLogic': { normalizePrinterChoice: value => value },
  });
  const context = { transport: 'offline', selection: { transport: 'offline', offlinePrinter: { printer: 'zebra' } }, monitor: {}, batchPrinter: 'zebra' };
  const guard = () => { if (!current) throw new Error('stale'); };
  const work = runtime.reprintGScaleArchiveReceipt({}, context, { epc: 'EPC' }, guard);
  assert.deepEqual(calls, ['prepare']); current = false; pending.resolve({}); await assert.rejects(work, /stale/);
  assert.deepEqual(calls, ['prepare']);
  await assert.rejects(runtime.printGScaleArchiveSession(context, { item_code: 'I' }, guard), /stale/);
  assert.deepEqual(calls, ['prepare']);
});

test('automatic stop guard is checked again after listeners and old-session changes', async () => {
  const runtime = compile('gscale/gscaleBatchState', { './gscaleControlLogic': {
    hasExactRpsBatchContext: item => !!item?.id && !!item?.revision && !!item?.item_code && !!item?.warehouse,
    rpsBatchActionErrorMessage: String,
  } });
  let current = true, calls = 0;
  const store = new runtime.GScaleBatchStateStore({ state: async () => ({}), stop: async () => { calls++; return {}; } },
    { prepareAutomaticStop: () => () => current });
  store.subscribe(() => { if (store.getSnapshot().loading) current = false; });
  store.apply({ id: 'b', revision: 1, active: true, item_code: 'I', warehouse: 'W', last_error: 'failed', last_error_at: 'now' });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0); assert.equal(store.getSnapshot().loading, false); store.dispose();
});

test('account change after a physical print blocks the later confirmation', async () => {
  const calls = [], pending = deferred(); let current = true;
  const runtime = compile('gscale/gscaleBatchPrintRuntime', {
    '../printing/printService': { PrintService: { printRps: async () => { calls.push('print'); return pending.promise; } } },
    './gscaleBatchApi': { gscaleRpsBatchPrint: async () => {},
      gscaleRpsBatchClientPrintPrepare: async () => { calls.push('prepare'); return {}; },
      gscaleRpsBatchClientPrintConfirm: async () => { calls.push('confirm'); } },
    './gscaleBatchPrint': { printActiveGScaleBatch: async (_context, api) => {
      const value = await api.prepare({}); await api.printLocal(value, {}); await api.confirm({}, 'EPC');
    } },
  });
  const work = runtime.printGScaleBatch({}, {}, async () => {}, () => { if (!current) throw new Error('stale'); });
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(calls, ['prepare', 'print']);
  current = false; pending.resolve({ ok: true }); await assert.rejects(work, /stale/); assert.deepEqual(calls, ['prepare', 'print']);
});


test('batch and stock reprint adapters forward the guard into authorized retry APIs', async () => {
  const received = [], guard = () => {};
  const batch = compile('gscale/gscaleBatchPrintRuntime', { '../printing/printService': { PrintService: { printRps: async () => ({ ok: true }) } },
    './gscaleBatchApi': { gscaleRpsBatchPrint: async (_s, _r, before) => received.push(before),
      gscaleRpsBatchClientPrintPrepare: async (_s, _r, before) => { received.push(before); return {}; },
      gscaleRpsBatchClientPrintConfirm: async (_s, _r, _epc, before) => received.push(before) },
    './gscaleBatchPrint': { printActiveGScaleBatch: async (_context, api) => { await api.printRemote({}); await api.prepare({}); await api.confirm({}, 'E'); } },
  });
  await batch.printGScaleBatch({}, {}, async () => {}, guard);
  const archive = compile('gscale/gscaleArchiveRuntime', { '../printing/printService': { PrintService: { printRps: async () => ({ ok: true }) } },
    '../shared/printApi': { adminPrepareRawMaterialStockReprint: async (_s, _epc, _order, before) => { received.push(before); return {}; },
      adminConfirmRawMaterialStockReprint: async (_s, _epc, _id, before) => received.push(before) },
    './gscaleArchive': { reprintArchiveReceipt: async (_entry, _printer, api) => { await api.prepare('E'); await api.confirm('E', 'id'); } },
    './gscaleBatchApi': {}, './gscaleControlLogic': { normalizePrinterChoice: value => value } });
  await archive.reprintGScaleArchiveReceipt({}, { transport: 'offline', selection: { transport: 'offline', offlinePrinter: { printer: 'zebra' } },
    monitor: {}, batchPrinter: 'zebra' }, { epc: 'E' }, guard);
  assert.equal(received.length, 5); assert.ok(received.every(item => item === guard));
});
