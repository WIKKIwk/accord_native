const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load() {
  const file = path.resolve(__dirname, '../src/workerWipDetailsPresentation.ts'), mod = new Module(file, module); mod.paths = module.paths;
  mod.require = id => id === './workerProgressModel' ? { progressBatchStatusDetail: batch => batch.status_detail ?? {} }
    : id === './dailyWork' ? { dailyWorkDate: value => `date:${value}` } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file); return mod.exports;
}
const api = load(), p = key => key;
// @v2-test test/worker_wip_details_test.dart
const rows = (batch, viewer = {}) => api.workerWipDetailRows(batch, { 'apparatus:default:press': 'Bosma', 'apparatus:default:cut': 'Kesish' }, viewer, p);
test('WIP details keep source metadata order, measured gross/tare semantics, localized states and one activity date', () => {
  const batch = { produced_qty: 1200.12345, uom: 'kg', finished_goods_meter: 12345.6789, finished_goods_kg: 8, bobina_kg: 2,
    payload_json: { gross_qty: 10 }, worker_ref: 'me', executor_name: 'Worker Name', status_detail: { flow_status: 'free_wip' },
    apparatus: 'apparatus:default:press', current_apparatus: 'apparatus:default:cut', next_apparatus: 'warehouse', started_at_unix: 1, completed_at_unix: 2,
    diameter: 99.98765, description: ' note ', qr_payload: '0123456789abcdef01234567' };
  assert.deepEqual(rows(batch), [
    ['worker.wip.info.quantity', '1 200.123 kg'], ['worker.daily.field.length', '12 345.679 m'],
    ['worker.wip.info.gross_weight', '10 kg'], ['worker.wip.info.net_weight', '8 kg'], ['worker.qr.passport.bobbin_weight', '2 kg'],
    ['worker.wip.info.produced_by', 'Worker Name'], ['worker.daily.status', 'worker.wip.status.free'],
    ['worker.wip.info.source', 'Bosma'], ['worker.wip.info.location', 'Kesish'], ['worker.wip.info.next_machine', 'warehouse'],
    ['worker.wip.info.finished', 'date:2'], ['worker.qr.passport.diameter', '99.988'], ['worker.wip.info.note', 'note'],
    ['worker.wip.info.epc', '0123 4567 89AB CDEF 0123 4567'],
  ]);
  const values = Object.fromEntries(rows({ ...batch, payload_json: { gross_qty: 'bad' } }));
  assert.equal(values['worker.wip.info.gross_weight'], 'worker.paddon.bobina_unknown');
  assert.equal(values['worker.wip.info.net_weight'], 'worker.paddon.bobina_unknown');
  const net = Object.fromEntries(rows({ ...batch, payload_json: { gross_qty: 10, include_bobina_in_net: true } }));
  assert.equal(net['worker.wip.info.net_weight'], '10 kg');
});

test('WIP details hide duplicate length/location and raw technical identities without deleting mandatory unknowns', () => {
  const batch = { produced_qty: 100, uom: 'm', finished_goods_meter: 100, worker_ref: 'worker:123456', worker_display_name: 'worker:123456',
    executor_name: '0123456789abcdef01234567', apparatus: 'apparatus:unknown', current_apparatus: 'apparatus:unknown', qr_payload: '', started_at_unix: 5 };
  const actual = rows(batch), values = Object.fromEntries(actual);
  assert.equal(values['worker.wip.info.produced_by'], 'worker.qr.history.worker_missing');
  assert.equal(values['worker.wip.info.source'], 'worker.qr.history.machine_missing');
  assert.equal(values['worker.wip.info.location'], undefined); assert.equal(values['worker.daily.field.length'], undefined);
  assert.equal(values['worker.wip.info.epc'], '—'); assert.equal(values['worker.wip.info.started'], 'date:5');
  assert.equal(api.workerWipProducer(batch, { ref: 'worker:123456', display_name: 'Ali' }, p), 'Ali');
  assert.equal(api.workerWipProducer(batch, { ref: 'someone-else', display_name: 'Ali' }, p), 'worker.qr.history.worker_missing');
});

test('WIP status fallback, microkilogram rounding and display title follow the source branches', () => {
  for (const [batch, key] of [[{ wip_status: 'in_use' }, 'in_progress'], [{ wip_status: 'processed' }, 'used'], [{ status: 'paused' }, 'paused'], [{ status_detail: { work_status: 'complete' } }, 'finished']]) {
    assert.equal(api.workerWipStatusLabel(batch, p), `worker.wip.status.${key}`);
  }
  const values = Object.fromEntries(rows({ finished_goods_kg: 10.0000001, bobina_kg: 10.0000002 }));
  assert.equal(values['worker.wip.info.net_weight'], '0 kg');
  assert.equal(api.workerWipDetailsItemName({ code: '', title: '' }, { order_id: 'zakaz-0042', label_item_name: 'Film yarim tayyor mahsulot, apparat: apparatus:default:press' }, p), '0042 • Film');
  assert.equal(api.workerWipDetailsItemName({ code: '100', title: 'Explicit' }, { order_id: 'zakaz-0042', payload_json: { order_title: 'Fallback' } }, p), '100 • Explicit');
});
