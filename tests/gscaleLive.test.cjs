const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const filename = path.resolve(__dirname, '../src/gscale', name);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  m.require = name => {
    if (name === './gscaleMonitor') return load('gscaleMonitor.ts');
    if (name === './gscaleControlLogic') return { normalizePrinterChoice: value => ['godex', 'go-dex', 'g500'].includes(value.trim().toLowerCase()) ? 'godex' : 'zebra',
      normalizeQuantitySource: value => value.trim().toLowerCase() === 'manual' ? 'manual' : 'scale' };
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const { refreshGScaleMonitor, GScaleLiveMonitor } = load('gscaleLive.ts');
const reply = (status, data) => ({ status, text: async () => JSON.stringify(data) });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('manual monitor refresh checks health before loading the live snapshot', async () => {
  const calls = [];
  const snapshot = await refreshGScaleMonitor(async url => {
    calls.push(url);
    return url.endsWith('healthz') ? reply(200, {}) : reply(200, { ok: true, state: { scale: { weight: 5, stable: true } } });
  }, 'http://scale:39117');
  assert.deepEqual(calls, ['http://scale:39117/healthz', 'http://scale:39117/v1/mobile/monitor/state']);
  assert.equal(snapshot.scaleValue, '5 kg'); assert.equal(snapshot.scaleStable, true);
  await assert.rejects(refreshGScaleMonitor(async () => reply(503, {}), 'http://scale:39117'), /healthz 503/);
});

test('monitor consumes stream data and ignores callbacks after stop', async () => {
  let listener, cancellations = 0;
  const snapshots = [], errors = [], latencies = [];
  const live = new GScaleLiveMonitor('http://scale:39117', async () => reply(200, {}), async (url, cb) => {
    assert.equal(url, 'http://scale:39117'); listener = cb; return () => { cancellations++; };
  }, { onSnapshot: value => snapshots.push(value), onError: value => errors.push(value),
    onLatency: value => latencies.push(value), onUnavailable: () => assert.fail('unexpected unavailable') });
  live.start(); await flush();
  listener({ type: 'data', value: JSON.stringify({ ok: true, state: { scale: { weight: 1.25, stable: true } } }) });
  listener({ type: 'data', value: JSON.stringify({ ok: false, error: 'scale offline' }) });
  assert.equal(snapshots[0].scaleValue, '1.25 kg'); assert.deepEqual(errors, ['scale offline']);
  assert.equal(latencies.length, 1);
  live.stop();
  listener({ type: 'data', value: JSON.stringify({ ok: true }) });
  assert.equal(snapshots.length, 1); assert.equal(cancellations, 1);
});

test('a stream closed before its native start resolves is still cancelled', async () => {
  let resolve, cancelled = 0;
  const live = new GScaleLiveMonitor('http://scale:39117', async () => reply(200, {}), () => new Promise(r => { resolve = r; }),
    { onSnapshot() {}, onError() {}, onLatency() {}, onUnavailable() {} });
  live.start(); live.stop();
  resolve(() => { cancelled++; });
  await flush();
  assert.equal(cancelled, 1);
});
