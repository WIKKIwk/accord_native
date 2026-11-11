const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { contractFetch, loadContract, recordedSession } = require('./support/contractFetch.cjs');

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, '../src', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    if (filename.endsWith('.json')) return require(filename);
    const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; cache.set(filename, mod);
    mod.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), id);
        const found = [target, target + '.ts', target + '.tsx', target + '/index.ts'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (found) return load(path.relative(path.resolve(__dirname, '../src'), found));
      }
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
  }
  return load;
}
const noNetwork = { './authorizedFetch': { authorizedFetch() { throw new Error('Unexpected network call'); } } };
const load = loader(noNetwork), apiModel = load('workerMaterialLinkApi.ts');
const { MaterialLinkRequestState, WorkerMaterialUseState } = load('workerMaterialState.ts');
const { WorkerOrderAlertState } = load('workerOrderAlert.ts');
const { workerCompletionMode } = load('workerCompletion.ts');
const progress = load('workerOutputProgress.ts'), presentation = load('workerMaterialPresentation.ts');
const defer = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const materialName = loadContract('worker_material_use_panel_test').find(row => row.test.startsWith('precomputed material scan: confirm') && row.method === 'GET').test;
const materialJson = JSON.parse(loadContract('worker_material_use_panel_test').find(row => row.test === materialName && row.method === 'GET').responseBody.text);
const eligible = apiModel.workerMaterialCandidatesFromJson(materialJson);
const empty = () => ({ enabled: true, candidates: [] });
function materialApiReplay(stem, name) {
  const replay = contractFetch(stem, name), session = recordedSession(stem, name);
  const api = loader({ './authorizedFetch': { authorizedFetch: (s, url, init) => replay(new URL(url, s.baseUrl), {
    ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` },
  }) } })('workerMaterialLinkApi.ts');
  return { api, replay, session };
}

function useHarness(options = {}) {
  let current = true, snapshot = eligible, uses = 0, changes = 0;
  const used = [];
  const state = new WorkerMaterialUseState({ current: () => current, changed: () => changes++, read: async () => snapshot,
    use: async material => { uses++; snapshot = empty(); }, confirm: async () => true, text: key => key,
    used: barcode => used.push(barcode), ...options });
  return { state, used, setCurrent: value => { current = value; }, setSnapshot: value => { snapshot = value; }, get uses() { return uses; }, get changes() { return changes; } };
}

// @v2-test test/worker_material_use_panel_test.dart
for (const scenario of ['confirm', 'cancel', 'wrong', 'changed']) test(`precomputed material scan: ${scenario}`, async () => {
  const used = [], calls = [];
  const h = useHarness({ confirm: async () => scenario !== 'cancel', used: value => used.push(value),
    use: async material => { calls.push(material); if (scenario === 'changed') throw new Error('raw_material_stock_unavailable'); h.setSnapshot(empty()); } });
  await h.state.refresh(); await h.state.toggleScanner(); await h.state.scan(scenario === 'wrong' ? 'OTHER' : 'https://example.invalid/stock?barcode=R1');
  assert.equal(calls.length, ['confirm', 'changed'].includes(scenario) ? 1 : 0);
  assert.deepEqual(used, scenario === 'confirm' ? ['R1'] : []);
  if (calls.length) assert.equal(calls[0].placementVersion, 7);
  if (scenario === 'changed') assert.equal(h.state.feedbackText, 'raw_material_stock_unavailable');
  if (scenario === 'confirm') assert.equal(h.state.candidates.length, 0);
});
test('material permission and failed refresh remove stale candidates', async () => {
  let fail = false;
  const h = useHarness({ read: async () => { if (fail) throw new Error('offline'); return { enabled: false, candidates: eligible.candidates }; } });
  await h.state.refresh(); assert.equal(h.state.candidates.length, 0);
  await h.state.toggleScanner(); assert.equal(h.state.scannerOpen, false);
  const second = useHarness({ read: async () => { if (fail) throw new Error('offline'); return eligible; } });
  await second.state.refresh(); fail = true; await second.state.toggleScanner();
  assert.equal(second.state.candidates.length, 0); assert.equal(second.state.scannerOpen, false);
});
test('account change while material confirmation is open cannot send old material', async () => {
  const confirm = defer(), h = useHarness({ confirm: () => confirm.promise });
  await h.state.toggleScanner(); const scan = h.state.scan('R1');
  assert.equal(h.state.confirming, true); h.setCurrent(false); confirm.resolve(true); await scan;
  assert.equal(h.uses, 0); assert.deepEqual(h.used, []);
});
test('late material read cannot restore a consumed candidate', async () => {
  const old = defer(); let reads = 0;
  const h = useHarness({ read: async () => ++reads === 3 ? old.promise : reads > 3 ? empty() : eligible });
  await h.state.toggleScanner(); await h.state.refresh(); const stale = h.state.refresh();
  await h.state.scan('R1'); assert.equal(h.uses, 1); assert.equal(h.state.candidates.length, 0);
  old.resolve(eligible); await stale; assert.equal(h.state.candidates.length, 0);
});
for (const scenario of ['confirm', 'cancel', 'wrong', 'changed']) test(`real material API and state replay V2 scan ${scenario}`, async () => {
  const name = loadContract('worker_material_use_panel_test').find(row => row.test.startsWith(`precomputed material scan: ${scenario}`)).test;
  const { api, replay, session } = materialApiReplay('worker_material_use_panel_test', name), used = [];
  const state = new WorkerMaterialUseState({ current: () => true, changed() {}, text: key => key,
    read: () => api.workerMaterialCandidates(session, 'zakaz-1', 'apparatus:test:print'),
    use: material => api.useWorkerMaterial(session, 'zakaz-1', 'apparatus:test:print', material),
    confirm: async () => scenario !== 'cancel', used: barcode => used.push(barcode) });
  await state.refresh(); await state.toggleScanner(); await state.scan(scenario === 'wrong' ? 'OTHER' : 'R1');
  replay.assertDone(); assert.deepEqual(used, scenario === 'confirm' ? ['R1'] : []);
  if (scenario === 'changed') assert.equal(state.feedback, 'rejected');
});
test('retired control while confirming prevents material mutation', async () => {
  let enabled = true; const confirmation = defer(), h = useHarness({ enabled: () => enabled, confirm: () => confirmation.promise });
  await h.state.toggleScanner(); const scan = h.state.scan('R1'); enabled = false; confirmation.resolve(true); await scan;
  assert.equal(h.uses, 0); assert.equal(h.state.confirming, false);
});
test('worker machine projection retains the direct material assignment permission', () => {
  const { workerMachinesFromSnapshot } = loader({ ...noNetwork, './workerQueueLimit': { DEFAULT_QUEUE_LIMIT: 10 },
    './workerSnapshot': {}, './workerDetailApi': {}, './apparatusApi': {} })('workerApi.ts');
  const machines = workerMachinesFromSnapshot([
    { id: 'apparatus:test:print', name: 'Bosma', operation: 'print', worker_material_assignment_allowed: true },
    { id: 'apparatus:test:film', name: 'Laminatsiya', operation: 'laminate', worker_material_assignment_allowed: false },
  ], { worker_show_all_apparatus_tabs: true }, []);
  assert.equal(machines[0].worker_material_assignment_allowed, true); assert.equal(machines[1].worker_material_assignment_allowed === true, false);
});

const requestJson = JSON.parse(loadContract('material_link_request_test').find(row => row.test === 'approval sends only explicit selected barcode and bearer token').responseBody.text).request;
const request = apiModel.materialLinkRequestFromJson(requestJson), rolls = request.rolls;
const overview = (status = 'pending') => ({ availableCount: 3, candidates: rolls, requests: [{ ...request, status }] });
function linkHarness(options = {}) {
  let current = true, allow = true, snapshot = overview(), creates = 0, linked = 0;
  const state = new MaterialLinkRequestState({ current: () => current, changed() {}, allowNew: () => allow,
    read: async () => snapshot, create: async () => { creates++; snapshot = overview(); }, cancel: async () => { snapshot = overview('cancelled'); },
    pick: async () => ['R2'], linked: () => linked++, ...options });
  return { state, setCurrent: value => { current = value; }, allow: value => { allow = value; }, snapshot: value => { snapshot = value; },
    get creates() { return creates; }, get linked() { return linked; } };
}
// @v2-test test/material_link_request_test.dart
test('request parsing retains display names, selected rolls, revision and expiry', () => {
  assert.equal(request.requesterName, 'Worker'); assert.equal(request.moverName, 'Mover'); assert.ok(request.expiresAt > 0);
  assert.equal(request.revision, 2); assert.deepEqual(request.selectedBarcodes, ['R2']); assert.equal(rolls.length, 3);
});
test('satisfied assignments retain pending tracking and allow cancellation', async () => {
  const h = linkHarness(); h.allow(false); await h.state.refresh(); assert.equal(h.state.hasPending, true);
  await h.state.send(); assert.equal(h.creates, 0);
  await h.state.cancel(h.state.latest[0]); assert.equal(h.state.hasPending, false);
});
for (const phase of ['preflight', 'picker']) test(`assignments satisfied during ${phase} prevent a new request`, async () => {
  const wait = defer(); let calls = 0;
  const h = linkHarness({ read: async () => phase === 'preflight' ? wait.promise : { ...overview(), requests: [] },
    pick: () => wait.promise, create: async () => { calls++; } });
  const sending = h.state.send(); await Promise.resolve(); h.allow(false);
  wait.resolve(phase === 'preflight' ? { ...overview(), requests: [] } : ['R2']); await sending; assert.equal(calls, 0);
});
test('account change while roll picker is open cannot create a request', async () => {
  const picker = defer(); let posts = 0;
  const h = linkHarness({ read: async () => ({ ...overview(), requests: [] }), pick: () => picker.promise, create: async () => { posts++; } });
  const sending = h.state.send(); await Promise.resolve(); h.setCurrent(false); picker.resolve(['R2']); await sending; assert.equal(posts, 0);
});
test('late live refresh cannot overwrite post-mutation verification', async () => {
  const old = defer(); let reads = 0;
  const h = linkHarness({ read: async () => ++reads === 1 ? old.promise : reads === 2 ? { ...overview(), requests: [] } : overview() });
  const late = h.state.refresh(); await h.state.send(); assert.equal(h.state.hasPending, true);
  old.resolve({ availableCount: 0, candidates: [], requests: [] }); await late; assert.equal(h.state.hasPending, true);
});
test('ambiguous create verifies committed requests and prevents a duplicate', async () => {
  let posted = false, posts = 0;
  const h = linkHarness({ read: async () => posted ? overview() : { ...overview(), requests: [] },
    create: async () => { posts++; posted = true; throw new Error('response lost'); } });
  await h.state.send(); assert.equal(h.state.hasPending, true); await h.state.send(); assert.equal(posts, 1);
});
test('focus and live notifications while picking cannot replace post-create verification', async () => {
  const pick = defer(); let reads = 0, posted = false;
  const h = linkHarness({ read: async () => { reads++; return posted ? overview() : { ...overview(), requests: [] }; },
    pick: () => pick.promise, create: async () => { posted = true; } });
  const sending = h.state.send(); await Promise.resolve(); h.state.notify(); h.state.notify();
  assert.equal(reads, 1); pick.resolve(['R2']); await sending;
  assert.equal(reads, 2); assert.equal(h.state.hasPending, true);
});
test('retired control prevents new linking and cancellation while keeping tracking readable', async () => {
  let enabled = true, cancels = 0; const pick = defer();
  const h = linkHarness({ enabled: () => enabled, read: async () => ({ ...overview(), requests: [] }), pick: () => pick.promise,
    cancel: async () => { cancels++; } });
  const sending = h.state.send(); await Promise.resolve(); enabled = false; pick.resolve(['R2']); await sending;
  await h.state.cancel(request); assert.equal(h.creates, 0); assert.equal(cancels, 0);
  await h.state.refresh(); assert.ok(h.state.overview);
});
for (const status of ['approved', 'stale', 'cancelled', 'expired']) test(`${status} leaves pending; material refresh fires only for approved/stale and once per ID`, async () => {
  const h = linkHarness(); await h.state.refresh(); h.snapshot(overview(status)); await h.state.refresh(); await h.state.refresh();
  assert.equal(h.state.hasPending, false); assert.equal(h.linked, ['approved', 'stale'].includes(status) ? 1 : 0);
});

test('material request API replays V2 selected-roll approval exactly', async () => {
  const name = 'approval sends only explicit selected barcode and bearer token', replay = contractFetch('material_link_request_test', name);
  const session = recordedSession('material_link_request_test', name);
  const api = loader({ './authorizedFetch': { authorizedFetch: (s, url, init) => replay(new URL(url, s.baseUrl), { ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` } }) } })('workerMaterialLinkApi.ts');
  const result = await api.decideMaterialLinkRequest(session, 'link-1', 'approve', ['R2']);
  replay.assertDone(); assert.equal(result.status, 'approved'); assert.deepEqual(result.selectedBarcodes, ['R2']);
});
test('empty request selection and approval never issue a network command', async () => {
  await assert.rejects(apiModel.createMaterialLinkRequests({}, 'order', 'apparatus:test:print', []), error => error.code === 'material_link_selection_required');
  await assert.rejects(apiModel.decideMaterialLinkRequest({}, 'request', 'approve', []), error => error.code === 'material_link_selection_required');
});
test('request create sends V2 explicit barcodes and accepts its acknowledgement without inventing an overview', async () => {
  const name = 'late live refresh cannot overwrite post-mutation verification', replay = contractFetch('material_link_request_test', name, { onlyMethods: ['POST'] });
  const session = recordedSession('material_link_request_test', name);
  const api = loader({ './authorizedFetch': { authorizedFetch: (s, url, init) => replay(new URL(url, s.baseUrl), {
    ...init, headers: { ...init.headers, Authorization: `Bearer ${s.token}` },
  }) } })('workerMaterialLinkApi.ts');
  assert.equal(await api.createMaterialLinkRequests(session, 'order-1', 'apparatus:test:film', ['R2']), undefined); replay.assertDone();
});
test('a roll linked during selection is verified after V2 rejects creation', async () => {
  const name = 'roll linked while worker picks is refreshed without pending loop';
  const { api, replay, session } = materialApiReplay('material_link_request_test', name);
  const state = new MaterialLinkRequestState({ current: () => true, changed() {}, allowNew: () => true, linked() {},
    read: () => api.materialLinkRequests(session, 'order-1', 'apparatus:test:film'),
    create: barcodes => api.createMaterialLinkRequests(session, 'order-1', 'apparatus:test:film', barcodes),
    cancel: id => api.decideMaterialLinkRequest(session, id, 'cancel'), pick: async () => ['R2'] });
  await state.refresh(); await state.send(); assert.match(state.error, /Holatni yangilang|qolmagan|o‘zgargan/);
  await state.refresh(); replay.assertDone(); assert.equal(state.hasPending, false);
});
test('hidden or background material notifications wait until the panel returns', async () => {
  let visible = false, reads = 0;
  const h = linkHarness({ canRefresh: () => visible, read: async () => { reads++; return overview(); } });
  h.state.notify(); await h.state.refresh(); assert.equal(reads, 0);
  visible = true; h.state.notify(); await h.state.refresh(); assert.equal(reads, 1);
  visible = false; h.state.notify(); assert.equal(reads, 1);
  visible = true; h.state.notify(); await h.state.refresh(); assert.equal(reads, 2);
});
test('malformed material numbers and request shapes fail instead of inventing eligible values', () => {
  assert.throws(() => apiModel.workerMaterialCandidatesFromJson({ enabled: true, candidates: [{ barcode: 'R1', placement_version: '7' }] }), TypeError);
  assert.throws(() => apiModel.materialLinkOverviewFromJson({ candidates: {} }), TypeError);
  assert.throws(() => apiModel.materialLinkRequestFromJson(null), TypeError);
  assert.deepEqual(apiModel.materialLinkOverviewFromJson({}), { availableCount: 0, candidates: [], requests: [] });
});

// @v2-test test/order_alert_button_test.dart
test('failed alert retries the same identity, disabled callbacks and concurrent taps cannot send', async () => {
  let enabled = false, posts = 0; const ids = [], first = defer();
  const state = new WorkerOrderAlertState('stable-id', async id => { posts++; ids.push(id); if (posts === 1) await first.promise; }, () => true, () => enabled, () => {});
  await state.send(); assert.equal(posts, 0); enabled = true;
  const sending = state.send(); await state.send(); assert.equal(posts, 1); assert.equal(state.sent, false);
  first.reject(new Error('offline')); await sending; assert.equal(state.sent, false); await state.send();
  assert.equal(state.sent, true); assert.deepEqual(ids, ['stable-id', 'stable-id']); await state.send(); assert.equal(posts, 2);
});
test('late alert success from another account cannot update this account', async () => {
  let current = true; const response = defer();
  const state = new WorkerOrderAlertState('old', () => response.promise, () => current, () => true, () => {});
  const sending = state.send(); current = false; response.resolve(); await sending; assert.equal(state.sent, false);
});

test('complete with issue bypasses output/paint; closing output remains a report; training never freezes real work', () => {
  const input = { action: 'complete', orderId: 'order', closingOutputId: '', safeStopRequest: null, description: '  nosozlik  ', kg: '', meter: '', bobina: '', waste: '' };
  assert.deepEqual(workerCompletionMode(input), { note: 'nosozlik', safeStopIssue: false, completionIssue: true, needsIssueOrOutput: false, needsOutput: false });
  assert.equal(workerCompletionMode({ ...input, closingOutputId: 'closed' }).completionIssue, false);
  assert.equal(workerCompletionMode({ ...input, orderId: 'training-order' }).completionIssue, false);
  assert.equal(workerCompletionMode({ ...input, description: '' }).needsOutput, true);
});
test('safe stop requires either complete output or a note, and cannot ignore partially entered metrics', () => {
  const input = { action: 'pause', orderId: 'order', closingOutputId: '', safeStopRequest: 'freeze', description: '', kg: '', meter: '', bobina: '', waste: '' };
  assert.equal(workerCompletionMode(input).needsIssueOrOutput, true);
  assert.equal(workerCompletionMode({ ...input, description: 'Jam' }).safeStopIssue, true);
  assert.equal(workerCompletionMode({ ...input, description: 'Jam', meter: '5' }).needsOutput, true);
  assert.equal(workerCompletionMode({ ...input, description: 'Jam', waste: '0' }).safeStopIssue, false);
});

const a = 'apparatus:test:print', b = 'apparatus:test:alternate';
const map = { base_length: 25601, nodes: [{ id: 'start', kind: 'start' }, { id: 'a', kind: 'apparatus', apparatus_id: a, alternative_group_id: 'g' },
  { id: 'b', kind: 'apparatus', apparatus_id: b, alternative_group_id: 'g' }, { id: 'again', kind: 'apparatus', apparatus_id: a }, { id: 'end', kind: 'end' }],
  edges: [{ from: 'start', to: 'a' }, { from: 'a', to: 'again' }, { from: 'again', to: 'end' }] };
const batch = (id, meters, extra = {}) => ({ batch_id: id, revision: 1, order_id: 'order', apparatus: a, action: 'pause', status: 'paused', wip_status: 'waiting', finished_goods_meter: meters, payload_json: { stage_node_id: 'a' }, ...extra });
// @v2-test test/admin_production_map_worker_output_progress_test_part.dart
test('progress sums latest output revisions, alternatives and unknown lengths without including another occurrence', () => {
  const totals = progress.workerStageOutputMeters(map, 'order', 'a', [batch('one', 10), batch('one', 20, { revision: 2 }),
    batch('alternate', 30, { apparatus: b, payload_json: { stage_node_id: 'b' } }), batch('missing', null),
    batch('again', 999, { payload_json: { stage_node_id: 'again' } }), batch('ambiguous', 999, { payload_json: {} }),
    batch('void', 999, { wip_status: 'void' }), batch('peremotka', 999, { wip_status: 'peremotka' }),
    batch('layer', 999, { payload_json: { stage_node_id: 'a', origin: 'layer_remainder' } }), batch('other-order', 999, { order_id: 'another' })]);
  assert.deepEqual(totals, { meters: 50, known: 2, missing: 1 }); assert.equal(progress.workerOrderPlannedMeters(map.base_length), 26000);
  assert.equal(progress.workerOutputStage(map, a, ''), ''); assert.deepEqual(progress.workerWipConsumerIds(map, a, 'a'), [a, b]);
});
test('progress preserves micro-meter precision and removes a superseded void roll', () => {
  assert.deepEqual(progress.workerStageOutputMeters(map, 'order', 'a', [batch('x', 0.1), batch('y', 0.2), batch('gone', 5), batch('gone', 5, { revision: 2, wip_status: 'void' })]), { meters: 0.3, known: 2, missing: 0 });
  for (const invalid of [0, -1, Infinity, NaN, null, '500']) assert.equal(progress.workerOrderPlannedMeters(invalid), null);
});
test('progress reader preserves every server revision until stage aggregation selects the newest', async () => {
  let output, cleanup; const queries = [];
  const hook = loader({ ...noNetwork, react: {
    useState: () => [null, value => { output = value; }], useMemo: fn => fn(), useCallback: fn => fn,
  }, 'expo-router': { useFocusEffect: fn => { cleanup = fn(); } },
  'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
  '../auth': { activeSessionToken: () => 'token' }, '../sessionReadScope': { sessionReadScope: () => 'account' },
  '../shared/productionDataRevisionRuntime': { productionDataRevision: { subscribe: () => () => {} } },
  '../workerWipApi': { adminWipBatches: async (session, query) => { queries.push(query); return query.producerApparatus === a
    ? [batch('same', 20, { revision: 2 }), batch('same', 5, { revision: 1 })] : []; } },
  './useWorkerOrderText': { useWorkerOrderText: () => ({ locale: 'uz', t: value => value, p: value => value }) },
  })('components/useWorkerOutputProgress.ts').useWorkerOutputProgress;
  try {
    hook({ session: {}, orderId: 'order', apparatusId: a, stageId: 'a', map, operation: 'print', outputRevision: 1 });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(output.meters, 20); assert.equal(output.known, 1);
    assert.deepEqual(queries.map(query => [query.status, query.orderId, query.limit, query.producerApparatus]), [['all', 'order', 500, a], ['all', 'order', 500, b]]);
  } finally { cleanup?.(); }
});
test('material balances group units case-insensitively and clamp remaining, status details retain V2 wording', () => {
  const rows = [{ stock_uom: 'KG', received_qty: 20, consumed_qty: 5 }, { stock_uom: 'kg', received_qty: 5, consumed_qty: 50 }, { stock_uom: 'm', received_qty: NaN, consumed_qty: -2 }];
  assert.deepEqual(presentation.rawMaterialBalances(rows), [{ uom: 'KG', received: 25, consumed: 55, remaining: 0 }, { uom: 'm', received: 0, consumed: 0, remaining: 0 }]);
  const item = presentation.assignedMaterialPresentation({ item_name: 'PET', item_code: 'PET / 12', item_group: 'Film', barcode: 'R1', execution_status: 'in_use' }, ['r1'], value => value);
  assert.equal(item.confirmed, true); assert.deepEqual(item.details, ['12', 'Film', 'R1', 'Ishlatilmoqda']);
});
test('native action and material labels use the V2 translations in all four locales', () => {
  const text = load('workerOrderText.ts'), catalog = require('../src/shared/localization/catalog.json');
  for (const locale of ['uz', 'en', 'ru', 'ur']) {
    assert.equal(text.workerOrderText('Tugatish', locale), catalog.production['worker.action.complete'][locale]);
    assert.equal(text.workerOrderProductionText('worker.materials.attached', locale), catalog.production['worker.materials.attached'][locale]);
  }
});

function reprintHarness(options = {}) {
  const calls = [], session = { scope: 'A' }, prepared = options.prepared ?? { reprint_id: 'reprint-1', stock: { barcode: 'R1' }, print_request: { epc: 'R1' } };
  class Cancelled extends Error {}
  const reprint = loader({ './sessionReadScope': { sessionReadScope: s => s.scope },
    './preparation/preparationReprint': { PreparationReprintCancelled: Cancelled },
    './preparation/preparationPrinter': {
      pickPreparationPrinter: async ({ selectDevice }) => selectDevice(),
      printPreparationJob: async () => { calls.push(['print']); if (options.afterPrint) options.afterPrint(session); return options.printed !== false; },
    }, './shared/printApi': {
      adminPrepareRawMaterialStockReprint: async (s, code, order) => { calls.push(['prepare', code, order]); return prepared; },
      adminConfirmRawMaterialStockReprint: async (s, code, id) => { calls.push(['confirm', code, id]); if (options.confirmFailed) throw new Error('offline'); },
    } })('workerAssignedMaterialReprint.ts').reprintWorkerAssignedMaterial;
  return { calls, session, Cancelled, run: () => reprint(session, 'R1', 'order-1', {
    current: () => true, selectDevice: async () => { if (options.afterPick) options.afterPick(session); return options.cancelled ? null : {}; },
  }) };
}
test('assigned QR reprint preserves identity and confirms only after printing', async () => {
  const h = reprintHarness(); assert.equal(await h.run(), null);
  assert.deepEqual(h.calls, [['prepare', 'R1', 'order-1'], ['print'], ['confirm', 'R1', 'reprint-1']]);
});
for (const options of [{ cancelled: true }, { afterPick: s => { s.scope = 'B'; } }]) test('cancelled or stale-account printer selection is not a successful reprint', async () => {
  const h = reprintHarness(options); await assert.rejects(h.run(), h.Cancelled); assert.equal(h.calls.length, 1);
});
test('QR mismatch or failed print cannot confirm; failed server confirmation retains printed warning', async () => {
  const mismatch = reprintHarness({ prepared: { reprint_id: 'id', stock: { barcode: 'OTHER' }, print_request: { epc: 'R1' } } });
  await assert.rejects(mismatch.run(), error => error.code === 'raw_material_stock_reprint_identity_mismatch'); assert.equal(mismatch.calls.length, 1);
  const failed = reprintHarness({ printed: false }); await assert.rejects(failed.run(), /Printer QR/); assert.equal(failed.calls.length, 2);
  for (const options of [{ confirmFailed: true }, { afterPrint: s => { s.scope = 'B'; } }]) {
    const h = reprintHarness(options); assert.match(await h.run(), /tasdig‘i saqlanmadi/);
  }
});

test('new logic is wired to both platforms, with actual native controls and a non-dismissible-outside quantity dialog', () => {
  const order = fs.readFileSync(path.resolve(__dirname, '../src/OrderScreen.tsx'), 'utf8');
  assert.match(order, /const showMaterials = !!bootstrap/); assert.match(order, /WorkerMaterialUsePanel/); assert.match(order, /MaterialLinkRequestPanel/);
  assert.match(order, /freeze_with_issue: true, issue_note: completion.note/); assert.match(order, /WorkerAssignedMaterialQr/);
  assert.match(order, /body.completion_request_note = completion.note/); assert.doesNotMatch(order, /body.description = completion.note/);
  for (const platform of ['ios', 'android']) {
    const output = fs.readFileSync(path.resolve(__dirname, `../src/components/WorkerOutputProgress.${platform}.tsx`), 'utf8');
    assert.match(output, /useWorkerOutputProgress/); assert.match(output, platform === 'ios' ? /@expo\/ui\/swift-ui/ : /@expo\/ui\/jetpack-compose/);
    const material = fs.readFileSync(path.resolve(__dirname, `../src/components/WorkerMaterialList.${platform}.tsx`), 'utf8');
    assert.match(material, platform === 'ios' ? /onLongPressGesture/ : /onLongClick/);
  }
  const dialog = fs.readFileSync(path.resolve(__dirname, '../src/components/WorkerFormDialog.ios.tsx'), 'utf8');
  assert.match(dialog, /<Modal/); assert.doesNotMatch(dialog, /BottomSheet|onTouchEnd|onBackdropPress/); assert.match(dialog, /@expo\/ui\/swift-ui/);
});
