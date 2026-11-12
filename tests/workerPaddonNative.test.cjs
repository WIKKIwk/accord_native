const assert = require('node:assert/strict'), test = require('node:test');
const { setup, hooks, batch, tick, snapshot, jsx } = require('./support/workerPaddonHarness.cjs');
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children), ...walk(node.props?.ListHeaderComponent)];
const node = (tree, type, predicate = () => true) => walk(tree).find(row => row.type === type && predicate(row));
const proxy = new Proxy({}, { get: (_target, key) => key });
const mods = new Proxy({}, { get: (_target, key) => key === 'shapes' ? { rectangle: () => ({ shape: 'rectangle' }), roundedRectangle: args => ({ shape: 'roundedRectangle', ...args }) } : (...args) => ({ name: key, args }) });
function native(h) {
  const runner = hooks(), events = h.events;
  h.packages.react = runner.react;
  h.packages['@expo/ui/swift-ui'] = { ...proxy, Alert: Object.assign(() => {}, { Trigger: 'Alert.Trigger', Message: 'Alert.Message', Actions: 'Alert.Actions' }),
    Host: 'Host', Button: 'Button', HStack: 'HStack', Image: 'Image', List: 'List', ProgressView: 'ProgressView', RNHostView: 'RNHostView', Section: 'Section', Spacer: 'Spacer', SwipeActions: Object.assign(() => {}, { Actions: 'SwipeActions.Actions' }), Text: 'Text', VStack: 'VStack' };
  h.packages['@expo/ui/swift-ui/modifiers'] = mods;
  h.packages['@expo/ui/jetpack-compose'] = { Host: 'Host', Text: 'Text', Column: 'Column', Row: 'Row', TextButton: 'TextButton',
    AlertDialog: Object.assign(() => {}, { Title: 'AlertDialog.Title', Text: 'AlertDialog.Text', DismissButton: 'AlertDialog.DismissButton', ConfirmButton: 'AlertDialog.ConfirmButton' }), RNHostView: 'RNHostView',
    useMaterialColors: () => ({ background: 'bg', primary: 'primary' }) };
  h.packages['@expo/ui/jetpack-compose/modifiers'] = mods;
  h.packages['@expo/ui/community/menu'] = { MenuView: 'MenuView' };
  h.packages['expo-symbols'] = { SymbolView: 'SymbolView' };
  h.packages['react-native-safe-area-context'] = { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
  h.packages['react-native'] = { ...h.packages['react-native'], View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', FlatList: 'FlatList', ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', RefreshControl: 'RefreshControl',
    PlatformColor: value => value, useWindowDimensions: () => ({ width: h.width ?? 400, height: 800, fontScale: h.fontScale ?? 1 }), BackHandler: { addEventListener: (_name, fn) => { h.hardwareBack = fn; return { remove() {} }; } } };
  h.packages['expo-router'] = { Stack: { Screen: 'Stack.Screen' }, useNavigation: () => ({ dispatch: action => events.push(['dispatch', action]) }), usePreventRemove: (blocked, callback) => { h.prevent = { blocked, callback }; } };
  h.packages['react-native-gesture-handler/ReanimatedSwipeable'] = { __esModule: true, default: 'Swipeable' };
  h.packages['react-native-gesture-handler'] = { GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector', usePanGesture: config => config };
  for (const name of ['BaseHost', 'WorkerPaddonDialog', 'WorkerPaddonFeedback', 'WorkerPaddonCamera', 'WorkerQueueCard.android']) h.files[`components/${name}`] = { [name.split('.')[0]]: name };
  h.files['shared/navigation/RoleHeader.android'] = { RoleHeader: 'RoleHeader' };
  h.files['shared/navigation/RoleHeaderButton'] = { RoleHeaderButton: 'RoleHeaderButton' };
  h.files['shared/navigation/RoleFab.android'] = { RoleFab: 'RoleFab' };
  h.files['components/WorkerOrderControls'] = { WorkerOrderButton: 'Action' };
  h.files['components/WorkerPaddonWip'] = { WorkerPaddonWipCard: 'WipCard', WorkerPaddonWipContent: 'WipContent' };
  h.files['components/useWorkerColors'] = { useWorkerColors: () => ({ background: 'bg', surface: 'surface' }) };
  h.files['../modules/accord-list-scroll/src/AccordListScrollReader'] = { AccordListScrollReader: 'ListScrollReader' };
  const render = (Component, props) => { runner.begin(); const tree = Component(props); runner.flush(); return tree; };
  return { render, runner };
}
for (const platform of ['ios', 'android']) test(`${platform}: Paddon list shows V2 totals, rows, navigation, and the compact action menu`, async () => {
  const h = await setup('list', platform), n = native(h);
  h.paddons.get('P1').paddon.item_count = 3; await h.model.controller.load(); h.render();
  h.files['components/useWorkerPaddonList'] = { useWorkerPaddonList: () => h.model };
  const Component = h.load(`components/WorkerPaddonList.${platform}`).WorkerPaddonList;
  try {
    const tree = n.render(Component, h.props), text = walk(tree).filter(row => row.type === 'Text').map(row => row.props.children);
    assert(text.includes('worker.paddons: 2')); assert(text.includes('worker.daily.wip: 3'));
    if (platform === 'ios') {
      assert.equal(node(tree, 'Stack.Screen').props.options.headerBackButtonDisplayMode, 'minimal');
      const row = walk(tree).find(item => item.type === 'HStack' && walk(item).some(child => child.type === 'Text' && child.props.children === 'P1'));
      assert(row.props.modifiers.some(item => item.name === 'contentShape'));
      row.props.modifiers.find(item => item.name === 'onTapGesture').args[0]();
      const menu = node(tree, 'MenuView'); assert.deepEqual(menu.props.actions.map(item => item.id), ['transfer', 'create']);
      assert.equal(menu.props.style.bottom, 88);
      const host = walk(tree).find(item => item.type === 'BaseHost' && node(item, 'List'));
      assert.deepEqual(host.props.style, { flex: 1 });
      menu.props.onPressAction({ nativeEvent: { event: 'transfer' } });
      menu.props.onPressAction({ nativeEvent: { event: 'create' } });
    } else {
      const list = node(tree, 'FlatList'), row = list.props.renderItem({ item: h.model.state.rows[0], index: 0 });
      assert(node(row, 'SymbolView', item => item.props.name.android === 'inventory_2'));
      assert(node(row, 'SymbolView', item => item.props.name.android === 'chevron_right'));
      row.props.onPress();
      const fab = node(tree, 'RoleFab'); assert.deepEqual(fab.props.actions.map(item => item.id), ['transfer', 'create']);
      fab.props.onSelect('transfer'); fab.props.onSelect('create');
      assert.equal(h.hardwareBack(), true);
    }
    await tick();
    assert(h.events.some(event => event[0] === 'detail' && event[1] === 'P1'));
    assert(h.events.some(event => event[0] === 'transferRoute' && event[1] === 'cut'));
    assert(h.events.some(event => event[0] === 'create' && event[1] === 'cut'));
    h.expire(); h.render(); assert.equal(n.render(Component, h.props), null);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('Android Paddon list keeps the worker navigation beneath the action area', async () => {
  const h = await setup('list', 'android'), n = native(h), selected = [];
  for (const name of ['WorkerPaddonList', 'WorkerPaddonDetail', 'WorkerPaddonTransfer', 'WorkerBottomBar']) h.files[`components/${name}`] = { [name]: name };
  const Component = h.load('components/WorkerPaddons.android').WorkerPaddons;
  try {
    let tree = n.render(Component, { ...h.props, onSelect: id => selected.push(id) });
    const bar = node(tree, 'WorkerBottomBar'); assert.equal(bar.props.active, ''); bar.props.onSelect('profile');
    node(tree, 'WorkerPaddonList').props.onProfile(); assert.deepEqual(selected, ['profile', 'profile']);
    node(tree, 'WorkerPaddonList').props.onDetail('P1', 'cut'); tree = n.render(Component, h.props);
    assert(node(tree, 'WorkerPaddonDetail')); assert.equal(node(tree, 'WorkerBottomBar'), undefined);
    node(tree, 'WorkerPaddonDetail').props.onBack(); tree = n.render(Component, { ...h.props, onSelect: id => selected.push(id) });
    assert(node(tree, 'WorkerPaddonList')); assert(node(tree, 'WorkerBottomBar'));
  } finally { n.runner.dispose(); h.dispose(); }
});
test('iOS Paddon list keeps all rows in the full-height scroll area with its FAB overlaid', async () => {
  const h = await setup('list', 'ios'), n = native(h);
  for (const code of ['P3', 'P4', 'P5']) h.paddons.set(code, snapshot(code));
  await h.model.controller.load(); h.render(); h.files['components/useWorkerPaddonList'] = { useWorkerPaddonList: () => h.model };
  const Component = h.load('components/WorkerPaddonList.ios').WorkerPaddonList;
  try {
    const tree = n.render(Component, h.props), host = walk(tree).find(item => item.type === 'BaseHost' && node(item, 'List'));
    assert.deepEqual(host.props.style, { flex: 1 });
    assert.equal(node(tree, 'MenuView').props.style.bottom, 88);
    const rows = walk(node(host, 'List')).filter(item => item.type === 'HStack' && item.props.modifiers?.some(modifier => modifier.name === 'onTapGesture'));
    assert.equal(rows.length, 5);
    rows[4].props.modifiers.find(modifier => modifier.name === 'onTapGesture').args[0]();
    assert.deepEqual(h.events.find(event => event[0] === 'detail'), ['detail', 'P5', 'cut', 'cut']);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('iOS Paddon scan activation targets the inline camera while preserving the native List and row swipe actions', async () => {
  const h = await setup('detail', 'ios'), n = native(h);
  h.paddons.get('P1').items = [batch('A')]; await h.model.controller.load(); h.render();
  h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
  const Component = h.load('components/WorkerPaddonDetail.ios').WorkerPaddonDetail;
  try {
    let tree = n.render(Component, h.props);
    assert.equal(node(tree, 'ListScrollReader').props.targetID, '');
    assert(node(tree, 'List')); assert(node(tree, 'SwipeActions.Actions'));
    node(tree, 'MenuView').props.onPressAction({ nativeEvent: { event: 'scan' } }); h.render(); tree = n.render(Component, h.props);
    const targetID = node(tree, 'ListScrollReader').props.targetID;
    assert.equal(targetID, 'accord-paddon-inline-camera');
    const cameraRow = node(tree, 'VStack', row => !!node(row, 'WorkerPaddonCamera'));
    assert.deepEqual(cameraRow.props.modifiers, [{ name: 'id', args: [targetID] }]);
    h.model.controller.clearFeedback(); h.render(); tree = n.render(Component, h.props);
    assert.equal(node(tree, 'ListScrollReader').props.targetID, targetID, 'feedback updates must not request another native scroll');
    h.model.controller.cancelScan(); h.render(); tree = n.render(Component, h.props);
    assert.equal(node(tree, 'ListScrollReader').props.targetID, ''); assert.equal(node(tree, 'WorkerPaddonCamera'), undefined);
    assert(node(tree, 'List')); assert(node(tree, 'SwipeActions.Actions'), 'row removal keeps the original native List swipe surface');
    h.model.controller.startScan(); h.render(); tree = n.render(Component, h.props);
    assert.equal(node(tree, 'ListScrollReader').props.targetID, targetID, 'a new scan activation restores the target after native cancellation');
  } finally { n.runner.dispose(); h.dispose(); }
});
// @v2-test test/aparatchi_paddons_test.dart
for (const platform of ['ios', 'android']) {
  test(`${platform}: native detail actions reach the real scan/review controller and stop exposing a retired account`, async () => {
    const h = await setup('detail', platform), n = native(h);
    h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
    const Component = h.load(`components/WorkerPaddonDetail.${platform}`).WorkerPaddonDetail;
    try {
      let tree = n.render(Component, h.props);
      if (platform === 'ios') node(tree, 'MenuView').props.onPressAction({ nativeEvent: { event: 'scan' } });
      else node(tree, 'Action', row => row.props.label === 'worker.paddon.add_wip').props.onPress();
      h.render();
      tree = n.render(Component, h.props); const camera = node(tree, 'WorkerPaddonCamera'); assert(camera.props.enabled);
      await camera.props.accept('A'); await tick(); h.render(); tree = n.render(Component, h.props);
      const dock = platform === 'ios' ? node(tree, 'MenuView').props.actions.map(row => row.title)
        : walk(tree).filter(row => row.type === 'Action').map(row => row.props.label);
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
for (const order of ['button-first', 'dismissal-first']) test(`iOS successor alert resolves the choice after native dismissal (${order})`, async () => {
  const h = await setup('detail', 'ios'), n = native(h), Component = h.load('components/WorkerPaddonDialog.ios').WorkerPaddonDialog;
  try {
    const operation = h.model.presentation.open({ kind: 'successor', title: 'New pallet?', message: 'P1 locked', cancelLabel: 'No', confirmLabel: 'Yes' }); h.render();
    let settled = false; operation.then(() => { settled = true; });
    const outer = n.render(Component, { data: h.model.presentation.data, visible: h.model.presentation.visible, close: h.model.presentation.close, dismissed: h.model.presentation.dismissed });
    const tree = n.render(outer.type, outer.props), alert = node(tree, h.packages['@expo/ui/swift-ui'].Alert);
    assert.equal(alert.props.title, 'New pallet?'); assert(node(tree, 'Alert.Message'));
    const buttons = walk(node(tree, 'Alert.Actions')).filter(row => row.type === 'Button');
    assert.deepEqual(buttons.map(row => row.props.label), ['No', 'Yes']);
    assert.equal(buttons[0].props.role, 'cancel');
    if (order === 'button-first') {
      buttons[1].props.onPress(); h.render(); await tick(); assert.equal(settled, false);
      alert.props.onIsPresentedChange(false);
    } else {
      alert.props.onIsPresentedChange(false); await tick(); assert.equal(settled, false);
      buttons[1].props.onPress();
    }
    assert.equal(await operation, 'confirm');
    alert.props.onIsPresentedChange(false); buttons[1].props.onPress();
    assert.equal(h.model.presentation.isOpen(), false);
  } finally { n.runner.dispose(); h.dispose(); }
});
test('iOS successor alert treats dismissal without a button as cancellation', async () => {
  const h = await setup('detail', 'ios'), n = native(h), Component = h.load('components/WorkerPaddonDialog.ios').WorkerPaddonDialog;
  try {
    const operation = h.model.presentation.open({ kind: 'successor', title: 'New pallet?', cancelLabel: 'No', confirmLabel: 'Yes' }); h.render();
    const outer = n.render(Component, { data: h.model.presentation.data, visible: h.model.presentation.visible, close: h.model.presentation.close, dismissed: h.model.presentation.dismissed });
    const tree = n.render(outer.type, outer.props);
    node(tree, h.packages['@expo/ui/swift-ui'].Alert).props.onIsPresentedChange(false);
    assert.equal(await operation, null);
  } finally { n.runner.dispose(); h.dispose(); }
});
for (const answer of ['No', 'Yes']) test(`iOS successor alert ${answer} preserves the print workflow`, async () => {
  const h = await setup('detail', 'ios'), n = native(h), Component = h.load('components/WorkerPaddonDialog.ios').WorkerPaddonDialog;
  try {
    const operation = h.model.print(); await tick(); h.render();
    assert.equal(h.model.presentation.data.kind, 'successor');
    const outer = n.render(Component, { data: h.model.presentation.data, visible: h.model.presentation.visible, close: h.model.presentation.close, dismissed: h.model.presentation.dismissed });
    const tree = n.render(outer.type, outer.props), alert = node(tree, h.packages['@expo/ui/swift-ui'].Alert);
    node(tree, 'Button', row => row.props.label === (answer === 'Yes' ? 'Ha' : 'Yo‘q')).props.onPress();
    h.render(); await tick(); assert.equal(h.events.some(event => event[0] === 'successor'), false);
    alert.props.onIsPresentedChange(false); await operation;
    assert.equal(h.events.some(event => event[0] === 'successor'), answer === 'Yes');
  } finally { n.runner.dispose(); h.dispose(); }
});
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
test('iOS Paddon detail keeps the back button and action menu clear of the tab bar', async () => {
  const h = await setup('detail', 'ios'), n = native(h);
  h.paddons.get('P1').items = [batch('A', { bobina_kg: 1 }), batch('B', { bobina_kg: 12 }), batch('C', { bobina_kg: 151 }), batch('D', { bobina_kg: null })];
  await h.model.controller.load(); h.render(); h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
  const Component = h.load('components/WorkerPaddonDetail.ios').WorkerPaddonDetail;
  try {
    let tree = n.render(Component, h.props), menu = node(tree, 'MenuView');
    assert.equal(node(tree, 'Stack.Screen').props.options.headerBackButtonDisplayMode, 'minimal');
    assert.equal(menu.props.style.bottom, 88);
    const host = walk(tree).find(row => row.type === 'BaseHost' && node(row, 'ListScrollReader'));
    assert.deepEqual(host.props.style, { flex: 1 });
    assert.deepEqual(menu.props.actions.map(action => action.id), ['scan', 'add', 'remove']);
    const groups = () => {
      const panel = walk(tree).find(item => item.type === 'VStack' && Array.isArray(item.props.children) && item.props.children[0]?.props?.children === h.model.header.bobinaTitle);
      return panel.props.children.flat().filter(item => item?.type === 'HStack');
    };
    assert.equal(h.model.header.bobina.length, 4); assert.deepEqual(groups().map(row => walk(row).filter(item => item.type === 'Button').length), [2, 2]);
    const first = walk(groups()[0]).find(item => item.type === 'Button'); first.props.onPress(); h.render();
    assert.equal(h.model.state.bobina, h.model.header.bobina[0].units);
    h.fontScale = 2; tree = n.render(Component, h.props); assert.deepEqual(groups().map(row => walk(row).filter(item => item.type === 'Button').length), [1, 1, 1, 1]);
    h.fontScale = 1; h.model.controller.filter(h.model.header.bobina[0].units); h.render();
    await h.model.edit('remove'); h.render(); h.model.controller.toggle('A'); h.render();
    tree = n.render(Component, h.props); menu = node(tree, 'MenuView');
    assert.deepEqual(menu.props.actions.map(action => action.id), ['add', 'remove', 'cancel']);
    assert.equal(menu.props.actions.find(action => action.id === 'add').attributes.disabled, true);
    menu.props.onPressAction({ nativeEvent: { event: 'add' } }); assert.equal(h.model.state.mode, 'remove');
    menu.props.onPressAction({ nativeEvent: { event: 'cancel' } }); h.render();
    assert.equal(h.model.presentation.data.title, 'worker.paddon.confirm.cancel.title');
  } finally { n.runner.dispose(); h.dispose(); }
});
test('iOS Paddon detail menu preserves scan cancellation and confirmation', async () => {
  const h = await setup('detail', 'ios'), n = native(h);
  h.files['components/useWorkerPaddonDetail'] = { useWorkerPaddonDetail: () => h.model };
  const Component = h.load('components/WorkerPaddonDetail.ios').WorkerPaddonDetail;
  const press = (tree, id) => node(tree, 'MenuView').props.onPressAction({ nativeEvent: { event: id } });
  try {
    let tree = n.render(Component, h.props); press(tree, 'scan'); h.render(); tree = n.render(Component, h.props);
    assert.equal(node(tree, 'MenuView').props.actions.find(action => action.id === 'confirm').attributes.disabled, true);
    press(tree, 'confirm'); assert.equal(h.events.some(event => event[0] === 'add'), false);
    press(tree, 'close'); await tick(); h.render(); assert.equal(h.model.state.scanning, false);
    tree = n.render(Component, h.props); press(tree, 'scan'); h.render(); tree = n.render(Component, h.props);
    node(tree, 'WorkerPaddonCamera').props.accept('A'); await tick(); h.render(); tree = n.render(Component, h.props);
    assert.equal(node(tree, 'MenuView').props.actions.find(action => action.id === 'confirm').attributes.disabled, false);
    press(tree, 'confirm'); await tick(); h.render();
    assert.deepEqual(h.events.find(event => event[0] === 'add'), ['add', ['A']]); assert.equal(h.model.state.scanning, false);
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
test('FAB eligibility follows assigned active cutters and the current account, not other visible machines', async () => {
  const h = await setup('list'), runner = hooks(); h.packages.react = runner.react;
  const useNavigation = h.load('components/useWorkerPaddonNavigation').useWorkerPaddonNavigation;
  const render = owner => { runner.begin(); const value = useNavigation(true, owner); runner.flush(); return value; };
  try {
    h.catalog.push({ id: 'lam', name: 'Lamination', operation: 'laminate', lifecycle_state: 'active', sort_order: 0 },
      { id: 'retired', name: 'Old cutter', operation: 'cut', lifecycle_state: 'retired', sort_order: 0 },
      { id: 'unassigned', name: 'Other cutter', operation: 'cut', lifecycle_state: 'active', sort_order: 0 });
    h.session.assigned_apparatus = ['lam', 'retired']; h.expire(); render(h.session); await tick();
    assert.deepEqual(render(h.session), []);
    h.session.assigned_apparatus = ['lam', 'cut']; h.expire(); render(h.session); await tick();
    assert.deepEqual(render(h.session).map(item => item.id), ['paddons:cut']);
    h.session.assigned_apparatus = ['lam']; h.expire();
    assert.deepEqual(render(h.session), []); await tick(); assert.deepEqual(render(h.session), []);
    h.session.assigned_apparatus = []; h.expire();
    const reads = h.events.filter(event => event[0] === 'catalog').length;
    assert.deepEqual(render(h.session), []); await tick();
    assert.equal(h.events.filter(event => event[0] === 'catalog').length, reads);
    h.session.assigned_apparatus = ['cut']; h.expire(); render(h.session); await tick();
    assert.equal(render(h.session).length, 1);
    const previous = h.session;
    h.session = { ...previous, token: 'other', assigned_apparatus: ['lam'] }; h.expire();
    assert.deepEqual(render(previous), []);
    assert.deepEqual(render(h.session), []); await tick(); assert.deepEqual(render(h.session), []);
  } finally { runner.dispose(); h.dispose(); }
});
test('FAB eligibility can recover on a refreshed queue catalog after an apparatus read fails', async () => {
  const h = await setup('list'), runner = hooks(), pending = []; h.packages.react = runner.react;
  h.files.apparatusApi.adminApparatus = (_session, options) => { options.beforeSend(); assert.equal(options.retryTransient, true);
    const read = {}; read.promise = new Promise((resolve, reject) => { read.resolve = resolve; read.reject = reject; }); pending.push(read); return read.promise; };
  const useNavigation = h.load('components/useWorkerPaddonNavigation').useWorkerPaddonNavigation;
  const render = key => { runner.begin(); const value = useNavigation(true, h.session, key); runner.flush(); return value; };
  try {
    assert.deepEqual(render('initial'), []); pending[0].reject(Error('offline')); await tick();
    assert.deepEqual(render('initial'), []); assert.deepEqual(render('reconnected'), []);
    pending[1].resolve(h.catalog); await tick();
    assert.deepEqual(render('reconnected').map(item => item.id), ['paddons:cut', 'paddons:cut2']);
  } finally { runner.dispose(); h.dispose(); }
});
