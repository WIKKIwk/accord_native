const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
const stem = 'production_map_minimal_sequence_ack_test';
const records = loadContract(stem).filter(x => x.method === 'POST');
const names = [...new Set(records.map(x => x.test))];
const base = { apparatus: 'apparatus:default:bosma_8', order_id: 'c', before_order_id: 'a',
  expected_version: '0'.repeat(64), idempotency_key: 'same-command' };

// @v2-test test/production_map_minimal_sequence_ack_test.dart
for (const name of names) test(name, async () => {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const client = load('workerSequenceMoveApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl),
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  const input = { ...base, canonical_order_ids: name.startsWith('without a complete baseline') ? null : ['a', 'hidden', 'b', 'c'] };
  const count = records.filter(x => x.test === name).length;
  for (let i = 0; i < count; i++) {
    if (name.startsWith('rejects ') || name.startsWith('without a complete baseline')) {
      await assert.rejects(client.adminMoveProductionMapSequence(session, input), error => error.code === 'production_map_snapshot_contract_invalid');
    } else {
      const result = await client.adminMoveProductionMapSequence(session, input);
      if (name.startsWith('applies clamped')) assert.deepEqual(result.order_ids, ['a', 'hidden', 'c', 'b']);
      else if (name.startsWith('no-op')) {
        assert.deepEqual(result.order_ids, ['a', 'hidden', 'b', 'c']);
        assert.equal(result.revision, null);
        assert.equal(result.version, '0'.repeat(64));
      } else assert.deepEqual(result.order_ids, ['c', 'a', 'hidden', 'b']);
    }
  }
  replay.assertDone();
});

test('sequence move captures a full baseline before an asynchronous response', async () => {
  let release;
  const session = {};
  const client = load('workerSequenceMoveApi', { './authorizedFetch': { authorizedFetch: async () => {
    await new Promise(resolve => { release = resolve; });
    const record = records.find(x => x.test.startsWith('baseline is captured'));
    return new Response(record.responseBody.text, { status: 200 });
  } } });
  const baseline = ['a', 'hidden', 'b', 'c'];
  const pending = client.adminMoveProductionMapSequence(session, { ...base, canonical_order_ids: baseline });
  baseline.length = 0;
  release();
  assert.deepEqual((await pending).order_ids, ['c', 'a', 'hidden', 'b']);
});

test('sequence move rejects invalid baseline and version before sending', async () => {
  const client = load('workerSequenceMoveApi', { './authorizedFetch': { authorizedFetch: () => { throw Error('unexpected request'); } } });
  await assert.rejects(client.adminMoveProductionMapSequence({}, { ...base, expected_version: 'invalid' }), error => error.code === 'queue_reorder_unavailable');
  await assert.rejects(client.adminMoveProductionMapSequence({}, { ...base, canonical_order_ids: ['c', 'c'] }), error => error.code === 'production_map_snapshot_contract_invalid');
});
