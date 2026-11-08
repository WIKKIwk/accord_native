const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
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
function fixture(platform, values) {
  let stateIndex = 0; const updates = [];
  const mocks = { 'react/jsx-runtime': jsx, react: { useState: () => { const i = stateIndex++; return [values[i], next => updates.push([i, next])]; } },
    '@expo/ui/swift-ui': { Button: 'Button', Host: 'Host', HStack: 'HStack', Text: 'Text', TextField: 'TextField', VStack: 'VStack', useNativeState: () => ({}) },
    '@expo/ui/swift-ui/modifiers': { buttonStyle: x => ['style', x], disabled: x => ['disabled', x], frame: x => ['frame', x],
      keyboardType: x => ['keyboard', x], lineLimit: x => ['lines', x], textFieldStyle: x => ['field', x] },
    '@expo/ui/jetpack-compose': { AlertDialog, Host: 'Host', OutlinedTextField, RNHostView: 'RNHostView', Text: 'Text', TextButton: 'TextButton', useNativeState: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => 'fill' },
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', PlatformColor: x => x, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    '../components/WorkerRadioChoice': { WorkerRadioChoice: 'WorkerRadioChoice' }, './CustomerContext': { useCustomerText: () => ({ text: x => x }) },
    './customerLogic': logic, './customerDeliveryView': view };
  return { ...load(`CustomerReturnDialog.${platform}.tsx`, mocks), updates };
}
function render(platform, kind, values, callbacks) {
  const f = fixture(platform, values), shell = f.CustomerReturnDialog({ kind, sentQty: 10, uom: 'kg', ...callbacks });
  return { ...f, tree: shell && shell.type(shell.props) };
}
test('return dialogs preserve three reasons, quantity boundaries and V2 action labels on both platforms', () => {
  for (const platform of ['ios', 'android']) for (const kind of ['reject', 'partial', 'claim']) {
    const calls = [], rendered = render(platform, kind, ['2', '', 'rejectReasonWrongItem'], { onCancel: () => calls.push('cancel'), onConfirm: input => calls.push(input) });
    const choices = nodes(rendered.tree, n => n.type === 'WorkerRadioChoice');
    assert.deepEqual(choices.map(c => c.props.label), ['rejectReasonDefective', 'rejectReasonWrongItem', 'rejectReasonQtyMismatch']);
    assert.equal(choices[1].props.selected, true); choices[1].props.onPress(); assert.deepEqual(rendered.updates.at(-1), [2, null]);
    if (platform === 'ios') {
      const buttons = nodes(rendered.tree, n => n.type === 'Button');
      assert.deepEqual(buttons.map(b => b.props.label), ['no', 'yes']);
      buttons[1].props.onPress();
    } else {
      const buttons = nodes(rendered.tree, n => n.type === 'TextButton');
      assert.equal(buttons[1].props.enabled, true); buttons[1].props.onClick();
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
      const yes = nodes(rendered.tree, n => n.type === 'TextButton')[1]; assert.equal(yes.props.enabled, false); yes.props.onClick();
    }
  }
});
test('delivery status and discussion ID follow the V2 mapping', () => {
  assert.equal(view.customerDeliveryStatusKey('accepted'), 'approvedLabel');
  assert.equal(view.customerDeliveryStatusKey('partial'), 'partiallyCompleted');
  assert.equal(view.customerDeliveryStatusKey('rejected'), 'rejectedStatusLabel');
  assert.equal(view.customerDeliveryStatusKey('cancelled'), 'pendingLabel');
  assert.equal(view.customerDiscussionEventId('\u0085 DN-1 \u0085'), 'customer_delivery_result:DN-1');
});
