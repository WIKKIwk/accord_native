const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminProgressQrLookupSupport.cjs');
const reads = f => f.calls.filter(([kind]) => ['primary', 'paddon', 'opening', 'material'].includes(kind));
test('actual ordered capture uses Dart N85/raw-then-display order and LAST query duplicate before lookup', async () => {
  const f = s.fixture(); f.start(); await s.flush();
  await f.controller.detectBarcodes([{ rawValue: ' \u0085 ', displayValue: ' \u0085 HTTPS://x/QR?qr_payload=FIRST&qr_payload=%C2%85LAST%C2%85 \u0085 ' }, { rawValue: 'LATER RAW' }]);
  assert.equal(reads(f).length, 1); assert.equal(reads(f)[0][1], 'LAST'); assert.equal(f.state().report.scanned_batch.batch_id, 'LAST');
});
for (const [value, ErrorType] of [['http://x/earlier%FF/QR?epc=VALID', SyntaxError], ['ftp://[v1.é]/QR', RangeError]]) test(`actual capture ${ErrorType.name} escapes before stop/loading/API/fallback/retry`, async () => {
  const f = s.fixture(); f.start(); await s.flush(); await assert.rejects(f.controller.detectBarcodes([{ rawValue: value }]), ErrorType);
  assert.equal(f.state().status, 'prompt'); assert.equal(f.state().processing, false); assert.equal(f.state().scanError, null); assert.deepEqual(f.calls.map(([kind]) => kind), ['apparatus']);
});
test('busy, retired, covered and obsolete-generation captures never read raw barcode fields or invoke malformed URI parsing', async () => {
  for (const state of ['busy', 'retired', 'covered', 'old-generation']) {
    const f = s.fixture(), pending = s.deferred(); f.start(); await s.flush(); const generation = f.controller.interactionGeneration; let reading;
    if (state === 'busy') { f.stop(() => pending.promise); reading = f.controller.detectNormalized('already loading'); }
    if (state === 'retired') f.controller.invalidate();
    if (state === 'covered') f.focus(() => false);
    if (state === 'old-generation') { f.controller.detach(); f.start(); await s.flush(); }
    let accessed = 0; await f.controller.detectBarcodes([{ get rawValue() { accessed++; return 'http://x/QR?unused=%FF'; } }], generation); assert.equal(accessed, 0);
    if (reading) { pending.resolve(); await reading; }
  }
});
for (const kind of ['primary', 'paddon', 'opening', 'material']) test(`visible ${kind} report blocks raw capture before reading its fields or parsing`, async () => {
  const f = s.fixture(); if (kind !== 'primary') f.answers.primary = async () => { throw s.apiError(); }; if (kind === 'material') f.answers.opening = async () => { throw s.apiError('opening_missing', 404); }; f.start(); await s.flush();
  await f.controller.detectNormalized(kind === 'paddon' ? '12345' : 'QR'); const before = f.calls.length; let accessed = 0;
  await f.controller.detectBarcodes([{ get rawValue() { accessed++; return 'http://x/earlier%FF/QR'; } }]); assert.equal(accessed, 0); assert.equal(f.calls.length, before);
});
test('authority loss while accessing original barcode stops before URI parse and all scanner/API work', async () => {
  const f = s.fixture(); f.start(); await s.flush(); await f.controller.detectBarcodes([{ get rawValue() { f.current(() => false); return 'http://x/earlier%FF/QR'; } }]);
  assert.equal(f.state().valid, false); assert.deepEqual(f.calls.map(([kind]) => kind), ['apparatus']);
});
test('actual empty capture and extracted trailing path empty become Source invalidQr without loading/stop; root-path URI remains raw', async () => {
  const f = s.fixture(); f.start(); await s.flush(); await f.controller.detectBarcodes([]); assert.equal(f.state().status, 'invalidQr'); await f.controller.detectBarcodes([{ rawValue: 'http://x/scan/' }]); assert.equal(f.state().status, 'invalidQr'); assert.equal(f.state().processing, false); assert.deepEqual(reads(f), []); assert.equal(f.calls.some(([kind]) => kind === 'stop'), false);
  await f.controller.detectBarcodes([{ rawValue: 'http://x/' }]); assert.equal(reads(f)[0][1], 'http://x/');
});
test('raw manual result parses only when genuine host completes its original ticket and survives expected modal blur', async () => {
  const f = s.fixture(); f.start(); await s.flush(); const ticket = f.controller.issueManual(); assert.deepEqual(reads(f), []); assert.equal(f.calls.some(([kind]) => kind === 'stop'), false); f.focus(() => false);
  await f.controller.completeManualRaw(ticket, ' \u0085 http://x/QR?qr_payload=FIRST&qr_payload=%C2%85LAST%C2%85 \u0085 '); assert.equal(reads(f)[0][1], 'LAST'); assert.equal(f.state().status, 'reportReady');
  await f.controller.completeManual(ticket, 'replay normalized'); await f.controller.completeManualRaw(ticket, 'http://x/QR?unused=%FF'); assert.equal(reads(f).length, 1);
});
for (const [raw, ErrorType] of [['http://x/earlier%FF/QR?epc=VALID', SyntaxError], ['ftp://[v1.é]/QR', RangeError]]) test(`raw manual ${ErrorType.name} remains outside lookupcatch and consumes the closed-dialog ticket exactly once`, async () => {
  const f = s.fixture(); f.start(); await s.flush(); const ticket = f.controller.issueManual(); f.focus(() => false); await assert.rejects(f.controller.completeManualRaw(ticket, raw), ErrorType);
  assert.equal(f.state().status, 'prompt'); assert.equal(f.state().scanError, null); assert.equal(f.state().processing, false); assert.deepEqual(reads(f), []); await f.controller.completeManualRaw(ticket, 'http://x/valid'); await f.controller.completeManual(ticket, 'replay'); assert.deepEqual(reads(f), []);
});
test('raw manual cancellation/forged/retired/replayed generation checks precede parsing and cannot adopt a refreshed mounted owner', async () => {
  for (const mode of ['cancel', 'forged', 'retired', 'detached', 'replayed', 'account']) {
    const f = s.fixture(); f.start(); await s.flush(); let ticket = f.controller.issueManual();
    if (mode === 'cancel') { await f.controller.completeManualRaw(ticket, null); }
    if (mode === 'forged') ticket = { generation: ticket.generation };
    if (mode === 'retired') f.controller.invalidate(); if (mode === 'detached') f.controller.detach(); if (mode === 'replayed') { f.controller.detach(); f.start(); await s.flush(); } if (mode === 'account') f.current(() => false);
    await f.controller.completeManualRaw(ticket, 'http://x/earlier%FF/QR'); assert.deepEqual(reads(f), []); assert.equal(f.calls.some(([kind]) => kind === 'stop'), false);
  }
});
test('raw manual empty extraction preserves Source invalidQr, and scanOnly actual capture waits stop then returns extracted payload without APIs', async () => {
  const f = s.fixture(); f.start(); await s.flush(); await f.controller.completeManualRaw(f.controller.issueManual(), 'http://x/scan/'); assert.equal(f.state().status, 'invalidQr'); assert.equal(f.state().processing, false); assert.deepEqual(reads(f), []);
  const only = s.fixture({ scanOnly: true }), stop = s.deferred(); only.stop(() => stop.promise); only.start(); const returning = only.controller.detectBarcodes([{ rawValue: 'http:payload?epc=EXTRACTED' }]); assert.equal(only.state().processing, true); assert.deepEqual(only.calls.map(([kind]) => kind), ['stop']); stop.resolve(); await returning; assert.deepEqual(only.calls.map(([kind]) => kind), ['stop', 'return']); assert.equal(only.calls[1][1], 'EXTRACTED');
});
test('normalized entry methods retain their old already-parsed contract and never reinterpret a caller-supplied literal URI', async () => {
  for (const manual of [false, true]) { const f = s.fixture(), literal = 'http://x/QR?epc=do-not-reparse'; f.start(); await s.flush(); if (manual) await f.controller.completeManual(f.controller.issueManual(), literal); else await f.controller.detectNormalized(literal); assert.equal(reads(f)[0][1], literal); }
});
