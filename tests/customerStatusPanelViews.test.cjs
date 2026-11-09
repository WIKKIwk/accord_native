const assert = require('node:assert/strict');
const test = require('node:test');
const { loadCustomerStatusPanel, nodes, kind, presentation } = require('./support/customerNativeStatusPanel.cjs');
const summary = { pendingCount: 7, confirmedCount: 0, rejectedCount: Number.MAX_SAFE_INTEGER };
const keys = ['pending', 'confirmed', 'rejected'];
const labels = ['pendingLabel', 'confirmedStatus', 'rejectedLabel'];
const testID = node => node.props.testID ?? node.props.modifiers?.find(m => m[0] === 'testID')?.[1];

// Source-derived: _CustomerStatusPanel and _CustomerStatusRow, including a real tonal count action in every row.
test('both native panels preserve status order/counts and give rows and counters the same real action', () => {
  for (const platform of ['ios', 'android']) {
    const calls = [], screen = loadCustomerStatusPanel(platform).CustomerStatusPanel({ summary, onOpenStatus: value => calls.push(value) });
    const rows = keys.map(key => nodes(screen, n => testID(n) === `customer-status-row-${key}`)[0]);
    const counts = keys.map(key => nodes(screen, n => testID(n) === `customer-status-count-${key}`)[0]);
    assert.deepEqual(calls, []);
    assert.equal(rows.length, 3); assert.equal(counts.length, 3); assert.ok(rows.every(Boolean)); assert.ok(counts.every(Boolean));
    assert.deepEqual(counts.map(n => n.props.children.props.children), ['7', '0', '9007199254740991']);
    for (let index = 0; index < rows.length; index++) {
      const action = rows[index].props.onPress ?? rows[index].props.onClick;
      assert.equal(action, counts[index].props.onPress ?? counts[index].props.onClick);
      action(); (counts[index].props.onPress ?? counts[index].props.onClick)();
    }
    assert.deepEqual(calls, ['pending', 'pending', 'confirmed', 'confirmed', 'rejected', 'rejected']);
    assert.deepEqual(nodes(screen, n => kind(n) === 'Text' && labels.includes(n.props.children)).map(n => n.props.children), labels);
  }
});

test('iOS uses separate sibling native row/count buttons rather than nested buttons or competing tap gestures', () => {
  const screen = loadCustomerStatusPanel('ios').CustomerStatusPanel({ summary, onOpenStatus() {} });
  const rows = nodes(screen, n => kind(n) === 'Overlay'); assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.props.alignment, 'trailing');
    const [main, slot] = row.props.children;
    assert.equal(main.type, 'Button'); assert.equal(slot.type, 'Overlay.Content');
    assert.equal(nodes(main.props.children, n => n.type === 'Button').length, 0);
    const counter = nodes(slot, n => n.type === 'Button')[0];
    assert.ok(counter); assert.equal(main.props.onPress, counter.props.onPress);
    assert.deepEqual(main.props.modifiers, [['buttonStyle', 'plain']]);
    const shape = main.props.children.props.modifiers.find(m => m[0] === 'contentShape'); assert.deepEqual(shape, ['contentShape', ['rectangle']]);
    const proxy = nodes(main, n => n.type === 'Text' && n.props.modifiers?.some(m => m[0] === 'opacity'))[0];
    assert.ok(proxy); assert.ok(proxy.props.modifiers.some(m => m[0] === 'opacity' && m[1] === 0));
    assert.ok(proxy.props.modifiers.some(m => m[0] === 'accessibilityHidden'));
    const count = counter.props.children;
    assert.equal(proxy.props.children, count.props.children);
    for (const modifier of ['font', 'padding', 'frame', 'fixedSize']) {
      assert.deepEqual(proxy.props.modifiers.find(m => m[0] === modifier), count.props.modifiers.find(m => m[0] === modifier));
    }
    assert.ok(count.props.modifiers.some(m => m[0] === 'background' && m[1] === 'secondarySystemFill' && m[2][1].cornerRadius === 14));
    assert.equal(nodes(screen, n => n.props.modifiers?.some(m => m[0] === 'onTapGesture')).length, 0);
    const reserved = nodes(slot, n => n.type === 'Spacer')[0]; assert.deepEqual(reserved.props.modifiers, [['frame', { width: 48 }]]);
  }
});

test('Android uses native tonal buttons inside native clickable row surfaces, with the V2 count geometry', () => {
  const screen = loadCustomerStatusPanel('android').CustomerStatusPanel({ summary, onOpenStatus() {} });
  const buttons = nodes(screen, n => n.type === 'FilledTonalButton'); assert.equal(buttons.length, 3);
  for (const button of buttons) {
    assert.deepEqual(button.props.contentPadding, { start: 14, end: 14, top: 0, bottom: 0 });
    assert.ok(button.props.modifiers.some(m => m[0] === 'defaultMinSize' && m[1].minWidth === 44 && m[1].minHeight === 40));
    assert.deepEqual(button.props.shape.props.cornerRadii, { topStart: 14, topEnd: 14, bottomStart: 14, bottomEnd: 14 });
    assert.equal(button.props.shape.props.type, 'roundedCorner');
    // V2's app-wide FilledButtonTheme overrides the tonal variant's default colors.
    assert.deepEqual(button.props.colors, { containerColor: 'primary', contentColor: 'on-primary' });
    assert.deepEqual(button.props.children.props.style, { typography: 'labelLarge', fontSize: 16, fontWeight: '500' });
    assert.equal(button.props.enabled, undefined, 'zero counts are still active, as in V2');
  }
  assert.equal(nodes(screen, n => n.type === 'Surface' && n.props.onClick).length, 3);
  assert.equal(nodes(screen, n => n.type === 'Surface' && !n.props.onClick).length, 1);
});

test('pending alone has the source marker/background and Android retains the grouped shape and inset dividers', () => {
  const ios = loadCustomerStatusPanel('ios').CustomerStatusPanel({ summary, onOpenStatus() {} });
  const iosRows = nodes(ios, n => kind(n) === 'Overlay');
  assert.deepEqual(iosRows.map(row => row.props.modifiers.some(m => m[0] === 'listRowBackground')), [true, false, false]);
  const markers = nodes(ios, n => n.type === 'RoundedRectangle'); assert.equal(markers.length, 1);
  assert.ok(markers[0].props.modifiers.some(m => m[0] === 'frame' && m[1].width === 4 && m[1].height === 24));
  assert.ok(markers[0].props.modifiers.some(m => m[0] === 'accessibilityHidden'));
  const android = loadCustomerStatusPanel('android').CustomerStatusPanel({ summary, onOpenStatus() {} });
  const androidRows = nodes(android, n => n.type === 'Surface' && n.props.onClick);
  assert.deepEqual(androidRows.map(row => row.props.color), ['pending-bg', 'bg', 'bg']);
  assert.deepEqual(androidRows.map(row => row.props.shape.props.cornerRadii), [
    { topStart: 28, topEnd: 28, bottomStart: 0, bottomEnd: 0 }, { topStart: 0, topEnd: 0, bottomStart: 0, bottomEnd: 0 },
    { topStart: 0, topEnd: 0, bottomStart: 28, bottomEnd: 28 },
  ]);
  const box = nodes(android, n => n.type === 'Box'); assert.equal(box.length, 1);
  assert.deepEqual(box[0].props.modifiers, [['size', 4, 24], ['clip', ['RoundedCorner', 999]], ['background', 'primary']]);
  const dividers = nodes(android, n => n.type === 'HorizontalDivider'); assert.equal(dividers.length, 2);
  for (const divider of dividers) {
    assert.equal(divider.props.thickness, 1); assert.equal(divider.props.color, 'outline');
    assert.deepEqual(divider.props.modifiers, [['padding', 18, 0, 18, 0], ['alpha', 0.55]]);
  }
});

// LocaleController.locale returns ur-PK, not ur. V2's chevron IconData sets matchTextDirection.
test('native chevrons follow locale direction and remain decorative', () => {
  const ios = loadCustomerStatusPanel('ios').CustomerStatusPanel({ summary, onOpenStatus() {} });
  const images = nodes(ios, n => n.type === 'Image'); assert.equal(images.length, 3);
  for (const image of images) {
    assert.equal(image.props.systemName, 'chevron.forward'); assert.equal(image.props.size, 22);
    assert.ok(image.props.modifiers.some(m => m[0] === 'accessibilityHidden'));
  }
  for (const [locale, direction] of [['uz', 'leftToRight'], ['en', 'leftToRight'], ['ru', 'leftToRight'], ['ur', 'rightToLeft'], ['ur-PK', 'rightToLeft'], ['ur_PK', 'rightToLeft']]) {
    assert.equal(presentation.customerLayoutDirection(locale), direction);
    const screen = loadCustomerStatusPanel('android', { locale }).CustomerStatusPanel({ summary, onOpenStatus() {} });
    assert.equal(nodes(screen, n => n.type === 'Host')[0].props.layoutDirection, direction);
    const icons = nodes(screen, n => n.type === 'SymbolView'); assert.equal(icons.length, 3);
    for (const icon of icons) {
      assert.equal(icon.props.name.android, direction === 'rightToLeft' ? 'chevron_left' : 'chevron_right');
      assert.equal(icon.props.accessible, false); assert.equal(icon.props.importantForAccessibility, 'no-hide-descendants');
    }
  }
});

test('updated snapshots change every displayed count without cached or fake values', () => {
  for (const platform of ['ios', 'android']) {
    const Panel = loadCustomerStatusPanel(platform).CustomerStatusPanel;
    for (const [counts, values] of [[{ pendingCount: 0, confirmedCount: 0, rejectedCount: 0 }, ['0', '0', '0']],
      [{ pendingCount: 5, confirmedCount: 8, rejectedCount: 13 }, ['5', '8', '13']]]) {
      const screen = Panel({ summary: counts, onOpenStatus() {} });
      assert.deepEqual(keys.map(key => nodes(screen, n => testID(n) === `customer-status-count-${key}`)[0].props.children.props.children), values);
    }
  }
});

test('localized status labels remain complete and row controls use source padding without extra wording', () => {
  const text = key => `اردو ${key} ${'long '.repeat(15)}`;
  for (const platform of ['ios', 'android']) {
    const screen = loadCustomerStatusPanel(platform, { locale: 'ur-PK', text }).CustomerStatusPanel({ summary, onOpenStatus() {} });
    const labelTexts = nodes(screen, n => n.type === 'Text' && labels.map(text).includes(n.props.children));
    assert.deepEqual(labelTexts.map(n => n.props.children), labels.map(text));
    for (const label of labelTexts) { assert.equal(label.props.maxLines, undefined); assert.equal(label.props.numberOfLines, undefined); }
    const rows = keys.map(key => nodes(screen, n => testID(n) === `customer-status-row-${key}`)[0]);
    for (const row of rows) {
      if (platform === 'ios') assert.ok(row.props.children.props.modifiers.some(m => m[0] === 'padding' && m[1].horizontal === 20 && m[1].vertical === 20));
      else assert.ok(row.props.children.props.modifiers.some(m => m[0] === 'padding' && m.slice(1).every(value => value === 20)));
    }
  }
});
