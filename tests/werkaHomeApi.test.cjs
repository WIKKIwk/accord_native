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
test('werka home parses summary and pending dispatches', async () => {
  const api = load('werkaHomeApi', { './authorizedFetch': { authorizedFetch: async (_s, path) => { assert.equal(path, '/v1/mobile/werka/home'); return { status: 200, json: async () => ({ summary: { pending_count: 1 }, pending_items: [{ id: '1', status: 'accepted', sent_qty: 2 }] }) }; } } });
  const home = await api.werkaHome({}); assert.equal(home.summary.pending_count, 1); assert.equal(home.pending_items[0].status, 'accepted');
});
