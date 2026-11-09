const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const controls = load('workerControlsApi', { './authorizedFetch': {}, './sessionReadScope': {} }), exception = load('shared/mobileApiException');
const tick = () => new Promise(resolve => setImmediate(resolve));
function requestModule(transport = async (_s, _u, _i, guard) => { guard?.(); return new Response('{}', { status: 200 }); }) {
  return load('admin/adminProductionRequest', { '../authorizedFetch': { authorizedFetch: transport }, '../workerControlsApi': controls,
    '../shared/mobileApiException': exception });
}
test('absent guard preserves the unguarded path; checked guards preserve identity and synchronous undefined', async () => {
  let passed = 'unset', count = 0;
  const request = requestModule(async (_s, _u, _i, guard) => { passed = guard; guard?.(); return new Response('{}', { status: 200 }); });
  assert.deepEqual(await request.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x'), {}); assert.equal(passed, undefined);
  assert.deepEqual(await request.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', null), {}); assert.equal(passed, undefined);
  const raw = () => { count++; }, checked = request.checkedAdminGuard(raw);
  assert.equal(request.checkedAdminGuard(raw), checked); assert.equal(request.checkedAdminGuard(checked), checked);
  assert.deepEqual(await request.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', raw), {});
  assert.equal(passed, checked); assert.equal(count, 3);
});
test('false, values, promises and hostile thenables all fail closed without unhandled rejection', async () => {
  const request = requestModule(), rejected = () => Promise.reject(new Error('async rejection'));
  const values = [() => false, () => true, () => null, () => 0, () => '', () => ({}), () => Promise.resolve(undefined),
    async () => false, rejected, () => ({ then(_resolve, reject) { setImmediate(() => reject(new Error('thenable rejection'))); } }),
    () => Object.defineProperty({}, 'then', { get() { throw new Error('getter failure'); } }), () => {
      const promise = Promise.reject(new Error('overridden methods'));
      Object.defineProperties(promise, { then: { value() { throw new Error('overridden then'); } },
        catch: { value() { throw new Error('overridden catch'); } } });
      return promise;
    }];
  for (const raw of values) assert.throws(request.checkedAdminGuard(raw), /Invalid admin guard/);
  await tick(); await tick();
  assert.equal(request.checkedAdminGuard(null), undefined);
});
test('reentrant guard remains rejected even if the inner exception is swallowed', async () => {
  let checked, calls = 0, sends = 0;
  const request = requestModule(async (_s, _u, _i, guard) => { guard(); sends++; return new Response('{}', { status: 200 }); });
  const raw = () => { calls++; try { checked(); } catch {} }; checked = request.checkedAdminGuard(raw);
  assert.throws(checked, /Invalid admin guard/); assert.equal(calls, 1);
  await assert.rejects(request.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', raw), /Invalid admin guard/);
  assert.equal(sends, 0);
});
test('reentry through a different guard is rejected even when caught by the outer callback', () => {
  const request = requestModule(); let innerRuns = 0;
  const inner = request.checkedAdminGuard(() => { innerRuns++; });
  const outer = request.checkedAdminGuard(() => { try { inner(); } catch {} });
  assert.throws(outer, /Invalid admin guard/); assert.equal(innerRuns, 0);
  inner(); assert.equal(innerRuns, 1);
});
test('the checked wrapper is used before transport and after body success or failure', async () => {
  let count = 0, sent = 0, captured;
  const request = requestModule(async (_s, _u, _i, guard) => { captured = guard; guard(); sent++;
    return { status: 200, async json() { return {}; } }; });
  const raw = () => { count++; if (count === 3) return false; };
  await assert.rejects(request.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', raw), /Invalid admin guard/);
  assert.equal(sent, 1); assert.equal(captured, request.checkedAdminGuard(raw)); assert.equal(count, 3);
  let failureChecks = 0;
  const failed = requestModule(async (_s, _u, _i, guard) => { guard(); return { status: 200, async json() { throw new Error('bad json'); } }; });
  await assert.rejects(failed.adminProductionRequest({}, '/v1/mobile/test', undefined, 'x', () => { failureChecks++; if (failureChecks === 3) return Promise.reject(new Error('ignored')); }),
    /Invalid admin guard/);
  assert.equal(failureChecks, 3); await tick();
});

test('hostile Promise constructor still blocks sends, but its rejection cannot be guaranteed handled', () => {
  const { spawnSync } = require('node:child_process');
  const probe = path.resolve(__dirname, 'support/adminHostileGuardProbe.cjs');
  const child = spawnSync(process.execPath, ['--unhandled-rejections=warn', probe], { encoding: 'utf8' });
  assert.equal(child.status, 0); assert.match(child.stdout, /Invalid admin guard;sends=0/);
  assert.match(child.stderr, /hostile guard rejection/);
});
