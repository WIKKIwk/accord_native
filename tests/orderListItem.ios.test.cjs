const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function fixture() {
  const background = function Background() {};
  background.Content = 'Background.Content';
  const ui = { ListItem: 'ListItem', Text: 'Text', Background: background, HStack: 'HStack', Rectangle: 'Rectangle', RNHostView: 'RNHostView', Spacer: 'Spacer', VStack: 'VStack' };
  const modifiers = new Proxy({}, { get: (_, name) => name === 'shapes'
    ? { rectangle: () => ({ type: 'rectangle' }) } : (...args) => ({ name, args }) });
  const mocks = {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    '@expo/ui': ui,
    '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { PlatformColor: (...semantic) => ({ semantic }), View: 'View' },
    '../../components/useWorkerColors': { useWorkerColors: () => ({ field: 'field', muted: 'muted' }) },
    '../../components/WorkerOrderThumbnail': { WorkerOrderThumbnail: 'Thumbnail' },
  };
  const filename = path.resolve(__dirname, '../src/shared/orders/OrderListItem.ios.tsx');
  const module = new Module(filename);
  module.filename = filename;
  module.paths = require.main.paths;
  module.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const props = { session: {}, orderId: '1', imageId: '', imageActive: true, headline: 'Buyurtma', supportingText: 'Mijoz', onPress() {} };
  return { ui, render: overrides => module.exports.OrderListItem({ ...props, ...overrides }) };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) { const match = find(item, predicate); if (match) return match; }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate) || find(node.props?.supportingText, predicate);
}

test('iOS status rows keep their labels and native colors without a background override', () => {
  const { ui, render } = fixture();
  const neutral = render({});
  assert.equal(neutral.type, ui.ListItem);
  assert.equal(find(neutral, node => node.props?.children === 'Mijoz').type, ui.Text);

  const queue = render({ cardTone: 'paused', statusText: 'To‘xtatilgan', statusDetail: 'Mijoz' });
  assert.equal(queue.type, ui.ListItem);
  assert.ok(find(queue, node => node.props?.children === 'To‘xtatilgan'));
  const dot = find(queue, node => node.props?.children === '●');
  assert.deepEqual(dot.props.modifiers.find(modifier => modifier.name === 'foregroundStyle').args[0], { semantic: ['systemOrange'] });

  assert.ok(find(render({ cardTone: 'history_partial' }), node => node.props?.children === 'Qisman'));
  assert.ok(find(render({ cardTone: 'history_completed' }), node => node.props?.children === 'Tugallangan'));
  assert.equal(render({ cardTone: 'paused', statusText: '' }).type, ui.ListItem);
});

test('iOS unlabeled status rows use translucent native colors and keep their actions', () => {
  const { ui, render } = fixture();
  const tones = {
    in_progress: 'systemGreen', completed: 'systemGreen', waiting_next_stage: 'systemBlue',
    paused: 'systemOrange', frozen: 'systemRed', issue: 'systemRed',
  };
  for (const [cardTone, color] of Object.entries(tones)) {
    const onPress = () => {}, onLongPress = () => {};
    const tree = render({ cardTone, onPress, onLongPress });
    assert.equal(tree.type, ui.Background);
    assert.ok(tree.props.modifiers.some(modifier => modifier.name === 'listRowInsets'));
    const row = find(tree, node => node.type === ui.HStack && node.props.modifiers?.some(modifier => modifier.name === 'onLongPressGesture'));
    assert.equal(find(tree, node => node.type === ui.ListItem), null);
    assert.equal(row.props.modifiers.find(modifier => modifier.name === 'onTapGesture').args[0], onPress);
    assert.equal(row.props.modifiers.find(modifier => modifier.name === 'onLongPressGesture').args[0], onLongPress);
    const rectangle = find(tree, node => node.type === ui.Rectangle);
    assert.deepEqual(rectangle.props.modifiers.find(modifier => modifier.name === 'foregroundStyle').args[0], { semantic: [color] });
    assert.ok(rectangle.props.modifiers.some(modifier => modifier.name === 'opacity' && modifier.args[0] < 1));
  }

  for (const cardTone of ['print_preflight', 'print_preflight_passed']) {
    const tree = render({ cardTone });
    const rectangle = find(tree, node => node.type === ui.Rectangle);
    const gradient = rectangle.props.modifiers.find(modifier => modifier.name === 'foregroundStyle').args[0];
    assert.equal(gradient.type, 'linearGradient');
    assert.ok(gradient.colors.every(color => Array.isArray(color.semantic)));
  }
});

test('iOS interactive rows put tap and long press on one full-width gesture owner', () => {
  const { ui, render } = fixture();
  for (const overrides of [{}, { statusText: 'Ish jarayonida', cardTone: 'in_progress' }, { cardTone: 'history_partial' }]) {
    let taps = 0, holds = 0;
    const row = render({ ...overrides, onPress: () => taps++, onLongPress: () => holds++ });
    assert.equal(row.type, ui.HStack);
    assert.equal(find(row, node => node.type === ui.ListItem), null, 'no nested Button can consume the row gesture');
    const mods = row.props.modifiers;
    assert.ok(mods.some(modifier => modifier.name === 'contentShape'));
    mods.find(modifier => modifier.name === 'onTapGesture').args[0]();
    assert.equal(taps, 1); assert.equal(holds, 0);
    mods.find(modifier => modifier.name === 'onLongPressGesture').args[0]();
    assert.equal(taps, 1); assert.equal(holds, 1);
    assert.ok(find(row, node => node.type === ui.Spacer));
    assert.equal(find(row, node => node.type === 'View').props.pointerEvents, 'none');
  }
});
