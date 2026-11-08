const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function setup(platform) {
  const calls = []; let sheetContent = null, sheetOptions = null;
  const worker = { id: 'ali', name: 'Ali', phone: '123', level: 'Master' }, apparatus = [{ id: 'apparatus:default:1', name: 'Rezka 1' }];
  const state = { phase: 'ready', team: { workers: [worker], apparatus, assignments: [] }, expandedId: 'ali', picker: null, notice: null, savingIds: [] };
  const controller = { getSnapshot: () => state, subscribe: () => () => {}, load: async () => calls.push('load'), expand: id => calls.push(['expand', id]),
    openPicker: id => { calls.push(['open', id]); state.picker = { worker, previous: null, selected: [], saving: false, blocked: null }; },
    toggle: (id, value) => { calls.push(['toggle', id, value]); state.picker.selected = value ? [id] : []; },
    save: async () => calls.push('save'), closePicker: () => calls.push('close'), dismissPicker: () => calls.push('dismiss') };
  const sheet = { open: (content, options) => { sheetContent = content; sheetOptions = options; }, isOpen: () => !!sheetContent, close: () => calls.push('sheet.close') };
  const t = (key, values) => values ? `${key}:${JSON.stringify(values)}` : key;
  const hooks = { useRezkaWorkerSettings: () => ({ controller, state, t, notice: value => t(value.key, value.values) }), useRezkaAdminText: () => t };
  const elementTypes = new Proxy({ useMaterialColors: () => ({}) }, { get: (target, key) => target[key] ?? key });
  const modifiers = new Proxy({}, { get: (_target, key) => (...args) => ({ modifier: key, args }) });
  const mocks = { 'react/jsx-runtime': jsx, react: { useEffect() {}, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    '@expo/ui': elementTypes, '@expo/ui/swift-ui': elementTypes, '@expo/ui/jetpack-compose': elementTypes,
    '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { PlatformColor: name => name, View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', RefreshControl: 'RefreshControl' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '../nativeSheet': { useNativeSheet: () => sheet },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' }, '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    './rezkaWorkerController': { apparatusLabels: ids => ids }, './useRezkaWorkerSettings': hooks };
  const filename = path.resolve(__dirname, `../src/rezka/RezkaWorkerSettings.${platform}.tsx`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { state, calls, render: () => mod.exports.RezkaWorkerSettingsScreen({ session: {}, navigation: null, footer: 'existing dock' }),
    sheet: () => ({ content: sheetContent, options: sheetOptions }) };
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: master settings reuses shell footer and displays real worker/picker states`, () => {
    const t = setup(platform), page = t.render();
    assert.ok(nodes(page, n => n.props?.children === 'existing dock').length || JSON.stringify(page).includes('existing dock'));
    assert.ok(JSON.stringify(page).includes('Ali')); assert.ok(JSON.stringify(page).includes('worker.worker_details'));
    if (platform === 'android') assert.equal(nodes(page, n => n.type === 'WorkerQueueCard').length, 1);
    const pickerButton = nodes(page, n => n.type === 'Button' && n.props.modifiers?.some(m => m.args?.[0] === 'worker-apparatus-picker-ali'))[0];
    assert.ok(pickerButton); (pickerButton.props.onPress ?? pickerButton.props.onClick)();
    assert.deepEqual(t.calls[0], ['open', 'ali']);
    const { content, options } = t.sheet(); assert.equal(options.dismissible, true);
    let picker = content.type(content.props);
    const control = nodes(picker, n => n.type === (platform === 'ios' ? 'Toggle' : 'Checkbox'))[0];
    (control.props.onIsOnChange ?? control.props.onCheckedChange)(true);
    assert.deepEqual(t.calls.at(-1), ['toggle', 'apparatus:default:1', true]);
    picker = content.type(content.props);
    const save = nodes(picker, n => n.type === 'Button' && n.props.modifiers?.some(m => m.args?.[0] === 'worker-apparatus-save'))[0];
    assert.ok(save); (save.props.onPress ?? save.props.onClick)(); assert.equal(t.calls.at(-1), 'save');
    options.onDismiss(); assert.equal(t.calls.at(-1), 'dismiss');
  });
}
