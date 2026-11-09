const assert = require('node:assert/strict');
const test = require('node:test');
const { loadCustomerStates, nodes, presentation } = require('./support/customerNativeStates.cjs');

// Source-derived: V2 AppRetryState.contentWidthFor and test/app_retry_state_test.dart.
test('Customer retry width follows the V2 proportion and bounds', () => {
  assert.equal(presentation.customerRetryContentWidth(390), 343.2);
  assert.equal(presentation.customerRetryContentWidth(300), 280);
  assert.equal(presentation.customerRetryContentWidth(200), 280);
  assert.equal(presentation.customerRetryContentWidth(900), 360);
});

// Source-derived: Center(AppLoadingIndicator), default 64 box, 48 indicator constraints and Loading semantics.
test('native loading states remain indeterminate, centered and labeled', () => {
  for (const platform of ['ios', 'android']) {
    const screen = loadCustomerStates(platform).CustomerLoadingState();
    if (platform === 'ios') {
      assert.equal(screen.props.alignment, 'center');
      const indicator = nodes(screen, n => n.type === 'ProgressView')[0];
      assert.equal(indicator.props.value, undefined);
      assert.deepEqual(indicator.props.modifiers, [['frame', { width: 64, height: 64 }], ['accessibilityLabel', 'Loading']]);
    } else {
      assert.deepEqual(screen.props.style, { flex: 1, alignItems: 'center', justifyContent: 'center' });
      const box = screen.props.children;
      assert.deepEqual(box.props.style, { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' });
      const indicator = nodes(screen, n => n.type === 'LoadingIndicator')[0];
      assert.equal(indicator.props.progress, undefined); assert.equal(indicator.props.color, 'primary');
      assert.deepEqual(indicator.props.modifiers, [['size', 48, 48], ['semantics', { contentDescription: 'Loading' }]]);
    }
  }
});

// Source-derived: AppRetryState topCenter, 24/40 padding, 16 gap and TextButton callback.
test('retry states retain localized text, adaptive width and the real retry action', async () => {
  for (const platform of ['ios', 'android']) {
    for (const width of [200, 300, 390, 900]) {
      const calls = [], text = key => `اردو ${key} ${'long '.repeat(20)}`;
      const screen = loadCustomerStates(platform, { width, text }).CustomerRetryState({ retry: async () => { calls.push('retry'); } });
      assert.equal(calls.length, 0);
      assert.deepEqual(screen.props.style, { flex: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' });
      const host = nodes(screen, n => n.type === 'Host')[0];
      assert.deepEqual(host.props.matchContents, { vertical: true });
      assert.deepEqual(host.props.style, { width: '100%', maxWidth: presentation.customerRetryContentWidth(width) });
      assert.equal(host.props.style.minWidth, undefined, 'parent padding can constrain the 280 lower bound on narrow screens');
      const body = nodes(screen, n => n.type === 'Text' && n.props.children === text('serverDisconnectedRetry'))[0];
      assert.ok(body); assert.equal(body.props.maxLines, undefined);
      let action;
      if (platform === 'ios') {
        const column = nodes(screen, n => n.type === 'VStack')[0]; assert.equal(column.props.spacing, 16);
        assert.ok(body.props.modifiers.some(m => m[0] === 'multilineTextAlignment' && m[1] === 'center'));
        assert.ok(body.props.modifiers.some(m => m[0] === 'lineLimit' && m.length === 1));
        const button = nodes(screen, n => n.type === 'Button')[0];
        assert.equal(button.props.label, text('retry')); assert.deepEqual(button.props.modifiers, [['buttonStyle', 'borderless']]);
        action = button.props.onPress;
      } else {
        const column = nodes(screen, n => n.type === 'Column')[0];
        assert.equal(column.props.horizontalAlignment, 'center'); assert.deepEqual(column.props.verticalArrangement, { spacedBy: 16 });
        assert.deepEqual(body.props.style, { typography: 'bodyLarge', textAlign: 'center' });
        const button = nodes(screen, n => n.type === 'TextButton')[0];
        assert.deepEqual(button.props.contentPadding, { start: 12, end: 12, top: 8, bottom: 8 });
        assert.equal(button.props.children.props.children, text('retry')); action = button.props.onClick;
      }
      action(); action(); await Promise.resolve(); assert.deepEqual(calls, ['retry', 'retry']);
    }
  }
});

// Source-derived: CustomerStatusDetailScreen loaded empty Center(Card.filled(Padding(18))).
test('empty status uses a centered read-only filled surface without an invented refresh action', () => {
  for (const platform of ['ios', 'android']) {
    const screen = loadCustomerStates(platform).CustomerEmptyStatusState();
    if (platform === 'ios') {
      assert.equal(screen.props.alignment, 'center');
      const surface = nodes(screen, n => n.type === 'VStack')[0];
      assert.deepEqual(surface.props.modifiers, [['padding', { all: 18 }], ['background', 'secondarySystemGroupedBackground', ['roundedRectangle', { cornerRadius: 12 }]]]);
    } else {
      assert.deepEqual(screen.props.style, { flex: 1, alignItems: 'center', justifyContent: 'center' });
      const card = nodes(screen, n => n.type === 'Card')[0];
      assert.deepEqual(card.props.colors, { containerColor: 'bg', contentColor: 'fg' });
      assert.deepEqual(card.props.children.props.modifiers, [['paddingAll', 18]]);
    }
    assert.equal(nodes(screen, n => n.type === 'Text' && n.props.children === 'noRecordsYet').length, 1);
    assert.equal(nodes(screen, n => ['Button', 'TextButton', 'List', 'ScrollView', 'RefreshControl'].includes(n.type)).length, 0);
    assert.equal(nodes(screen, n => n.props.onClick || n.props.onPress).length, 0);
  }
});
