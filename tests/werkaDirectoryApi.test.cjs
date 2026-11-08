// V2 has no direct HTTP recordings for these directory readers; assertions follow the f119 source.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/werka/werkaDirectoryApi.ts');
function setup(data, status = 200) {
  const calls = [], module = new Module(filename); module.filename = filename; module.paths = require.main.paths;
  module.require = name => name === '../authorizedFetch' ? { authorizedFetch: async (_session, url) => {
    calls.push(url); return new Response(JSON.stringify(data), { status });
  } } : require(name);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { api: module.exports, calls };
}
test('suppliers and customers preserve query trimming and pagination', async () => {
  const { api, calls } = setup([{ ref: 'r', name: 'Name' }, {}]);
  assert.deepEqual(await api.werkaSuppliers({}, { query: ' a & b ', limit: 30, offset: 60 }),
    [{ ref: 'r', name: 'Name', phone: '' }, { ref: '', name: '', phone: '' }]);
  await api.werkaCustomers({}, { query: ' ', limit: 0, offset: -1 });
  assert.deepEqual(calls, ['/v1/mobile/werka/suppliers?q=a+%26+b&limit=30&offset=60', '/v1/mobile/werka/customers']);
});
test('default page limit and typed decoding are retained', async () => {
  const { api, calls } = setup([]); await api.werkaCustomers({});
  assert.equal(calls[0], '/v1/mobile/werka/customers?limit=200');
  await assert.rejects(setup([{ ref: 3 }]).api.werkaSuppliers({}), /Invalid directory string/);
  await assert.rejects(setup({}).api.werkaCustomers({}), /Invalid directory list/);
  await assert.rejects(setup([], 503).api.werkaSuppliers({}), /Werka suppliers failed/);
});
