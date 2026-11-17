const assert = require('node:assert/strict');
const test = require('node:test');
const { loader, clock } = require('./support/workerQueueTransport.cjs');
const record = require('./contracts/f11910bb/order_scan_bootstrap_api_test.json').records.find(row => row.test === 'bootstrap decodes context and QR proof in one authorized request');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup() {
  let current = true, demo = false, read = async () => stored;
  const session = { token: 'token', baseUrl: 'https://example.test', profile: { role: 'material_taminotchi', ref: 'one' } };
  const writes = [], removed = [];
  const snapshots = { generation: 0, read: (...args) => read(...args),
    writeEncoded: async (scope, key, encoded, generation) => { writes.push({ scope, key, value: JSON.parse(encoded), generation }); },
    remove: async (scope, key) => { removed.push({ scope, key }); } };
  const load = loader({ '../auth': { activeSessionToken: s => s.token }, '../appPreferences': { appPreferences: { getItem: async () => 'false' } },
    '../shared/productionSnapshotRuntime': { productionSnapshotStore: snapshots } });
  const api = load('material/materialSequenceApi'), cacheApi = load('material/materialSequenceCache');
  const wire = JSON.parse(record.responseBody.text).queue_context;
  Object.assign(wire, { completed_orders: [], completion_requests: [], completion_request_decisions: [] });
  const snapshot = api.decodeMaterialSequenceSnapshot(wire, session, true);
  snapshot.materialSequenceLiveExtras = true;
  const apparatus = load('apparatusApi').apparatusFromJson(require('./contracts/f11910bb/material_supply_tasks.json').windows.material.input.apparatus[0]);
  let stored;
  const cache = new cacheApi.MaterialSequenceCache(session, () => current,
    { snapshots, demoMode: async () => demo });
  return { cache, cacheApi, snapshot, apparatus, session, writes, removed, snapshots,
    store: value => { stored = value; }, read: fn => { read = fn; }, retire: () => { current = false; }, demo: value => { demo = value; } };
}

// Source-derived regression: admin_production_map_orders_snapshot_cache.dart.
test('Material canonical cache uses source identity, 400ms debounce and a strict live-extra round trip', async () => {
  const timers = clock();
  try {
    const h = setup(), pending = h.cache.save(h.snapshot, [h.apparatus]);
    timers.advance(399); await flush(); assert.equal(h.writes.length, 0);
    timers.advance(1); await pending; assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].key, JSON.stringify(['canonical-queue-v1', false, true, true]));
    h.store(h.writes[0].value); const restored = await h.cache.load();
    assert.equal(restored.snapshot.epoch, h.snapshot.epoch); assert.equal(restored.snapshot.revision, h.snapshot.revision);
    assert.equal(restored.apparatus[0].id, h.apparatus.id);
    assert.equal(restored.snapshot.materialSequenceLiveExtras, true);
  } finally { timers.restore(); }
});

test('bad cache is removed; demo mode, missing live extras and unreconciled moves never write', async () => {
  const h = setup(); h.store({ schema: 1, snapshot: {}, apparatus: [] });
  assert.equal(await h.cache.load(), null); await flush(); assert.equal(h.removed.length, 1);
  h.snapshot.materialSequenceLiveExtras = false; await h.cache.save(h.snapshot, [h.apparatus]);
  h.snapshot.materialSequenceLiveExtras = true; h.snapshot.materialSequenceUnreconciled = true; await h.cache.save(h.snapshot, [h.apparatus]);
  assert.equal(h.writes.length, 0);
  h.demo(true); assert.equal(await h.cache.load(), null);
});

test('500ms restore timeout and account/store retirement reject late cache reads and pending saves', async () => {
  const timers = clock();
  try {
    const h = setup(); let resolve;
    h.read(() => new Promise(done => { resolve = done; }));
    const restore = h.cache.load(); await flush(); timers.advance(500); assert.equal(await restore, null);
    resolve({ schema: 99 }); await flush(); assert.equal(h.removed.length, 0);
    const pending = h.cache.save(h.snapshot, [h.apparatus]); h.snapshots.generation++;
    await h.cache.flush(); await pending; assert.equal(h.writes.length, 0);
    const other = setup(), next = other.cache.save(other.snapshot, [other.apparatus]); other.retire();
    await other.cache.flush(); await next; assert.equal(other.writes.length, 0);
  } finally { timers.restore(); }
});

test('restored Material sequence starts cursor recovery without an eager HTTP queue read', async () => {
  const h = setup(), load = loader({ '../shared/localization': { productionText: key => key } }),
    { MaterialSequenceController } = load('material/materialSequenceController');
  let reads = 0, catalog = 0, listener, saved = 0;
  const controller = new MaterialSequenceController({ current: () => true,
    load: async () => { reads++; throw Error('queue should wait for a gap'); },
    loadApparatus: async () => { catalog++; return [h.apparatus]; },
    selection: { loadSavedApparatusId: async () => null, resolveApparatus: rows => rows[0] ?? null },
    cache: { load: async () => ({ snapshot: h.snapshot, apparatus: [h.apparatus] }), save: async () => { saved++; }, clear: async () => {}, flush: async () => {} },
    live: (_get, apply, recover, error, validated) => { listener = { apply, recover, error, validated }; return () => {}; } });
  await controller.start(); await flush(); assert.equal(reads, 0); assert.equal(catalog, 1); assert.equal(saved, 0);
  listener.validated(); assert.equal(saved, 1); listener.recover(); await flush(); assert.equal(reads, 1);
  controller.dispose();
});
