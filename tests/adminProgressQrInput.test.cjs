const assert = require('node:assert/strict'), test = require('node:test');
const base = require('./adminUsersSupport.cjs');
const scanner = base.load('admin/adminProgressQrInputScanner'), strings = base.load('admin/dartJsonString');
const uri = base.load('admin/adminProgressQrInputUri', { './dartJsonString': strings, './adminProgressQrInputScanner': scanner });
const input = base.load('admin/adminProgressQrInput', { './dartJsonString': strings, './adminProgressQrInputUri': uri });
const fixture = require('./fixtures/adminProgressQrInput.oracle.json');
test('Dart3.13.7 Source extraction differential preserves every oracle value and Format/Range semantic error category', () => {
  const mismatches = [];
  for (const expected of fixture.cases) {
    let result; try { result = { value: input.adminProgressQrPayload(expected.raw) }; } catch (error) { result = { error: error instanceof SyntaxError ? 'FormatException' : error instanceof RangeError ? 'RangeError' : error.constructor.name }; }
    if (expected.error ? expected.error !== result.error : expected.value !== result.value || result.error) mismatches.push({ raw: expected.raw, expected, result });
  }
  assert.deepEqual(mismatches.slice(0, 25), [], `${mismatches.length}/${fixture.cases.length} oracle mismatches`);
});
test('Source first barcode value checks raw then display per-entry, uses Dart whitespace and does not skip an earlier display for a later raw', () => {
  assert.equal(input.adminProgressQrFirstBarcodeValue([]), '');
  assert.equal(input.adminProgressQrFirstBarcodeValue([{ rawValue: ' \u0085 ', displayValue: ' \u0085 DISPLAY \u0085 ' }, { rawValue: 'LATER RAW' }]), 'DISPLAY');
  assert.equal(input.adminProgressQrFirstBarcodeValue([{ rawValue: ' \u0085 RAW \u0085 ', displayValue: 'DISPLAY' }]), 'RAW');
  assert.equal(input.adminProgressQrFirstBarcodeValue([{ rawValue: null }, { displayValue: null }, { displayValue: ' QR ' }]), 'QR');
});
test('Source simple URI fastpath bypasses port overflow while uppercase host, escaped path or normalized dot path requires actual64bit parsing', () => {
  const root = 'http://x:999999999999999999999999999999'; assert.equal(input.adminProgressQrPayload(root + '/QR'), 'QR');
  for (const raw of [root.replace('//x:', '//X:') + '/QR', root + '/%51R', root + '/a/../QR']) assert.equal(input.adminProgressQrPayload(raw), raw);
  for (const port of ['-1', '+1', '0x10', '+0xffffffffffffffff', '\u008580\u0085']) assert.equal(input.adminProgressQrPayload(`http://X:${port}/QR`), 'QR');
});
test('Source component materialization order preserves path errors, skipped empty query keys, earlier duplicate failures and empty-key priority', () => {
  assert.throws(() => input.adminProgressQrPayload('http://x/earlier%FF/QR?epc=OK'), SyntaxError);
  assert.equal(input.adminProgressQrPayload('http://x/earlier%FF/../QR?epc=OK'), 'OK');
  assert.equal(input.adminProgressQrPayload('http://x/QR?=%FF&epc=OK'), 'OK'); assert.throws(() => input.adminProgressQrPayload('http://x/QR?qr_payload=%FF&qr_payload=OK'), SyntaxError);
  assert.equal(input.adminProgressQrPayload('http://x/QR?qr_payload=&progress_qr=IGNORED'), 'QR'); assert.equal(input.adminProgressQrPayload('http://x/QR?qr_payload=A&qr_payload=B'), 'B');
  assert.throws(() => input.adminProgressQrPayload('http://x/QR?epc=\ud800'), SyntaxError); assert.throws(() => input.adminProgressQrPayload('ftp://[v1.é]/QR'), RangeError);
});
test('exact small SDK scanner table provenance/hash and BSD source attribution remain attached without a runtime dependency', () => {
  const fs = require('node:fs'), crypto = require('node:crypto'), ts = require('typescript');
  const scannerSource = fs.readFileSync(require.resolve('../src/admin/adminProgressQrInputScanner.ts'), 'utf8');
  const table = scannerSource.split('const transitions =')[1].split(';')[0], bytes = Uint8Array.from([...table.matchAll(/\\x([0-9A-F]{2})/g)].map(match => parseInt(match[1], 16)));
  assert.equal(bytes.length, 2112); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), fixture.provenance.scannerTableSha256); assert.ok(scannerSource.includes(fixture.provenance.sdkCoreUriSha256)); assert.match(scannerSource, /Copyright 2012, the Dart project authors/); assert.match(scannerSource, /Redistribution and use in source and binary forms/);
  for (const filename of ['adminProgressQrInput.ts', 'adminProgressQrInputUri.ts', 'adminProgressQrInputScanner.ts']) {
    const source = ts.createSourceFile(filename, fs.readFileSync(require.resolve('../src/admin/' + filename), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) if (ts.isImportDeclaration(statement)) assert.equal(statement.moduleSpecifier.text.startsWith('./'), true);
    const visit = node => { if (ts.isNewExpression(node)) assert.notEqual(node.expression.getText(source), 'URL'); if (ts.isIdentifier(node)) assert.equal(['Buffer', 'process', 'atob', 'require'].includes(node.text), false); ts.forEachChild(node, visit); }; visit(source);
  }
});
module.exports = { input, uri, scanner, fixture };
