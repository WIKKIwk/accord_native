// Source-derived from f11910bb WorkerWipDetails, _PaddonWipCard and
// worker_wip_details_test.dart. No Dart, backend, printer or device is used.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}
const progress = load('workerProgressModel.ts'), display = load('rezka/rezkaPaddonDisplay.ts');
const model = load('rezka/rezkaPaddonWipModel.ts', { '../workerProgressModel': progress, './rezkaPaddonDisplay': display });
const parser = load('workerProgressBatch.ts', { './workerProgressModel': progress,
  './workerControlsApi': { isCanonicalApparatusId: value => /^apparatus:[^:]+:.+/.test(value), WorkerControlException: class extends Error {} } });
const paddonModels = load('paddonModels.ts', { './workerProgressBatch': parser });
const { productionText } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const t = key => productionText(key, 'uz'), machine = { id: 'apparatus:default:asset-010', name: 'Rezka' };
const base = changes => ({ order_id: 'zakaz-0038', label_item_name: 'Old label', payload_json: { order_title: 'Bosma paket', gross_qty: 211.675 },
  apparatus: machine.id, current_apparatus: '', current_location: '', next_apparatus: '', worker_ref: 'workerispdaduio0242304203480239',
  worker_display_name: 'Akmal Rahimov', executor_name: 'workerispdaduio0242304203480239', produced_qty: 8787, uom: 'm',
  finished_goods_kg: 200, finished_goods_meter: null, bobina_kg: 1.125, wip_status: '', status: 'completed', action: 'complete',
  status_detail: { flow_status: '', work_status: 'completed', wip_status: '', stock_status: '' }, completed_at_unix: 0, started_at_unix: 0,
  diameter: null, description: '', qr_payload: '400000000000000000000001', ...changes });
const render = (changes = {}, catalog = [machine], viewer = null) => model.rezkaPaddonWipContent(base(changes), catalog, viewer, t);
const row = (content, key) => content.rows.find(value => value.key === key)?.value;

test('selected source example retains order, measured gross/net, producer, machine and grouped EPC', () => {
  const content = render();
  assert.equal(content.order, `${t('worker.paddon.order')}: 0038 - Bosma paket`);
  assert.equal(row(content, 'worker.wip.info.quantity'), '8 787 m');
  assert.equal(row(content, 'worker.wip.info.gross_weight'), '211.675 kg');
  assert.equal(row(content, 'worker.wip.info.net_weight'), '210.55 kg');
  assert.equal(row(content, 'worker.qr.passport.bobbin_weight'), '1.125 kg');
  assert.equal(row(content, 'worker.wip.info.produced_by'), 'Akmal Rahimov');
  assert.equal(row(content, 'worker.wip.info.source'), 'Rezka');
  assert.equal(row(content, 'worker.wip.info.epc'), '4000 0000 0000 0000 0000 0001');
  assert.equal(content.rows.at(-1).isEpc, true);
  assert.ok(!JSON.stringify(content).includes('workerispdaduio0242304203480239'));
});
test('the existing Paddon snapshot and batch decoders feed the passive projection without mutation', () => {
  const raw = base({ batch_id: 'batch-1' }), snapshot = paddonModels.paddonSnapshotFromJson({ paddon: { code: 'P1' }, items: [raw] });
  const before = JSON.stringify(snapshot), content = model.rezkaPaddonWipContent(snapshot.items[0], [machine], null, t);
  assert.equal(row(content, 'worker.wip.info.gross_weight'), '211.675 kg');
  assert.equal(row(content, 'worker.wip.info.net_weight'), '210.55 kg');
  assert.equal(row(content, 'worker.wip.info.source'), 'Rezka'); assert.equal(JSON.stringify(snapshot), before);
});
test('include-core mode uses measured gross as net, even with an unknown core', () => {
  for (const bobina of [null, 1.125]) {
    const content = render({ payload_json: { gross_qty: 211.675, include_bobina_in_net: true }, bobina_kg: bobina });
    assert.equal(row(content, 'worker.wip.info.net_weight'), '211.675 kg');
  }
});
test('missing, excessive and zero core follow source net rules and gross fallback', () => {
  for (const [bobina, expected] of [[null, 'Kiritilmagan'], [250, 'Kiritilmagan'], [0, '200 kg']]) {
    const content = render({ payload_json: {}, bobina_kg: bobina });
    assert.equal(row(content, 'worker.wip.info.gross_weight'), '200 kg'); assert.equal(row(content, 'worker.wip.info.net_weight'), expected);
  }
  assert.equal(row(render({ payload_json: { gross_qty: 'not numeric' } }), 'worker.wip.info.gross_weight'), 'Kiritilmagan');
  assert.equal(row(render({ payload_json: { gross_qty: 0.0000004 } }), 'worker.wip.info.gross_weight'), 'Kiritilmagan');
});
test('length and diameter appear only under the source conditions', () => {
  const content = render({ produced_qty: 12, uom: 'kg', finished_goods_meter: 1450, diameter: 35 });
  assert.equal(row(content, 'worker.wip.info.quantity'), '12 kg'); assert.equal(row(content, 'worker.daily.field.length'), '1 450 m');
  assert.equal(row(content, 'worker.qr.passport.diameter'), '35');
  assert.equal(row(render({ produced_qty: 0, uom: '', finished_goods_meter: 1450 }), 'worker.wip.info.quantity'), '1 450 m');
  assert.equal(row(render({ produced_qty: 1450, uom: ' M ', finished_goods_meter: 1450 }), 'worker.daily.field.length'), undefined);
});
test('internal producer identifiers are hidden and the matching viewer may supply a name', () => {
  const ref = 'workerispdaduio0242304203480239';
  const hidden = { worker_ref: ref, worker_display_name: ref, executor_name: ref };
  assert.equal(row(render(hidden), 'worker.wip.info.produced_by'), t('worker.qr.history.worker_missing'));
  assert.equal(row(render(hidden, [machine], { ref, display_name: 'Sardor Karimov' }), 'worker.wip.info.produced_by'), 'Sardor Karimov');
  for (const name of ['worker_123', 'user123456', 'system-user:one', 'abcdef0123456789abcdef01', '01234567-89ab-cdef-0123-456789abcdef']) {
    assert.equal(row(render({ worker_display_name: name, executor_name: '' }), 'worker.wip.info.produced_by'), t('worker.qr.history.worker_missing'));
  }
});
test('machine labels reject raw canonical IDs, preserve candidate order and let the last catalog duplicate win', () => {
  const duplicate = [{ id: machine.id, name: 'Old' }, { id: machine.id, name: 'Newest' }, { id: 'next', name: 'Next' }];
  const content = render({ current_apparatus: 'apparatus:missing', current_location: '2-qator', next_apparatus: 'next' }, duplicate);
  assert.equal(row(content, 'worker.wip.info.source'), 'Newest'); assert.equal(row(content, 'worker.wip.info.location'), '2-qator');
  assert.equal(row(content, 'worker.wip.info.next_machine'), 'Next');
  assert.equal(row(render({}, []), 'worker.wip.info.source'), t('worker.qr.history.machine_missing'));
  assert.equal(row(render({ current_apparatus: machine.id }, [machine]), 'worker.wip.info.location'), undefined);
});
test('all flow and fallback statuses resolve to the source localization keys', () => {
  const mapping = { free_wip: 'worker.wip.status.free', accepted_to_stock: 'worker.wip.status.accepted', waiting_next_stage: 'worker.wip.status.waiting_next',
    consumed_by_next_stage: 'worker.wip.status.consumed_next', in_progress: 'worker.wip.status.in_progress' };
  for (const [flow, key] of Object.entries(mapping)) assert.equal(row(render({ status_detail: { flow_status: flow } }), 'worker.daily.status'), t(key));
  for (const [wip, key] of [['waiting', 'worker.wip.status.waiting'], ['in_use', 'worker.wip.status.in_progress'], ['processed', 'worker.wip.status.used']])
    assert.equal(row(render({ wip_status: wip, status_detail: {} }), 'worker.daily.status'), t(key));
  for (const [work, key] of [['paused', 'worker.wip.status.paused'], ['resumed', 'worker.wip.status.in_progress'], ['completed', 'worker.wip.status.finished'], ['', 'worker.daily.wip']])
    assert.equal(row(render({ status: '', status_detail: { work_status: work } }), 'worker.daily.status'), t(key));
});
test('EPC, notes, local timestamps and Peremotka follow the source branching', () => {
  const old = process.env.TZ; process.env.TZ = 'UTC';
  try {
    const content = render({ qr_payload: ' abcdef0123456789abcdef01 ', description: ' note ', wip_status: 'peremotka', completed_at_unix: 1700000000, started_at_unix: 1600000000 });
    assert.equal(row(content, 'worker.wip.info.epc'), 'ABCD EF01 2345 6789 ABCD EF01'); assert.equal(row(content, 'worker.wip.info.note'), 'note');
    assert.equal(row(content, 'worker.wip.info.finished'), '14.11.2023 22:13'); assert.equal(row(content, 'worker.wip.info.started'), undefined);
    assert.equal(content.peremotka, t('worker.rezka.print.peremotka'));
    assert.equal(row(render({ qr_payload: '' }), 'worker.wip.info.epc'), '—');
    assert.equal(row(render({ qr_payload: 'raw-code' }), 'worker.wip.info.epc'), 'raw-code');
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test('all four locale paths resolve real catalog keys; unsafe weight precision is not misreported', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const content = model.rezkaPaddonWipContent(base({}), [machine], null, key => {
      const value = productionText(key, locale); assert.notEqual(value, key, `${locale}:${key}`); return value;
    });
    assert.equal(content.rows.length, 8);
  }
  assert.throws(() => render({ payload_json: { gross_qty: 1e10 } }), RangeError);
});
