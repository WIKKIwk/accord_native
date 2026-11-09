const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '../src', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.require = id => id.startsWith('.') ? load(`${path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id))}.ts`) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const { QolipQrScannerState, qolipFirstBarcodeValue, qolipScannerErrorKey } = load('qolip/qolipQrScannerState.ts');
const { MobileApiException } = load('shared/mobileApiException.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(mode = 'cell') {
  let current = true, failure = false, started = true, stop = async () => {}, lookup = async qr => ({ id: 'cell', qr_payload: qr });
  const events = [];
  const state = new QolipQrScannerState(mode, {
    current: () => current, stop: async () => { events.push('stop'); await stop(); },
    restart: async () => { events.push('restart'); return started; }, cameraFailed: () => failure,
    lookup: async (qr, guard) => { assert.equal(guard(), true); events.push(['lookup', qr]); return lookup(qr); },
    complete: value => events.push(['complete', value]), notify: value => events.push(['notice', value]),
  });
  state.activate();
  return { state, events, expire: () => { current = false; }, revive: () => { current = true; },
    setStop: fn => { stop = fn; }, setLookup: fn => { lookup = fn; }, camera: (value, failed) => { started = value; failure = failed; } };
}

test('V2 capture reads the first trimmed raw value then its display fallback, in capture order', () => {
  assert.equal(qolipFirstBarcodeValue([{ rawValue: ' \u0085 ', displayValue: ' DISPLAY ' }, { rawValue: 'RAW' }]), 'DISPLAY');
  assert.equal(qolipFirstBarcodeValue([{ rawValue: ' RAW ', displayValue: 'DISPLAY' }]), 'RAW');
  assert.equal(qolipFirstBarcodeValue([{ rawValue: null }, { displayValue: '\u0085 VALUE \u0085' }]), 'VALUE');
  assert.equal(qolipFirstBarcodeValue([]), '');
  assert.equal(qolipFirstBarcodeValue([{ rawValue: '\u200b' }]), '\u200b');
});
for (const mode of ['raw', 'universal']) test(`${mode} scanner stops then returns the QR text without any lookup`, async () => {
  const f = fixture(mode); await f.state.detect([{ rawValue: ' QR ' }]);
  assert.deepEqual(f.events, ['stop', ['complete', 'QR']]);
  assert.equal(f.state.getSnapshot().finished, true);
  assert.equal(f.state.getSnapshot().status, `scanner.checking.${mode === 'raw' ? 'mold' : mode}`);
  await f.state.detect([{ rawValue: 'SECOND' }]); assert.equal(f.events.length, 2);
});
test('cell scan waits for camera stop, calls the source GET once, and returns its parsed cell', async () => {
  const f = fixture(), stopped = deferred(), result = deferred(); f.setStop(() => stopped.promise); f.setLookup(() => result.promise);
  const reading = f.state.detect([{ rawValue: ' CELL ' }]);
  assert.equal(f.state.getSnapshot().processing, true); assert.deepEqual(f.events, ['stop']);
  await f.state.detect([{ rawValue: 'DUPLICATE' }]); assert.deepEqual(f.events, ['stop']);
  stopped.resolve(); await tick(); assert.deepEqual(f.events, ['stop', ['lookup', 'CELL']]);
  const cell = { id: 'c', row_letter: 'A', column_number: 3 }; result.resolve(cell); await reading;
  assert.equal(f.events.at(-1)[1], cell);
});
test('blank captures have no camera or network side effects', async () => {
  const f = fixture(); await f.state.detect([{ rawValue: '\u0085 ' }]); assert.deepEqual(f.events, []);
  assert.equal(f.state.getSnapshot().processing, false);
});
for (const code of ['cell_qr_not_found', 'qolip_cell_qr_not_found', 'qr_required', 'qolip_cell_qr_required', 'other']) {
  test(`lookup error ${code} uses V2 snackbar mapping then restarts and resets the prompt`, async () => {
    const f = fixture(), error = new MobileApiException({ code, message: 'server detail is not the scanner label' });
    f.setLookup(async () => { throw error; }); await f.state.detect([{ rawValue: 'CELL' }]);
    const key = code.includes('not_found') ? 'scanner.not_found' : code.includes('required') ? 'scanner.empty' : 'scanner.check_failed';
    assert.deepEqual(f.events, ['stop', ['lookup', 'CELL'], ['notice', key], 'restart']);
    assert.equal(f.state.getSnapshot().status, 'scanner.prompt.cell'); assert.equal(f.state.getSnapshot().processing, false);
  });
}
test('unknown errors and foreign code-like values map to the source generic scanner failure', () => {
  assert.equal(qolipScannerErrorKey(new Error('network')), 'scanner.check_failed');
  assert.equal(qolipScannerErrorKey({ code: 'cell_qr_not_found' }), 'scanner.check_failed');
});
test('camera retry failure shows camera_failed only when the native session is in error', async () => {
  const f = fixture(); f.camera(false, true); await f.state.retry(); assert.equal(f.state.getSnapshot().status, 'scanner.camera_failed');
  f.camera(false, false); await f.state.retry(); assert.equal(f.state.getSnapshot().status, 'scanner.prompt.cell');
});
for (const stage of ['stop', 'lookup']) test(`closing during ${stage} discards late success and never closes a newer screen`, async () => {
  const f = fixture(), gate = deferred();
  if (stage === 'stop') f.setStop(() => gate.promise); else f.setLookup(() => gate.promise);
  const reading = f.state.detect([{ rawValue: 'CELL' }]); await tick(); f.state.suspend(); f.state.activate();
  gate.resolve({ id: 'late' }); await reading;
  assert.ok(!f.events.some(event => Array.isArray(event) && ['complete', 'notice'].includes(event[0])));
});
test('session retirement during a pending lookup suppresses both a late error and automatic retry', async () => {
  const f = fixture(), gate = deferred(); f.setLookup(() => gate.promise);
  const reading = f.state.detect([{ rawValue: 'CELL' }]); await tick(); f.expire(); gate.reject(new Error('late'));
  await reading; assert.deepEqual(f.events, ['stop', ['lookup', 'CELL']]);
});
test('a previous camera generation cannot deliver a capture after an explicit retry', async () => {
  const f = fixture('raw'), generation = f.state.getSnapshot().generation;
  await f.state.retry(); await f.state.detect([{ rawValue: 'OLD' }], generation);
  assert.deepEqual(f.events, ['restart']); await f.state.detect([{ rawValue: 'NEW' }], f.state.getSnapshot().generation);
  assert.deepEqual(f.events.at(-1), ['complete', 'NEW']);
});
test('construction performs no camera, session, network or callback operation', () => {
  const forbidden = () => { throw Error('render must not operate the scanner'); };
  assert.doesNotThrow(() => new QolipQrScannerState('cell', {
    current: forbidden, stop: forbidden, restart: forbidden, cameraFailed: forbidden,
    lookup: forbidden, complete: forbidden, notify: forbidden,
  }));
});
test('a replaced opening binding cannot revive after focus or input returns to the old value', async () => {
  const f = fixture('raw'); f.state.invalidate(); f.state.activate();
  await f.state.retry(); await f.state.detect([{ rawValue: 'LATE' }]);
  assert.equal(f.state.canAct(), false); assert.equal(f.state.getSnapshot().invalid, true); assert.deepEqual(f.events, []);
});
test('an observer that closes the page while publishing completion prevents a stale result callback', async () => {
  const f = fixture('raw'); f.state.subscribe(() => { if (f.state.getSnapshot().finished) f.state.suspend(); });
  await f.state.detect([{ rawValue: 'QR' }]); assert.deepEqual(f.events, ['stop']);
});
