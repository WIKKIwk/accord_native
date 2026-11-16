const assert = require('node:assert/strict');
const test = require('node:test');
const s = require('./adminProgressQrReportSupport.cjs');

test('legacy entire-order rows never become verified roll history or an inferred current batch', () => {
  const value = s.decode({ progress_batches: [s.batch('other-order-roll')], current_batch: s.batch('legacy-current'), current_batches: [s.batch('one')] });
  assert.equal(s.report.adminProgressQrHasScopedHistory(value), false);
  const history = s.report.adminProgressQrHistoryBatches(value);
  assert.equal(history.length, 1); assert.equal(history[0], value.scanned_batch); assert.equal(history[0].batch_id, 'scanned');
  assert.equal(s.report.adminProgressQrHistoryCurrentBatch(value), null);
  assert.equal(value.current_batch.batch_id, 'legacy-current'); assert.equal(value.progress_batches[0].batch_id, 'other-order-roll');
});
test('exact scoped history keeps source order and duplicates even if lineage_complete is false; current requires exactly one', () => {
  const value = s.decode({ history_scope: '\u0085 batch_lineage \u0085', lineage_complete: false,
    progress_batches: [s.batch('B'), s.batch('A'), s.batch('B')], current_batches: [null, s.batch('current'), false] });
  assert.equal(s.report.adminProgressQrHasScopedHistory(value), true); assert.equal(value.lineage_complete, false);
  assert.equal(s.report.adminProgressQrHistoryBatches(value), value.progress_batches);
  assert.deepEqual(value.progress_batches.map(row => row.batch_id), ['B', 'A', 'B']);
  assert.equal(s.report.adminProgressQrHistoryCurrentBatch(value), value.current_batches[0]);
  for (const current_batches of [[], [s.batch('A'), s.batch('B')]]) assert.equal(s.report.adminProgressQrHistoryCurrentBatch(s.decode({ history_scope: 'batch_lineage', current_batches })), null);
  assert.equal(s.report.adminProgressQrHasScopedHistory(s.decode({ history_scope: 'BATCH_LINEAGE' })), false);
});
test('missing or non-map scanned batch is the exact source API exception while a malformed top object remains a type error', () => {
  for (const scanned_batch of [undefined, null, [], 'raw', 4]) assert.throws(() => s.decode({ scanned_batch }), error => error instanceof s.exception.MobileApiException && error.code === 'progress_batch_not_found' && error.message === 'Progress QR topilmadi' && error.statusCode === null);
  assert.throws(() => s.report.adminProgressQrReportFromJson(null), TypeError);
});
test('actual canonical batch, order, queue, log and run parsers reject invalid source payloads rather than retain raw objects', () => {
  for (const fields of [
    { scanned_batch: s.batch('bad', { apparatus: 'legacy-label' }) },
    { order: { title: 12 } },
    { queue_states: { 'legacy-label': { order: 'pending' } } },
    { logs: [{ apparatus: 'legacy-label' }] },
    { run_sessions: [{ apparatus: 'legacy-label' }] },
  ]) assert.throws(() => s.decode(fields));
  const value = s.decode({ order: { id: 'order', title: 'Product' }, queue_states: { [s.apparatus]: { order: 'pending' } },
    logs: [{ apparatus: s.apparatus, event_id: 'event' }], run_sessions: [{ apparatus: s.apparatus, session_id: 'run' }] });
  assert.equal(value.order.id, 'order'); assert.deepEqual(value.order.products, []); assert.equal(value.logs[0].event_id, 'event'); assert.equal(value.run_sessions[0].session_id, 'run');
});
test('source strict lists reject malformed rows while optional lineage/current/resource map-only rows are filtered', () => {
  for (const key of ['logs', 'corrections', 'progress_batches', 'run_sessions', 'active_sessions', 'lineage_edges', 'current_batches', 'session_resources']) {
    assert.throws(() => s.decode({ [key]: {} }), TypeError);
    assert.doesNotThrow(() => s.decode({ [key]: null }));
  }
  for (const key of ['logs', 'corrections', 'progress_batches', 'run_sessions', 'active_sessions']) assert.throws(() => s.decode({ [key]: [null] }), TypeError);
  const value = s.decode({ lineage_edges: [null, 'bad', { parent_batch_id: ' P ', child_batch_id: ' C ' }], session_resources: [false, { session_id: ' R ' }], current_batches: [9, s.batch('valid')] });
  assert.deepEqual(value.lineage_edges, [{ parent_batch_id: 'P', child_batch_id: 'C' }]); assert.equal(value.session_resources[0].session_id, 'R'); assert.equal(value.current_batches[0].batch_id, 'valid');
});
test('correction actor ref precedence and map copies keep Dart collection strings, nullable defaults and signed num truncation', () => {
  const old = { nested: { qty: 4 } }, row = s.records.adminProgressQrCorrectionFromJson({ batch_id: ['A', 3], previous_revision: -2.9, new_revision: 4.9,
    actor: { role: ['R'], ref_: '', ref: 'fallback', display_name: { name: 'Actor' } }, old_values: old, new_values: [], created_at_unix: 12.9 });
  assert.equal(row.batch_id, '[A, 3]'); assert.equal(row.actor_role, '[R]'); assert.equal(row.actor_ref, ''); assert.equal(row.actor_display_name, '{name: Actor}');
  assert.equal(row.previous_revision, -2); assert.equal(row.new_revision, 4); assert.equal(row.created_at_unix, 12);
  assert.notEqual(row.old_values, old); assert.equal(row.old_values.nested, old.nested); assert.deepEqual(row.new_values, {});
  assert.equal(s.records.adminProgressQrCorrectionFromJson({ actor: { ref_: null, ref: 'fallback' } }).actor_ref, 'fallback');
  for (const invalid of ['1', true, Infinity]) assert.throws(() => s.records.adminProgressQrOpenedByFromJson({ opened_at_unix: invalid }), TypeError);
});
test('resources use literal true availability, retain duplicates and trim only source string codes/material text', () => {
  const value = s.records.adminProgressQrSessionResourcesFromJson({ session_id: '\u0085 session \u0085', raw_materials_available: 'true', qolip_available: 1,
    raw_materials: [null, { barcode: '\u0085 BC \u0085', item_code: ['C', 'D'], item_name: { label: 'Name' } }], qolip_codes: [' M ', 4, null, '\u0085', ' M '] });
  assert.equal(value.session_id, 'session'); assert.equal(value.raw_materials_available, false); assert.equal(value.qolip_available, false);
  assert.deepEqual(value.raw_materials, [{ barcode: 'BC', item_code: '[C, D]', item_name: '{label: Name}' }]); assert.deepEqual(value.qolip_codes, ['M', 'M']);
  assert.throws(() => s.records.adminProgressQrSessionResourcesFromJson({ qolip_codes: 'M' }), TypeError);
});
test('opened metadata and report defaults preserve raw source text, optional map checks and exact bool semantics', () => {
  const value = s.decode({ is_stale: 1, stale_reason: ['old', 'roll'], lineage_complete: 'true', current_batch: [], order: 'raw', opened_by: { actor_ref: ' Ref ', opened_at_unix: -1.9 } });
  assert.equal(value.is_stale, false); assert.equal(value.lineage_complete, false); assert.equal(value.stale_reason, '[old, roll]');
  assert.equal(value.current_batch, null); assert.equal(value.order, null); assert.equal(value.opened_by.actor_ref, ' Ref '); assert.equal(value.opened_by.opened_at_unix, -1);
  assert.deepEqual(value.logs, []); assert.deepEqual(value.corrections, []); assert.deepEqual(value.session_resources, []);
});
