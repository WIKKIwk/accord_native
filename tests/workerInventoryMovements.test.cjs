// @v2-test test/inventory_movements_test.dart
// @v2-test test/inventory_lazy_loading_test.dart
const assert = require('node:assert/strict');
const test = require('node:test');
const { loader, clock } = require('./support/workerQueueTransport.cjs');
const load = loader();
const model = load('shared/inventoryMovementModel');
const { InventoryMovementController } = load('shared/inventoryMovementController');
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const location = (id, name, kind = 'warehouse', warehouse = id) => ({ id, name, kind, active: true, warehouse_id: warehouse, factory_location_id: '', apparatus: [] });
const asset = (ref, kind = 'raw_material', warehouse = 'w1') => ({ kind, asset_ref: ref, item_code: ref, item_name: `Product ${ref}`, identifier: ref, qty: 10.125, uom: 'kg', status: 'available', transfer_id: '', placement_version: 1,
  custody_warehouse_id: warehouse, custody_warehouse: warehouse === 'w1' ? 'Assigned' : 'Other', physical_location: { id: warehouse, kind: 'warehouse', name: warehouse }, order_assignment_known: false, order_assignment: null });
class Lease {
  constructor(rows) { this.rows = rows; this.loading = false; this.error = null; this.trusted = false; this.ready = Promise.resolve(); this.listeners = new Set(); this.refreshes = 0; }
  addListener(listener) { this.listeners.add(listener); }
  removeListener(listener) { this.listeners.delete(listener); }
  refresh() { this.refreshes++; return Promise.resolve(); }
  dispose() { this.disposed = true; }
  publish(rows, trusted = false) { this.rows = rows; this.trusted = trusted; this.listeners.forEach(listener => listener()); }
}
function setup(overrides = {}) {
  const session = { baseUrl: 'https://example.test', token: 'unit-token', profile: { role: 'aparatchi', ref: 'worker' }, capabilities: ['inventory.movement.manage'], assigned_warehouses: [' Assigned '] };
  const locations = new Lease([location('w2', 'Other'), location('w1', 'Assigned'), location('state', 'Press', 'state', ''), { ...location('off', 'Assigned'), active: false }]);
  const assetViews = [], transferViews = [], writes = [], saved = [];
  let current = true, reconciles = 0;
  const store = { locations: () => locations, assets: input => { const lease = new Lease([asset('A'), asset('B', 'finished_goods'), asset('C', 'qolip')]); assetViews.push({ input, lease }); return lease; },
    transfers: input => { const lease = new Lease([]); transferViews.push({ input, lease }); return lease; }, reconcileAfterWrite: async () => { reconciles++; } };
  const dependencies = { store, current: () => current, restore: async () => 'w2', save: async value => saved.push(value),
    lookup: async barcode => [asset(barcode)],
    relocate: async (item, destination, key) => { writes.push({ kind: 'relocate', item, destination, key }); return { ...item, physical_location: destination }; },
    relocateBatch: async (items, destination, key) => { writes.push({ kind: 'batch', items, destination, key }); return items.map(item => ({ ...item, physical_location: destination })); },
    transfer: async (item, destination, key) => { writes.push({ kind: 'transfer', item, destination, key }); return { id: 'transfer', status: 'received', source_warehouse: item.custody_warehouse, source_warehouse_id: item.custody_warehouse_id, destination_warehouse: destination.name, destination_warehouse_id: destination.warehouse_id, lines: [], note: '', created_at_unix: 1 }; },
    key: action => `mobile:${action}:generated`, ...overrides };
  const controller = new InventoryMovementController(session, dependencies);
  return { controller, session, locations, assetViews, transferViews, writes, saved, store, dependencies, invalidate() { current = false; }, reconciles: () => reconciles };
}

test('worker inventory chooses an assigned active warehouse and reads all kinds without assignment bootstrap', async () => {
  const x = setup(); await x.controller.start();
  assert.equal(x.controller.getSnapshot().warehouse, 'w1');
  assert.deepEqual(x.controller.warehouses.map(row => row.warehouse_id), ['w1']);
  assert.deepEqual(x.assetViews[0].input, { warehouseId: 'w1', query: '', includeOrderAssignment: false });
  assert.deepEqual(x.controller.getSnapshot().assets.map(row => row.kind), ['raw_material', 'finished_goods', 'qolip']);
  assert.equal(x.transferViews.length, 0, 'transfer windows are lazy');
  x.controller.selectWarehouse('w2'); assert.equal(x.controller.getSnapshot().warehouse, 'w1');
  x.controller.dispose(); assert.equal(x.locations.disposed, true); assert.equal(x.assetViews[0].lease.disposed, true);
});

test('warehouse preference is profile-owned and inactive/unassigned selections cannot survive live locations', async () => {
  const x = setup({ restore: async () => 'w1' }); await x.controller.start();
  x.controller.selectWarehouse('w1'); await flush(); assert.deepEqual(x.saved, ['w1']);
  x.locations.publish([location('w2', 'Other')]);
  assert.equal(x.controller.getSnapshot().warehouse, ''); assert.deepEqual(x.controller.getSnapshot().assets, []);
  assert.equal(x.assetViews[0].lease.disposed, true); x.controller.dispose();
});

test('asset search waits 350ms and retires the previous query lease; transfer filters update immediately', async () => {
  const c = clock(), x = setup();
  try {
    await x.controller.start(); x.controller.setTab('incoming');
    x.transferViews[0].lease.publish([{ id: 'one', destination_warehouse: 'Assigned', source_warehouse: 'Other', lines: [{ item_name: 'Needle' }], note: '' }, { id: 'wrong', destination_warehouse: 'Other', source_warehouse: 'Assigned', lines: [], note: '' }]);
    x.controller.search(' Needle '); assert.equal(x.controller.getSnapshot().incoming.length, 1);
    c.advance(349); assert.equal(x.assetViews.length, 1);
    c.advance(1); assert.equal(x.assetViews.length, 2); assert.equal(x.assetViews[1].input.query, 'Needle'); assert.equal(x.assetViews[0].lease.disposed, true);
    x.controller.setTab('incoming'); assert.equal(x.transferViews.length, 1);
    x.controller.setTab('outgoing'); assert.deepEqual(x.transferViews[1].input, { direction: 'outgoing' });
  } finally { x.controller.dispose(); c.restore(); }
});

test('QR lookup joins in-flight codes, filters states and ignores results after scope retirement', async () => {
  const pending = deferred(); let reads = 0;
  const x = setup({ lookup: async () => { reads++; return pending.promise; } }); await x.controller.start(); x.controller.toggleScanning();
  const first = x.controller.lookup('https://example.test/qr?barcode=A'); await x.controller.lookup('a'); assert.equal(reads, 1);
  pending.resolve([{ ...asset('A'), physical_location: { id: 'state', kind: 'state', name: 'Press' } }, asset('A', 'finished_goods'), asset('other')]);
  await first; assert.deepEqual(x.controller.getSnapshot().qrAssets.map(row => row.kind), ['finished_goods']);
  assert.equal(x.controller.getSnapshot().qrStatus, '1 ta mahsulot topildi');
  x.controller.dispose();
  const late = deferred(), y = setup({ lookup: () => late.promise }); await y.controller.start(); const reading = y.controller.lookup('A');
  y.invalidate(); late.resolve([asset('A')]); await reading; assert.deepEqual(y.controller.getSnapshot().qrAssets, []); y.controller.dispose();
});

test('bulk state relocation includes all selected kinds and duplicate submits send one write', async () => {
  const pending = deferred(); let calls = 0;
  const x = setup({ relocateBatch: async () => { calls++; return pending.promise; } }); await x.controller.start();
  for (const item of x.controller.getSnapshot().assets) x.controller.toggleSelection(item);
  assert.equal(x.controller.selectedAssets.length, 3);
  const first = x.controller.relocateSelected(x.controller.states[0]); const duplicate = x.controller.relocateSelected(x.controller.states[0]);
  assert.equal(calls, 1); assert.equal(x.controller.getSnapshot().busy.has('relocate-batch'), true);
  pending.resolve(x.controller.getSnapshot().assets.map(item => ({ ...item, physical_location: { id: 'state', kind: 'state', name: 'Press' } })));
  await Promise.all([first, duplicate]); assert.equal(x.controller.getSnapshot().selected.size, 0); assert.equal(x.controller.getSnapshot().assets.length, 0);
  assert.equal(x.reconciles(), 1); x.controller.dispose();
});

test('a canonical live window defeats a delayed relocation receipt, while untrusted windows apply the committed mutation', async () => {
  const pending = deferred(), x = setup({ relocate: () => pending.promise }); await x.controller.start();
  const item = x.controller.getSnapshot().assets[0], writing = x.controller.relocate(item, x.controller.states[0]);
  const newer = { ...item, qty: 22 }; x.assetViews[0].lease.publish([newer], true);
  pending.resolve({ ...item, qty: 11 }); await writing;
  assert.equal(x.controller.getSnapshot().assets[0].qty, 22); assert.equal(x.reconciles(), 1); x.controller.dispose();
});

test('single relocation excludes other warehouses and received internal transfers remove the old warehouse row', async () => {
  const x = setup(); await x.controller.start(); const item = x.controller.getSnapshot().assets[0];
  assert.deepEqual(x.controller.relocateDestinations(item).map(row => row.id), ['state']);
  await x.controller.relocate(item, x.locations.rows[0]); assert.equal(x.writes.length, 0);
  await x.controller.transfer(item, x.locations.rows[0]); assert.equal(x.writes.length, 1); assert.equal(x.writes[0].kind, 'transfer');
  assert.equal(x.controller.getSnapshot().assets.some(row => row.asset_ref === item.asset_ref), false); x.controller.dispose();
});

test('retired scope cannot start relocation/transfer or apply an in-flight receipt', async () => {
  const pending = deferred(), x = setup({ transfer: () => pending.promise }); await x.controller.start();
  const item = x.controller.getSnapshot().assets[0], writing = x.controller.transfer(item, x.locations.rows[0]);
  x.invalidate(); pending.resolve({ id: 't', status: 'received' }); await writing;
  assert.equal(x.controller.getSnapshot().assets.length, 3); assert.equal(x.reconciles(), 0);
  await x.controller.relocate(item, x.controller.states[0]); assert.equal(x.writes.length, 0); x.controller.dispose();
});

test('React StrictMode attach cleanup attach keeps one owner and final disposal releases every lease', async () => {
  const x = setup(); x.controller.mount(); x.controller.unmount(); x.controller.mount(); await flush();
  assert.equal(x.controller.current(), true); assert.equal(x.assetViews.length, 1);
  x.controller.unmount(); await flush(); assert.equal(x.controller.current(), false); assert.equal(x.locations.disposed, true);
});

test('selection and QR matching retain V2 warehouse, availability and case rules', () => {
  const x = setup(), item = asset('a');
  assert.equal(model.movementCanSelect(x.session, item, 'w1'), true);
  assert.equal(model.movementCanSelect(x.session, { ...item, transfer_id: 'reserved' }, 'w1'), false);
  assert.equal(model.movementCanSelect(x.session, asset('b', 'qolip', 'w2'), 'w1', true), false);
  assert.equal(model.movementQrMatches([asset('OTHER')], 'unrelated').length, 1, 'source accepts one warehouse candidate if exact matches are empty');
  assert.equal(model.movementQuantity(1.120), '1.12'); assert.equal(model.movementQuantity(1.23456), '1.235');
});

test('batch relocation sends the source endpoint, normalized deduplicated assets and optional note and accepts 2xx', async () => {
  const requests = [];
  class ControlException extends Error {}
  const fixture = loader({ './authorizedFetch': { authorizedFetch: async (_session, url, init, before) => { before?.(); requests.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 201, json: async () => [] }; } },
    './workerControlsApi': { WorkerControlException: ControlException, isCanonicalApparatusId: () => true } });
  const api = fixture('shared/inventoryMovementApi'); let guarded = 0;
  const session = setup().session;
  await api.inventoryRelocateBatch(session, { assets: [asset(' A '), asset('a'), asset('a', 'qolip'), asset(' ')], physicalLocationId: ' state ', idempotencyKey: ' k ', note: ' note ' }, () => guarded++);
  assert.equal(guarded, 1); assert.deepEqual(requests, [{ url: '/v1/mobile/admin/inventory/relocations/batch', body: { assets: [{ asset_kind: 'raw_material', asset_ref: 'a' }, { asset_kind: 'qolip', asset_ref: 'a' }], physical_location_id: 'state', idempotency_key: 'k', note: 'note' } }]);
  await assert.rejects(api.inventoryRelocateBatch(session, { assets: [], physicalLocationId: 'state', idempotencyKey: 'k' })); assert.equal(requests.length, 1);
});

function surfaceHarness(x) {
  const hooks = []; let cursor = 0;
  const react = {
    useRef(value) { const index = cursor++; if (!hooks[index]) hooks[index] = { current: value }; return hooks[index]; },
    useState(value) { const index = cursor++; if (!hooks[index]) hooks[index] = { value }; return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next; }]; },
  };
  const read = loader({ react, './useWorkerInventory': { useWorkerInventory: () => ({ owner: x.controller, state: x.controller.getSnapshot(), scope: 'unit', valid: x.controller.current() }) },
    './useWorkerOrderText': { useWorkerOrderText: () => ({ t: value => value }) } });
  const { useWorkerInventorySurface } = read('components/useWorkerInventorySurface');
  return () => { cursor = 0; return useWorkerInventorySurface(x.session); };
}

test('inventory sheet continuations await actual native dismissal, keep the first rapid selection, and reject old callbacks', async () => {
  const x = setup(); await x.controller.start(); const render = surfaceHarness(x); let surface = render();
  surface.rows[0].open(); surface.rows[1].open(); surface = render();
  assert.equal(surface.sheet.asset.asset_ref, 'A'); const old = surface.sheet.id;
  let first = 0, duplicate = 0;
  surface.afterClose(old, () => { first++; surface.chooseRelocation(surface.sheet.asset); });
  surface.afterClose(old, () => duplicate++);
  assert.equal(first, 0, 'dismissing animation is not completion');
  surface.dismiss(old); surface = render();
  assert.equal(first, 1); assert.equal(duplicate, 0); assert.equal(surface.sheet.kind, 'location');
  const next = surface.sheet.id; assert.notEqual(next, old);
  surface.dismiss(old); surface = render(); assert.equal(surface.sheet.id, next);
  surface.dismiss(next); surface = render(); assert.equal(surface.sheet, null); x.controller.dispose();
});

test('inventory sheets cannot continue a location or transfer action after account retirement', async () => {
  const x = setup(); await x.controller.start(); const render = surfaceHarness(x); let surface = render();
  surface.rows[0].open(); surface = render(); let continuations = 0;
  surface.afterClose(surface.sheet.id, () => continuations++);
  x.invalidate(); surface.dismiss(surface.sheet.id); surface = render();
  assert.equal(continuations, 0); assert.equal(surface.sheet, null); assert.equal(x.writes.length, 0); x.controller.dispose();
});

test('inventory presentation key follows access-scope and account witness changes while token refresh retains its identity', () => {
  let version = 1;
  const auth = { sessionWitnessVersion: () => version, subscribeSessionWitness: () => () => {} };
  const read = loader({ react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() }, 'react-native': {}, './auth': auth,
    './appPreferences': {}, './inventoryReadApi': {}, './inventoryRelocateApi': {}, './preparation/preparationInventoryTransfers': {},
    './shared/inventoryViewRuntime': {}, './shared/inventoryMovementApi': {} });
  const { useWorkerInventoryKey } = read('components/useWorkerInventory');
  const session = setup().session, first = useWorkerInventoryKey(session);
  session.token = 'refreshed'; assert.equal(useWorkerInventoryKey(session), first);
  version++; const account = useWorkerInventoryKey(session); assert.notEqual(account, first);
  session.assigned_warehouses = ['Other']; assert.notEqual(useWorkerInventoryKey(session), account);
});

function compileView(name, mocks) {
  const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
  const filename = path.resolve(__dirname, '../src/components', name), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : (() => { throw new Error(`Unmocked view dependency: ${id}`); })();
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const viewJsx = (type, props, key) => ({ type, props: props ?? {}, key });
function viewNodes(tree, predicate, result = []) {
  if (tree == null || typeof tree !== 'object') return result;
  if (Array.isArray(tree)) { tree.forEach(child => viewNodes(child, predicate, result)); return result; }
  if (predicate(tree)) result.push(tree);
  viewNodes(tree.props?.children, predicate, result); return result;
}
const viewTexts = tree => viewNodes(tree, node => node.type === 'Text').map(node => node.props.children).flat().filter(value => typeof value === 'string');

for (const platform of ['ios', 'android']) test(`${platform} actual inventory screen wires native tabs, row gestures, query and warehouse filters to the worker owner`, async () => {
  const x = setup(); await x.controller.start(); const renderSurface = surfaceHarness(x); let surface = renderSurface(), backs = 0;
  const listItem = Object.assign(function ListItem() {}, { HeadlineContent: 'HeadlineContent', SupportingContent: 'SupportingContent', TrailingContent: 'TrailingContent' });
  const ui = new Proxy({ ListItem: listItem, useMaterialColors: () => ({ surface: '#000' }) }, { get: (target, key) => target[key] ?? key });
  const modifiers = new Proxy({}, { get: (_target, key) => key === 'shapes' ? { rectangle: () => ({}) } : (...args) => ({ name: key, args }) });
  const mocks = {
    'react/jsx-runtime': { jsx: viewJsx, jsxs: viewJsx, Fragment: 'Fragment' },
    '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose': ui,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './useWorkerInventory': { useWorkerInventoryKey: () => 'account-key' },
    './useWorkerInventorySurface': { useWorkerInventorySurface: () => surface },
    './WorkerAlert': { WorkerAlert: 'WorkerAlert' }, './WorkerFormField': { WorkerFormField: 'WorkerFormField' },
    './WorkerInventoryScanner': { WorkerInventoryScanner: 'WorkerInventoryScanner' }, './WorkerInventorySheet': { WorkerInventorySheet: 'WorkerInventorySheet' },
    './WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' }, '../shared/filters/DropdownFilter.android': { DropdownFilter: 'DropdownFilter' },
  };
  const { WorkerInventoryScreen } = compileView(`WorkerInventoryScreen.${platform}.tsx`, mocks);
  const render = () => { surface = renderSurface(); const wrapper = WorkerInventoryScreen({ session: x.session, onBack: () => backs++ }); assert.equal(wrapper.key, 'account-key'); return wrapper.type(wrapper.props); };
  let tree = render(); const texts = viewTexts(tree);
  assert.ok(texts.includes('A • 10.125 kg • Mavjud'), 'source asset subtitle contains identifier, quantity and status once');
  assert.ok(!texts.includes('w1'), 'warehouse physical location is not an extra row subtitle');
  const gesture = kind => viewNodes(tree, node => node.props?.modifiers?.some(modifier => modifier.name === kind))[0].props.modifiers.find(modifier => modifier.name === kind).args[0];
  if (platform === 'ios') gesture('onLongPressGesture')(); else gesture('combinedClickable').onLongClick();
  assert.equal(x.controller.getSnapshot().selected.size, 1);
  x.controller.clearSelection(); tree = render();
  if (platform === 'ios') gesture('onTapGesture')(); else gesture('combinedClickable').onClick();
  tree = render(); assert.equal(viewNodes(tree, node => node.type === 'WorkerInventorySheet')[0].props.surface.sheet.asset.asset_ref, 'A');
  surface.dismiss(surface.sheet.id); tree = render();
  if (platform === 'ios') {
    viewNodes(tree, node => node.type === 'Picker' && node.props.label === '')[0].props.onSelectionChange('incoming');
    viewNodes(tree, node => node.type === 'Picker' && node.props.label === 'Ombor')[0].props.onSelectionChange('w1');
    viewNodes(tree, node => node.type === 'TextField')[0].props.onTextChange('needle');
    viewNodes(tree, node => node.type === 'Button' && node.props.label === 'Orqaga')[0].props.onPress();
  } else {
    viewNodes(tree, node => node.type === 'Button' && viewTexts(node).includes('Kiruvchi'))[0].props.onClick();
    viewNodes(tree, node => node.type === 'DropdownFilter')[0].props.onChange('w1');
    viewNodes(tree, node => node.type === 'WorkerFormField')[0].props.onChangeText('needle');
    viewNodes(tree, node => node.type === 'WorkerSheetButton' && node.props.label === 'Orqaga')[0].props.onPress();
  }
  assert.equal(x.controller.getSnapshot().tab, 'incoming'); assert.equal(x.transferViews.length, 1);
  assert.equal(x.controller.getSnapshot().query, 'needle'); assert.equal(backs, 1);
  await flush(); assert.deepEqual(x.saved, ['w1']); x.controller.dispose();
});

test('actual asset and empty transfer sheets preserve source field order, omit duplicate item code, and translate labels separately', () => {
  const t = value => `translated:${value}`;
  const react = { useContext: () => () => {}, useState: initial => [initial, () => {}] };
  const mocks = { react, 'react/jsx-runtime': { jsx: viewJsx, jsxs: viewJsx, Fragment: 'Fragment' },
    'expo-image': { Image: 'Image' }, 'qrcode-generator': {}, 'react-native': { Text: 'Text', View: 'View' },
    '../preparation/preparationInventoryReprint': {}, '../preparation/preparationReprint': {}, '../shared/inventoryMovementModel': model,
    './WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' }, './WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    './workerSheetContext': { WorkerSheetCloseContext: {} }, './useWorkerColors': { useWorkerColors: () => ({ text: '#fff', muted: '#888' }) }, './useWorkerPrinterSelector': {},
  };
  const { WorkerInventorySheet } = compileView('WorkerInventorySheet.tsx', mocks);
  const render = sheet => { const outer = WorkerInventorySheet({ session: {}, surface: { sheet, t, canRelocate: false, canTransfer: false } }); const content = outer.props.children; return content.type(content.props); };
  const item = { ...asset('A'), item_name: 'A', item_code: 'A' };
  const tree = render({ id: 1, kind: 'asset', asset: item }), texts = viewTexts(tree);
  assert.equal(texts.filter(value => value === 'A').length, 2, 'one title and one identifier, no duplicate product-code header');
  assert.deepEqual(texts, ['A', 'translated:Mavjud', 'translated:Identifikator', 'A', 'translated:Miqdor', '10.125 kg', 'translated:Fizik joy', 'w1']);
  const transfer = render({ id: 2, kind: 'transfer', transfer: { source_warehouse: 'Source', destination_warehouse: 'Destination', status: 'requested', lines: [], created_at_unix: 1, note: 'literal user note' } });
  assert.deepEqual(viewTexts(transfer).slice(0, 5), ['Source → Destination', 'translated:So‘ralgan', 'translated:Mahsulot', '—', 'translated:Sana']);
  assert.deepEqual(viewTexts(transfer).slice(-2), ['translated:Izoh', 'literal user note']);
});

test('bulk confirmation retains the source selection captured before opening the location picker', async () => {
  const x = setup(); await x.controller.start();
  x.controller.toggleSelection(x.controller.getSnapshot().assets[0]); x.controller.toggleSelection(x.controller.getSnapshot().assets[1]);
  const render = surfaceHarness(x); let surface = render(); surface.relocateSelected(); surface = render();
  const picker = surface.sheet;
  x.assetViews[0].lease.publish([], true); assert.equal(x.controller.selectedAssets.length, 0);
  picker.choose(x.controller.states[0]); surface = render();
  assert.match(surface.alert.message, /^2 ta mahsulot/);
  surface.alert.onConfirm(); await flush();
  assert.equal(x.writes.length, 1); assert.equal(x.writes[0].items.length, 2); x.controller.dispose();
});

test('actual inventory QR sheet orders preview, product, literal payload and static-label details without translating backend values', () => {
  const react = { useContext: () => () => {}, useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {}, useMemo: fn => fn() };
  const qrFactory = () => ({ addData() {}, make() {}, createDataURL: () => 'data:qr' });
  const mocks = { react, 'react/jsx-runtime': { jsx: viewJsx, jsxs: viewJsx, Fragment: 'Fragment' },
    'expo-image': { Image: 'Image' }, 'qrcode-generator': qrFactory, 'react-native': { Text: 'Text', View: 'View' },
    '../preparation/preparationInventoryReprint': {}, '../preparation/preparationReprint': {}, '../shared/inventoryMovementModel': model,
    './WorkerOrderSheet': { WorkerOrderSheet: 'WorkerOrderSheet' }, './WorkerSheetButton': { WorkerSheetButton: 'WorkerSheetButton' },
    './workerSheetContext': { WorkerSheetCloseContext: {} }, './useWorkerColors': { useWorkerColors: () => ({ text: '#fff', muted: '#888' }) },
    './useWorkerPrinterSelector': { useWorkerPrinterSelector: () => ({ dialogs: null }) },
  };
  const { WorkerInventorySheet } = compileView('WorkerInventorySheet.tsx', mocks);
  const item = { ...asset('A'), identifier: 'Miqdor', item_name: 'Miqdor', custody_warehouse: 'Miqdor', physical_location: { id: 'w1', kind: 'warehouse', name: 'Miqdor' } };
  const surface = { sheet: { id: 1, kind: 'qr', asset: item }, t: value => `translated:${value}`, owner: { current: () => true } };
  const outer = WorkerInventorySheet({ session: {}, surface }); const content = outer.props.children.type(outer.props.children.props);
  const qr = viewNodes(content, node => node.type?.name === 'InventoryQr')[0]; const tree = qr.type(qr.props);
  assert.equal(tree.props.children[0].props.children, 'translated:Homashyo QR');
  assert.equal(tree.props.children[1].type, 'Image');
  assert.equal(tree.props.children[2].props.children, 'Miqdor');
  assert.equal(tree.props.children[3].props.children, 'Miqdor'); assert.equal(tree.props.children[3].props.selectable, true);
  const texts = viewTexts(tree);
  assert.equal(texts.filter(value => value === 'translated:Miqdor').length, 1, 'only the static quantity label is translated');
  assert.ok(texts.includes('translated:Mavjud'), 'status is a translated source label');
  assert.ok(texts.filter(value => value === 'Miqdor').length >= 4, 'product, payload and backend warehouse/location names remain literal');
});
