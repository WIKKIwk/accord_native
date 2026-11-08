// @v2-test test/werka_paddon_api_test.dart (independently passed at f11910bb)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, recordedSession } = require('./support/contractFetch.cjs');

const stem = 'f11910bb/werka_paddon_api_test';
const filename = path.resolve(__dirname, '../src/werka/werkaPaddonApi.ts');
function load(file, replay, cache = new Map()) {
  const resolved = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(resolved)) return cache.get(resolved);
  const module = new Module(resolved); module.filename = resolved; module.paths = require.main.paths;
  cache.set(resolved, module.exports);
  module.require = name => {
    if (name === './werkaMutationScope') return { werkaMutationScope: () => ({ beforeSend() {}, afterResponse() {} }) };
    if (name.endsWith('/authorizedFetch') || name === './authorizedFetch') return { authorizedFetch: (session, url, init = {}) => {
      const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${session.token}`);
      return replay(new URL(url, session.baseUrl), { ...init, headers });
    } };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved), name), replay, cache);
    return require(name);
  };
  module._compile(ts.transpileModule(fs.readFileSync(resolved, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, resolved);
  cache.set(resolved, module.exports); return module.exports;
}
function setup(name) {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  return { replay, session, api: load(filename, replay) };
}
const paddon = { paddon: { id: 'p1', code: '00001', total_gross_kg: 12, total_net_kg: 11.25 },
  items: [{ batch_id: 'b1', apparatus: 'apparatus:default:asset-010' }],
  snapshot_token: 'snapshot-v1', can_receive: true, warehouses: ['WH-1'] };

test('Werka preview and receive use authenticated pallet contract', async () => {
  const { replay, session, api } = setup('Werka preview and receive use authenticated pallet contract');
  const preview = await api.werkaPaddonPreview(session, ' 00001 ');
  assert.equal(preview.snapshot.items[0].batch_id, 'b1');
  assert.equal(preview.snapshot.paddon.total_gross_kg, 12); assert.equal(preview.snapshot.paddon.total_net_kg, 11.25);
  assert.equal((await api.werkaReceivePaddon(session, preview, 'WH-1')).warehouse, 'WH-1');
  replay.assertDone();
});
test('received batch supports warehouse processor without relaxing apparatus IDs', () => {
  const { api } = setup('Werka preview and receive use authenticated pallet contract');
  const data = structuredClone(paddon); data.items[0].processed_by_apparatus = 'warehouse:WH-1'; data.can_receive = false;
  const preview = api.werkaPaddonPreviewFromJson(data);
  assert.equal(preview.snapshot.items[0].processed_by_apparatus, 'warehouse:WH-1'); assert.equal(preview.canReceive, false);
  for (const bad of ['Rezka', 'warehouse:', '']) {
    const invalid = structuredClone(paddon); invalid.items[0].apparatus = bad;
    assert.throws(() => api.werkaPaddonPreviewFromJson(invalid), error => error.code === 'apparatus_id_invalid');
  }
});
test('receipt conflict is surfaced to refresh, not retried automatically', async () => {
  const { replay, session, api } = setup('receipt conflict is surfaced to refresh, not retried automatically');
  await assert.rejects(api.werkaReceivePaddon(session, api.werkaPaddonPreviewFromJson(paddon), 'WH-1'),
    error => error.code === 'paddon_receipt_conflict');
  replay.assertDone();
});
test('universal preview never guesses type from code and rejects unknown kind', async () => {
  const { replay, session, api } = setup('universal preview never guesses type from code and rejects unknown kind');
  for (const code of ['00001', 'WIP-v2:batch/01', 'https://example.invalid/W/QR']) {
    await assert.rejects(api.werkaQrPreview(session, code), error => error.code === 'qr_preview_invalid');
  }
  replay.assertDone();
});
test('single WIP stale token returns conflict without automatic POST retry', async () => {
  const { replay, session, api } = setup('single WIP stale token returns conflict without automatic POST retry');
  const preview = api.werkaWipPreviewFromJson({ batch: { batch_id: 'b1', apparatus: 'apparatus:default:asset-010',
    qr_payload: 'QR-b1' }, snapshot_token: 'before', can_receive: true, warehouses: ['WH-1'] });
  await assert.rejects(api.werkaReceiveWip(session, preview, 'WH-1'), error => error.code === 'wip_receipt_conflict');
  replay.assertDone();
});
