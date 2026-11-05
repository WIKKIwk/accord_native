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
test('successor verifies the apparatus and unlocked new paddon', async () => {
  let body, locked = false;
  const client = load('paddonSuccessorApi', { './authorizedFetch': { authorizedFetch: async (_s, path, init) => {
    assert.equal(path, '/v1/mobile/admin/production-maps/paddons/active/next'); body = JSON.parse(init.body);
    return { status: 200, json: async () => ({ ok: true, apparatus: 'a', code: 'new', paddon: { code: 'new', locked_at_unix: locked ? 1 : null } }) };
  } } });
  assert.equal((await client.createActivePaddonSuccessor({}, ' old ', ' a ')).code, 'new');
  assert.deepEqual(body, { code: 'old', apparatus: 'a' });
  locked = true; await assert.rejects(client.createActivePaddonSuccessor({}, 'old', 'a'), e => e.code === 'paddon_create');
});
