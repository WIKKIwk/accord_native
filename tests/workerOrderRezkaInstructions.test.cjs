const assert = require('node:assert/strict'), test = require('node:test');
const { harness, nodes, main, api, instructions } = require('./support/workerOrderScreen.cjs');
const station = 'apparatus:default:bosma_8';
const node = (id, other = {}) => ({ id, kind: 'apparatus', apparatus_id: station, ...other });
const map = (nodes, edges = []) => ({ nodes, edges });
test('authoritative cut output groups override node defaults, preserving roll/part/total order', () => {
  const p = harness('ios').p, definition = map([node('stage', { rezka_frame_groups: [5, 6], rezka_kadr_count: 7, rezka_label_length: 3 })]);
  assert.deepEqual(instructions.workerOrderRezkaInstructions(definition, station, 'stage', [2, 3], p), [
    p('worker.split.summary', { count: 2 }), p('worker.split.part', { index: 1, frames: 2 }), p('worker.split.part', { index: 2, frames: 3 }), p('worker.split.total', { frames: 5 })]);
  assert.deepEqual(instructions.workerOrderRezkaInstructions(definition, station, 'stage', [], p).at(-1), p('worker.split.total', { frames: 11 }));
});
for (const locale of ['uz', 'en', 'ru', 'ur']) test(`${locale}: legacy frame count, QR instructions and label length preserve V2 wording`, () => {
  const p = harness('ios', {}, locale).p;
  assert.deepEqual(instructions.workerOrderRezkaInstructions(map([node('stage', { rezka_kadr_count: 3, rezka_label_length: 12.5 })]), station, 'stage', [], p), [
    p('worker.split.rolls', { frames: 3 }), p('worker.split.qr'), p('worker.split.same'), p('worker.split.label_length', { length: '12.5' })]);
  assert.deepEqual(instructions.workerOrderRezkaInstructions(map([node('stage')]), station, 'stage', [], p), []);
});
test('explicit stage occurrence wins; alternative assignment and the display path select the V2 fallback', () => {
  const p = harness('ios').p;
  const first = node('earlier', { rezka_frame_groups: [1] }), second = node('later', { rezka_frame_groups: [4] });
  assert.equal(instructions.workerOrderRezkaInstructions(map([first, second]), station, 'later', [], p).at(-1), p('worker.split.total', { frames: 4 }));
  const alternative = node('alt', { apparatus_id: 'apparatus:default:other', alternative_assigned_apparatus_id: station, rezka_kadr_count: 2 });
  assert.equal(instructions.workerOrderRezkaInstructions(map([alternative]), station, '', [], p)[0], p('worker.split.rolls', { frames: 2 }));
  alternative.alternative_group_id = 'group';
  assert.deepEqual(instructions.workerOrderRezkaInstructions(map([alternative]), station, '', [], p), []);
  assert.deepEqual(instructions.workerOrderRezkaInstructions(map([first]), '', 'earlier', [], p), []);
});
test('display successor honors first alternative group before a later group, as V2 does', () => {
  const start = { id: 'start', kind: 'start' };
  const a = node('a', { alternative_group_id: 'A', apparatus_id: 'apparatus:default:a', alternative_assigned_apparatus_id: 'apparatus:default:c' });
  const b = node('b', { alternative_group_id: 'B', apparatus_id: 'apparatus:default:b', alternative_assigned_apparatus_id: 'apparatus:default:b' });
  const c = node('c', { alternative_group_id: 'A', apparatus_id: 'apparatus:default:c' });
  assert.deepEqual(api.orderDisplayPath(map([start, a, b, c], ['a', 'b', 'c'].map(to => ({ from: 'start', to })))).map(node => node.id), ['start', 'c']);
});
for (const platform of ['ios', 'android']) test(`${platform}: cut instructions are before merge state and retained only for display while stale`, () => {
  const h = harness(platform, { apparatus: { operation: 'cut' }, control: { allowed_actions: ['pause', 'merge', 'complete'],
    rezka_output_kadr_counts: [2], rezka_input_lineage: [{ input_batch_id: 'a', sequence_no: 1, status: 'processed' }, { input_batch_id: 'b', sequence_no: 2, status: 'in_use' }] },
    interaction: { mode: 'in_progress', blocking_reason_code: '', material_intake_allowed: false } });
  h.values.set('detail', { epoch: 'epoch', maps: [{ map: { id: '0198', nodes: [node('stage')], edges: [] } }] });
  const text = tree => nodes(main(tree), node => node.type === 'Text').map(node => node.props.children).flat();
  const before = text(h.render());
  assert.ok(before.indexOf(h.p('worker.map.cutting')) < before.indexOf(h.p('worker.merge_state.title')));
  assert.ok(before.includes(h.p('worker.split.total', { frames: 2 })));
  h.setFresh(false); h.values.set('bootstrap', null);
  assert.ok(text(h.render()).includes(h.p('worker.split.total', { frames: 2 })));
});
