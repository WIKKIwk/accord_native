const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src/components', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}

test('Android host can follow system colors while preserving text direction', () => {
  const theme = { mode: 'dark', seed: '#445566', colors: { surface: '#123456' }, direction: 'rightToLeft' };
  const { BaseHost } = load('BaseHost.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'ComposeHost' }, './useBaseTheme': { useBaseTheme: () => theme },
  });
  const system = BaseHost({ children: 'content', dynamicColors: true });
  assert.equal(system.props.colorScheme, undefined);
  assert.equal(system.props.seedColor, undefined);
  assert.equal(system.props.colorOverrides, undefined);
  assert.equal(system.props.layoutDirection, 'rightToLeft');
  const configured = BaseHost({ children: 'content' });
  assert.equal(configured.props.colorScheme, 'dark');
  assert.equal(configured.props.seedColor, theme.seed);
  assert.equal(configured.props.colorOverrides, theme.colors);
});

for (const role of ['tayyorlov_masteri', 'aparatchi', 'boyoqchi', 'homashyo_rezkachi', 'admin']) test(`${role} profile uses Android system colors`, () => {
  const opened = [], sheets = [], materialOptions = [];
  const FieldGroup = Object.assign(() => {}, { Section: 'FieldSection' });
  const react = { useCallback: fn => fn, useLayoutEffect: fn => fn(), useRef: value => ({ current: value }),
    useState: value => [value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
  const mocks = {
    react,
    '@expo/ui': { Button: 'Button', Column: 'Column', FieldGroup, ListItem: 'ListItem', RNHostView: 'RNHostView', Row: 'Row', ScrollView: 'ScrollView', Spacer: 'Spacer', Text: 'Text', TextInput: 'TextInput', useNativeState: value => value },
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: options => { materialOptions.push(options); return { surfaceContainerLow: 'system-background', onSurfaceVariant: 'system-muted' }; } },
    'react-native': { Alert: { alert() {} } },
    '../profileModel': { profileDisplay: () => ({ name: 'Ibrohim', role: 'Master', phone: '123', apparatusLabels: [] }) },
    '../nativeSheet': { useNativeSheet: () => { const index = sheets.length, sheet = { isOpen: () => false, open: value => { opened[index] = value; }, close() {}, update() {} }; sheets.push(sheet); return sheet; } },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './BaseHost': { BaseHost: 'BaseHost' },
  };
  const { ProfileView } = load('ProfileView.android.tsx', mocks);
  const page = ProfileView({ session: { profile: { role } }, snapshot: { profile: {} }, editing: true, busy: false,
    onOpenEditor() {}, onCloseEditor() {}, onLogout() {}, onDailyWork() {} });
  assert.deepEqual(materialOptions, [{}]);
  assert.equal(page.props.dynamicColors, true);
  const group = nodes(page, node => node.type === FieldGroup)[0];
  assert.deepEqual(group.props.style, { backgroundColor: 'system-background' });
  const secondary = nodes(page, node => node.type === 'Text' && node.props.children === 'Master')[0];
  assert.equal(secondary.props.textStyle.color, 'system-muted');
  assert.equal(opened[0].props.dynamicColors, true);
  const settings = nodes(page, node => node.type === 'Button' && node.props.testID === 'profile-settings')[0];
  settings.props.onPress();
  assert.equal(opened[1].props.dynamicColors, true);
});
