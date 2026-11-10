const assert = require('node:assert/strict'), test = require('node:test');
const { setup, hooks, batch, tick, jsx } = require('./support/workerPaddonHarness.cjs');
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children), ...walk(node.props?.ListHeaderComponent)];
const node = (tree, type, predicate = () => true) => walk(tree).find(row => row.type === type && predicate(row));
const proxy = new Proxy({}, { get: (_target, key) => key });
const mods = new Proxy({}, { get: (_target, key) => (...args) => ({ name: key, args }) });
function native(h) {
  const runner = hooks(), events = h.events;
  h.packages.react = runner.react;
  h.packages['@expo/ui/swift-ui'] = { ...proxy, Button: 'Button', HStack: 'HStack', List: 'List', ProgressView: 'ProgressView', RNHostView: 'RNHostView', Section: 'Section', Spacer: 'Spacer', SwipeActions: Object.assign(() => {}, { Actions: 'SwipeActions.Actions' }), Text: 'Text', VStack: 'VStack' };
  h.packages['@expo/ui/swift-ui/modifiers'] = mods;
  h.packages['@expo/ui/jetpack-compose'] = { Host: 'Host', Text: 'Text', Column: 'Column', TextButton: 'TextButton',
    AlertDialog: Object.assign(() => {}, { Title: 'AlertDialog.Title', Text: 'AlertDialog.Text', DismissButton: 'AlertDialog.DismissButton', ConfirmButton: 'AlertDialog.ConfirmButton' }), RNHostView: 'RNHostView',
    useMaterialColors: () => ({ background: 'bg', primary: 'primary' }) };
  h.packages['react-native'] = { ...h.packages['react-native'], View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', FlatList: 'FlatList', ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', RefreshControl: 'RefreshControl',
    useWindowDimensions: () => ({ width: 400, height: 800 }), BackHandler: { addEventListener: (_name, fn) => { h.hardwareBack = fn; return { remove() {} }; } } };
  h.packages['expo-router'] = { Stack: { Screen: 'Stack.Screen' }, useNavigation: () => ({ dispatch: action => events.push(['dispatch', action]) }), usePreventRemove: (blocked, callback) => { h.prevent = { blocked, callback }; } };
  h.packages['react-native-gesture-handler/ReanimatedSwipeable'] = { __esModule: true, default: 'Swipeable' };
  h.packages['react-native-gesture-handler'] = { GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector', usePanGesture: config => config };
  for (const name of ['BaseHost', 'WorkerPaddonDialog', 'WorkerPaddonFeedback', 'WorkerPaddonCamera', 'WorkerQueueCard.android']) h.files[`components/${name}`] = { [name.split('.')[0]]: name };
  h.files['shared/navigation/RoleHeader.android'] = { RoleHeader: 'RoleHeader' };
  h.files['components/WorkerOrderControls'] = { WorkerOrderButton: 'Action' };
  h.files['components/WorkerPaddonWip'] = { WorkerPaddonWipCard: 'WipCard', WorkerPaddonWipContent: 'WipContent' };
  h.files['components/useWorkerColors'] = { useWorkerColors: () => ({ background: 'bg', surface: 'surface' }) };
  const render = (Component, props) => { runner.begin(); const tree = Component(props); runner.flush(); return tree; };
  return { render, runner };
}
// @v2-test test/aparatchi_paddons_test.dart
for (const platform of ['ios', 'android']) {
  test(`${platform}: native detail actions reach the real scan/review controller and stop exposing a retired account`, async () => {
    const h = await setup('detail', platform), n = native(h);
    h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
    const Component = h.load(`components/WorkerPaddonDetail.${platform}`).WorkerPaddonDetail;
    try {
      let tree = n.render(Component, h.props);
      node(tree, 'Action', row => row.props.label === 'worker.paddon.add_wip').props.onPress(); h.render();
      tree = n.render(Component, h.props); const camera = node(tree, 'WorkerPaddonCamera'); assert(camera.props.enabled);
      await camera.props.accept('A'); await tick(); h.render(); tree = n.render(Component, h.props);
      const dock = walk(tree).filter(row => row.type === 'Action').map(row => row.props.label);
      assert.deepEqual(dock.slice(-2), ['worker.paddon.scan.confirm|{"count":1}', 'worker.paddon.scan.close']);
      const review = platform === 'ios' ? node(tree, 'Button', row => row.props.label === 'worker.paddon.scan.pending|{"count":1}') : node(tree, 'Action', row => row.props.label === 'worker.paddon.scan.pending|{"count":1}');
      review.props.onPress(); h.render(); tree = n.render(Component, h.props);
      assert.equal(node(tree, 'WorkerPaddonDialog').props.data.confirmDisabled, false);
      node(tree, 'Pressable', row => walk(row).some(child => child.type === 'WipCard' && child.props.selectionIcon === 'close')).props.onPress();
      h.render(); tree = n.render(Component, h.props); assert.equal(node(tree, 'WorkerPaddonDialog').props.data.confirmDisabled, true);
      h.expire(); h.render(); assert.equal(n.render(Component, h.props), null);
    } finally { n.runner.dispose(); h.dispose(); }
  });
  test(`${platform}: assigned roll swipe uses the single removal endpoint only after a native confirmation`, async () => {
    const h = await setup('detail', platform), n = native(h);
    h.paddons.get('P1').items = [batch('A')]; await h.model.controller.load(); h.render();
    h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
    const Component = h.load(`components/WorkerPaddonDetail.${platform}`).WorkerPaddonDetail;
    try {
      const tree = n.render(Component, h.props);
      const action = platform === 'ios' ? node(tree, 'Button', row => row.props.role === 'destructive')
        : node(node(tree, 'FlatList').props.renderItem({ item: h.model.rows[0], index: 0 }).props.renderRightActions(), 'Action');
      action.props.onPress(); h.render(); assert.equal(h.events.some(e => e[0] === 'remove'), false);
      await h.close(); assert.deepEqual(h.events.find(e => e[0] === 'remove'), ['remove', ['A'], true]);
    } finally { n.runner.dispose(); h.dispose(); }
  });
  test(`${platform}: native confirmation has Cancel before Confirm and its dismissal resolves the pending operation`, async () => {
    const h = await setup('detail', platform), n = native(h), Component = h.load(`components/WorkerPaddonDialog.${platform}`).WorkerPaddonDialog;
    try {
      const operation = h.model.presentation.open({ title: 'Title', message: 'Body', cancelLabel: 'No', confirmLabel: 'Yes' }); h.render();
      let settled = false; operation.then(() => { settled = true; });
      const tree = n.render(Component, { data: h.model.presentation.data, visible: h.model.presentation.visible, close: h.model.presentation.close, dismissed: h.model.presentation.dismissed });
      if (platform === 'ios') {
        const buttons = walk(tree).filter(row => row.type === 'Button'); assert.deepEqual(buttons.map(row => row.props.label), ['No', 'Yes']);
        buttons[1].props.onPress(); h.render(); await tick(); assert.equal(settled, false); node(tree, 'Modal').props.onDismiss();
      } else {
        assert(walk(tree).findIndex(row => row.type === 'AlertDialog.DismissButton') < walk(tree).findIndex(row => row.type === 'AlertDialog.ConfirmButton'));
        node(node(tree, 'AlertDialog.ConfirmButton'), 'TextButton').props.onClick(); h.render();
      }
      assert.equal(await operation, 'confirm');
    } finally { n.runner.dispose(); h.dispose(); }
  });
}
test('long-press transfer checks the opposite native drop zone and rechecks its original account after asynchronous measurement', async () => {
  const h = await setup('transfer'), n = native(h); h.paddons.get('P1').items = [batch('A'), batch('B')]; await h.model.controller.load(); h.render();
  const useDrag = h.load('components/useWorkerPaddonDrag').useWorkerPaddonDrag, root = { current: { measureInWindow: callback => callback(0, 20) } };
  const render = () => { n.runner.begin(); const result = useDrag(h.model, root); n.runner.flush(); return result; };
  try {
    h.model.controller.toggle('P1', 'A'); h.model.controller.toggle('P1', 'B'); h.render(); const drag = render();
    drag.zone('P1', { measureInWindow: callback => callback(0, 0, 100, 100) });
    let measure; drag.zone('P2', { measureInWindow: callback => { measure = callback; } });
    drag.start('P1', batch('A'), { x: 10, y: 20 }); const ending = drag.end({ x: 10, y: 220 });
    h.expire(); measure(0, 200, 100, 100); await ending;
    assert.equal(h.events.some(e => e[0] === 'move'), false); assert.equal(h.model.presentation.data, null);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('a valid drop carries the selected batch to the opposite Paddon and cancellation never moves it', async () => {
  const h = await setup('transfer'), n = native(h); h.paddons.get('P1').items = [batch('A'), batch('B')]; await h.model.controller.load(); h.render();
  const useDrag = h.load('components/useWorkerPaddonDrag').useWorkerPaddonDrag;
  const render = () => { n.runner.begin(); const result = useDrag(h.model, { current: null }); n.runner.flush(); return result; };
  try {
    h.model.controller.toggle('P1', 'A'); h.model.controller.toggle('P1', 'B'); h.render(); const drag = render();
    drag.zone('P2', { measureInWindow: callback => callback(0, 200, 100, 100) });
    drag.start('P1', batch('A'), { x: 10, y: 10 }); drag.cancel(); await drag.end({ x: 10, y: 220 });
    assert.equal(h.model.presentation.data, null);
    drag.start('P1', batch('A'), { x: 10, y: 10 }); const operation = drag.end({ x: 10, y: 220 }); await tick(); h.render();
    assert.match(h.model.presentation.data.message, /"count":2/); assert.equal(h.events.some(e => e[0] === 'move'), false);
    await h.close(); await operation; assert.deepEqual(h.events.find(e => e[0] === 'move'), ['move', 'P1', 'P2', ['A', 'B']]);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('the native long-press recognizer starts without release, suppresses a tap, and drops only on a noncancelled end', async () => {
  const h = await setup(), n = native(h), calls = [], Component = h.load('components/useWorkerPaddonDrag').WorkerPaddonDraggable;
  const props = { source: 'P1', batch: batch('A'), enabled: true, onPress: () => calls.push('tap'), children: jsx.jsx('Card', {}),
    drag: { start: (...args) => calls.push(['start', ...args]), update: point => calls.push(['update', point]), end: point => calls.push(['end', point]), cancel: () => calls.push('cancel') } };
  try {
    const tree = n.render(Component, props), gesture = tree.props.gesture, pressable = node(tree, 'Pressable');
    assert.equal(gesture.activateAfterLongPress, 500); pressable.props.onPressIn(); gesture.onActivate({ absoluteX: 10, absoluteY: 20 });
    assert.equal(calls[0][0], 'start'); pressable.props.onPress(); assert.equal(calls.includes('tap'), false);
    gesture.onDeactivate({ canceled: true }); assert.equal(calls.some(e => e[0] === 'end'), false); gesture.onFinalize();
    gesture.onActivate({ absoluteX: 10, absoluteY: 20 }); gesture.onDeactivate({ canceled: false, absoluteX: 30, absoluteY: 240 });
    assert.deepEqual(calls.at(-1), ['end', { x: 30, y: 240 }]);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('drawer destinations include only current assigned active cutting apparatus and discard a retired catalog response', async () => {
  const h = await setup('list'), runner = hooks(); h.packages.react = runner.react;
  const useNavigation = h.load('components/useWorkerPaddonNavigation').useWorkerPaddonNavigation;
  const render = visible => { runner.begin(); const value = useNavigation(visible); runner.flush(); return value; };
  try {
    h.catalog.push({ id: 'other', name: 'Other', operation: 'cut', lifecycle_state: 'active' }, { id: 'print', name: 'Print', operation: 'print', lifecycle_state: 'active' });
    h.session.assigned_apparatus.push('print'); render(true); await tick();
    assert.deepEqual(render(true).map(row => row.id), ['paddons:cut', 'paddons:cut2']);
    render(false); h.expire(); render(true); await tick(); const fresh = render(true); assert.equal(fresh.length, 2);
    h.session = { ...h.session, token: 'other', assigned_apparatus: ['print'] }; h.expire(); assert.deepEqual(render(true), []); await tick(); assert.deepEqual(render(true), []);
  } finally { runner.dispose(); h.dispose(); }
});
