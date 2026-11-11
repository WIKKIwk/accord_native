const assert = require('node:assert/strict'), test = require('node:test');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function load(name, mocks = {}, clock) {
  if (name === 'workerDetailRecoveryRead.ts') mocks = { './shared/mobileApiException': load('shared/mobileApiException.ts'), ...mocks };
  const module = { exports: {} }, source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', name), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', source)(id => {
    if (!Object.hasOwn(mocks, id)) throw Error(`Unexpected import ${id}`);
    return mocks[id];
  }, module, module.exports, clock?.schedule ?? setTimeout, clock?.cancel ?? clearTimeout);
  return module.exports;
}
const { WorkerDetailRecovery } = load('workerDetailRecovery.ts');
const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function clock() {
  let now = 0, next = 0; const timers = new Map(), delays = [];
  const schedule = (run, delay) => { const id = ++next; timers.set(id, { at: now + delay, run }); delays.push(delay); return id; };
  const advance = async by => {
    const end = now + by;
    for (;;) { const first = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!first) break;
      now = first[1].at; timers.delete(first[0]); first[1].run(); await tick(); }
    now = end; await tick();
  };
  return { schedule, cancel: id => timers.delete(id), advance, timers, delays };
}
function fixture(input = {}) {
  const c = clock(), errors = [], reads = [], publications = []; let hydrated = false, invalidations = 0, current = true;
  const owner = new WorkerDetailRecovery({ schedule: c.schedule, cancel: c.cancel,
    current: () => current, hydrated: () => hydrated, invalidate: () => invalidations++,
    denied: error => error.statusCode === 403 || error.statusCode === 401,
    failed: (error, initial) => errors.push({ error, initial }), load: async valid => {
      reads.push(valid); await input.read?.(valid); if (valid()) { hydrated = true; publications.push(true); }
    } });
  return { c, errors, reads, publications, owner, setHydrated: value => { hydrated = value; }, setCurrent: value => { current = value; }, get invalidations() { return invalidations; } };
}
test('V2 initial preview paints before read; initial failure waits for manual Retry', async () => {
  let failed = true; const h = fixture({ read: async () => { if (failed) throw Error('Initial read unavailable'); } });
  h.owner.invalidate(); assert.equal(h.reads.length, 0); await h.c.advance(0);
  assert.equal(h.errors.length, 1); assert.equal(h.errors[0].initial, true);
  await h.c.advance(20_000); assert.equal(h.reads.length, 1);
  failed = false; h.owner.retry(); await h.c.advance(0); assert.equal(h.publications.length, 1);
  await h.c.advance(20_000); assert.equal(h.reads.length, 2); h.owner.dispose();
});
test('V2 hydrated transient errors back off 200/500/1000/2000 capped then stop after fresh authority', async () => {
  let failed = true; const h = fixture({ read: async () => { if (failed) throw Error('Unavailable'); } }); h.setHydrated(true);
  h.owner.invalidate(); await h.c.advance(0); assert.equal(h.reads.length, 1);
  await h.c.advance(199); assert.equal(h.reads.length, 1); await h.c.advance(1); assert.equal(h.reads.length, 2);
  await h.c.advance(500); await h.c.advance(1000); await h.c.advance(2000); await h.c.advance(2000);
  assert.deepEqual(h.c.delays.slice(0, 7), [0, 200, 500, 1000, 2000, 2000, 2000]);
  failed = false; await h.c.advance(2000); assert.equal(h.publications.length, 1);
  const count = h.reads.length; await h.c.advance(20_000); assert.equal(h.reads.length, count); h.owner.dispose();
});
test('V2 hydrated denial stops automatic and manual rereads until reopened identity', async () => {
  const h = fixture({ read: async () => { throw Object.assign(Error('Forbidden'), { statusCode: 403 }); } }); h.setHydrated(true);
  h.owner.invalidate(); await h.c.advance(0); const count = h.invalidations;
  h.owner.invalidate(); h.owner.retry(); await h.c.advance(20_000);
  assert.equal(h.reads.length, 1); assert.equal(h.invalidations, count); assert.equal(h.errors[0].initial, false); h.owner.dispose();
});
test('V2 revision handoff retires old completion and only current owner publishes', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  const h = fixture({ read: () => (++count === 1 ? first : second).promise });
  h.owner.invalidate(); await h.c.advance(0); h.owner.invalidate(); await h.c.advance(0);
  first.reject(Error('retired read')); await tick(); assert.equal(h.errors.length, 0); assert.equal(h.publications.length, 0);
  second.resolve(); await tick(); assert.equal(h.publications.length, 1); h.owner.dispose();
});
test('V2 background cancels pending recovery, resume reads fresh; disposal ignores old responses', async () => {
  const pending = deferred(); let count = 0;
  const h = fixture({ read: () => ++count === 1 ? pending.promise : Promise.resolve() }); h.setHydrated(true);
  h.owner.invalidate(); await h.c.advance(0); h.owner.setForeground(false);
  pending.resolve(); await tick(); assert.equal(h.publications.length, 0);
  await h.c.advance(20_000); assert.equal(h.reads.length, 1);
  h.owner.setForeground(true); await h.c.advance(0); assert.equal(h.publications.length, 1);
  h.owner.invalidate(); h.owner.dispose(); await h.c.advance(20_000); assert.equal(h.reads.length, 2);
});
test('temporary blocking never retries a command and strict effect reactivation can read again', async () => {
  const h = fixture(); h.owner.invalidate(true); await h.c.advance(20_000); assert.equal(h.reads.length, 0);
  h.owner.invalidate(false); await h.c.advance(0); assert.equal(h.reads.length, 1);
  h.owner.dispose(); h.owner.activate(); await h.c.advance(0); assert.equal(h.reads.length, 2); h.owner.dispose();
});

function readerFixture(read) {
  const c = clock(); let scope = 'worker-scope';
  const reader = load('workerDetailRecoveryRead.ts', { './auth': { activeSessionToken: () => 'token' },
    './sessionReadScope': { sessionReadScope: () => scope }, './workerDetailApi': { workerProductionOrderDetail: read },
    './workerOrderLogic': { validOrderControl: () => false } }, c);
  return { ...reader, c, scope: value => { scope = value; } };
}
test('V2 close/reopen shares only pending scoped GET; settled read does not certify next operation', async () => {
  const pending = deferred(); let calls = 0; const h = readerFixture(() => { calls++; return pending.promise; });
  const session = {}, first = h.readWorkerDetailSnapshot(session, 'press', 'order', () => null, () => true),
    second = h.readWorkerDetailSnapshot(session, 'press', 'order', () => null, () => true);
  await tick(); assert.equal(calls, 1); pending.resolve({ epoch: 'epoch', rev: 2 }); await Promise.all([first, second]);
  await h.readWorkerDetailSnapshot(session, 'press', 'order', () => null, () => true); assert.equal(calls, 2);
});
test('two stale scoped details return the V2 page-changed code and message', async () => {
  let reads = 0;
  const h = readerFixture(async () => { reads++; return { epoch: 'old', rev: 1 }; });
  await assert.rejects(h.readWorkerDetailSnapshot({}, 'press', 'order', () => ({ epoch: 'current', rev: 2 }), () => true),
    { code: 'order_page_changed', message: 'Buyurtma yangilandi. Qayta oching.' });
  assert.equal(reads, 2);
});
test('V2 stale retry and hung scoped GET share one five second deadline; later old completion cannot retire newer lease', async () => {
  const stale = deferred(), hung = deferred(), fresh = deferred(); let calls = 0;
  const h = readerFixture(() => [stale, hung, fresh][calls++].promise);
  const cursor = () => ({ epoch: 'epoch', rev: 2 });
  const first = h.readWorkerDetailSnapshot({}, 'press', 'order', cursor, () => true); const failed = assert.rejects(first, /timed out/);
  await tick(); await h.c.advance(4900); stale.resolve({ epoch: 'epoch', rev: 1 }); await tick(); assert.equal(calls, 2);
  await h.c.advance(100); await failed;
  const second = h.readWorkerDetailSnapshot({}, 'press', 'order', cursor, () => true); await tick(); assert.equal(calls, 3);
  hung.resolve({ epoch: 'epoch', rev: 2 }); await tick();
  const reopen = h.readWorkerDetailSnapshot({}, 'press', 'order', cursor, () => true); await tick(); assert.equal(calls, 3);
  fresh.resolve({ epoch: 'epoch', rev: 2 }); await Promise.all([second, reopen]);
});
test('V2 scope or owner invalidation cannot publish a completed GET', async () => {
  const pending = deferred(), h = readerFixture(() => pending.promise);
  const result = h.readWorkerDetailSnapshot({}, 'press', 'order', () => null, () => true); const rejected = assert.rejects(result, /Sessiya/);
  await tick(); h.scope('other-account'); pending.resolve({ epoch: 'epoch', rev: 2 }); await rejected;
});

const { harness, nodes, main } = require('./support/workerOrderScreen.cjs');
const wait = () => new Promise(resolve => setTimeout(resolve, 5));
for (const platform of ['ios', 'android']) test(`${platform}: a write receipt blocks unversioned and older controls until matching authority arrives`, () => {
  const h = harness(platform, { states: { pendingControlReceipt: { epoch: 'epoch', rev: 7 } },
    controlState: { epoch: '', rev: null }, control: { state: 'pending', allowed_actions: ['start'] },
    interaction: { mode: 'fresh_start', blocking_reason_code: '', material_intake_allowed: false } });
  const controls = () => nodes(main(h.render()), node => node.type?.name === 'NativeButton' && node.props.label === h.p('worker.action.start'));
  assert.equal(controls().length, 0);
  const install = state => h.values.set('bootstrap', { ...h.bootstrap, control_state: { ...h.bootstrap.control_state, ...state } });
  install({ epoch: 'epoch', rev: 6 }); assert.equal(controls().length, 0);
  install({ epoch: 'different', rev: 9 }); assert.equal(controls().length, 0);
  install({ epoch: 'epoch', rev: 7 }); assert.equal(controls().length, 1);
});
for (const platform of ['ios', 'android']) test(`${platform}: actual OrderScreen keeps preview and its form through phased hydration, transient recovery and pending cancellation`, async () => {
  const full = deferred(), sections = deferred();
  const h = harness(platform, { states: { detail: null, bootstrap: null, detailReadScope: '', loading: true },
    readDetail: () => full.promise, readBootstrap: () => sections.promise });
  h.props.preview = { code: '0198', title: 'Row preview', imageId: 'preview-image' };
  let tree = h.render();
  const preview = nodes(tree, node => node.type === 'WorkerOrderOverview')[0];
  assert.equal(preview.props.title, 'Row preview'); assert.equal(preview.props.detail, null);
  const start = h.effects.find(effect => /recovery\.invalidate\(busy\)/.test(effect.toString())); assert.ok(start); start(); await wait();
  assert.equal(h.values.get('detail'), null);
  full.resolve({ epoch: 'epoch', rev: 1, maps: [{ map: { id: '0198', title: 'Hydrated full map' } }] }); await tick();
  tree = h.render();
  assert.equal(nodes(tree, node => node.type === 'WorkerOrderOverview')[0].props.title, 'Hydrated full map');
  assert.equal(h.values.get('bootstrap'), null, 'The map does not wait for scan/section GET');
  h.values.set('completionNote', 'Unfinished report');
  sections.resolve(structuredClone(h.bootstrap)); await tick(); tree = h.render();
  assert.equal(h.values.get('loading'), false); assert.equal(h.values.get('controlRetired'), false);
  assert.equal(h.values.get('completionNote'), 'Unfinished report');
  const cleanup = h.effects.find(effect => /recovery\.dispose\(\)/.test(effect.toString()))?.(); cleanup?.();
});
for (const platform of ['ios', 'android']) test(`${platform}: actual OrderScreen initial detail failure leaves preview, error and manual retry`, async () => {
  const h = harness(platform, { states: { detail: null, bootstrap: null, detailReadScope: '', loading: true },
    readDetail: async () => { throw Error('Detail unavailable'); } });
  h.props.preview = { code: '0198', title: 'Still visible preview', imageId: '' };
  h.render(); const start = h.effects.find(effect => /recovery\.invalidate\(busy\)/.test(effect.toString())); start(); await wait();
  const tree = h.render();
  assert.equal(h.values.get('error'), 'Detail unavailable');
  assert.equal(nodes(tree, node => node.type === 'WorkerOrderOverview')[0].props.title, 'Still visible preview');
  assert.ok(nodes(main(tree), node => node.type?.name === 'NativeButton' && node.props.label === 'Qayta urinish').length);
  const cleanup = h.effects.find(effect => /recovery\.dispose\(\)/.test(effect.toString()))?.(); cleanup?.();
});

test('V2 section retry classification preserves terminal 4xx and retries timeouts/rate limits/server failures', () => {
  const h = readerFixture(async () => ({}));
  for (const error of [Error('Network'), {}, { statusCode: 408 }, { statusCode: 429 }, { statusCode: 503 }]) {
    assert.equal(h.workerDetailSectionRetryable(error), true);
  }
  for (const error of [{ code: 'apparatus_id_invalid' }, { statusCode: 400 }, { statusCode: 401 }, { statusCode: 403 }, { statusCode: 404 }]) {
    assert.equal(h.workerDetailSectionRetryable(error), false);
  }
});
test('independent material sections retain original failure identity for safe automatic read classification', async () => {
  const original = Object.assign(Error('Unavailable'), { statusCode: 503, code: 'unavailable' }); let reads = 0;
  const sectionApi = load('workerScanSections.ts', { './sessionReadScope': { sessionReadScope: () => 'same' },
    './workerControlsApi': { WorkerControlException: class extends Error {} },
    './workerOrderLogic': load('workerOrderLogic.ts', { './workerControlsApi': {} }),
    './workerRawMaterials': { adminRawMaterialStartRequirements: async () => { reads++; throw original; } }, './workerQolips': {} });
  const result = await sectionApi.completeWorkerScanSections({}, { control_state: { order_id: 'order', apparatus: 'press',
    control: { interaction: { start_materials_mode: 'scan_required', qolip_mode: 'not_required' } } }, sections: {} }, []);
  assert.equal(reads, 1); assert.equal(result.sections.materials.status, 'error');
  assert.equal(result.sections.materials.error, 'Unavailable'); assert.equal(result.sections.materials.readError, original);
});
test('a recovered button contract cannot cancel independent material read recovery; healthy sections stop it', async () => {
  const c = clock(); let sectionsNeeded = true, reads = 0;
  const owner = new WorkerDetailRecovery({ schedule: c.schedule, cancel: c.cancel, current: () => true, hydrated: () => true,
    invalidate() {}, failed() { assert.fail('Only a section error is present'); }, denied: () => false,
    sectionsNeedRecovery: () => sectionsNeeded, load: async () => { reads++; } });
  owner.invalidate(); await c.advance(0); assert.equal(reads, 1);
  await c.advance(200); assert.equal(reads, 2);
  sectionsNeeded = false; await c.advance(500); assert.equal(reads, 3);
  await c.advance(20_000); assert.equal(reads, 3); owner.dispose();
});
test('validated scoped snapshot controls can initialize the detail independently while sections remain unavailable', () => {
  const { rules } = require('./support/workerOrderScreen.cjs');
  const api = load('workerDetailRecoveryRead.ts', { './auth': {}, './sessionReadScope': {}, './workerDetailApi': {},
    './workerOrderLogic': rules });
  const control = { state: 'pending', allowed_actions: ['start'], previous_stage_ready: false, complete_requires_full_report: false,
    interaction: { mode: 'fresh_start', start_materials_mode: 'hidden', material_scan_required: false, assigned_materials_display_only: false,
      material_intake_allowed: false, previous_wip_mode: 'not_required', opening_wip_mode: 'not_required', qolip_mode: 'not_required' } };
  const snapshot = { epoch: 'epoch', rev: 12, scope: 'scope', queue_states: { press: { order: 'pending' } },
    queue_action_controls: { press: { order: control } }, order_controls: { order: { state: 'active' } }, stage_states: {} };
  const bootstrap = api.workerDetailInitialBootstrap(snapshot, 'press', 'order');
  assert.ok(bootstrap); assert.equal(rules.validOrderControl(bootstrap, 'press', 'order', null), true); assert.deepEqual(bootstrap.sections, {});
  snapshot.queue_states.press.order = 'paused'; assert.equal(api.workerDetailInitialBootstrap(snapshot, 'press', 'order'), null);
});
test('V2 worker-specific unavailable response withdraws cached action presentation', () => {
  const { workerOrderPresentationDenied } = load('workerOrderPresentation.ts');
  assert.equal(workerOrderPresentationDenied({ code: 'worker_order_not_available', statusCode: 404 }), true);
  assert.equal(workerOrderPresentationDenied({ code: 'temporary_backend_failure', statusCode: 503 }), false);
});
for (const platform of ['ios', 'android']) test(`${platform}: closing a sheet cannot release the list write fence before the pending HTTP mutation settles`, async () => {
  const mutation = deferred(), notifications = [];
  const hold = { order_id: '0198', apparatus: 'apparatus:default:bosma_8', hold_id: 'hold', revision: 1, status: 'held' };
  const h = harness(platform, { control: { state: 'print_preflight', print_preflight: hold },
    interaction: { mode: 'fresh_start_blocked', blocking_reason_code: 'print_preflight_active', material_intake_allowed: false },
    runPreflight: () => mutation.promise });
  h.props.onWritePending = pending => notifications.push(pending);
  const tree = h.render();
  nodes(main(tree), node => (node.type?.name === 'NativeButton' || node.type === 'WorkerPreflightButton') && node.props.label === 'Rang chiqdi')[0].props.onPress();
  assert.deepEqual(notifications, [true]);
  const close = h.effects.find(effect => /mounted\.current = true/.test(effect.toString()) && /reportDismissed/.test(effect.toString()))(); close();
  assert.deepEqual(notifications, [true], 'Unmount cannot certify the pre-mutation snapshot');
  mutation.resolve({}); await tick(); assert.deepEqual(notifications, [true, false]);
});
