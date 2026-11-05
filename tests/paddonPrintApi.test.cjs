const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const stem = 'paddon_bluetooth_label_test', records = loadContract(stem);
const names = [...new Set(records.map(x => x.test))];
const expected = {
  known: ['Paddon 00001', 'Mahsulot soni: 7', 'Turli babinalar soni: —', 'Brutto: 24.375 kg', 'Netto: 23.125 kg'],
  unknown: ['Paddon 00001', 'Mahsulot soni: 7', 'Turli babinalar soni: —', 'Brutto: — kg', 'Netto: — kg'],
  empty: ['Paddon 00001', 'Mahsulot soni: 0', 'Turli babinalar soni: 0', 'Brutto: 0 kg', 'Netto: 0 kg'],
  partial: ['Paddon 00001', 'Mahsulot soni: 3', 'Turli babinalar soni: —', 'Brutto: 12.123456 kg', 'Netto: — kg'],
  legacy: ['Paddon 00001', 'Mahsulot soni: —', 'Turli babinalar soni: —', 'Brutto: — kg', 'Netto: — kg'],
};

// @v2-test test/paddon_bluetooth_label_test.dart
for (const name of names) test(name, async () => {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('paddonPrintApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl),
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const transport = name.includes('PrintTransport.offline') ? 'offline' : name.includes('PrintTransport.wifi') ? 'wifi' : 'bluetooth';
  for (let i = 0; i < records.filter(x => x.test === name).length; i++) {
    const result = await client.adminPaddonPrintQr(session, { code: '00001', print_transport: transport, print_count: 2 });
    const lines = result.print_job.paddon_label_lines;
    const scenario = name.match(/^Bluetooth pallet (\w+)/)?.[1];
    if (scenario) assert.deepEqual(lines, expected[scenario]);
    else if (name.startsWith('20 WIPs')) assert.deepEqual(lines, ['Mijoz: Qobil aka', 'Mahsulot nomi: Hot Lunch', 'Paddon 00001',
      'Mahsulot soni: 20', 'Turli babinalar soni: 4', 'Brutto: 568 kg', 'Netto: 500 kg']);
    else if (name.startsWith('normalizes')) { assert.deepEqual(lines.slice(0, 2), ['Mijoz: Qobil aka', 'Mahsulot nomi: Hot Lunch']); assert.ok(lines.includes('Turli babinalar soni: 1')); }
    else if (name.includes('omits the single-product')) { assert.equal(lines.length, 5); assert.ok(lines.includes('Turli babinalar soni: 1')); }
    else if (name.startsWith('unknown bobbin')) assert.ok(lines.includes('Turli babinalar soni: —'));
    else if (name.startsWith('empty snapshot')) { assert.equal(lines.length, 5); assert.ok(lines.includes('Turli babinalar soni: 0')); }
    else assert.deepEqual(lines, []);
  }
  replay.assertDone();
});

test('paddon print bounds copies and trims printer fields', async () => {
  let body;
  const client = load('paddonPrintApi', { './authorizedFetch': { authorizedFetch: async (_session, _url, init) => {
    body = JSON.parse(init.body);
    return new Response('{"paddon":{"code":"P"}}', { status: 200 });
  } } });
  await assert.rejects(client.adminPaddonPrintQr({}, { code: ' ' }), error => error.code === 'paddon_not_found');
  const result = await client.adminPaddonPrintQr({}, { code: ' P ', driver_url: ' https://printer/// ', printer: ' godex ',
    print_mode: ' label ', print_count: 101, print_transport: 'bluetooth' });
  assert.deepEqual(body, { code: 'P', driver_url: 'https://printer', print_transport: 'offline', printer: 'godex', print_mode: 'label', print_count: 100 });
  assert.equal(result.qr_payload, 'P');
  assert.equal(result.print_job, null);
});
