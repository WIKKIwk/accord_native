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
test('rezka print side saves current and previous values', async () => {
  let sent; const api = load('rezkaMasterSettingsApi', { './authorizedFetch': { authorizedFetch: async (_s, path, init) => { sent = { path, ...init }; return { status: 200 }; } } });
  await api.rezkaMasterSavePrintSide({}, 'order', true, false);
  assert.equal(sent.path, '/v1/mobile/rezka-master/print-side'); assert.equal(sent.method, 'PUT');
  assert.deepEqual(JSON.parse(sent.body), { order_id: 'order', standard_print_side: true, previous_standard_print_side: false });
});
