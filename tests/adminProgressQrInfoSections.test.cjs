const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminProgressQrInfoSectionsSupport.cjs');
const p = key => `localized:${key}`;
test('Source order section uses exact eight-field order, keys, raw strings and existing Dart numeric policy without units', () => {
  const section = s.projection.adminProgressQrOrderDetails(s.order({ order_number: ' ORDER ', roll_count: -0, width_mm: -.125, order_kg: 9223372036854775808, base_length: NaN }), p);
  assert.equal(section.title, p('worker.qr.report.product_order'));
  assert.deepEqual(section.rows.map(row => row.id), ['order-number', 'product', 'product-code', 'customer', 'roll-count', 'width', 'planned-weight', 'planned-length']);
  assert.deepEqual(section.rows.map(row => row.label), ['order_number', 'product', 'product_code', 'customer', 'roll_count', 'width', 'planned_weight', 'planned_length'].map(key => p(`worker.qr.report.${key}`)));
  assert.deepEqual(section.rows.map(row => row.value), [' ORDER ', 'PRODUCT', 'CODE', 'CUSTOMER', '0', '-0.125', '9223372036854775807', 'NaN']);
  assert.ok(Object.isFrozen(section) && Object.isFrozen(section.rows) && section.rows.every(Object.isFrozen));
});
test('null order disappears while nonnull all-empty order retains its titled card and Dart-blank rows disappear', () => {
  assert.equal(s.projection.adminProgressQrOrderDetails(null, p), null);
  const section = s.projection.adminProgressQrOrderDetails(s.order({ order_number: ' \u0085 ', title: '\u0085', product_code: '', customer_name: ' ', roll_count: null, width_mm: null, order_kg: null, base_length: null }), p);
  assert.equal(section.rows.length, 0); assert.equal(section.title, p('worker.qr.report.product_order'));
  assert.throws(() => s.projection.adminProgressQrOrderDetails(s.order({ width_mm: Infinity }), p), RangeError);
});
test('queue preserves outer and inner original Map insertion order including integer-like keys and untouched order labels', () => {
  const queue = new Map([[' machine-z ', new Map([['10', 'pending'], ['2', 'paused']])], ['machine-a', new Map([[' 1 ', ' custom ']])]]);
  const section = s.projection.adminProgressQrQueueStates(queue, new Map([['machine-z', ' Canonical Z ']]), p);
  assert.deepEqual(section.rows.map(row => row.label), ['Canonical Z • 10', 'Canonical Z • 2', 'machine-a •  1 ']);
  assert.deepEqual(section.rows.map(row => row.value), [p('worker.qr.status.waiting_start'), p('worker.qr.status.paused'), ' custom ']);
  assert.equal(section.title, p('worker.qr.report.queue_status')); assert.ok(Object.isFrozen(section) && Object.isFrozen(section.rows) && section.rows.every(Object.isFrozen));
});
test('queue leaf retains empty card, skips only Dart-blank state and avoids catalog reads for empty machine id', () => {
  for (const queue of [new Map(), new Map([['machine', new Map()]])]) assert.equal(s.projection.adminProgressQrQueueStates(queue, new Map(), p).rows.length, 0);
  let reads = 0;
  const section = s.projection.adminProgressQrQueueStates(new Map([[' \u0085 ', new Map([['RAW ORDER', 'unknown']])], ['machine', new Map([['blank', ' \u0085 '], ['visible', 'frozen']])]]), { get() { reads++; return ' \u0085 '; } }, p);
  assert.equal(reads, 2); assert.deepEqual(section.rows.map(row => row.label), [' • RAW ORDER', 'machine • visible']); assert.deepEqual(section.rows.map(row => row.value), ['unknown', 'frozen']);
});
test('QR queue labels use exact Source state dictionary, trimmed case-sensitive matching and untouched unknown states', () => {
  const groups = { 'worker.qr.status.started': ['start'], 'worker.action.pause': ['pause'], 'worker.qr.status.roll_removed': ['detach_roll', 'roll_detached'], 'worker.qr.status.resumed': ['resume'], 'worker.qr.status.finished': ['complete'],
    'worker.qr.status.waiting_start': ['pending'], 'worker.qr.status.in_progress': ['in_progress', 'active', 'in_use'], 'worker.qr.status.paused': ['paused'], 'worker.qr.status.completed': ['completed'], 'worker.qr.status.waiting_work': ['waiting'],
    'worker.qr.status.used': ['processed', 'consumed_by_next_stage'], 'worker.qr.status.waiting_stock': ['free_wip', 'finished_pending_acceptance'], 'worker.qr.status.accepted_stock': ['accepted_to_stock'], 'worker.qr.status.waiting_next': ['waiting_next_stage'] };
  for (const [key, states] of Object.entries(groups)) for (const state of states) assert.equal(s.projection.adminProgressQrQueueStateLabel(` \u0085 ${state} `, p), p(key));
  for (const state of [' PENDING ', ' print_preflight ', ' frozen ', 'constructor', '__proto__']) assert.equal(s.projection.adminProgressQrQueueStateLabel(state, p), state);
});
test('projection cannot replace its original authority from inside localization callbacks', () => {
  for (const kind of ['order', 'queue']) {
    let active = true;
    const props = { order: s.order(), queueStates: new Map([['machine', new Map([['ORDER', 'pending']])]]), apparatusNamesById: new Map(), isCurrent: () => active,
      p: key => { active = false; props.isCurrent = () => true; return p(key); } };
    assert.equal(kind === 'order' ? s.model.adminProgressQrOrderDetailsModel(props) : s.model.adminProgressQrQueueStatesModel(props), null);
  }
});
for (const platform of ['android', 'ios']) {
  test(`${platform}: actual native order/queue sections retain all rows, native value selection and read-only card semantics`, () => {
    for (const kind of ['order', 'queue']) {
      const f = s.fixture(platform, kind), tree = f.render(); assert.ok(s.values(tree).includes(kind === 'order' ? 'ORDER' : s.l10n.productionText('worker.qr.status.waiting_start', 'uz')));
      assert.equal(s.nodes(tree, n => n.props.onClick || n.props.onPress || n.type === 'DisclosureGroup').length, 0);
      const selected = s.nodes(tree, n => platform === 'android' ? n.type === 'NativeText' && n.props.selectable : n.type === 'Text' && n.props.modifiers?.some(m => m.name === 'textSelection' && m.args[0] === true));
      assert.equal(selected.length, kind === 'order' ? 8 : 1);
      f.props.p = key => s.l10n.productionText(key, 'ru'); assert.ok(f.render());
    }
  });
  test(`${platform}: missing order is absent, empty queues remain cards, and retired/async original authority holds projection`, () => {
    const f = s.fixture(platform); f.props.order = null; assert.equal(f.render(), null);
    const queue = s.fixture(platform, 'queue'); queue.props.queueStates = new Map(); assert.ok(queue.render());
    queue.current(() => false); assert.equal(queue.render(), null); queue.current(() => Promise.reject(Error('async original'))); assert.equal(queue.render(), null);
    const race = s.fixture(platform); let active = true; race.current(() => active); race.props.p = key => { active = false; return p(key); }; assert.equal(race.render(), null);
  });
}
test('Android native card keeps Source card/row metrics and constrains long selectable values to parent width', () => {
  const f = s.fixture('android'); f.props.order.title = 'a long product '.repeat(100); const tree = f.render(), surface = s.nodes(tree, n => n.type === 'Surface')[0];
  assert.equal(tree.props.style.marginBottom, 12); assert.equal(surface.props.color, s.colors.surfaceContainerHighest); assert.equal(surface.props.tonalElevation, 0); assert.equal(surface.props.shadowElevation, 0);
  assert.deepEqual(Object.values(surface.props.shape.cornerRadii), [12, 12, 12, 12]);
  const title = s.nodes(tree, n => n.type === 'Text' && n.props.style?.fontWeight === '900')[0]; assert.equal(title.props.style.typography, 'titleMedium'); assert.equal(title.props.style.lineHeight, 24); assert.equal(title.props.style.letterSpacing, .15);
  assert.ok(s.nodes(tree, n => n.type === 'Text' && n.props.style?.typography === 'labelLarge').every(n => n.props.style.lineHeight === 22.88 && n.props.style.letterSpacing === .1));
  const hosts = s.nodes(tree, n => n.type === 'RNHostView'); assert.equal(hosts.length, 8); assert.ok(hosts.every(n => n.props.matchContents.vertical && n.props.modifiers.some(m => m.name === 'fillMaxWidth')));
  assert.ok(s.nodes(tree, n => n.type === 'NativeText').every(n => n.props.style.fontSize === 16 && n.props.style.lineHeight === 24 && n.props.style.letterSpacing === .5 && n.props.style.fontWeight === '700'));
});
