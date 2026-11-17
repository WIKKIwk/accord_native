const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(name, mocks = {}) {
  const file = path.resolve(__dirname, `../src/${name}.ts`), mod = new Module(file, module);
  mod.filename = file; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  return mod.exports;
}
const model = compile('material/materialSequenceModel', { '../shared/dartApparatus': { dartTrim: value => value.trim() },
  '../shared/localization': { productionText: key => key } });
const authError = error => ['unauthorized', 'forbidden', 'production_map_snapshot_contract_invalid'].includes(error?.code) || [401,403].includes(error?.statusCode);
const { MaterialSequenceController } = compile('material/materialSequenceController', { './materialSequenceModel': model,
  '../workerQueueReadError': { workerQueueReadAuthorizationError: authError } });
const apparatus = { id: 'apparatus:line:cut', name: 'Rezka', operation: 'cut' };
const node = (id, extra = {}) => ({ id, kind: 'apparatus', apparatus_id: apparatus.id, alternative_group_id: '', alternative_assigned_apparatus_id: '', title: '', ...extra });
function order(id, extra = {}) { return { map: { id, code: id.slice(6), order_number: '', title: id, product_code: '', customer_name: '',
  nodes: [{ id: 'start', kind: 'start' }, node('work')], edges: [{ from: 'start', to: 'work', branch: '' }], ...extra } }; }
function snapshot(extra = {}) {
  return { epoch: 'epoch', revision: 1, maps: [order('zakaz-new'), order('zakaz-middle'), order('zakaz-old')],
    visible_order_ids: { [apparatus.id]: ['zakaz-new', 'zakaz-middle', 'zakaz-old'] },
    sequences: { [apparatus.id]: ['zakaz-middle'] }, queue_states: {}, queue_policies: {}, stage_states: {},
    queue_action_controls: {}, order_statuses: {}, order_customers: {}, ...extra };
}

test('f119 Material sequence keeps explicit strict order then appends new entries oldest-first; free queue retains shared order', () => {
  const data = snapshot();
  assert.deepEqual(model.materialSequenceOrders(data, apparatus).map(row => row.map.id), ['zakaz-middle', 'zakaz-old', 'zakaz-new']);
  data.queue_policies[apparatus.id] = { policy: 'free_pick' };
  assert.deepEqual(model.materialSequenceOrders(data, apparatus).map(row => row.map.id), ['zakaz-new', 'zakaz-middle', 'zakaz-old']);
  assert.deepEqual(model.materialSequenceOrders(data, null), []);
});

test('supply sequence preserves frozen rows and removes completed lifecycle/occurrences while repeated apparatus work stays visible', () => {
  const repeated = order('zakaz-repeat', { nodes: [{ id: 'start', kind: 'start' }, node('first'), node('later')],
    edges: [{ from: 'start', to: 'first', branch: '' }, { from: 'first', to: 'later', branch: '' }] });
  const data = snapshot({ maps: [order('zakaz-frozen'), order('zakaz-closed'), repeated, order('zakaz-done')],
    visible_order_ids: { [apparatus.id]: ['zakaz-frozen', 'zakaz-closed', 'zakaz-repeat', 'zakaz-done'] },
    queue_states: { [apparatus.id]: { 'zakaz-frozen': 'frozen', 'zakaz-repeat': 'completed' } },
    stage_states: { 'zakaz-repeat': { first: 'completed', later: 'pending' }, 'zakaz-done': { work: 'completed' } },
    order_statuses: { 'zakaz-closed': { lifecycle_status: 'closed' } } });
  assert.deepEqual(model.materialSequenceOrders(data, apparatus).map(row => row.map.id), ['zakaz-repeat', 'zakaz-frozen']);
});

test('print alternatives require explicit whole-group assignment; non-print candidate visibility remains cooperative', () => {
  const printing = { ...apparatus, operation: 'print' }, saved = order('zakaz-1', { nodes: [node('one', { alternative_group_id: 'p' }),
    node('two', { alternative_group_id: 'p', apparatus_id: 'apparatus:line:other' })] });
  assert.equal(model.materialSequencePrintAllows(saved, printing), false);
  assert.equal(model.materialSequencePrintAllows(saved, apparatus), true);
  saved.map.nodes.forEach(row => { row.alternative_assigned_apparatus_id = apparatus.id; });
  assert.equal(model.materialSequencePrintAllows(saved, printing), true);
});

test('source search includes node text and canonical customer without renumbering the unfiltered sequence', () => {
  const data = snapshot(); data.order_customers['zakaz-new'] = 'Customer'; data.maps[2].map.nodes[1].title = 'Laminatsiya';
  assert.deepEqual(model.materialSequenceOrders(data, apparatus, 'customer').map(row => row.map.id), ['zakaz-new']);
  assert.deepEqual(model.materialSequenceOrders(data, apparatus, 'LAMINATSIYA').map(row => row.map.id), ['zakaz-old']);
  assert.equal(model.materialSequenceOrders(data, apparatus).indexOf(data.maps[0]) + 1, 3);
});

function harness(load) {
  let current = true, listener, stopped = 0;
  const selected = { resolveApparatus: (list, id) => list.find(row => row.id === id) ?? null,
    loadSavedApparatusId: async () => null, saveApparatus: async () => {} };
  const controller = new MaterialSequenceController({ current: () => current, load, selection: selected,
    live: (_get, apply, recover, error) => { listener = { apply, recover, error }; return () => { stopped++; }; } });
  return { controller, live: () => listener, stopCount: () => stopped, expire: () => { current = false; controller.invalidate(); } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
test('snapshot/catalog publish atomically; an account transition retires a still pending request', async () => {
  const load = deferred(), h = harness(() => load.promise), pending = h.controller.start();
  assert.equal(h.controller.getSnapshot().snapshot, null); h.expire();
  load.resolve({ snapshot: snapshot(), apparatus: [apparatus] }); await pending;
  assert.equal(h.controller.getSnapshot().snapshot, null); assert.deepEqual(h.controller.getSnapshot().apparatus, []);
  assert.equal(h.live(), undefined);
});

test('live revision and retired epochs prevent stale snapshots replacing the latest Material sequence', async () => {
  const h = harness(async () => ({ snapshot: snapshot(), apparatus: [apparatus] })); await h.controller.start();
  h.live().apply(snapshot({ revision: 4 })); h.live().apply(snapshot({ revision: 2 }));
  assert.equal(h.controller.getSnapshot().snapshot.revision, 4);
  h.live().apply(snapshot({ epoch: 'new-epoch', revision: 1 })); h.live().apply(snapshot({ revision: 99 }));
  assert.equal(h.controller.getSnapshot().snapshot.epoch, 'new-epoch');
  h.controller.setForeground(false); assert.equal(h.stopCount(), 1); h.expire();
});

test('concurrent refreshes coalesce while retaining the last usable snapshot during failure', async () => {
  let calls = 0; const later = deferred();
  const h = harness(async () => { calls++; if (calls === 1) return { snapshot: snapshot(), apparatus: [apparatus] };
    if (calls === 2) return later.promise; throw Error('offline'); });
  await h.controller.start(); const original = h.controller.getSnapshot().snapshot;
  const first = h.controller.refresh(), second = h.controller.refresh(); assert.equal(first, second);
  later.resolve({ snapshot: snapshot({ revision: 2 }), apparatus: [apparatus] }); await first;
  assert.equal(calls, 3); assert.equal(h.controller.getSnapshot().snapshot.revision, 2);
  assert.notEqual(h.controller.getSnapshot().snapshot, original); assert.equal(h.controller.getSnapshot().error, 'offline');
  h.expire();
});

const fingerprinter = compile('workerDelta', { './workerSnapshot': {} });
const live = compile('material/materialSequenceLive', { '../auth': {}, '../productionMapLiveStream': {},
  '../workerLegacyState': { applyWorkerLegacyDelta: (_before, event) => event }, '../workerDelta': fingerprinter,
  '../workerLiveUri': {}, '../workerLiveTransport': {}, '../workerQueueReadError': {}, './materialSequenceApi': {}, './materialSequenceReplay': {} });
test('global v2 compressed list edits preserve source hashes/order and normalize into shared canonical merger', () => {
  const before = { maps: [{ map: { id: 'a' } }, { map: { id: 'b' } }], sequences: { x: ['a', 'b'] } };
  const edit = { base_len: 2, base_hash: fingerprinter.sequenceFingerprint(['a', 'b']), len: 3,
    hash: fingerprinter.sequenceFingerprint(['b', 'c', 'a']), ops: [[0, 1, 1], [1, ['c']], [0, 0, 1]] };
  const event = { protocol: 'state_delta_v2', patch: { map_order_edit: edit, sequences: { upsert: {}, remove: [], edit: { x: edit } } } };
  const merged = live.materialSequenceDelta(before, event, {});
  assert.equal(merged.protocol, 'state_delta_v1'); assert.deepEqual(merged.patch.map_order, ['b', 'c', 'a']);
  assert.deepEqual(merged.patch.sequences, { upsert: { x: ['b', 'c', 'a'] }, remove: [] });
  assert.ok(event.patch.map_order_edit); assert.deepEqual(before.sequences.x, ['a', 'b']);
  assert.equal(live.materialSequenceDelta(before, { ...event, patch: { map_order_edit: { ...edit, hash: 'wrong' } } }, {}), null);
});

test('assignment order picker keeps source search matching and 50-row local paging', () => {
  const search = compile('shared/searchNormalizer'), picker = compile('material/materialAssignmentPicker', { '../shared/searchNormalizer': search });
  const values = Array.from({ length: 61 }, (_, index) => order(`zakaz-${index}`, { title: index === 60 ? 'Qog’oz' : 'Plyonka' }));
  const label = value => `${value.map.code} · ${value.map.title}`;
  assert.equal(picker.materialAssignmentPickerRows(values, '', label, 50).items.length, 50);
  assert.equal(picker.materialAssignmentPickerRows(values, '', label, 50).hasMore, true);
  assert.deepEqual(picker.materialAssignmentPickerRows(values, 'qogoz', label, 50).items.map(value => value.map.id), ['zakaz-60']);
});

test('source row tones keep issue/freeze precedence and bind passed preflight to its exact order/apparatus', () => {
  const row = order('zakaz-new'), data = snapshot({ queue_states: { [apparatus.id]: { 'zakaz-new': 'print_preflight' } },
    queue_action_controls: { [apparatus.id]: { 'zakaz-new': { state: 'print_preflight', print_preflight: {
      status: 'passed', order_id: 'other', apparatus: apparatus.id } } } } });
  assert.equal(model.materialSequenceTone(row, data, apparatus), 'print_preflight');
  data.queue_action_controls[apparatus.id]['zakaz-new'].print_preflight.order_id = 'zakaz-new';
  assert.equal(model.materialSequenceTone(row, data, apparatus), 'print_preflight_passed');
  data.order_controls = { 'zakaz-new': 'freeze_requested' };
  assert.equal(model.materialSequenceTone(row, data, apparatus), 'frozen');
  data.order_statuses['zakaz-new'] = { completed_with_issue_count: 1 };
  assert.equal(model.materialSequenceTone(row, data, apparatus), 'issue');
});

const replay = compile('material/materialSequenceReplay', { '../authorizedFetch': {}, '../productionMapDelta': {}, '../workerControlsApi': {} });
test('legacy sequence moves require exact revision/version and adjacent anchors, preserve the global snapshot cursor', () => {
  const event = { base_revision: 4, revision: 5, base_version: 'a'.repeat(64), version: 'b'.repeat(64),
    ops: [{ type: 'move', id: 'c', before_id: 'b', after_id: 'a' }] };
  assert.deepEqual(replay.materialSequenceAfterMove(['a','b','c'], 4, 'a'.repeat(64), event), ['a','c','b']);
  assert.equal(replay.materialSequenceAfterMove(['a','b','c'], 3, 'a'.repeat(64), event), null);
  assert.equal(replay.materialSequenceAfterMove(['a','b','c'], 4, 'c'.repeat(64), event), null);
  assert.equal(replay.materialSequenceAfterMove(['a','x','b','c'], 4, 'a'.repeat(64), event), null);
});

test('sequence API publishes exact global snapshot/catalog read and confines legacy fallback to unversioned empty snapshots', async () => {
  const calls = []; let value = { maps: [], epoch: 'epoch' };
  const api = compile('material/materialSequenceApi', {
    '../authorizedFetch': { authorizedFetch: async (_session, route, _options, guard) => { guard(); calls.push(route); return { status: 200, json: async () => route.endsWith('/sequence') ? value : [{ map: { id: 'zakaz-legacy' } }] }; } },
    '../apparatusApi': { adminApparatus: async (_session, options) => { options.beforeSend(); calls.push(['catalog', options.limit]); return [apparatus]; } },
    '../productionMapSnapshot': { decodeCanonicalProductionMapSnapshot: wire => ({ ...wire }) },
    '../workerControlsApi': {}, '../workerProductionMapSaved': { productionMapSavedFromJson: value => value },
  });
  const initial = await api.readMaterialSequence({}, () => true);
  // _readOrdersApparatus uses 200, independently of the assignment/history catalogs.
  assert.deepEqual(calls, ['/v1/mobile/admin/production-maps/sequence', ['catalog',200]]); assert.deepEqual(initial.apparatus, [apparatus]);
  calls.length = 0; value = { maps: [], epoch: '' };
  const legacy = await api.readMaterialSequence({}, () => true);
  assert.equal(calls.at(-1), '/v1/mobile/admin/production-maps'); assert.equal(legacy.snapshot.maps[0].map.id, 'zakaz-legacy');
  await assert.rejects(api.readMaterialSequence({}, () => false), /Akkaunt/);
});

test('native sequence stream negotiates compact fallback, validates exact cursor and retires old socket callbacks', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sockets = [], queries = [], applied = [], errors = []; let valid = true, validated = 0, recovered = 0;
  const data = { epoch: 'e', revision: 3, scope: 's' };
  const runtime = compile('material/materialSequenceLive', { '../auth': { activeSessionToken: () => 'token' },
    '../productionMapLiveStream': { decodeProductionMapLiveMessage: event => event }, '../workerLegacyState': {}, '../workerDelta': fingerprinter,
    '../workerLiveUri': { adminProductionMapLiveUri: (_base, _token, options) => { queries.push(options); return new URL('wss://host/live'); } },
    '../workerLiveTransport': { openWorkerLiveSocket: () => { const socket = { closed: 0, close() { this.closed++; } }; sockets.push(socket); return socket; } },
    '../workerQueueReadError': { workerQueueReadAuthorizationError: authError }, './materialSequenceReplay': {},
    './materialSequenceApi': { materialSequenceWire: value => value, decodeMaterialSequenceSnapshot: value => value } });
  const stop = runtime.subscribeMaterialSequence({ baseUrl: 'https://host' }, () => valid, () => data, value => applied.push(value),
    () => recovered++, error => errors.push(error), () => validated++);
  assert.equal(queries[0].workerScope, false); assert.equal(queries[0].compactStateDelta, true);
  const stale = sockets[0].onmessage;
  stale({ data: JSON.stringify({ ok: true, protocol: 'state_delta_v1', type: 'state_ready' }) });
  assert.equal(sockets[0].closed, 1); assert.equal(queries[1].compactStateDelta, false);
  sockets[1].onmessage({ data: JSON.stringify({ ok: true, type: 'state_ready', recovery_supported: true, epoch:'e', revision:3, scope:'s' }) });
  assert.equal(validated, 1); assert.equal(recovered, 0);
  stale({ data: JSON.stringify({ ok:true, maps: [] }) }); assert.equal(applied.length, 0);
  valid = false; sockets[1].onmessage({ data: JSON.stringify({ ok:true, maps: [] }) }); assert.equal(applied.length, 0);
  stop(); t.mock.timers.tick(60_000); assert.equal(sockets.length, 2); assert.equal(errors.length, 0);
});

test('cached sequence requires canonical continuity before save; failed authorization discards its visible baseline', async () => {
  let validate, nextError, saved = 0, cleared = 0;
  const cacheValue = { snapshot: snapshot({ materialSequenceLiveExtras: true }), apparatus: [apparatus] };
  const controller = new MaterialSequenceController({ current: () => true,
    load: async () => { throw nextError ?? Error('offline'); }, selection: { loadSavedApparatusId: async () => null, resolveApparatus: values => values[0], saveApparatus: async () => {} },
    cache: { load: async () => cacheValue, save: async () => { saved++; }, clear: async () => { cleared++; }, flush: async () => {} },
    live: (_get, _apply, _recover, _error, verified) => { validate = verified; return () => {}; } });
  await controller.start(); assert.equal(controller.getSnapshot().snapshot, cacheValue.snapshot); assert.equal(saved, 0);
  validate(); assert.equal(saved, 1);
  controller.dispose();
  const fresh = new MaterialSequenceController({ current: () => true, load: async () => { throw Object.assign(Error('forbidden'), { code:'forbidden' }); },
    selection: { loadSavedApparatusId: async () => null, resolveApparatus: values => values[0], saveApparatus: async () => {} },
    cache: { load: async () => cacheValue, save: async () => {}, clear: async () => { cleared++; }, flush: async () => {} }, live: () => () => {} });
  await fresh.start(); await fresh.refresh(); assert.equal(fresh.getSnapshot().snapshot, null); assert.equal(cleared, 1); fresh.dispose();
});
