const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.rendered ? node.rendered.tree : node.props?.children, predicate)];
}

function setup() {
  const calls = [], pending = new Set(); let active, inventoryReads = 0, fabRenders = 0;
  const react = {
    useState(initial) {
      const instance = active, index = instance.cursor++;
      if (!(index in instance.slots)) instance.slots[index] = initial;
      return [instance.slots[index], next => {
        const value = typeof next === 'function' ? next(instance.slots[index]) : next;
        if (Object.is(instance.slots[index], value)) return;
        instance.slots[index] = value; pending.add(instance);
      }];
    },
    useRef(initial) {
      const index = active.cursor++; return active.slots[index] ??= { current: initial };
    },
    useMemo(factory, dependencies) {
      const index = active.cursor++, previous = active.slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        active.slots[index] = { dependencies, value: factory() };
      }
      return active.slots[index].value;
    },
    useImperativeHandle(ref, create) { ref.current = create(); },
    useEffect() {},
  };
  function mount(component, props) {
    const instance = { slots: [], cursor: 0, renders: 0, tree: null, render() {
      const previous = active; active = instance; instance.cursor = 0; instance.renders++;
      try { instance.tree = component(props); expand(instance.tree); return instance.tree; } finally { active = previous; }
    } };
    instance.render(); return instance;
  }
  function expand(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(expand); return; }
    if (typeof node.type === 'function') node.rendered = mount(node.type, node.props);
    else expand(node.props?.children);
  }
  const asset = { kind: 'raw_material', asset_ref: 'roll-1', item_name: 'BOPP', item_code: 'BOPP', identifier: 'ROLL-1',
    qty: 100, uom: 'kg', custody_warehouse: 'Own', status: 'available', physical_location: { kind: 'warehouse', name: 'Own' } };
  const transfer = { id: 'transfer-1', source_warehouse: 'Own', destination_warehouse: 'Other', lines: [], status: 'received' };
  const window = () => ({ rows: [], loading: false, error: null, hasMore: false });
  const inventory = { tab: 'assets', query: '', warehouse: '', warehouses: [{ warehouse_id: 'a', name: 'Own' }],
    locations: { loading: false, error: null }, assets: window(), incoming: window(), outgoing: window(),
    visibleAssets: [asset], visibleIncoming: [transfer], visibleOutgoing: [transfer], qrAssets: [], current: () => true,
    canTransfer: () => true };
  const session = { capabilities: ['raw_material.assign'] }, home = { snapshot: { assigned_warehouses: ['Own'] } };
  const shared = value => ({ value, set(next) { this.value = next; } });
  const ui = new Proxy({ usePreparationText: () => value => value, usePreparationDialogs: () => ({}) },
    { get: (object, key) => object[key] ?? key });
  const mocks = {
    'react/jsx-runtime': jsx, react, 'expo-camera': { useCameraPermissions: () => [{ granted: true }, () => {}] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({}) },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: () => ({}), weight: () => ({}) },
    'expo-image': { Image: 'Image' }, 'expo-router': { router: {} }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'qrcode-generator': { __esModule: true, default: () => { calls.push(['qr']); return { addData: value => calls.push(['barcode', value]),
      make() {}, createDataURL: () => 'data:image/gif;base64,qr' }; } },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', StyleSheet: { create: value => value },
      useWindowDimensions: () => ({ height: 800, width: 400 }) },
    'react-native-reanimated': { useSharedValue: shared }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '../components/WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/orders/OrdersWorkspace': { OrdersWorkspace: props => jsx.jsxs('Workspace', {
      children: [props.header, ...props.tabs.map(tab => props.children(tab.id))],
    }) },
    './PreparationContext.android': { usePreparationContext: () => ({ session, home }) },
    './PreparationFab.android': { usePreparationFab: () => { fabRenders++; return () => {}; } },
    './PreparationInventoryDetails.android': { InventorySheetSummary: 'InventorySheetSummary', InventorySheetButton: 'InventorySheetButton', InventoryDetailRow: 'InventoryDetailRow' },
    './preparationInventory': { preparationInventoryAssetBarcode: value => value.identifier, preparationInventoryQuantity: value => String(value),
      preparationInventoryStatus: value => value, preparationInventoryTransferTimestamp: () => 'date' },
    './PreparationUI.android': ui, './usePreparationInventory.android': { usePreparationInventory: () => { inventoryReads++; return inventory; } },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationMovements.android.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const screen = mount(mod.exports.PreparationInventoryScreen, {});
  return { calls, screen, counts: () => ({ inventoryReads, fabRenders }),
    flush() { while (pending.size) { const instance = pending.values().next().value; pending.delete(instance); instance.render(); } } };
}

test('opening and dismissing material and transfer sheets does not rerender the inventory list or FAB', () => {
  const x = setup();
  nodes(x.screen.tree, node => node.type === 'WorkerQueueCard')[0].props.onPress(); x.flush();
  let sheet = nodes(x.screen.tree, node => node.type === 'WorkerOrderSheet')[0];
  assert.equal(nodes(sheet, node => node.type === 'InventorySheetSummary')[0].props.title, 'BOPP');
  sheet.props.onClose(); x.flush();
  assert.equal(nodes(x.screen.tree, node => node.type === 'WorkerOrderSheet').length, 0);
  nodes(x.screen.tree, node => node.type === 'WorkerQueueCard').at(-1).props.onPress(); x.flush();
  sheet = nodes(x.screen.tree, node => node.type === 'WorkerOrderSheet')[0];
  assert.equal(nodes(sheet, node => node.type === 'InventorySheetSummary')[0].props.title, 'Own → Other');
  sheet.props.onClose(); x.flush();
  assert.equal(nodes(x.screen.tree, node => node.type === 'WorkerOrderSheet').length, 0);
  assert.equal(x.screen.renders, 1);
  assert.deepEqual(x.counts(), { inventoryReads: 1, fabRenders: 1 });
});

test('opening material details skips QR generation until the QR action is pressed', () => {
  const x = setup();
  nodes(x.screen.tree, node => node.type === 'WorkerQueueCard')[0].props.onPress(); x.flush();
  assert.deepEqual(x.calls, []);
  nodes(x.screen.tree, node => node.type === 'InventorySheetSummary')[0].props.onShowQr(); x.flush();
  assert.deepEqual(x.calls, [['qr'], ['barcode', 'ROLL-1']]);
  assert.equal(nodes(x.screen.tree, node => node.type === 'Image')[0].props.source.uri, 'data:image/gif;base64,qr');
  assert.equal(x.screen.renders, 1);
});
