const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { presentation } = require('./support/customerNativeStates.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, pred) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n, pred));
  return [...(pred(node) ? [node] : []), ...nodes(node.props?.children, pred)]; }
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const logic = load('customerLogic.ts'), view = load('customerDeliveryView.ts');
const AlertDialog = Object.assign(() => null, { Title: 'Title', Text: 'DialogText', DismissButton: 'DismissButton', ConfirmButton: 'ConfirmButton' });
const OutlinedTextField = Object.assign(() => null, { Label: 'Label', Placeholder: 'Placeholder', Suffix: 'Suffix' });
function fixture(platform, values, locale = 'uz') {
  let stateIndex = 0; const updates = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useState: () => { const i = stateIndex++; return [values[i], next => updates.push([i, next])]; } },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Text: 'Text', TextField: 'TextField', VStack: 'VStack', useNativeState: () => ({}) },
    '@expo/ui/swift-ui/modifiers': { accessibilityAddTraits: x => ['traits', x], accessibilityHidden: () => ['hidden'], buttonStyle: x => ['style', x],
      contentShape: x => ['contentShape', x], disabled: x => ['disabled', x], fixedSize: x => ['fixedSize', x], font: x => ['font', x], frame: x => ['frame', x],
      keyboardType: x => ['keyboard', x], kerning: x => ['kerning', x], lineLimit: x => ['lines', x], padding: x => ['padding', x], textFieldStyle: x => ['field', x],
      shapes: { rectangle: () => ['rectangle'] } },
    '@expo/ui/jetpack-compose': { AlertDialog, Button: 'ComposeButton', Host: 'Host', OutlinedButton: 'OutlinedButton', OutlinedTextField, RNHostView: 'RNHostView',
      Row: 'Row', Shape: { RoundedCorner: x => ['rounded', x] }, Text: 'Text', TextButton: 'TextButton',
      useMaterialColors: () => ({ onSurface: 'onSurface', primary: 'primary', onPrimary: 'onPrimary' }), useNativeState: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': { defaultMinSize: x => ['minSize', x], fillMaxWidth: () => 'fill', weight: x => ['weight', x] },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'RNText', View: 'View', PlatformColor: x => x,
      useWindowDimensions: () => ({ width: 400, height: 800 }) },
    './CustomerContext': { useCustomerText: () => ({ locale, text: x => x }) },
    './customerLogic': logic, './customerDeliveryView': view, './customerPresentation': presentation };
  return { ...load(`CustomerReturnDialog.${platform}.tsx`, mocks), updates };
}
function render(platform, kind, values, callbacks, locale = 'uz') {
  const f = fixture(platform, values, locale), shell = f.CustomerReturnDialog({ kind, sentQty: 10, uom: 'kg', ...callbacks });
  return { ...f, tree: shell && shell.type(shell.props) };
}
test('return dialogs preserve three reasons, quantity boundaries and V2 action labels on both platforms', () => {
  for (const platform of ['ios', 'android']) for (const kind of ['reject', 'partial', 'claim']) {
    const calls = [], rendered = render(platform, kind, ['2', '', 'rejectReasonWrongItem'], { onCancel: () => calls.push('cancel'), onConfirm: input => calls.push(input) });
    const choices = nodes(rendered.tree, n => n.type === (platform === 'ios' ? 'Button' : 'Pressable') && n.props.testID?.startsWith('customer-reason-'));
    const labels = choices.map(c => nodes(c, n => n.type === (platform === 'ios' ? 'Text' : 'RNText'))[0].props.children);
    assert.deepEqual(labels, ['rejectReasonDefective', 'rejectReasonWrongItem', 'rejectReasonQtyMismatch']);
    if (platform === 'ios') assert.ok(choices[1].props.modifiers.some(m => m[0] === 'traits' && m[1].includes('isSelected')));
    else assert.equal(choices[1].props.accessibilityState.checked, true);
    choices[1].props.onPress(); assert.deepEqual(rendered.updates.at(-1), [2, null]);
    choices[0].props.onPress(); assert.deepEqual(rendered.updates.at(-1), [2, 'rejectReasonDefective']);
    if (platform === 'ios') {
      const buttons = nodes(rendered.tree, n => n.type === 'Button' && !n.props.testID?.startsWith('customer-reason-'));
      assert.deepEqual(buttons.map(b => b.props.label), ['no', 'yes']);
      buttons[1].props.onPress();
    } else {
      const confirm = nodes(rendered.tree, n => n.type === 'ComposeButton')[0];
      assert.equal(confirm.props.enabled, true); confirm.props.onClick();
      const dialog = nodes(rendered.tree, n => n.type === AlertDialog)[0];
      assert.deepEqual(dialog.props.properties, { dismissOnBackPress: true, dismissOnClickOutside: true });
    }
    assert.deepEqual(calls, [{ returnedQty: kind === 'reject' ? 10 : 2, reason: 'rejectReasonWrongItem', comment: '' }]);
  }
});
test('invalid partial full return and short reasonless comments disable confirmation', () => {
  for (const platform of ['ios', 'android']) {
    const rendered = render(platform, 'partial', ['10', 'ab', null], { onCancel() {}, onConfirm() { throw Error('must not submit'); } });
    if (platform === 'ios') {
      const yes = nodes(rendered.tree, n => n.type === 'Button' && n.props.label === 'yes')[0];
      assert.ok(yes.props.modifiers.some(m => m[0] === 'disabled' && m[1] === true)); yes.props.onPress();
    } else {
      const yes = nodes(rendered.tree, n => n.type === 'ComposeButton')[0]; assert.equal(yes.props.enabled, false); yes.props.onClick();
    }
  }
});

test('return dialog cancel and dismissal callbacks remain wired on both platforms', () => {
  for (const platform of ['ios', 'android']) for (const kind of ['reject', 'partial', 'claim']) {
    let cancelled = 0;
    const rendered = render(platform, kind, ['2', '', 'rejectReasonWrongItem'], { onCancel: () => cancelled++, onConfirm() { throw Error('must not submit'); } });
    if (platform === 'ios') {
      nodes(rendered.tree, n => n.type === 'Modal')[0].props.onRequestClose();
      nodes(rendered.tree, n => n.type === 'Pressable')[0].props.onPress();
      nodes(rendered.tree, n => n.type === 'Button' && n.props.label === 'no')[0].props.onPress();
      assert.equal(cancelled, 3);
    } else {
      const dialog = nodes(rendered.tree, n => n.type === AlertDialog)[0];
      assert.deepEqual(dialog.props.properties, { dismissOnBackPress: true, dismissOnClickOutside: true });
      dialog.props.onDismissRequest();
      nodes(rendered.tree, n => n.type === 'OutlinedButton')[0].props.onClick();
      assert.equal(cancelled, 2);
    }
  }
});

test('return dialog hosts and reason controls follow the app-selected locale', () => {
  for (const platform of ['ios', 'android']) for (const kind of ['reject', 'partial', 'claim']) {
    for (const [locale, direction, nativeDirection] of [['uz', 'leftToRight', 'ltr'], ['en', 'leftToRight', 'ltr'], ['ru', 'leftToRight', 'ltr'], ['ur-PK', 'rightToLeft', 'rtl']]) {
      const rendered = render(platform, kind, ['2', '', 'rejectReasonWrongItem'], { onCancel() {}, onConfirm() {} }, locale);
      const hosts = nodes(rendered.tree, n => n.type === 'Host'); assert.ok(hosts.length >= 3);
      assert.ok(hosts.every(host => host.props.layoutDirection === direction));
      assert.ok(nodes(rendered.tree, n => n.type === 'View' && n.props.style?.direction === nativeDirection).length);
      if (platform === 'ios') {
        const choices = nodes(rendered.tree, n => n.type === 'Button' && n.props.testID?.startsWith('customer-reason-'));
        assert.equal(choices.length, 3);
        for (const [index, choice] of choices.entries()) {
          assert.equal(typeof choice.props.onPress, 'function');
          assert.equal(choice.props.modifiers.some(m => m[0] === 'traits' && m[1].includes('isSelected')), index === 1);
          const icon = nodes(choice, n => n.type === 'Image')[0]; assert.equal(icon.props.size, 22);
          assert.ok(icon.props.modifiers.some(m => m[0] === 'hidden'));
          const row = choice.props.children; assert.equal(row.props.spacing, 10);
          assert.ok(row.props.modifiers.some(m => m[0] === 'padding' && m[1].vertical === 10));
          assert.ok(row.props.modifiers.some(m => m[0] === 'contentShape'));
        }
      }
    }
  }
});

test('Android reason rows use source geometry, selection icon and wrapping', () => {
  for (const kind of ['reject', 'partial', 'claim']) {
    const rendered = render('android', kind, ['2', '', 'rejectReasonWrongItem'], { onCancel() {}, onConfirm() {} });
    const choices = nodes(rendered.tree, n => n.type === 'Pressable' && n.props.testID?.startsWith('customer-reason-'));
    assert.equal(choices.length, 3);
    const group = nodes(rendered.tree, n => n.type === 'View' && n.props.testID === 'customer-reason-group')[0];
    assert.ok(group);
    assert.equal(nodes(group, n => n.type === 'Pressable').length, 3);
    const scroll = nodes(rendered.tree, n => n.type === 'ScrollView')[0];
    assert.equal(scroll.props.contentContainerStyle.gap, 12);
    const quantity = nodes(rendered.tree, n => n.type === OutlinedTextField && n.props.singleLine)[0];
    if (kind !== 'reject') {
      assert.ok(quantity);
      const quantityHost = nodes(scroll, n => n.type === 'Host' && nodes(n, c => c === quantity).length)[0];
      assert.equal(quantityHost.props.style.marginBottom, 4);
    } else assert.equal(quantity, undefined);
    const reasonLabel = nodes(group, n => n.type === 'Text' && n.props.children === 'reasonLabel')[0];
    assert.deepEqual(reasonLabel.props.style, { typography: 'titleMedium', fontSize: 16, fontWeight: '500' });
    const labelHost = nodes(group, n => n.type === 'Host')[0];
    assert.equal(labelHost.props.style.marginBottom, 8);
    for (const [index, choice] of choices.entries()) {
      assert.equal(choice.props.accessibilityRole, 'radio');
      assert.equal(choice.props.accessibilityState.checked, index === 1);
      assert.deepEqual(choice.props.style, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderRadius: 16 });
      const icon = nodes(choice, n => n.type === 'SymbolView')[0];
      assert.equal(icon.props.size, 22);
      assert.equal(icon.props.name.android, index === 1 ? 'check_circle' : 'radio_button_unchecked');
      assert.equal(icon.props.accessible, false);
      const label = nodes(choice, n => n.type === 'RNText')[0];
      assert.equal(label.props.style.flex, 1);
      assert.equal(label.props.style.fontSize, 16);
      assert.equal(label.props.style.fontWeight, '400');
      assert.equal(label.props.numberOfLines, undefined);
    }
  }
});

test('iOS reason rows stay contiguous with the source label and action spacing', () => {
  for (const kind of ['reject', 'partial', 'claim']) {
    const rendered = render('ios', kind, ['2', '', 'rejectReasonWrongItem'], { onCancel() {}, onConfirm() {} });
    const scroll = nodes(rendered.tree, n => n.type === 'ScrollView')[0];
    assert.equal(scroll.props.contentContainerStyle.gap, 12);
    const group = nodes(scroll, n => n.type === 'View' && n.props.testID === 'customer-reason-group')[0];
    assert.ok(group);
    assert.equal(nodes(group, n => n.type === 'Button' && n.props.testID?.startsWith('customer-reason-')).length, 3);
    const label = nodes(group, n => n.type === 'Text' && n.props.children === 'reasonLabel')[0];
    assert.ok(label.props.modifiers.some(m => m[0] === 'font' && m[1].textStyle === 'body' && m[1].weight === 'medium'));
    assert.equal(nodes(group, n => n.type === 'Host')[0].props.style.marginBottom, 8);
    const heading = nodes(scroll, n => n.type === 'Host' && nodes(n, c => c.type === 'Text' && c.props.children === view.customerReturnTitleKey(kind)).length)[0];
    assert.equal(heading.props.style.marginBottom, 4);
    const comment = nodes(scroll, n => n.type === 'Host' && nodes(n, c => c.type === 'Text' && c.props.children === 'extraCommentLabel').length)[0];
    assert.equal(comment.props.style.marginBottom, 8);
  }
});

test('return titles retain V2 headline emphasis on both platforms', () => {
  for (const platform of ['ios', 'android']) for (const kind of ['reject', 'partial', 'claim']) {
    const rendered = render(platform, kind, ['2', '', 'rejectReasonWrongItem'], { onCancel() {}, onConfirm() {} });
    const title = nodes(rendered.tree, n => n.type === 'Text' && n.props.children === view.customerReturnTitleKey(kind))[0];
    assert.ok(title);
    if (platform === 'ios') {
      assert.ok(title.props.modifiers.some(m => m[0] === 'font' && m[1].textStyle === 'title' && m[1].weight === 'bold'));
      assert.ok(title.props.modifiers.some(m => m[0] === 'kerning' && m[1] === -0.6));
    } else assert.deepEqual(title.props.style, { typography: 'headlineMedium', fontSize: 28, fontWeight: '700', letterSpacing: -0.6 });
  }
});

test('Android return actions use the source outlined and filled equal-width hierarchy', () => {
  for (const kind of ['reject', 'partial', 'claim']) {
    const calls = [], rendered = render('android', kind, ['2', '', 'rejectReasonWrongItem'], { onCancel: () => calls.push('cancel'), onConfirm: input => calls.push(input) });
    const row = nodes(rendered.tree, n => n.type === 'Row')[0];
    assert.ok(row.props.modifiers.includes('fill'));
    assert.deepEqual(row.props.horizontalArrangement, { spacedBy: 12 });
    const [cancel, confirm] = row.props.children;
    assert.equal(cancel.type, 'OutlinedButton'); assert.equal(confirm.type, 'ComposeButton');
    assert.deepEqual([cancel, confirm].map(button => nodes(button, n => n.type === 'Text')[0].props.children), ['no', 'yes']);
    assert.deepEqual(cancel.props.colors, { contentColor: 'onSurface' });
    assert.deepEqual(confirm.props.colors, { containerColor: 'primary', contentColor: 'onPrimary' });
    for (const button of [cancel, confirm]) {
      assert.ok(button.props.modifiers.some(m => Array.isArray(m) && m[0] === 'weight' && m[1] === 1));
      assert.ok(button.props.modifiers.some(m => Array.isArray(m) && m[0] === 'minSize' && m[1].minHeight === 56));
      assert.deepEqual(button.props.shape[1].cornerRadii, { topStart: 20, topEnd: 20, bottomStart: 20, bottomEnd: 20 });
      const label = nodes(button, n => n.type === 'Text')[0];
      assert.deepEqual(label.props.style, { typography: 'labelLarge', fontSize: 16, fontWeight: '500' });
    }
    assert.equal(confirm.props.enabled, true); cancel.props.onClick(); confirm.props.onClick();
    assert.deepEqual(calls, ['cancel', { returnedQty: kind === 'reject' ? 10 : 2, reason: 'rejectReasonWrongItem', comment: '' }]);
  }
});
test('delivery status and discussion ID follow the V2 mapping', () => {
  assert.equal(view.customerDeliveryStatusKey('accepted'), 'approvedLabel');
  assert.equal(view.customerDeliveryStatusKey('partial'), 'partiallyCompleted');
  assert.equal(view.customerDeliveryStatusKey('rejected'), 'rejectedStatusLabel');
  assert.equal(view.customerDeliveryStatusKey('cancelled'), 'pendingLabel');
  assert.equal(view.customerDiscussionEventId('\u0085 DN-1 \u0085'), 'customer_delivery_result:DN-1');
});
