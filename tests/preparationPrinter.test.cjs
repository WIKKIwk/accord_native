const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function setup() {
  const calls = [], cache = { cached: null };
  class Request {
    static fromPrintJson(job) { calls.push(['decode', job]); return new Request(job); }
    constructor(job) { this.job = job; }
    toJson() { return { ...this.job }; }
  }
  const deps = {
    '../printing/printModels': { UsbRpsPrintRequest: Request },
    '../printing/printService': { PrintService: { printRps: async (request, options) => { calls.push(['local', request.job, options]); return { ok: true }; } } },
    '../printing/sessionBluetoothPrinter': { SessionBluetoothPrinter: {
      resolveCached: async () => cache.cached, remember: value => { cache.cached = value; },
    } },
    './preparationReprint': { reprintPreparationRoll: async (session, roll, order, context) => {
      const printer = await context.pickPrinter(); return printer && context.print({ epc: 'ABC' }, printer);
    } },
  };
  const filename = path.resolve(__dirname, '../src/preparation/preparationPrinter.ts'), loaded = new Module(filename, module);
  loaded.require = id => id in deps ? deps[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: loaded.exports, calls, cache };
}
test('reprint uses cached Bluetooth and sends the job to the local printer service', async () => {
  const x = setup(); x.cache.cached = { address: 'AA' };
  assert.equal(await x.api.reprintPreparationRollWithPrinter({}, {}, 'order', { isCurrent: () => true, selectDevice: async () => { throw Error('unexpected picker'); } }), true);
  assert.deepEqual(x.calls[1], ['local', { epc: 'ABC' }, { transport: 'bluetooth', bluetoothPrinter: x.cache.cached }]);
});
test('USB choice uses the selected printer and unavailable selection cancels', async () => {
  const x = setup(), printer = { kind: 'zebra' }, options = { isCurrent: () => true, selectDevice: async () => ({ transport: 'offline', printer }) };
  const selected = await x.api.pickPreparationPrinter(options);
  assert.equal(await x.api.printPreparationJob({ epc: 'E' }, selected), true);
  assert.deepEqual(x.calls[1][2], { transport: 'offline', printerProfile: printer });
  assert.equal(await x.api.pickPreparationPrinter({ ...options, selectDevice: async () => null }), null);
});
test('Wi-Fi selection checks the driver then posts the V2 payload and propagates errors', async () => {
  const x = setup(), oldFetch = global.fetch, requests = [];
  global.fetch = async (url, init) => { requests.push([url, init]); return { ok: true, json: async () => requests.length === 1
    ? { state: { printer: { connected: 'yes', kind: 'zebra' } } } : { ok: true } }; };
  try {
    const selected = await x.api.pickPreparationPrinter({ isCurrent: () => true, selectDevice: async () => ({ transport: 'wifi', serverBaseUrl: 'https://printer.test/' }) });
    assert.equal(await x.api.printPreparationJob({ epc: 'E' }, selected), true);
    assert.equal(requests[0][0], 'https://printer.test/v1/mobile/monitor/state');
    assert.equal(requests[1][0], 'https://printer.test/v1/mobile/driver/print');
    assert.deepEqual(JSON.parse(requests[1][1].body), { epc: 'E', printer: 'zebra', print_mode: 'rfid' });
    global.fetch = async () => ({ ok: false, json: async () => ({ detail: 'Qog‘oz tugadi' }) });
    await assert.rejects(x.api.printPreparationJob({ epc: 'E' }, selected), /Qog‘oz tugadi/);
  } finally { global.fetch = oldFetch; }
});
test('manual printer address uses the V2 default port and rejects loopback', () => {
  const { preparationPrinterServerUrl } = setup().api;
  assert.equal(preparationPrinterServerUrl('192.168.1.12'), 'http://192.168.1.12:39117');
  assert.equal(preparationPrinterServerUrl('http://192.168.1.12:4000/path'), 'http://192.168.1.12:4000');
  assert.equal(preparationPrinterServerUrl('http://192.168.1.12:80'), 'http://192.168.1.12:80');
  assert.throws(() => preparationPrinterServerUrl('localhost'), /Localhost/);
  assert.throws(() => preparationPrinterServerUrl(''), /formati/);
});
test('inventory Wi-Fi reprint uses the selected server without the production monitor override', async () => {
  const x = setup(), oldFetch = global.fetch, requests = [];
  global.fetch = async (url, init) => { requests.push([url, init]); return { ok: true, json: async () => ({ ok: true }) }; };
  try {
    const printer = await x.api.pickPreparationInventoryPrinter({ isCurrent: () => true,
      selectDevice: async () => ({ transport: 'wifi', serverBaseUrl: 'http://printer:39117' }) });
    assert.equal(await x.api.printPreparationJob({ epc: 'E' }, printer, { inventory: true }), true);
    assert.equal(requests.length, 1); assert.equal(requests[0][0], 'http://printer:39117/v1/mobile/driver/print');
    assert.deepEqual(JSON.parse(requests[0][1].body), { epc: 'E' });
  } finally { global.fetch = oldFetch; }
});

test('manual Wi-Fi selection normalizes and probes a server before choosing its printer', async () => {
  const x = setup(), oldFetch = global.fetch, requests = [];
  global.fetch = async url => { requests.push(url); return { ok: true, json: async () => ({ service: 'mobileapi', server_ref: '5070' }) }; };
  try {
    const selected = await x.api.preparationManualPrinterServer('192.168.1.12');
    assert.deepEqual(selected, { transport: 'wifi', serverBaseUrl: 'http://192.168.1.12:39117', driverBaseUrl: 'http://100.117.62.18:39117' });
    assert.deepEqual(requests, ['http://192.168.1.12:39117/v1/mobile/handshake']);
    assert.throws(() => x.api.preparationPrinterServerAddress('localhost:39117'), /Localhost/);
  } finally { global.fetch = oldFetch; }
});
