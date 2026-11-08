const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
function setup(platform) {
  const calls = []; let content;
  const source = { item_code: 'film', item_name: 'Film', qty: 10, uom: 'kg', warehouse: 'WH' };
  const state = { barcode: '', reason: '', driverUrl: 'http://gscale.local:39117', printer: 'zebra', printMode: 'label', transport: 'bluetooth',
    source, outputs: [{ key: 1, item_code: '', item_name: '', qty: '', uom: 'kg', warehouse: 'WH', reason: '', print_qr: true },
      { key: 2, item_code: '', item_name: '', qty: '', uom: 'kg', warehouse: 'WH', reason: '', print_qr: true }],
    loadingSource: false, submitting: false, uncertain: false, blockedPrinter: false, notice: null, remainder: null };
  const controller = { getSnapshot: () => state, setBarcode: value => calls.push(['barcode', value]), loadSource: async () => calls.push('load'),
    selectItem: (index, item) => calls.push(['item', index, item]), editOutput: (index, value) => calls.push(['edit', index, value]),
    removeOutput: index => calls.push(['remove', index]), addOutput: () => calls.push('add'), setReason: value => calls.push(['reason', value]),
    setPrinter: value => calls.push(['printer', value]), submit: async () => calls.push('submit'), chooseRemainder: value => calls.push(['remainder', value]) };
  const hook = { controller, state, device: { title: 'Bluetooth printer tanlanmagan', subtitle: 'Bluetooth printer tanlash uchun bosing' }, scope: 'scope',
    choosePrinter: async () => calls.push('choosePrinter'), scan: async () => calls.push('scan'), isCurrent: () => true };
  const shared = initial => ({ value: initial, get() { return this.value; }, set(value) { this.value = value; } });
  const Alert = Object.assign(function Alert() {}, { Trigger: 'Alert.Trigger', Message: 'Alert.Message', Actions: 'Alert.Actions' });
  const AlertDialog = Object.assign(function AlertDialog() {}, { Title: 'AlertDialog.Title', Text: 'AlertDialog.Text', ConfirmButton: 'AlertDialog.ConfirmButton' });
  const OutlinedTextField = Object.assign(function OutlinedTextField() {}, { Label: 'OutlinedTextField.Label' });
  const elements = new Proxy({ Alert, AlertDialog, OutlinedTextField, useNativeState: shared, useMaterialColors: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
  const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect() {}, useState: initial => [initial, () => {}] },
    '@expo/ui': elements, '@expo/ui/swift-ui': elements, '@expo/ui/jetpack-compose': elements,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { PlatformColor: name => name, View: 'View', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../nativeSheet': { useNativeSheet: () => ({ open: value => { content = value; }, close: () => calls.push('sheet.close') }) },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, './RezkaItemPicker': { RezkaItemPicker: 'RezkaItemPicker' },
    './rezkaSplitLogic': { formatRezkaQty: value => Number.isInteger(value) ? String(value) : value.toFixed(3) },
    './rezkaSplitController': { rezkaSplitNoticeText: value => value.message ?? null, isExcludedRezkaPrinter: value => /go[\s_-]*dex|\bg500\b/i.test(value) },
    './useRezkaSplit': { useRezkaSplit: () => hook, useRezkaText: () => text => text } };
  const filename = path.resolve(__dirname, `../src/rezka/RezkaSplit.${platform}.tsx`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { state, calls, render: scan => mod.exports.RezkaSplitScreen({ session: {}, printer: {}, scan, onBack: () => calls.push('back') }), content: () => content };
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: split shows real form and item picker, with no scanner action when unavailable`, () => {
    const t = setup(platform), page = t.render();
    assert.ok(JSON.stringify(page).includes('QR ni tekshirish')); assert.ok(JSON.stringify(page).includes('Bo‘lish va QR chiqarish'));
    assert.ok(!JSON.stringify(page).includes('qrcode.viewfinder')); assert.ok(!JSON.stringify(page).includes('qr_code_scanner'));
    const fields = nodes(page, n => typeof n.type === 'function' && n.type.name === 'Field');
    const barcode = fields.find(n => n.props.label === 'Source QR'); barcode.props.change('abc'); barcode.props.submit();
    assert.deepEqual(t.calls.slice(0, 2), [['barcode', 'abc'], 'load']);
    const item = platform === 'ios'
      ? nodes(page, n => n.type === 'Button' && JSON.stringify(n).includes('Mahsulot tanlang'))[0]
      : nodes(page, n => typeof n.type === 'function' && n.type.name === 'Action' && n.props.label === 'Mahsulot tanlang')[0];
    (item.props.onPress ?? item.props.press)();
    assert.equal(t.content().type, 'RezkaItemPicker'); const selected = { code: 'x' }; t.content().props.select(selected);
    assert.deepEqual(t.calls.slice(-2), [['item', 0, selected], 'sheet.close']);
    t.state.outputs.shift(); t.content().props.select({ code: 'stale' });
    assert.notDeepEqual(t.calls.at(-2), ['item', 0, { code: 'stale' }]);
  });
  test(`${platform}: uncertain or excluded printer suppresses the submit action`, () => {
    const t = setup(platform); t.state.uncertain = true;
    assert.ok(!JSON.stringify(t.render()).includes('Bo‘lish va QR chiqarish'));
    t.state.uncertain = false; t.state.blockedPrinter = true;
    assert.ok(!JSON.stringify(t.render()).includes('Bo‘lish va QR chiqarish'));
  });
  test(`${platform}: remainder action exposes the V2 choices`, () => {
    const t = setup(platform); t.state.remainder = { source: { qty: 10, uom: 'kg' }, total: 8, difference: 2 };
    const page = t.render(), dialog = nodes(page, n => typeof n.type === 'function' && n.type.name === 'RemainderDialog')[0];
    const tree = dialog.type(dialog.props), text = JSON.stringify(tree);
    assert.ok(text.includes('Miqdor yetmayapti')); assert.ok(text.includes('Unutibman')); assert.ok(text.includes('Brak mahsulot')); assert.ok(text.includes('Bekor qilish'));
    const forgot = nodes(tree, n => (n.type === 'Button' && (n.props.label === 'Unutibman' || JSON.stringify(n).includes('Unutibman'))))[0];
    (forgot.props.onPress ?? forgot.props.onClick)(); assert.deepEqual(t.calls.at(-1), ['remainder', 'forgot']);
  });
}
