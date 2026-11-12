const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file.endsWith('.tsx') ? file : `${file}.ts`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const controls = { isCanonicalApparatusId: id => /^apparatus:/.test(id),
  WorkerControlException: class extends Error { constructor(code, message) { super(message); this.code = code; } } };
const progress = load('workerProgressBatch', { './workerControlsApi': controls, './workerProgressModel': load('workerProgressModel') });
const routes = load('workerOutputProgress', { './workerControlsApi': controls, './workerWip': {} });
const peremotka = load('workerPeremotka');
const catalog = require('../src/shared/localization/catalog.json');
const localization = load('shared/localization/index', { './catalog.json': catalog });
const p = (key, values) => localization.productionText(key, 'uz', values);
const input = load('workerInputProgress', { './workerOpeningWipCandidatesApi': {}, './workerWipApi': {}, './workerProgressApi': {},
  './workerControlsApi': controls, './workerProgressBatch': progress, './workerOutputProgress': routes, './workerPeremotka': peremotka });
const sourceId = 'apparatus:default:print', station = 'apparatus:default:lamination';
const label = id => id === sourceId ? '8 ta rangli bosma aparat' : id === station ? 'Laminatsiya 1' : id;
const map = { nodes: [{ id: 'start', kind: 'start' }, { id: 'print', kind: 'apparatus', apparatus_id: sourceId },
  { id: 'lam', kind: 'apparatus', apparatus_id: station }, { id: 'later-lam', kind: 'apparatus', apparatus_id: station }],
  edges: [{ from: 'start', to: 'print' }, { from: 'print', to: 'lam' }, { from: 'lam', to: 'later-lam' }] };
function batch(id, qty = 1, extra = {}) { return { batch_id: id, order_id: 'order', apparatus: sourceId, action: 'detach_roll', produced_qty: qty,
  uom: 'm', qr_payload: `QR-${id}`, wip_status: 'waiting', next_apparatus: station, payload_json: { next_stage_node_id: 'lam' }, ...extra }; }
function source(extra = {}) { return { apparatusId: station, orderId: 'order', stageId: 'lam', previousStage: sourceId,
  previousRequired: true, openingRequired: false, map, selected: null, ...extra }; }
function selected(row, opening = false) { return { id: row.batch_id, qr: row.qr_payload, stage: 'lam', batch: row, opening }; }

// V2 _PreviousProgressQrTile / _InputProgressBatchList and the user's four-roll FAB example.
test('FAB scan displays all four matching rolls, moves the validated roll first and marks only it', async () => {
  const rows = [batch('a'), batch('b'), batch('c', 1121), batch('d', 6002)];
  const context = source({ selected: selected(rows[1]) });
  const result = await input.readWorkerInputProgress({}, context, () => true, {
    production: async () => rows, opening: async () => assert.fail('opening not required'), validate: async () => assert.fail('already present'),
  });
  const model = input.workerInputProgressModel({ source: { ...context, selected: result.selected }, batches: result.batches, loading: false, error: '' }, p, label);
  assert.equal(model.title, 'Oldingi bosqich tasdiqlandi');
  assert.equal(model.subtitle, '8 ta rangli bosma aparat • 1 m');
  assert.equal(model.products, 'Oldingi bosqichdan kelgan mahsulotlar');
  assert.equal(model.summary, '8 ta rangli bosma aparat chiqargan 4 ta mahsulot bor. 4 tasini scan qilish kerak.');
  assert.equal(model.rows.length, 4);
  assert.deepEqual(model.rows.map(row => row.selected), [true, false, false, false]);
  assert.equal(model.rows[0].qr, 'QR: QR-b');
  assert.equal(model.rows[2].title, '8 ta rangli bosma aparat rulonni yechib chiqargan mahsulot');
  assert.equal(model.rows[2].status, 'Scan qilish kerak • Miqdor: 1121 m');
  assert.equal(model.rows[3].status, 'Scan qilish kerak • Miqdor: 6002 m');
  assert.equal(result.selected.id, 'b');
});

test('list filters other orders, used rolls and a later occurrence of the same machine', () => {
  const rows = [batch('valid'), batch('other', 1, { order_id: 'another' }), batch('used', 1, { wip_status: 'in_use' }),
    batch('later', 1, { payload_json: { next_stage_node_id: 'later-lam' } })];
  assert.deepEqual(input.workerInputProgressCandidates(rows, source()).map(row => row.batch_id), ['valid']);
  const alternativeMap = { nodes: [...map.nodes.slice(0, 3).map(n => n.id === 'lam' ? { ...n, alternative_group_id: 'lam-group' } : n),
    { id: 'alternative', kind: 'apparatus', apparatus_id: 'apparatus:default:lam2', alternative_group_id: 'lam-group' }], edges: map.edges.slice(0, 2) };
  assert.equal(input.workerInputProgressCandidates([batch('alternate', 2, { next_apparatus: 'apparatus:default:lam2', payload_json: { next_stage_node_id: 'alternative' } })], source({ map: alternativeMap })).length, 1);
});

test('complete scoped bootstrap candidates avoid a second list request; a wrong stage falls back', async () => {
  const calls = [], context = source({ section: { status: 'ready', apparatus: station, order_id: 'order', stage_node_id: 'lam',
    limit: 500, status_filter: 'waiting', data: { batches: [batch('prepared')] } } });
  const reads = { production: async () => { calls.push('list'); return [batch('fallback')]; }, opening: async () => [], validate: async () => assert.fail('no scan') };
  assert.equal((await input.readWorkerInputProgress({}, context, () => true, reads)).batches[0].batch_id, 'prepared');
  assert.deepEqual(calls, []);
  context.section.stage_node_id = 'later-lam';
  assert.equal((await input.readWorkerInputProgress({}, context, () => true, reads)).batches[0].batch_id, 'fallback');
  assert.deepEqual(calls, ['list']);
});

test('a validated QR omitted from the list is revalidated before being retained', async () => {
  const scanned = batch('new'), context = source({ selected: selected(scanned) }), calls = [];
  const reads = { production: async () => [batch('old')], opening: async () => [], validate: async qr => { calls.push(qr); return scanned; } };
  const result = await input.readWorkerInputProgress({}, context, () => true, reads);
  assert.deepEqual(result.batches.map(row => row.batch_id), ['new', 'old']);
  assert.deepEqual(calls, ['QR-new']);
  const rejected = await input.readWorkerInputProgress({}, context, () => true, { ...reads, validate: async () => ({ ...scanned, wip_status: 'in_use' }) });
  assert.equal(rejected.selected, null);
  assert.equal(rejected.batches.length, 1);
});

test('accepting a newly produced roll immediately adds it to the displayed list without dropping other candidates', () => {
  const scanned = batch('new', 25);
  const model = input.workerInputProgressModel({ source: source({ selected: selected(scanned) }), batches: [batch('older')], loading: false, error: '' }, p, label);
  assert.deepEqual(model.rows.map(row => row.qr), ['QR: QR-new', 'QR: QR-older']);
  assert.deepEqual(model.rows.map(row => row.selected), [true, false]);
});

test('a closed sheet or changed account cannot publish an in-flight list', async () => {
  let current = true, release;
  const pending = input.readWorkerInputProgress({}, source(), () => current, {
    production: () => new Promise(resolve => { release = resolve; }), opening: async () => [], validate: async () => assert.fail('stale'),
  });
  current = false; release([batch('a')]);
  await assert.rejects(pending, error => error.code === 'session_scope_changed');
});

test('opening WIP and production candidates share the V2 list and quantity fallback', async () => {
  const opening = { batch_id: 'opening', order_id: 'order', qr_payload: 'OPENING', wip_status: 'waiting', quantity: 7.5, uom: 'kg' };
  const context = source({ openingRequired: true, selected: selected(opening, true) });
  const result = await input.readWorkerInputProgress({}, context, () => true, { production: async () => [batch('printed')],
    opening: async () => [opening], validate: async () => assert.fail('opening selection uses its candidate') });
  assert.deepEqual(result.batches.map(row => row.batch_id), ['printed', 'opening']);
  const model = input.workerInputProgressModel({ source: { ...context, selected: result.selected }, batches: result.batches, loading: false, error: '' }, p, label);
  assert.equal(model.subtitle, '8 ta rangli bosma aparat • 7.5 kg');
  assert.deepEqual(model.rows.map(row => row.selected), [false, true]);
  assert.equal(input.openingWipAsInputProgress({ ...opening, finished_goods_meter: 20 }, sourceId).uom, 'm');
});

test('loading, empty and denied states retain V2 text and never fabricate a selected row', () => {
  const make = (extra = {}) => input.workerInputProgressModel({ source: source(), batches: [], loading: false, error: '', ...extra }, p, label);
  assert.equal(make().empty, '8 ta rangli bosma aparatdan ushbu buyurtma va bosqich uchun qabul qilishga tayyor WIP topilmadi.');
  assert.equal(make().ready, false);
  assert.equal(make({ loading: true, batches: [batch('a')] }).rows.length, 0);
  const error = input.workerInputProgressError({ statusCode: 403 }, p);
  assert.equal(error, 'Bu apparat uchun WIP ma’lumotlarini ko‘rish huquqi yo‘q.');
  assert.equal(make({ error, batches: [batch('a')] }).rows.length, 0);
});

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function content(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(content).join(' ');
  return tree && typeof tree === 'object' ? content(tree.props?.children) : '';
}
for (const platform of ['ios', 'android']) test(`${platform} native block renders all candidates and exactly one scanned checkmark without tap selection`, () => {
  const colors = new Proxy({}, { get: (_, key) => String(key) });
  const components = new Proxy({ useMaterialColors: () => colors }, { get: (target, key) => target[key] ?? String(key) });
  const modifiers = new Proxy({}, { get: () => () => ({}) });
  const { WorkerInputProgress } = load(`components/WorkerInputProgress.${platform}.tsx`, {
    '@expo/ui/swift-ui': components, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': components, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, './BaseHost': { BaseHost: 'BaseHost' },
    'react-native': { PlatformColor: key => key, StyleSheet: { create: value => value }, View: 'View' },
  });
  const rows = [batch('scanned'), batch('b'), batch('c', 1121), batch('d', 6002)];
  const model = input.workerInputProgressModel({ source: source({ selected: selected(rows[0]) }), batches: rows, loading: false, error: '' }, p, label);
  const tree = WorkerInputProgress({ model });
  const tiles = nodes(tree).filter(n => ['worker-input-selected', 'worker-input-candidate'].includes(n.props?.testID));
  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles.map(n => n.props.accessibilityState.selected), [true, false, false, false]);
  assert(content(tiles[0]).includes('QR: QR-scanned'));
  assert(content(tree).includes('Miqdor: 6002 m'));
  assert(tiles.every(n => !n.props.onPress && !n.props.onClick));
  for (const state of [{ ...model, loading: true, rows: [] }, { ...model, error: 'WIP error', rows: [] }, { ...model, ready: false, rows: [] }]) {
    const rendered = WorkerInputProgress({ model: state });
    assert.equal(nodes(rendered).filter(n => n.props?.testID === 'worker-input-selected').length, 0);
  }
});
