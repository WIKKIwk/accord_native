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
const model = load('workerLaminationRemainders', { './authorizedFetch': {} });
const station = 'apparatus:default:asset-007';
const source = { source_kind: 'progress_batch', source_id: 'original-50kg', session_id: 'lamination-session', revision: 7,
  qr_payload: 'original-qr', item_code: 'PET', item_name: 'Printed PET', source_net_kg: 50, source_meter: 1500, tare_kg: 2 };

// @v2-test test/lamination_layer_remainder_api_test.dart
test('empty layer reports follow only the server material policy', () => {
  for (const policy of [true, false, null, 'true']) {
    const snapshot = model.laminationAstatkaSnapshotFromJson({ session: { session_id: 'optional-session', status: 'active' }, allow_empty_sources: policy });
    assert.equal(snapshot.allow_empty_sources, policy === true);
    assert.deepEqual(snapshot.sources, []);
    assert.equal(model.laminationAstatkaOutputRequired(snapshot), true);
  }
});

test('kg fields retain exact current physical inputs and fall back only to a unique calculable roll', () => {
  for (const wipKind of ['progress_batch', 'opening_wip']) {
    const sources = [wipKind, 'raw_material'].flatMap(kind => [
      { ...source, source_kind: kind, source_id: `a-current-${kind}`, is_current_roll: true },
      { ...source, source_kind: kind, source_id: `z-previous-${kind}` },
    ]);
    const snapshot = model.laminationAstatkaSnapshotFromJson({ sources });
    assert.equal(model.laminationAstatkaInputRoll(snapshot, 'wip').source_id, `a-current-${wipKind}`);
    assert.equal(model.laminationAstatkaInputRoll(snapshot, 'film').source_id, 'a-current-raw_material');
    assert.equal(model.layerRemainderSourceToJson(model.laminationAstatkaInputRoll(snapshot, 'wip')).is_current_roll, true);
    const unbound = model.laminationAstatkaSnapshotFromJson({ sources: sources.map(row => ({ ...row, is_current_roll: false })) });
    assert.equal(model.laminationAstatkaInputRoll(unbound, 'wip'), null);
    assert.equal(model.laminationAstatkaInputRoll(unbound, 'film'), null);
  }
  const legacy = model.laminationAstatkaSnapshotFromJson({ sources: [source] });
  assert.equal(model.laminationAstatkaInputRoll(legacy, 'wip').source_id, source.source_id);
  assert.equal(model.layerRemainderEstimateMeter(legacy.sources[0], 20), 600);
  assert.equal(model.layerRemainderEstimateMeter(legacy.sources[0], 51), null);
  const film = model.laminationAstatkaSnapshotFromJson({ sources: [
    { ...source, source_kind: 'raw_material', source_id: 'film' },
    { ...source, source_kind: 'raw_material', source_id: 'glue', source_meter: 0 },
  ] });
  assert.equal(model.laminationAstatkaInputRoll(film, 'film').source_id, 'film');
});

test('two-field support and independent label switches are explicit', () => {
  assert.equal(model.laminationAstatkaSnapshotFromJson({}).supports_remainder_weights, false);
  for (const wip of [false, true]) for (const film of [false, true]) {
    const snapshot = model.laminationAstatkaSnapshotFromJson({ remainder_weights_supported: true,
      label_settings: { print_wip_remainder_labels: wip, print_film_remainder_labels: film } });
    assert.equal(snapshot.supports_remainder_weights, true);
    assert.equal(model.laminationLabelPrints(snapshot.label_settings, 'progress_batch'), wip);
    assert.equal(model.laminationLabelPrints(snapshot.label_settings, 'opening_wip'), wip);
    assert.equal(model.laminationLabelPrints(snapshot.label_settings, 'raw_material'), film);
  }
});

test('saved report results validate action and preserve returned remainder data', () => {
  const snapshot = model.laminationAstatkaSnapshotFromJson({ request_result: { ok: true, report: {},
    remainders: [{ source_id: 's', recorded_by: { display_name: 'Operator' }, remaining_net_kg: 20 }], prints: [] } });
  assert.equal(snapshot.request_result.action, 'pause');
  assert.equal(snapshot.request_result.remainders[0].recorded_by_name, 'Operator');
  assert.equal(model.laminationAstatkaResultFromJson({ ok: true, action: 'complete', session: { status: 'completed' } }).action, 'complete');
  assert.throws(() => model.laminationAstatkaResultFromJson({ ok: true, action: 'complete', session: { status: 'active' } }),
    error => error.code === 'laminatsiya_astatka_invalid_response');
});

// V2 has no recorded GET for the snapshot; the request follows the baseline source.
test('snapshot request validates scope and trims optional request ID', async () => {
  let requested;
  const client = load('workerLaminationApi', { './authorizedFetch': { authorizedFetch: async (_session, url) => {
    requested = new URL(url, 'https://example.test');
    return new Response(JSON.stringify({ session: { session_id: 'session', status: 'active' }, sources: [source] }), { status: 200 });
  } } });
  const snapshot = await client.adminLaminationAstatkaSnapshot({}, { apparatus: ` ${station} `, order_id: ' order-1 ', request_id: ' id ' });
  assert.equal(requested.pathname, '/v1/mobile/admin/production-maps/laminatsiya-astatka');
  assert.deepEqual(Object.fromEntries(requested.searchParams), { apparatus: station, order_id: 'order-1', request_id: 'id' });
  assert.equal(snapshot.session_id, 'session');
  await assert.rejects(client.adminLaminationAstatkaSnapshot({}, { apparatus: station, order_id: ' ' }),
    error => error.code === 'layer_remainder_context_invalid');
});
