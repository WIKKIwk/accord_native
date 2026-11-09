// Source-derived tests for pure parts of werka_qr_scan_routing_test.dart; camera and navigation remain unported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths; cache.set(resolved, module.exports);
  module.require = name => name.endsWith('/authorizedFetch') || name === './authorizedFetch' ? { authorizedFetch: () => { throw Error('No network'); } }
    : name.startsWith('.') ? load(path.resolve(path.dirname(resolved), name), cache) : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
const cache = new Map(), base = path.resolve(__dirname, '../src');
const api = load(`${base}/werka/werkaScanLogic.ts`, cache);
const { MobileApiException } = load(`${base}/shared/mobileApiException.ts`, cache);
const { WorkerControlException } = load(`${base}/workerControlsApi.ts`, cache);
test('scanner chooses the first nonblank raw value, then display value', () => {
  assert.equal(api.firstWerkaBarcodeValue([{ rawValue: ' ', displayValue: ' display ' }, { rawValue: 'next' }]), 'display');
  assert.equal(api.firstWerkaBarcodeValue([{ rawValue: ' raw ', displayValue: 'display' }]), 'raw');
  assert.equal(api.firstWerkaBarcodeValue([]), '');
});
test('valid archive QR bypasses preview; malformed archive QR stays invalid', async () => {
  const encoded = Buffer.from('ARCHIVE\nsess\nitem\n3\ntime').toString('base64url');
  let calls = 0; const resolve = async () => { calls++; throw Error('must not be called'); };
  assert.equal((await api.resolveWerkaScannedCode(`https://scan.wspace.sbs/A/${encoded}`, resolve)).kind, 'archive');
  assert.equal((await api.resolveWerkaScannedCode('https://scan.wspace.sbs/A/not-valid-base64', resolve)).kind, 'invalid');
  assert.equal(calls, 0);
});
test('scanner never guesses a pallet from digits; only qr_not_found permits stock fallback', async () => {
  const preview = { code: '00002', paddon: {}, wip: null }, sent = [];
  const result = await api.resolveWerkaScannedCode(' 00002 ', async code => { sent.push(code); return preview; });
  assert.equal(result.kind, 'preview'); assert.equal(result.preview, preview); assert.deepEqual(sent, [' 00002 ']);
  for (const raw of ['54321', 'STOCK-ABC', 'https://scan.wspace.sbs/L/ACCORD/item/00002']) {
    const stock = await api.resolveWerkaScannedCode(raw, async () => { throw new WorkerControlException('qr_not_found', 'missing', 404); });
    assert.equal(stock.kind, 'stock'); assert.equal(stock.scannedBarcode, raw.split('/').pop()); assert.equal(stock.rawValue, raw);
  }
});
test('permission, ambiguity, missing endpoint and transport errors never fall back to stock', async () => {
  for (const error of [new MobileApiException({ code: 'forbidden', message: 'no' }),
    new WorkerControlException('qr_ambiguous', 'ambiguous', 409), new WorkerControlException('qr_preview_failed', 'missing', 503), new Error('offline')]) {
    await assert.rejects(api.resolveWerkaScannedCode('00002', async () => { throw error; }), caught => caught === error);
  }
  assert.equal(api.werkaScanErrorMessage(new MobileApiException({ code: 'forbidden', message: 'x' })),
    'QR ma’lumotini ko‘rishga ruxsat yo‘q. Sizga ombor biriktirilganini tekshiring.');
});
test('URL barcode and EPC queries follow source precedence', () => {
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid/path?barcode=+ABC+&epc=DEF'), 'ABC');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid/path?epc=DEF'), 'DEF');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid/path?barcode=+&epc=DEF'), 'path');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid/%ZZ'), '%ZZ');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid?barcode=X'), 'https://example.invalid?barcode=X');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid/?barcode=X'), 'https://example.invalid/?barcode=X');
  assert.equal(api.extractWerkaLookupBarcode('https://example.invalid//?barcode=X'), 'X');
});
