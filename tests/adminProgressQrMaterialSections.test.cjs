const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminProgressQrMaterialSectionsSupport.cjs');
const p = (key, values) => values ? `${key}:${JSON.stringify(values)}` : key;
test('actual Source Dart VM function oracle preserves all57 QR description/status/Unicode cases', () => {
  const oracle = require('./fixtures/adminProgressQrDescriptions.oracle.json'); assert.equal(oracle.cases.length, 57);
  for (const row of oracle.cases) assert.equal(s.projection.adminProgressQrStateDescription(row.input, key => `localized:${key}`), row.description, row.input);
});
test('QR-specific lowercase matches actual Dart VM mapping for every valid Unicode scalar without JS Unicode casing', () => {
  const oracle = require('./fixtures/adminProgressQrDescriptions.oracle.json'), mappings = new Map(oracle.lower_scalar_mappings); assert.equal(mappings.size, 1023);
  for (let scalar = 0; scalar <= 0x10ffff; scalar++) {
    if (scalar >= 0xd800 && scalar <= 0xdfff) continue;
    assert.equal(s.lower.adminProgressQrSourceLowercase(String.fromCodePoint(scalar)), String.fromCodePoint(mappings.get(scalar) ?? scalar), scalar.toString(16));
  }
  assert.equal(s.lower.adminProgressQrSourceLowercase('\ud800A\udfff'), '\ud800a\udfff');
});
test('Source material status sentences keep exact order, trim inputs, quantity and production interpolation keys', () => {
  const section = s.projection.adminProgressQrMaterialStatusSection(s.report({ item_name: ' \u0085 Name ', item_group: ' Group ', warehouse: ' Warehouse ', qty: -1.25, uom: ' kg ', status: ' in_use ' }), ' paused ', p);
  assert.equal(section.title, 'worker.qr.report.material_status');
  assert.deepEqual(section.lines, ['worker.qr.material.recorded:{"name":"Name","quantity":"-1.25 kg"}', 'worker.qr.material.group:{"group":"Group"}', 'worker.qr.material.warehouse:{"warehouse":"Warehouse"}', 'worker.qr.material.status_in_use', 'worker.qr.material.queue_state:{"state":"worker.qr.state.paused"}']);
  assert.ok(Object.isFrozen(section) && Object.isFrozen(section.lines));
});
test('Source material name falls back to code then literal Homashyo, and only actual Dart-blank lines disappear', () => {
  for (const [fields, name] of [[{ item_name: '\u0085', item_code: ' Code ' }, 'Code'], [{ item_name: ' ', item_code: '\u0085' }, 'Homashyo']]) {
    const section = s.projection.adminProgressQrMaterialStatusSection(s.report({ ...fields, warehouse: '\u0085', item_group: '', status: ' \u0085 ' }), ' \u0085 ', p);
    assert.deepEqual(section.lines, [p('worker.qr.material.recorded', { name, quantity: '2.5 kg' })]);
  }
  const section = s.projection.adminProgressQrMaterialStatusSection(s.report(), 'pending', (key, values) => key === 'worker.qr.material.group' ? '\u0085' : p(key, values));
  assert.equal(section.lines.some(line => line.includes('material.group')), false);
});
test('status sentence is case-sensitive; generic status and unknown queue fallback use Source Dart lowercase', () => {
  for (const status of ['available', 'in_use', 'consumed', 'reserved']) assert.equal(s.projection.adminProgressQrMaterialStatusSentence(` ${status} `, p), `worker.qr.material.status_${status}`);
  assert.equal(s.projection.adminProgressQrMaterialStatusSentence(' AVAILABLE ', p), p('worker.qr.material.status_generic', { status: ' available ' }));
  assert.equal(s.projection.adminProgressQrMaterialStatusSentence('İΣ', p), p('worker.qr.material.status_generic', { status: 'iσ' }));
  assert.equal(s.projection.adminProgressQrStateDescription(' İΣ ', p), ' iσ '); assert.equal(s.projection.adminProgressQrStateDescription(' FROZEN ', p), ' frozen ');
});
test('queue description uses its own Source dictionary including stopped and accepted stock, not queue headline labels', () => {
  const groups = { started: ['start'], paused: ['pause', 'paused'], roll_removed: ['detach_roll', 'roll_detached'], resumed: ['resume'], completed: ['complete', 'completed'], waiting_start: ['pending', 'waiting'],
    in_progress: ['in_progress', 'in_use', 'active'], stopped: ['stopped', 'cancelled'], used_next: ['processed', 'consumed_by_next_stage'], waiting_stock: ['free_wip', 'finished_pending_acceptance'], waiting_next: ['waiting_next_stage'] };
  for (const [suffix, states] of Object.entries(groups)) for (const state of states) assert.equal(s.projection.adminProgressQrStateDescription(` \u0085 ${state} `, p), `worker.qr.state.${suffix}`);
  assert.equal(s.projection.adminProgressQrStateDescription('accepted_to_stock', p), 'worker.qr.status.accepted_stock');
});
test('unassigned Source material shows one sentence and never reads machine names', () => {
  const section = s.projection.adminProgressQrMaterialAssignmentSection({ assignment: null, orderTitle: '', orderNumber: '', queueState: 'pending', apparatusNamesById: { get() { throw Error('must not read'); } }, p });
  assert.equal(section.title, 'worker.qr.report.where_used'); assert.deepEqual(section.lines, ['worker.qr.material.unassigned']);
});
test('assignment Source numbered order, canonical name, generic purpose, queue, actor and raw time stay in exact order', () => {
  const section = s.projection.adminProgressQrMaterialAssignmentSection({ assignment: { order_id: ' FALLBACK ', apparatus: ' machine ', assigned_by_name: ' Actor ', assigned_at: ' raw date ' }, orderTitle: ' Title ', orderNumber: ' Number ', queueState: 'completed', apparatusNamesById: new Map([['machine', ' Canonical ']]), p });
  assert.deepEqual(section.lines, [p('worker.qr.material.assigned_order_number', { number: 'Number', order: 'Title' }), p('worker.qr.material.assigned_apparatus', { apparatus: 'Canonical' }), 'worker.qr.apparatus.purpose.next', p('worker.qr.material.queue_state', { state: 'worker.qr.state.completed' }), p('worker.qr.material.assigned_by', { name: 'Actor' }), p('worker.qr.material.assigned_at', { time: 'raw date' })]);
  assert.ok(Object.isFrozen(section.lines));
});
test('assignment blank title/number/machine/actor/time retains Source fallbacks without inventing machine purpose', () => {
  let reads = 0;
  const section = s.projection.adminProgressQrMaterialAssignmentSection({ assignment: { order_id: ' ID ', apparatus: '\u0085', assigned_by_name: '', assigned_at: '\u0085' }, orderTitle: ' ', orderNumber: '\u0085', queueState: '', apparatusNamesById: { get() { reads++; return 'Wrong'; } }, p });
  assert.equal(reads, 0); assert.deepEqual(section.lines, [p('worker.qr.material.assigned_order', { order: 'ID' }), p('worker.qr.material.assigned_apparatus', { apparatus: '' }), 'worker.qr.apparatus.purpose.next']);
});
for (const platform of ['android', 'ios']) {
  test(`${platform}: real shared native card draws Source sentence order with selectable native text and no commands`, () => {
    for (const kind of ['status', 'assignment']) {
      const f = s.fixture(platform, kind), tree = f.render(), selected = s.nodes(tree, n => platform === 'android' ? n.type === 'NativeText' && n.props.selectable : n.type === 'Text' && n.props.modifiers?.some(m => m.name === 'textSelection' && m.args[0] === true));
      assert.equal(selected.length, kind === 'status' ? 5 : 1); assert.equal(s.nodes(tree, n => n.props.onClick || n.props.onPress).length, 0);
      if (platform === 'android') { assert.equal(s.nodes(tree, n => n.type === 'Surface' && n.props.shape?.type === 'CircleShape' && n.props.color === s.colors.primary && n.props.modifiers.some(m => m.name === 'size' && m.args[0] === 7 && m.args[1] === 7)).length, selected.length); assert.ok(selected.every(n => n.props.style.lineHeight === 21.6 && n.props.style.letterSpacing === .5 && n.props.style.fontSize === 16)); }
      else assert.equal(s.nodes(tree, n => n.type === 'Image' && n.props.systemName === 'circle.fill' && n.props.modifiers.some(m => m.name === 'accessibilityHidden')).length, selected.length);
      for (const locale of ['ru', 'ur-PK']) { f.props.p = (key, values) => s.l10n.productionText(key, locale, values); assert.ok(f.render()); }
    }
  });
  test(`${platform}: original authority remains captured through projection; retired or asynchronous report renders nothing`, () => {
    for (const kind of ['status', 'assignment']) {
      const f = s.fixture(platform, kind); f.current(() => false); assert.equal(f.render(), null); f.current(() => Promise.reject(Error('async original'))); assert.equal(f.render(), null);
      let current = true; f.props.isCurrent = () => current; f.props.p = key => { current = false; f.props.isCurrent = () => true; return key; }; assert.equal(f.render(), null);
    }
  });
}
