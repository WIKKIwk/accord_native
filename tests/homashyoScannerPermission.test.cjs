// Role permission policy around the shared serialized camera-permission controller; no OS calls.
const assert = require('node:assert/strict'); const fs = require('node:fs'); const Module = require('node:module');
const path = require('node:path'); const test = require('node:test'); const ts = require('typescript');
function run(active, permission, error = null, isCurrent = () => true) {
  const filename = path.resolve(__dirname, '../src/homashyo/useRawSplitScanner.ts'), m = new Module(filename, module), effects = [], calls = [];
  m.filename = filename; m.paths = module.paths;
  const react = { useState: value => [value, next => calls.push(['state', next])], useRef: value => ({ current: value }),
    useEffect: effect => effects.push(effect), useCallback: fn => fn, useSyncExternalStore: () => 'uz' };
  const guardFile = path.resolve(__dirname, '../src/shared/camera/synchronousGuard.ts'), guardModule = new Module(guardFile, module);
  guardModule.filename = guardFile; guardModule.paths = module.paths;
  guardModule._compile(ts.transpileModule(fs.readFileSync(guardFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, guardFile);
  const mocks = { react, '../shared/camera/synchronousGuard': guardModule.exports, '../shared/camera/useCameraSurfacePermission': { useCameraSurfacePermission: () => ({ permission, error, checking: false, canUseCamera: () => permission?.granted === true,
    requestPermission: async () => { calls.push('request'); return permission; } }) },
    '../shared/localization': { productionText: key => key }, '../shared/localization/runtime': { localeController: {} },
    './rawSplitScanLogic': { RawSplitScanGate: class { accept(value) { return value || null; } } } };
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const state = m.exports.useRawSplitScanner(active, isCurrent, value => calls.push(['complete', value])); effects.forEach(effect => effect()); return { calls, state };
}
test('role waits for initial permission read and never prompts while inactive', () => {
  assert.deepEqual(run(true, null).calls, []); assert.deepEqual(run(false, { granted: false, canAskAgain: true }).calls, []);
});
test('role requests only a known, denied, askable permission and handles initial-read errors', () => {
  assert.deepEqual(run(true, { granted: true, canAskAgain: true }).calls, []);
  assert.deepEqual(run(true, { granted: false, canAskAgain: false }).calls, []);
  assert.deepEqual(run(true, { granted: false, canAskAgain: true }).calls, ['request']);
  assert.equal(run(true, null, new Error('read failed')).state.failed, true);
  assert.deepEqual(run(true, { granted: false, canAskAgain: true }, new Error('read failed')).calls, []);
});

test('role rejects camera or manual completion immediately after owner/session becomes stale', () => {
  let current = true; const h = run(true, { granted: true, canAskAgain: true }, null, () => current);
  current = false; h.state.complete('old'); assert.deepEqual(h.calls, []);
});

test('async or rejected role owner guard cannot start a prompt or complete a scan', async () => {
  for (const guard of [() => Promise.resolve(true), () => Promise.reject(new Error('stale'))]) {
    const h = run(true, { granted: false, canAskAgain: true }, null, guard); h.state.complete('bad');
    await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(h.calls, []);
  }
});
