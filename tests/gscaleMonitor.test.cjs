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
    if (name === './gscaleControlLogic') return { normalizePrinterChoice: value => ['godex', 'go-dex', 'g500'].includes(value.trim().toLowerCase()) ? 'godex' : 'zebra',
      normalizeQuantitySource: value => value.trim().toLowerCase() === 'manual' ? 'manual' : 'scale' };
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  cache.set(filename, m.exports); return m.exports;
}
const monitor = load('gscaleMonitor.ts');

// @v2-test test/gscale_discovery_result_test.dart
test('monitor reads connected printer from nested state and repairs an empty label', () => {
  for (const label of ['ulangan', '']) {
    const result = monitor.monitorSnapshotFromJson({ ok: true, state: { scale: { unit: 'kg' }, printer: { connected: true, kind: 'godex', label } } });
    assert.equal(result.printerLabel, 'ulangan'); assert.equal(result.printerKind, 'godex');
  }
  const top = monitor.monitorSnapshotFromJson({ ok: true, state: {}, printer: { connected: 'true', kind: 'godex', label: 'ulanmagan' } });
  assert.equal(top.printerLabel, 'ulangan'); assert.equal(top.printerKind, 'godex');
});

test('live data keeps RS active batch and printer when the next payload omits both', () => {
  const previous = monitor.monitorSnapshotFromJson({ ok: true, state: { printer: { connected: true, kind: 'godex' },
    batch: { active: true, item_code: 'I', item_name: 'Ink', warehouse: 'W', printer: 'godex', quantity_source: 'manual' } } });
  const next = monitor.monitorSnapshotFromJson({ ok: true, state: { scale: { weight: 2.5, stable: true, source: 'serial' } } });
  const merged = monitor.mergeLiveMonitorWithRsBatch(next, previous);
  assert.equal(merged.scaleValue, '2.5 kg'); assert.equal(merged.scaleStable, true);
  assert.equal(merged.batchActive, true); assert.equal(merged.batchItemCode, 'I');
  assert.equal(merged.printerKind, 'godex'); assert.equal(merged.printerLabel, 'ulangan');
});

test('printer status prioritizes processing and constructs completion/error messages', () => {
  assert.equal(monitor.derivePrinterState('done', 'error', 'active'), 'processing');
  assert.equal(monitor.buildPrinterEventKey('done', ' EPC ', '', 'done'), 'done|EPC|');
  assert.equal(monitor.buildPrinterEventMessage('done', 'done', 'EPC', '', 'godex'), 'godex: print qildi • EPC');
  assert.equal(monitor.buildPrinterEventMessage('error', 'error', '', 'No paper', 'zebra'), 'zebra: failed • No paper');
});
