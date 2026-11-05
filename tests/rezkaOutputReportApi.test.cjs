const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const stem = 'rezka_output_report_read_api_test';
for (const record of loadContract(stem)) test(record.test, async () => {
  const replay = contractFetch(stem, record.test), session = recordedSession(stem, record.test);
  const client = load('rezkaOutputReportApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const read = () => client.adminRezkaOutputReport(session, 'apparatus:default:asset-010', 'zakaz-rezka-report-read');
  if (record.status === 200) { const result = await read(); assert.ok(result.report.frames.length); assert.ok(result.kadr_counts.length); }
  else if (record.status === 404 && !record.responseBody.text) assert.equal(await read(), null);
  else await assert.rejects(read());
  replay.assertDone();
});
