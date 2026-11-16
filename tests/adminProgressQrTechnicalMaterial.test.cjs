const assert = require('node:assert/strict'), test = require('node:test'), s = require('./adminProgressQrTechnicalMaterialSupport.cjs'), oracle = require('./fixtures/adminProgressQrNumbers.oracle.json');
const p = key => `localized:${key}`;
test('actual Source Dart VM numeric oracle preserves all273 finite/nonfinite/fixed/int64 cases', () => {
  assert.equal(oracle.cases.length, 273);
  for (const row of oracle.cases) { const value = Number(row.input); assert.equal(s.projection.adminProgressQrQuantityParts(value, ''), row.quantity, row.input); if (row.error) assert.throws(() => s.projection.adminProgressQrDisplayNumber(value), RangeError); else assert.equal(s.projection.adminProgressQrDisplayNumber(value), row.display, row.input); }
});
test('current052 Source technical fields keep exact order and explicit Metalayzer row without backend work', () => {
  const value = s.report({ is_metalayzer: true, assignment: { order_id: 'ASSIGNED', apparatus: 'apparatus:default:machine', assigned_by_ref: 'REF', assigned_by_name: 'ACTOR', assigned_at: 'DATE', stock_status: 'STOCK', stock_warehouse: 'SW', stock_qty: 2, received_qty: 2.25, consumed_qty: 0, remaining_qty: .125 } });
  const rows = s.projection.adminProgressQrTechnicalMaterial(value, new Map([['apparatus:default:machine', ' Canonical name ']]), p);
  assert.deepEqual(rows.map(row => row.id), ['barcode', 'warehouse', 'item-code', 'item-name', 'item-group', 'quantity', 'status', 'metalayzer', 'receipt', 'reserved-order', 'assigned-order', 'assigned-machine', 'assigned-by-ref', 'assigned-by-name', 'assigned-at', 'stock-status', 'stock-warehouse', 'stock-quantity', 'received-quantity', 'consumed-quantity', 'remaining-quantity']);
  assert.deepEqual(rows.map(row => row.value), ['BAR', 'WAREHOUSE', 'CODE', 'NAME', 'GROUP', '2.5 kg', p('worker.qr.material.status_available'), 'Metalayzer bo‘ldi', 'RECEIPT', 'RESERVED', 'ASSIGNED', 'Canonical name', 'REF', 'ACTOR', 'DATE', 'STOCK', 'SW', '2', '2.25', '0', '0.125']);
  assert.equal(rows[7].label, 'Metalayzer'); assert.ok(Object.isFrozen(rows) && rows.every(Object.isFrozen));
});
test('InfoRow removes actual Dart-blank values while keeping visible whitespace, status case and canonical fallback', () => {
  let lookups = 0; const names = { get() { lookups++; return 'invented empty-key name'; } };
  const decoded = s.report({ barcode: ' \u0085 ', warehouse: ' W ', item_name: '', status: ' Available ', is_metalayzer: false, assignment: { apparatus: 'apparatus:default:machine' } });
  // Source helper accepts a constructed typed model too; the shared canonical API decoder remains untouched.
  const value = { ...decoded, assignment: { ...decoded.assignment, apparatus: ' \u0085 ' } };
  const rows = s.projection.adminProgressQrTechnicalMaterial(value, names, p);
  assert.equal(lookups, 0); assert.equal(rows.find(row => row.id === 'barcode'), undefined); assert.equal(rows.find(row => row.id === 'item-name'), undefined); assert.equal(rows.find(row => row.id === 'assigned-machine'), undefined);
  assert.equal(rows.find(row => row.id === 'warehouse').value, ' W '); assert.equal(rows.find(row => row.id === 'status').value, ' Available '); assert.equal(rows.find(row => row.id === 'metalayzer').value, 'Metalayzer bo‘lmagan');
  const raw = s.report({ assignment: { apparatus: 'apparatus:default:unknown' } }); assert.equal(s.projection.adminProgressQrTechnicalMaterial(raw, new Map([['apparatus:default:unknown', ' \u0085 ']]), p).find(row => row.id === 'assigned-machine').value, 'apparatus:default:unknown');
  assert.equal(s.projection.adminProgressQrQuantityParts(-.001, ' \u0085 kg \u0085 '), '-0 kg');
});
test('Source status translation applies exact trimmed lowercase keys only', () => {
  for (const status of ['available', 'in_use', 'consumed', 'reserved']) assert.equal(s.projection.adminProgressQrMaterialStatus(` \u0085 ${status} `, p), p(`worker.qr.material.status_${status}`));
  assert.equal(s.projection.adminProgressQrMaterialStatus(' RESERVED ', p), ' RESERVED '); assert.equal(s.projection.adminProgressQrMaterialStatus('  custom  ', p), '  custom  ');
});
for (const platform of ['android', 'ios']) {
  test(`${platform}: actual native expansion starts collapsed, preserves Source rows/selection and remains through locale/catalog/report redraw`, () => {
    const f = s.fixture(platform), first = f.render(); assert.equal(s.node(first, 'technical-rows'), undefined); s.expand(first, platform);
    let tree = f.render(); assert.ok(s.node(tree, 'technical-rows')); assert.ok(s.values(tree).includes('Metalayzer bo‘lmagan'));
    if (platform === 'android') assert.ok(s.nodes(tree, n => n.type === 'NativeText').every(n => n.props.selectable && n.props.style.fontSize === 16 && n.props.style.fontWeight === '700'));
    else assert.ok(s.nodes(tree, n => n.type === 'Text' && n.props.modifiers?.some(m => m.name === 'textSelection' && m.args[0] === true)).length > 0);
    f.props.p = key => s.l10n.productionText(key, 'ru'); f.props.report = s.report({ is_metalayzer: true, item_name: 'NEW NAME' }); f.props.apparatusNamesById = new Map(); tree = f.render(); assert.ok(s.node(tree, 'technical-rows')); assert.ok(s.values(tree).includes('NEW NAME')); assert.ok(s.values(tree).includes('Metalayzer bo‘ldi'));
    f.r.replay(); tree = f.render(); assert.ok(s.node(tree, 'technical-rows')); s.expand(tree, platform, false); assert.equal(s.node(f.render(), 'technical-rows'), undefined);
  });
  test(`${platform}: covered/unmounted/retired/async-authority native callbacks cannot change expansion or adopt another section`, () => {
    for (const effect of [f => f.top(() => false), f => f.top(() => Promise.reject(Error('async top'))), f => f.current(() => false), f => f.r.unmount()]) {
      const f = s.fixture(platform), tree = f.render(); effect(f); s.expand(tree, platform); assert.equal(s.node(f.render(), 'technical-rows'), undefined);
    }
    const f = s.fixture(platform), old = f.render(); f.props.sectionIdentity = {}; f.render(); s.expand(old, platform); assert.equal(s.node(f.render(), 'technical-rows'), undefined);
  });
  test(`${platform}: same-section authority replacement retires dispatch while a genuinely new section starts collapsed`, () => {
    const f = s.fixture(platform), old = f.render(); s.expand(old, platform); assert.ok(s.node(f.render(), 'technical-rows')); f.props.canInteract = () => true; assert.equal(f.render(), null); s.expand(old, platform); assert.equal(f.render(), null); f.props.sectionIdentity = {}; assert.equal(s.node(f.render(), 'technical-rows'), undefined);
  });
  test(`${platform}: final original-current reentrancy cannot expand content after actual unmount`, () => {
    const f = s.fixture(platform); let armed = false, checks = 0; f.props.isCurrent = () => { if (armed && ++checks === 2) f.r.unmount(); return true; }; const tree = f.render(); armed = true; s.expand(tree, platform); armed = false; assert.equal(s.node(f.render(), 'technical-rows'), undefined);
  });
}
test('Android long selectable values use parent width, Source bodyLarge metrics and expanded icon/border colors', () => {
  const f = s.fixture('android', { item_name: 'long name '.repeat(60) }), collapsed = f.render();
  assert.equal(s.nodes(collapsed, n => n.type === 'SymbolView')[0].props.tintColor, s.colors.onSurfaceVariant);
  assert.deepEqual(s.nodes(collapsed, n => n.type === 'Column')[0].props.modifiers.find(m => m.name === 'padding').args, [0, 1, 0, 1]);
  s.expand(collapsed, 'android'); const tree = f.render();
  const valueHosts = s.nodes(tree, n => n.type === 'RNHostView' && s.nodes(n, child => child.type === 'NativeText').length);
  assert.ok(valueHosts.length > 0 && valueHosts.every(n => n.props.matchContents.vertical === true && n.props.matchContents.horizontal === undefined));
  assert.ok(s.nodes(tree, n => n.type === 'NativeText').every(n => n.props.style.lineHeight === 24 && n.props.style.letterSpacing === .5));
  assert.equal(s.nodes(tree, n => n.type === 'SymbolView')[0].props.tintColor, s.colors.primary);
  assert.deepEqual(s.nodes(tree, n => n.type === 'Column')[0].props.modifiers.find(m => m.name === 'padding').args, [0, 1, 0, 1]);
  assert.equal(s.nodes(tree, n => n.props.testID === 'admin-qr-material-technical-border')[0].props.style[1].borderColor, s.colors.outlineVariant);
  assert.equal(s.nodes(tree, n => n.type === 'Text' && n.props.style?.fontWeight === '900')[0].props.style.typography, 'bodyLarge');
});
