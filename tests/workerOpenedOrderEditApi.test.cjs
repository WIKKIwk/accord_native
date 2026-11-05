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
const stem = 'opened_order_edit_api_test';
function replayApi(name) {
  const replay = contractFetch(stem, name, { onlyMethods: ['GET'] }), session = recordedSession(stem, name);
  const client = load('workerOpenedOrderEditApi', { './authorizedFetch': { authorizedFetch: (s, p, init = {}) => replay(new URL(p, s.baseUrl),
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } });
  return { client, replay, session };
}
// @v2-test test/opened_order_edit_api_test.dart
test('opened order edit uses dedicated authenticated endpoint and exact snapshot', async () => {
  const { client, replay, session } = replayApi('opened order edit uses dedicated authenticated endpoint and exact snapshot');
  const source = await client.adminOpenedOrderEditSource(session, 'zakaz-1234');
  assert.equal(source.template.kg, 500);
  assert.equal(source.order_id, 'zakaz-1234');
  assert.equal(source.original.map.unknown_field, 'preserve');
  assert.equal(source.original.template.unknown_field, 'also preserve');
  replay.assertDone();
});

test('opened order material restrictions round trip with the exact snapshot', () => {
  const client = load('workerOpenedOrderEditApi', { './authorizedFetch': {} });
  const payload = { map: { id: 'order', extra: 3 }, template: { layers: [{ material: 'pet', micron: '12' }] }, restrictions: {
    locked_layer_indices: [0], dimensions_locked: true, layer_structure_locked: true, unresolved_materials: false } };
  const source = client.openedOrderEditSourceFromJson(payload);
  assert.equal(source.original, payload);
  assert.deepEqual([...source.restrictions.locked_layer_indices], [0]);
  for (const indices of [[-1], [3], ['0']]) assert.throws(() => client.openedOrderEditSourceFromJson({ ...payload,
    restrictions: { ...payload.restrictions, locked_layer_indices: indices } }), /restrictions/);
  assert.throws(() => client.openedOrderEditSourceFromJson({ ...payload, restrictions: {} }), /restrictions/);
  assert.throws(() => client.openedOrderEditSourceFromJson({ ...payload, restrictions: {
    ...payload.restrictions, unresolved_materials: true, locked_layer_indices: [] } }), /restrictions/);
});

test('template numeric fields use Dart decimal parsing rather than JavaScript hex coercion', () => {
  const { calculateOrderTemplateFromJson } = load('workerOpenedOrderEditApi', { './authorizedFetch': {} });
  const template = calculateOrderTemplateFromJson({ width_mm: '0x20', waste_percent: '-.5e2',
    print_val_size_mm: '0b101', roll_count: 'NaN' });
  assert.equal(template.width_mm, 0);
  assert.equal(template.waste_percent, -50);
  assert.equal(template.print_val_size_mm, null);
  assert.equal(Number.isNaN(template.roll_count), true);
  assert.equal(calculateOrderTemplateFromJson({ roll_count: 'nan' }).roll_count, null);
});

test('template dates retain Dart microseconds, local dates, offsets and overflow', () => {
  const { calculateOrderTemplateFromJson: parse } = load('workerOpenedOrderEditApi', { './authorizedFetch': {} });
  const precise = parse({ saved_at: '2026-11-05T10:11:12.123456Z' }).saved_at;
  assert.equal(precise.getTime(), Date.parse('2026-11-05T10:11:12.123Z'));
  assert.equal(precise.microsecond, 456);
  assert.equal(precise.microseconds_since_epoch, BigInt(precise.getTime()) * 1000n + 456n);
  assert.equal(precise.is_utc, true);
  const compact = parse({ saved_at: '20260101' }).saved_at;
  assert.equal(compact.getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(compact.is_utc, false);
  const offset = parse({ saved_at: '2020-01-42T00:00:00,654321+05:00' }).saved_at;
  assert.equal(offset.getTime(), Date.UTC(2020, 1, 10, 19, 0, 0, 654));
  assert.equal(offset.microsecond, 321);
  const beforeEpoch = parse({ saved_at: '-1' }).saved_at;
  assert.equal(beforeEpoch.getTime(), -1);
  assert.equal(beforeEpoch.microsecond, 999);
  assert.equal(beforeEpoch.microseconds_since_epoch, -1n);
});

for (const name of ['GET conflict remains blocked without retries or creating an order', ...[400, 404, 409, 422].map(status => `edit preserves a business reason for HTTP ${status}`),
  'GET preserves the actual explained database failure', 'edit keeps the existing translation for a known server error']) {
  test(name, async () => {
    const { client, replay, session } = replayApi(name);
    await assert.rejects(client.adminOpenedOrderEditSource(session, 'zakaz-1234'), error => {
      if (name.startsWith('GET conflict')) return error.statusCode === 409 && error.message === 'Buyurtmada opening WIP ochilgan';
      if (name.startsWith('edit preserves')) return error.message === 'Buyurtmaga xomashyo biriktirilgan. Xomashyo tarixini tekshiring.';
      if (name.startsWith('GET preserves')) return error.statusCode === 500 && error.code === 'order_edit_database_permission' && error.message.startsWith('Serverning baza hisobi');
      return error.message === 'Aparat yoki buyurtma ma’lumoti topilmadi. Oynani yangilang.';
    });
    replay.assertDone();
  });
}
