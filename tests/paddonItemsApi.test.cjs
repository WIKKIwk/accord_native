const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(fetch) { return load('paddonItemsApi', { './authorizedFetch': { authorizedFetch: fetch } }); }
const station = 'apparatus:default:asset-007';

// V2 has no recorded add-batch HTTP request; these assertions follow its source.
test('adding paddon WIPs trims IDs, preserves duplicates and decodes the snapshot', async () => {
  let body, url;
  const client = api(async (_session, requested, init) => {
    url = requested; body = JSON.parse(init.body);
    return new Response(JSON.stringify({ paddon: { code: 'P', total_gross_kg: '12.5', total_net_kg: -1 },
      items: [{ batch_id: 'one', apparatus: station }], available_items: [null, { batch_id: 'one', apparatus: station }, { batch_id: 'two', apparatus: station }] }), { status: 200 });
  });
  const snapshot = await client.adminPaddonAddWips({}, { paddon_code: ' P ', progress_batch_ids: [' one ', '', ' one ', 'two'] });
  assert.equal(url, '/v1/mobile/admin/production-maps/paddons/items/add-batch');
  assert.deepEqual(body, { code: 'P', progress_batch_ids: ['one', 'one', 'two'] });
  assert.equal(snapshot.paddon.total_gross_kg, 12.5);
  assert.equal(snapshot.paddon.total_net_kg, null);
  assert.equal(snapshot.can_manage_items, true);
  assert.deepEqual(snapshot.available_items.map(item => item.batch_id), ['two']);
});

test('paddon snapshots respect locked and management states', () => {
  const { paddonSnapshotFromJson } = load('paddonModels', { './authorizedFetch': {} });
  assert.equal(paddonSnapshotFromJson({ paddon: { locked_at_unix: 0 }, can_manage_items: true }).can_manage_items, false);
  assert.equal(paddonSnapshotFromJson({ paddon: {}, can_manage_items: false }).can_manage_items, false);
  assert.throws(() => paddonSnapshotFromJson({ can_manage_items: 'true' }), /Invalid paddon management flag/);
});
