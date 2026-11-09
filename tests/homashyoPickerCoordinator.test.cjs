const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function load(file, mocks = {}) { const filename = path.resolve(__dirname, `../src/${file}.ts`), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths; m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename); return m.exports; }
const discovery = load('gscale/gscaleDiscovery');
const { createTransientDevicePicker } = load('shared/printing/transientDevicePicker', { '../../gscale/gscaleDiscovery': discovery });
const { RawSplitPickerCoordinator } = load('homashyo/rawSplitPickerCoordinator');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let valid = true, rendered = null; const renders = [];
  const coordinator = new RawSplitPickerCoordinator({ isCurrent: () => valid,
    create: () => createTransientDevicePicker({ isCurrent: () => valid, scan: async () => ({ servers: [], candidateCount: 0 }), probe: async () => null }),
    render: request => { rendered = request; renders.push(request); }, convert: selection => ({ transport: selection.transport }) });
  return { coordinator, renders, request: () => rendered, invalidate: () => { valid = false; } };
}
const printer = { transport: 'bluetooth', bluetoothPrinter: { address: 'AA' } };
test('selection waits for overlay removal before yielding, and old dismissal cannot close a new picker', async () => {
  const h = harness(), firstResult = h.coordinator.select(), first = h.request(); let resolved = false;
  firstResult.then(() => { resolved = true; });
  assert.equal(await first.adapter.selectDevice(printer), true);
  first.adapter.completeSelection(() => h.coordinator.dismiss(first)); await flush();
  assert.equal(resolved, false); assert.equal(h.request(), null);
  h.coordinator.removed(first); assert.deepEqual(await firstResult, { transport: 'bluetooth' });
  const secondResult = h.coordinator.select(), second = h.request(); assert.notEqual(second, first);
  h.coordinator.dismiss(first); h.coordinator.removed(first); assert.equal(h.request(), second);
  h.coordinator.dismiss(second); h.coordinator.removed(second); assert.equal(await secondResult, null);
});
test('Cancel or hardware Back invalidate a late selection and concurrent requests never replace the owner', async () => {
  const h = harness(), result = h.coordinator.select(), request = h.request();
  assert.equal(await h.coordinator.select(), null); h.coordinator.dismiss(request);
  assert.equal(await request.adapter.selectDevice(printer), false); h.coordinator.removed(request);
  assert.equal(await result, null); assert.equal(h.request(), null);
});
test('session switch or owner disposal resolves null and ignores late completion', async () => {
  for (const dispose of [false, true]) {
    const h = harness(), result = h.coordinator.select(), request = h.request();
    assert.equal(await request.adapter.selectDevice(printer), true);
    if (dispose) h.coordinator.dispose(); else h.invalidate();
    request.adapter.completeSelection(() => h.coordinator.dismiss(request)); h.coordinator.removed(request);
    assert.equal(await result, null); assert.equal(await h.coordinator.select(), null);
  }
});
test('a gate transition dismisses a live picker and prevents queued Wi-Fi discovery before overlay removal', async () => {
  let valid = true, request, renders = [], scans = 0;
  const owner = new RawSplitPickerCoordinator({ isCurrent: () => true,
    create: isCurrent => { request = createTransientDevicePicker({ isCurrent, scan: async () => { scans++; return { servers: [], candidateCount: 0 }; }, probe: async () => null }); return request; },
    render: value => renders.push(value), convert: selection => selection });
  const pending = owner.select(() => valid); valid = false; owner.invalidateIfStale(); request.adapter.selectConnection('wifi');
  assert.equal(scans, 0); assert.equal(renders.at(-1), null); owner.removed(request); assert.equal(await pending, null);
});
