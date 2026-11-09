const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
test('opted-in apparatus attempts close the transport gate at each attempt deadline', async t => {
  const filename = path.resolve(__dirname, '../src/apparatusApi.ts'), mod = new Module(filename, module), original = Date.now;
  t.after(() => { Date.now = original; }); let now = 0; const timeouts = [];
  Date.now = () => now;
  const transport = { authorizedFetch: async (_session, _path, _init, guard, timeout, options) => {
    guard(); assert.equal(options.readWitness(), true); timeouts.push(timeout); now = 7000;
    return new Response(timeouts.length === 1 ? '' : '[]', { status: timeouts.length === 1 ? 502 : 200 });
  } };
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === './authorizedFetch' ? transport : id === './workerControlsApi'
    ? { WorkerControlException: class extends Error {}, isCanonicalApparatusId: () => true } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  await mod.exports.readApparatus({}, '/v1/mobile/admin/apparatus', true, undefined, () => {}, () => true);
  assert.deepEqual(timeouts, [10000, 8000]);
});
