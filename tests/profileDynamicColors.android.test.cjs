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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
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

function setup(role, mode = 'light', settingsOpen = false) {
  const system = { surfaceContainerLow: `device-${mode}-surface`, onSurfaceVariant: `device-${mode}-muted` };
  const appTheme = { mode, seed: '#ff0000', colors: { surfaceContainerLow: 'app-surface', onSurfaceVariant: 'app-muted' }, direction: 'leftToRight' };
  const effects = [], materialOptions = [], editorOpened = [], settingsOpened = [], settingsUpdated = [];
  const editorSheet = { isOpen: () => false, open: content => editorOpened.push(content), close() {}, update() {} };
  const settingsSheet = { isOpen: () => settingsOpen, open: content => settingsOpened.push(content),
    update: content => settingsUpdated.push(content), close() {} };
  let sheetIndex = 0;
  const react = { useCallback: fn => fn, useLayoutEffect: fn => effects.push(fn), useRef: value => ({ current: value }),
    useState: value => [typeof value === 'function' ? value() : value, () => {}], useSyncExternalStore: (_subscribe, get) => get() };
  const { BaseHost } = load('BaseHost.android.tsx', {
    '@expo/ui/jetpack-compose': { Host: 'NativeHost' }, './useBaseTheme': { useBaseTheme: () => appTheme },
  });
  const FieldGroup = Object.assign(() => {}, { Section: 'Section' });
  const { ProfileView } = load('ProfileView.android.tsx', {
    react, '@expo/ui': { Button: 'Button', Column: 'Column', FieldGroup, RNHostView: 'RNHostView', Row: 'Row', Spacer: 'Spacer', Text: 'Text' },
    '@expo/ui/jetpack-compose': { PullToRefreshBox: 'PullToRefreshBox', useMaterialColors: options => { materialOptions.push(options); return system; } },
    'react-native': { Alert: { alert() {} } },
    '../profileModel': { profileDisplay: () => ({ name: 'Operator', role: 'Role', phone: '123', legalName: '', apparatusLabels: [] }) },
    '../nativeSheet': { useNativeSheet: () => [editorSheet, settingsSheet][sheetIndex++] },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    './BaseHost': { BaseHost }, './ProfileAvatarPreview.android': { ProfileAvatarPreview: 'Avatar' },
    './ProfileEditor.android': { ProfileEditor: 'Editor' }, './ProfileSettings': { ProfileSettings: 'Settings' },
  });
  const session = { profile: { role } };
  const render = editing => {
    const tree = ProfileView({ session, snapshot: { profile: session.profile }, editing, busy: false,
      onRefresh: async () => {}, onOpenEditor() {}, onCloseEditor() {}, onLogout() {} });
    effects.forEach(effect => effect());
    return tree;
  };
  const verifySystemHost = element => {
    assert.equal(element.type, BaseHost);
    assert.equal(element.props.dynamicColors, true);
    const native = BaseHost(element.props);
    assert.equal(native.type, 'NativeHost');
    assert.equal(native.props.colorScheme, undefined);
    assert.equal(native.props.seedColor, undefined);
    assert.equal(native.props.colorOverrides, undefined);
    assert.equal(native.props.layoutDirection, 'leftToRight');
  };
  return { render, verifySystemHost, FieldGroup, system, materialOptions, editorOpened, settingsOpened, settingsUpdated };
}

for (const role of ['homashyo_rezkachi', 'tayyorlov_masteri', 'aparatchi', 'boyoqchi', 'admin', 'future_role']) {
  for (const mode of ['light', 'dark']) test(`${role}: Android profile uses the ${mode} system palette`, () => {
    const h = setup(role, mode), tree = h.render(false);
    h.verifySystemHost(tree);
    assert.deepEqual(h.materialOptions, [{}]);
    assert.equal(nodes(tree, node => node.type === h.FieldGroup)[0].props.style.backgroundColor, h.system.surfaceContainerLow);
    const roleText = nodes(tree, node => node.type === 'Text' && node.props.children === 'Role')[0];
    assert.equal(roleText.props.textStyle.color, h.system.onSurfaceVariant);
    nodes(tree, node => node.type === 'Button' && node.props.testID === 'profile-settings')[0].props.onPress();
    assert.equal(h.settingsOpened.length, 1);
    h.verifySystemHost(h.settingsOpened[0]);
  });
}

test('profile editor and refreshed settings sheets both use system colors for any role', () => {
  const h = setup('homashyo_rezkachi', 'dark', true);
  h.render(true);
  assert.equal(h.editorOpened.length, 1);
  assert.equal(h.settingsUpdated.length, 1);
  h.verifySystemHost(h.editorOpened[0]);
  h.verifySystemHost(h.settingsUpdated[0]);
});
