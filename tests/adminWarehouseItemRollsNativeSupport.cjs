/* global __dirname */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const { load, strings, l10n } = require('./adminUsersSupport.cjs');
const jsx = { Fragment: 'Fragment', jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const modifiers = new Proxy({}, { get: (_target, name) => name === 'Shapes' ? { RoundedCorner: params => ({ type: 'roundedCorner', ...params }) } : (...args) => ({ name: String(name), args }) });
const colors = { surface: '#FFFFFFFF', surfaceContainer: '#EEEEEEFF', surfaceContainerLowest: '#FAFAFAFF', onSurface: '#111111FF', onSurfaceVariant: '#666666FF', secondaryContainer: '#BBBBBBFF', onSecondaryContainer: '#111111FF', primary: '#334455FF', onPrimary: '#FFFFFFFF', outlineVariant: '#AAAAAAFF', error: '#AA0000FF' };
function expand(node) {
  if (Array.isArray(node)) return node.map(expand); if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') { const result = node.type(node.props); return expand(result && typeof result === 'object' && !Array.isArray(result) && node.key !== undefined ? { ...result, key: node.key } : result); }
  return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
}
function nodes(node, predicate) { if (Array.isArray(node)) return node.flatMap(value => nodes(value, predicate)); if (!node || typeof node !== 'object') return []; return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]; }
const byID = (tree, id) => nodes(tree, node => node.props?.testID === id || node.props?.modifiers?.some(value => ['testID', 'accessibilityIdentifier'].includes(value.name) && value.args[0] === id))[0];
const text = tree => nodes(tree, node => ['Text', 'RN.Text'].includes(node.type)).map(node => node.props.children).flat().join(' ');
const click = (node, platform) => node.props[platform === 'android' ? 'onClick' : 'onPress']();
function runtime() {
  let cursor = 0, effects = []; const values = [], cleanups = new Map();
  return { react: { useRef: initial => { const index = cursor++; return values[index] ??= { current: initial }; },
    useEffect: (fn, deps) => { const index = cursor++, old = values[index]; if (!old || deps.some((value, i) => value !== old[i])) { values[index] = deps; effects.push(() => { cleanups.get(index)?.(); cleanups.set(index, fn()); }); } },
    useMemo: fn => fn(), useState: value => [value, () => {}] },
    render(fn) { cursor = 0; effects = []; const result = expand(fn()); effects.forEach(effect => effect()); return result; } };
}
function nativeModule(file, mocks = {}, options = {}) {
  const host = runtime(), native = (name, slots = []) => { const component = props => ({ type: name, props }); slots.forEach(slot => { component[slot] = `${name}.${slot}`; }); return component; };
  const ui = new Proxy({ Shape: { RoundedCorner: value => value }, List: native('List'),
    ModalBottomSheet: props => { if (props.ref) props.ref.current = { hide: options.hide ?? (async () => {}) }; return { type: 'ModalBottomSheet', props }; } }, { get: (target, name) => target[name] ?? String(name) });
  ui.List.ForEach = props => ({ type: 'List.ForEach', props: { ...props, children: props.data.map((item, index) => props.children({ item, index })) } });
  const rowDetails = load('admin/AdminWarehouseMainRows', { '../workerPeremotka': load('workerPeremotka'), '../qolip/qolipApiCommon': {}, './dartJsonString': strings });
  const base = { react: host.react, 'react/jsx-runtime': jsx, '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'expo-image': { Image: 'ExpoImage' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'react-native': { View: 'View', Text: 'RN.Text', ScrollView: 'RN.ScrollView', StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 400, height: 800 }),
      FlatList: props => ({ type: 'FlatList', props: { ...props, children: props.data.flatMap((item, index) => [index && props.ItemSeparatorComponent ? { type: props.ItemSeparatorComponent, props: {} } : null, props.renderItem({ item })]) } }) },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors }) },
    'react-native-reanimated': { useSharedValue: value => ({ value }) }, 'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../shared/orders/OrdersList': { OrdersList: props => ({ type: 'OrdersList', props: { ...props, children: [...props.rows.map(props.renderRow), props.children, props.footer] } }) },
    '../shared/themeRuntime': { themeController: { variant: 'white' } }, '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, './AdminWarehouseMainRows': rowDetails,
    './AdminLoadingIndicator.android': { AdminLoadingIndicator: props => ({ type: 'AdminLoadingIndicator', props: { size: 64, glyphSize: 38, ...props } }) }, './AdminWarehouseRawQrPreview': { AdminWarehouseRawQrPreview: 'AdminWarehouseRawQrPreview' }, './dartJsonString': strings, ...mocks };
  const filename = path.resolve(__dirname, '../src/admin', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; mod.require = name => Object.hasOwn(base, name) ? base[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { exports: mod.exports, render: fn => host.render(fn) };
}
module.exports = { l10n, load, strings, colors, nativeModule, nodes, byID, text, click, expand };
