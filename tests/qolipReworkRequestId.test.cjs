const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks) {
  const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
function fixture({ value = '1760000000123456', bytes = Uint8Array.from({ length: 16 }, (_, index) => index), present = true, random } = {}) {
  const calls = [];
  const clock = load('modules/accord-native-clock/src/AccordNativeClockModule.ts', {
    expo: { NativeModule: class {}, requireOptionalNativeModule: name => {
      calls.push(['module', name]); return present ? { microsecondsSinceEpoch: () => { calls.push('clock'); return value; } } : null;
    } },
  });
  const factory = load('src/qolip/qolipReworkRequestId.ts', {
    'expo-crypto': { getRandomBytesAsync: async size => { calls.push(['random', size]); return random ? random() : bytes; } },
    '../../modules/accord-native-clock/src/AccordNativeClockModule': clock,
  });
  return { ...factory, calls, clock };
}

test('V2 id draws 128 secure bits before reading UTC microseconds and uses lowercase padded hex', async () => {
  const f = fixture(); assert.deepEqual(f.calls, [], 'loading the helper must not require a native binary or draw entropy');
  assert.equal(await f.newQolipReworkRequestId(), 'qolip-rework-1760000000123456-000102030405060708090a0b0c0d0e0f');
  assert.deepEqual(f.calls, [['random', 16], ['module', 'AccordNativeClock'], 'clock']);
});
// @v2-test test/qolip_rework_request_id_test.dart
test('f119 rework IDs remain unique and fit the backend request ID contract across 10,000 draws', async () => {
  const f = fixture({ random: () => randomBytes(16) }), ids = new Set();
  for (let index = 0; index < 10_000; index++) {
    const id = await f.newQolipReworkRequestId();
    assert.match(id, /^qolip-rework-[0-9]+-[0-9a-f]{32}$/);
    assert.ok(id.length <= 128);
    assert.ok(!ids.has(id), `duplicate request ID: ${id}`);
    ids.add(id);
  }
  assert.equal(ids.size, 10_000);
});
for (const value of ['10000000000123457', '-1', '0']) test(`native decimal microseconds ${value} never pass through a JS Number or millisecond fallback`, async () => {
  const f = fixture({ value }); const id = await f.newQolipReworkRequestId(); assert.ok(id.startsWith(`qolip-rework-${value}-`));
});
test('older development builds fail before creating a usable request id', async () => {
  const f = fixture({ present: false }); await assert.rejects(f.newQolipReworkRequestId(), /accord_clock_unavailable/);
  assert.ok(!f.calls.includes('clock'));
});
for (const value of [123, null, '123.4', '1e6', '123\n', '123\r\n', '']) test(`invalid native timestamp ${JSON.stringify(value)} is rejected`, async () => {
  const f = fixture({ value }); await assert.rejects(f.newQolipReworkRequestId(), /accord_clock_invalid/);
});
test('entropy failure is propagated without falling back or reading the clock', async () => {
  const failure = new Error('secure source unavailable'), f = fixture({ random: async () => { throw failure; } });
  await assert.rejects(f.newQolipReworkRequestId(), error => error === failure); assert.deepEqual(f.calls, [['random', 16]]);
});
for (const bytes of [new Uint8Array(15), new Uint8Array(17), Array(16).fill(0)]) test('a malformed secure entropy result never becomes a request id', async () => {
  const f = fixture({ bytes }); await assert.rejects(f.newQolipReworkRequestId(), /qolip_request_id_random_unavailable/);
  assert.deepEqual(f.calls, [['random', 16]]);
});
test('the existing Reworks hook defaults to the real factory while preserving explicit injection', async () => {
  const factory = fixture(); let dependencies;
  class Controller {
    constructor(value) { dependencies = value; }
    getSnapshot = () => ({}); subscribe = () => () => {}; groups = [];
  }
  const hook = load('src/qolip/useQolipReworks.ts', {
    react: { useMemo: fn => fn(), useEffect() {}, useSyncExternalStore: (_subscribe, get) => get() },
    '../auth': {}, '../sessionReadScope': {}, '../shared/qolipDataRevision': {}, './qolipReworkApi': {},
    './qolipReworkRequestId': factory, './qolipReworksState': { QolipReworksState: Controller },
  }).useQolipReworks;
  hook({}); assert.equal(dependencies.nextRequestId, factory.newQolipReworkRequestId);
  assert.match(await dependencies.nextRequestId(), /^qolip-rework-1760000000123456-[0-9a-f]{32}$/);
  const injected = async () => 'test-key'; hook({}, injected); assert.equal(dependencies.nextRequestId, injected);
});
