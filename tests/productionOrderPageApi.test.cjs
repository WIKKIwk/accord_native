const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, `../src/${name}.ts`);
  const loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(id.slice(2), mocks) : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return loaded.exports;
}
function api(replay) { return load('productionOrderPageApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl), { ...init, headers: { Authorization: `Bearer ${s.token}` } }) } }); }
for (const [stem, name, input, expected] of [
  ['admin_order_page_api_test', 'admin page forwards only its scope and accepts conditional 304', { view: 'sequence', apparatus: 'apparatus:default:bosma_8', search: 'old order', ifVersion: 'page-1' }, null],
  ['admin_orders_list_api_test', 'Orders requests opt-in summary and keeps conditional scope parameters', { view: 'orders', search: 'x', cursor: 'next', ifVersion: 'v0' }, 'orders_list_v1'],
  ['admin_orders_list_api_test', 'old server full Orders pages remain a compatible fallback', { view: 'orders' }, ''],
  ['admin_orders_list_api_test', 'Orders accepts conditional 304 without decoding an empty body', { view: 'orders', ifVersion: 'v1' }, null],
  ['admin_order_page_decode_test', 'HTTP page body reaches the same fully validated model', { view: 'sequence', apparatus: 'apparatus:default:bosma_7' }, ''],
]) test(name, async () => {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const result = await api(replay).adminProductionOrderPage(session, input);
  assert.equal(result?.projection ?? null, expected);
  replay.assertDone();
});

test('legacy sequence and closed pages remain usable', async () => {
  const stem = 'admin_sequence_list_api_test', name = 'identity experiment is scoped and old server full pages still decode';
  const replay = contractFetch(stem, name), session = recordedSession(stem, name), client = api(replay);
  assert.equal((await client.adminProductionOrderPage(session, { view: 'sequence', apparatus: 'apparatus:default:bosma_7' })).length, 1);
  assert.equal((await client.adminProductionOrderPage(session, { view: 'closed' })).length, 0);
  replay.assertDone();
});

test('summary validation rejects duplicate IDs and unsupported authority fields', () => {
  const { productionOrderPageFromJson: parse } = api(() => { throw Error('unexpected request'); });
  const base = { projection: 'orders_list_v1', version: 'v', epoch: 'e', rev: 1, scope: 's', offset: 0, total: 0, next_cursor: null, order_ids: [], pending_ids: [], rows: {}, pending_rows: {} };
  assert.equal(parse(base).length, 0);
  assert.throws(() => parse({ ...base, queue_states: {} }), e => e.code === 'order_page_invalid');
  assert.throws(() => parse({ ...base, total: 2, order_ids: ['same'], pending_ids: ['same'], rows: { same: { id: 'same', code: '', title: '', customer_name: '', image_id: '', display_state: 'pending', watermarks: [] } }, pending_rows: { same: { id: 'same', code: '', title: '', customer_name: '', image_id: '', kg: 1 } } }), e => e.code === 'order_page_invalid');
});

test('sequence summary validates row identities, ranks and authority like V2', () => {
  const { productionOrderPageFromJson: parse } = api(() => { throw Error('unexpected'); });
  const station = 'apparatus:default:bosma_7', ids = ['zakaz-1', 'training-zakaz-2'];
  const make = () => ({ projection: 'sequence_list_v1', ok: true, version: 'v1', epoch: 'server', rev: 1, scope: 'selected-scope', offset: 0, total: 2, next_cursor: null,
    order_ids: [...ids], sequence_positions: { [ids[0]]: 4, [ids[1]]: 12 }, sequence_versions: { [station]: 's1' }, sequence_revisions: { [station]: 1 },
    queue_policies: [{ apparatus_id: station, apparatus: '7 rang', policy: 'strict_sequence', locked: false, reason: '' }],
    rows: Object.fromEntries(ids.map(id => [id, { id, code: id, title: 'O‘zbek 😀', customer_name: 'Xaridor', image_id: 'photo-1', queue_state: 'pending', display_state: 'pending', can_reorder: true }])) });
  assert.equal(parse(make()).sequence_rows[ids[0]].frozen, false);
  for (const mutate of [
    x => delete x.rows[ids[0]], x => delete x.rows[ids[0]].customer_name, x => { x.rows[ids[0]].id = 'other'; },
    x => { x.rows[ids[0]].queue_state = 'unknown'; }, x => { x.rows[ids[0]].display_state = 'unknown'; },
    x => { x.rows[ids[0]].can_reorder = 'true'; }, x => delete x.sequence_positions[ids[0]], x => { x.order_ids = [ids[0], ids[0]]; },
    x => { x.scope = ''; }, x => { x.rev = 1.5; }, x => { x.sequence_versions = {}; },
    x => { x.sequence_revisions[station] = -1; }, x => { x.queue_policies = []; }, x => { x.queue_policies[0].policy = 'future_policy'; },
    x => x.queue_policies.push(x.queue_policies[0]), x => { x.maps = []; }, x => { x.projection = 'future_projection'; },
  ]) { const wire = make(); mutate(wire); assert.throws(() => parse(wire)); }
});
