const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(name, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', name + '.ts'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./') ? load(name.slice(0, name.lastIndexOf('/') + 1) + id.slice(2), mocks)
    : id.startsWith('../') ? load(path.posix.normalize(name.slice(0, name.lastIndexOf('/') + 1) + id), mocks) : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString'), closed = load('admin/adminWorkMapClosedModel', { './dartJsonString': dart });
const text = { adminText: (key, _locale, values = {}) => Object.hasOwn(values, 'value') ? `${key}=${values.value}` : key };
const model = load('admin/adminClosedLogPresentation', { '../shared/localization': text, './adminWorkMapClosedModel': closed, './dartJsonString': dart });
const parsed = load('workerClosedOrders', { './authorizedFetch': {} }), machine = 'apparatus:default:press', other = 'apparatus:default:cut';
const log = (changes = {}) => parsed.productionOrderLogFromJson({ event_id: 'e', order_id: 'o', apparatus: machine, action: 'start',
  from_state: '', to_state: '', actor_display_name: '', actor_ref: '', actor_role: '', created_at_unix: 0, ...changes });
const batch = (changes = {}) => ({ batch_id: 'b', session_id: '', apparatus: machine, current_apparatus: '', action: 'start', status: '', wip_status: '',
  status_detail: { flow_status: '', stock_status: '' }, started_at_unix: 0, completed_at_unix: 0, produced_qty: 0, uom: '', qr_payload: '',
  worker_display_name: '', worker_role: '', worker_ref: '', executor_name: '', label_item_code: '', label_item_name: '', current_location: '', next_apparatus: '',
  parent_batch_id: '', description: '', return_ink_kg: null, lamination_print_leftover_rolls: null, lamination_film_leftover_rolls: null,
  rezka_bosma_waste: null, rezka_lamination_waste: null, rezka_edge_waste: null, total_waste: null, finished_goods_kg: null, finished_goods_meter: null, ...changes });
const order = (batches = []) => ({ progress_batches: batches });
const catalog = [{ id: machine, name: ' Old ' }, { id: machine, name: ' Print 7 ' }, { id: other, name: ' Cut ' }];
test('Closed log titles, states, apparatus and actor follow source branch precedence', () => {
  assert.equal(model.adminClosedApparatusLabel(` ${machine} `, catalog), 'Print 7'); assert.equal(model.adminClosedApparatusLabel('unknown', catalog), 'unknown');
  for (const [action, title] of [['start', 'Boshladi'], ['pause', 'Pauza qildi'], ['freeze', 'Muzlatdi'], ['detach_roll', 'Rulonni yechdi'],
    ['merge', 'WIP rulonni uladi'], ['resume', 'Davom ettirdi'], ['roll_complete', 'Rulonni tugatdi'], ['complete', 'Tugatdi'], ['', 'Harakat'], ['__proto__', '__proto__']]) {
    assert.equal(model.adminClosedLogTitle(log({ action })), title);
  }
  for (const [status, expected] of [['pending', 'Muzlatish so‘raldi'], ['frozen', 'Muzlatildi'], ['cancelled', 'Muzlatish bekor qilindi'],
    ['unfrozen', 'Muzlatishdan chiqarildi'], [' Future ', 'Muzlatish: future'], ['', 'Muzlatish hodisasi']]) assert.equal(model.adminClosedFreezeLabel(status), expected);
  const transfer = log({ action: 'pause', actor_ref: ' ref ', from_state: 'a', to_state: 'b', transfer: { from_apparatus: machine, to_apparatus: other, reason: ' broken ' } });
  assert.deepEqual(model.adminClosedLogRow(transfer, catalog), { icon: 'transfer', title: 'Apparat almashtirildi • Print 7 → Cut',
    subtitle: `ref • ${machine} → ${other} • Sabab: broken` });
  assert.equal(model.adminClosedLogTitle(log({ completed_with_issue: true, issue_note: ' damage ' })), 'damage');
  const early = { ...log(), action: 'close_early', issue_note: ' reason ', freeze: { status: 'frozen', target_apparatus: other } };
  assert.equal(model.adminClosedLogTitle(early), 'Order muammo bilan erta yopildi'); assert.equal(model.adminClosedLogApparatus(early, catalog), '');
  assert.equal(model.adminClosedLogState(early), 'Erta yopilgan'); assert.equal(model.adminClosedLogRow(early, catalog).subtitle, 'Noma’lum ijrochi • Erta yopilgan • Sabab: reason');
});
test('Closed batch matching uses freeze session, transfer ID, then action/apparatus and nearest time', () => {
  const batches = [batch({ batch_id: 'far', session_id: 's', started_at_unix: 40 }), batch({ batch_id: 'near', session_id: 's', started_at_unix: 95 }),
    batch({ batch_id: 'current', current_apparatus: machine, apparatus: other, started_at_unix: 98 }), batch({ batch_id: 'wrong', action: 'pause' })];
  const freeze = log({ freeze: { status: 'frozen', target_apparatus: machine, target_session_id: ' s ' }, created_at_unix: 100 });
  assert.deepEqual(model.adminClosedBatchesForLog(order(batches), freeze).map(value => value.batch_id), ['far', 'near']);
  const transfer = log({ transfer: { from_apparatus: machine, to_apparatus: other, progress_batch_id: ' near ' }, created_at_unix: 100 });
  assert.deepEqual(model.adminClosedBatchesForLog(order(batches), transfer).map(value => value.batch_id), ['near']);
  assert.deepEqual(model.adminClosedBatchesForLog(order(batches), { ...transfer, transfer: { ...transfer.transfer, progress_batch_id: 'missing' } }), []);
  assert.deepEqual(model.adminClosedBatchesForLog(order(batches), log({ action: ' START ', created_at_unix: 100 })).map(value => value.batch_id), ['current', 'near', 'far']);
  assert.deepEqual(model.adminClosedBatchesForLog(order(batches), { ...log(), action: 'close_early' }), []);
});
test('Closed detail sections retain source ordering, selectable identifiers and zero-waste precedence', () => {
  const entry = log({ event_id: ' event ', from_state: 'a', to_state: 'b', issue_note: ' issue ', zero_output_waste: { total_waste: 2.5, rezka_edge_waste: 0 },
    freeze: { status: 'pending', target_apparatus: machine, target_worker_ref: ' worker ', target_session_id: ' session ', request_id: ' request ', requested_at_unix: 1 },
    transfer: { from_apparatus: machine, to_apparatus: other, reason: ' reason ', transfer_id: ' transfer ', session_id: ' ts ', progress_batch_id: ' b ', material_barcodes: ['A', 'B'] } });
  const result = model.adminClosedLogDetail(order([batch({ batch_id: 'b' })]), entry, catalog, 'en');
  assert.deepEqual(result.sections.map(section => section.id), ['event', 'freeze', 'transfer', 'progress']);
  assert.deepEqual(result.sections[0].fields.map(field => field.label), ['production.event', 'label.apparatus', 'production.time', 'production.executor', 'label.status', 'production.event_id', 'production.issue_note']);
  assert.equal(result.sections[0].fields.find(field => field.label === 'production.event_id').selectable, true);
  assert.equal(result.sections[1].fields.find(field => field.label === 'production.target_worker').value, 'worker');
  assert.equal(result.sections[2].fields.find(field => field.label === 'production.material_qr').value, 'A, B');
  assert.deepEqual(result.sections[3].metrics, ['production.total_waste=2.5', 'production.edge_waste=0']);
  assert.equal(result.sections[3].batches, undefined);
});
test('Closed progress details keep status, field and metric ordering and expose QR text as data only', () => {
  const item = batch({ batch_id: ' b ', session_id: ' s ', status: 'done', wip_status: 'waiting', status_detail: { flow_status: 'flow', stock_status: 'stock' },
    worker_display_name: ' Ana ', executor_name: ' Worker ', label_item_code: ' P ', label_item_name: ' Film ', current_location: ' Shelf ', next_apparatus: other,
    parent_batch_id: ' parent ', produced_qty: 2.5, uom: ' kg ', return_ink_kg: 0, rezka_edge_waste: 1.25, finished_goods_meter: 10, description: ' note ', qr_payload: ' qr ' });
  const result = model.adminClosedLogDetail(order([item]), log(), catalog, 'uz'), progress = result.sections.at(-1), row = progress.batches[0];
  assert.equal(progress.title, 'production.progress_info_plural'); assert.equal(row.title, 'start • Print 7');
  assert.equal(row.status, 'done • production.wip_prefix=waiting • production.flow_prefix=flow • production.stock_prefix=stock');
  assert.deepEqual(row.fields.map(field => field.label), ['production.batch_id', 'production.target_session', 'production.executor', 'production.executor', 'production.item', 'production.location', 'production.next_equipment', 'production.parent_batch']);
  assert.deepEqual(row.metrics, ['production.produced=2.5  kg', 'production.returned_ink=0', 'production.edge_waste=1.25', 'production.finished_meters=10']);
  assert.deepEqual(row.note, { label: 'production.note', value: 'note' });
  assert.deepEqual(row.qr, { payload: 'qr', label: 'production.qr_payload', copyLabel: 'action.copy', copiedText: 'production.copied' });
  const empty = model.adminClosedLogDetail(order([]), log(), catalog, 'uz').sections.at(-1);
  assert.equal(empty.title, 'production.progress_info'); assert.equal(empty.empty, 'production.progress_empty');
});
test('Closed quantities match source fixed-three-decimal spelling, including negative zero', () => {
  for (const [value, expected] of [[-0, '-0'], [0, '0'], [0.0005, '0.001'], [-0.00001, '-0'], [1.2345, '1.234'], [100, '100'], [1e21, '1e+21']]) {
    assert.equal(model.adminClosedLogNumber(value), expected);
  }
});
test('actual Closed and progress decoders feed the localized read-only detail model', () => {
  const localization = load('shared/localization/index', { './catalog.json': require('../src/shared/localization/catalog.json') });
  const actual = load('admin/adminClosedLogPresentation', { '../shared/localization': localization, './adminWorkMapClosedModel': closed, './dartJsonString': dart });
  const value = parsed.closedProductionOrderFromJson({ order_id: 'o', logs: [{ event_id: 'e', order_id: 'o', apparatus: machine, action: 'start', actor_display_name: 'Ana' }],
    progress_batches: [{ batch_id: 'b', session_id: 's', apparatus: machine, order_id: 'o', action: 'start', produced_qty: 12.5, uom: 'kg', qr_payload: 'QR' }] });
  const result = actual.adminClosedLogDetail(value, value.logs[0], catalog, 'en'), event = result.sections[0], progress = result.sections.at(-1);
  assert.equal(event.title, 'Event details'); assert.equal(event.fields.find(field => field.label === 'Event').value, 'Boshladi');
  assert.equal(event.fields.find(field => field.label === 'Performed by').value, 'Ana'); assert.equal(progress.title, 'Progress information');
  assert.deepEqual(progress.batches[0].metrics, ['Produced: 12.5 kg']); assert.equal(progress.batches[0].qr.copyLabel, 'Copy');
});
