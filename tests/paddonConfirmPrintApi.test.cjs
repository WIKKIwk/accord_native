const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
test('confirmation verifies matching locked paddon and preserves options', async () => {
  let sent;
  const client = load('paddonConfirmPrintApi', { './authorizedFetch': { authorizedFetch: async (_s, _p, init) => { sent = JSON.parse(init.body); return { status: 200, json: async () => ({ ok: true, paddon: { code: 'P1', locked_at_unix: 123 }, newly_locked: true, apparatus_options: [{ id: 'a', name: 'A' }, {}] }) }; } } });
  const result = await client.confirmPaddonPrint({}, ' P1 ');
  assert.deepEqual(sent, { code: 'P1' }); assert.equal(result.newly_locked, true); assert.deepEqual(result.apparatus_options, { a: 'A' });
});
test('confirmation rejects an unlocked paddon', async () => {
  const client = load('paddonConfirmPrintApi', { './authorizedFetch': { authorizedFetch: async () => ({ status: 200, json: async () => ({ ok: true, paddon: { code: 'P1' } }) }) } });
  await assert.rejects(client.confirmPaddonPrint({}, 'P1'), e => e.code === 'paddon_print_confirm');
});
