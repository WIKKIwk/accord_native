// Source: raw_material_split_models.dart, newRawSplitRequestId.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks) {
  const filename = path.resolve(__dirname, '..', file), mod = new Module(filename, module);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}

function fixture({ value = '1760000000123456', present = true, random } = {}) {
  const calls = [];
  const clock = load('modules/accord-native-clock/src/AccordNativeClockModule.ts', {
    expo: { NativeModule: class {}, requireOptionalNativeModule: name => {
      calls.push(['module', name]);
      return present ? { microsecondsSinceEpoch: () => { calls.push('clock'); return value; } } : null;
    } },
  });
  const draft = load('src/homashyo/rawSplitDraft.ts', {
    './rawSplitModel': {}, './rawSplitWidthPlan': {},
    '../../modules/accord-native-clock/src/AccordNativeClockModule': clock,
    'expo-crypto': { getRandomBytesAsync: async size => {
      calls.push(['random', size]);
      return random ? random() : Uint8Array.from({ length: 16 }, (_, i) => i);
    } },
  });
  return { ...draft, calls };
}

test('V2 reads microseconds before generating sixteen secure bytes', async () => {
  const f = fixture();
  assert.equal(await f.newRawSplitRequestId(), 'split-1760000000123456-000102030405060708090a0b0c0d0e0f');
  assert.deepEqual(f.calls, [['module', 'AccordNativeClock'], 'clock', ['random', 16]]);
});

test('the native timestamp is preserved beyond JavaScript integer precision', async () => {
  const f = fixture({ value: '10000000000123457' });
  assert.ok((await f.newRawSplitRequestId()).startsWith('split-10000000000123457-'));
});

test('an older build without the native clock cannot produce a request ID', async () => {
  const f = fixture({ present: false });
  await assert.rejects(f.newRawSplitRequestId(), /accord_clock_unavailable/);
  assert.deepEqual(f.calls, [['module', 'AccordNativeClock']]);
});

test('a malformed native timestamp is rejected before drawing randomness', async () => {
  const f = fixture({ value: '1.5' });
  await assert.rejects(f.newRawSplitRequestId(), /accord_clock_invalid/);
  assert.deepEqual(f.calls, [['module', 'AccordNativeClock'], 'clock']);
});

test('a secure randomness failure cannot produce a request ID', async () => {
  const failure = new Error('entropy unavailable');
  const f = fixture({ random: () => { throw failure; } });
  await assert.rejects(f.newRawSplitRequestId(), error => error === failure);
});
