const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
class MobileApiException extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
let history = [], localPrint = [];
function load(file) {
  const filename = path.resolve(__dirname, '../src', file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === '../printing/printModels') return load('printing/printModels.ts');
    if (name === '../printing/printService') return { PrintService: { async printRps(request, options) { localPrint.push({ request, options }); return { ok: true }; } } };
    if (name === '../shared/mobileApiException') return { MobileApiException };
    if (name === '../shared/printApi') return {};
    if (name === '../workerControlsApi') return { isCanonicalApparatusId: () => true };
    if (name === './gscaleBatchApi') return { gscaleRpsBatchHistory: async () => history };
    if (name === './gscalePreparation') return { formatCompactKg: value => value.toFixed(3).replace(/\.?0+$/, '') };
    if (name.startsWith('./gscale')) return load(`gscale/${name.slice(2)}.ts`);
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const runtime = load('gscale/gscaleArchiveRuntime.ts');
const model = load('gscale/gscaleBatchModel.ts');
const base = { controlOnly: false, transport: 'wifi', selection: null, server: { endpoint: { baseUrl: 'http://scale:39117' } },
  monitor: { printerKind: 'godex', printerLabel: 'ulangan' }, batchPrinter: 'zebra' };

test('standalone archive loads the local driver and decodes quantities', async () => {
  const previous = global.fetch, urls = [];
  global.fetch = async url => { urls.push(url); return { status: 200, text: async () => JSON.stringify({ archive: [
    { session_id: 'b1', item_code: 'I', warehouse: 'W', prints: [{ qty: 3, epc: 'E1' }] },
  ] }) }; };
  try {
    const result = await runtime.loadGScaleArchive({}, base);
    assert.deepEqual(urls, ['http://scale:39117/v1/mobile/archive?limit=50']);
    assert.equal(result[0].prints[0].gross_qty, 3); assert.equal(result[0].prints[0].net_qty, 3);
  } finally { global.fetch = previous; }
});

test('control archive uses ERP batches and local printer emits batch QR', async () => {
  history = [model.batchSessionFromJson({ id: 'batch', item_code: 'PET', warehouse: 'W', prints: [{ qty: 5, net_qty: 5, gross_qty: 6 }] })];
  const context = { ...base, controlOnly: true, transport: 'bluetooth', selection: { transport: 'bluetooth', bluetoothPrinter: { printer: 'xp-p323b' } } };
  const sessions = await runtime.loadGScaleArchive({}, context);
  localPrint = [];
  assert.match(await runtime.printGScaleArchiveSession(context, sessions[0]), /Bluetooth printerda chop etildi/);
  assert.equal(localPrint[0].request.epc, 'RPS-BATCH:BATCH'); assert.equal(localPrint[0].request.printCount, 1);
});

test('archive printer follows actual connection status and printer kind', () => {
  assert.equal(runtime.currentArchivePrinterChoice(base), 'godex');
  assert.equal(runtime.currentArchivePrinterChoice({ ...base, monitor: { printerKind: '', printerLabel: 'ulanmagan' } }), '');
  assert.equal(runtime.currentArchivePrinterChoice({ ...base, monitor: { printerKind: '', printerLabel: 'Go-Dex G500' } }), 'godex');
});
