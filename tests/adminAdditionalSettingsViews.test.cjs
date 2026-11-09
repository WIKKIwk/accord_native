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
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const viewModel = load('admin/additionalSettingsViewModel.ts', { '../shared/localization': l10n });
const alert = Object.assign(function Alert() {}, { Trigger: 'Alert.Trigger', Actions: 'Alert.Actions', Message: 'Alert.Message' });
const dialog = Object.assign(function AlertDialog() {}, { Title: 'AlertDialog.Title', Text: 'AlertDialog.Text',
  ConfirmButton: 'AlertDialog.ConfirmButton', DismissButton: 'AlertDialog.DismissButton' });
const react = { useEffect() {}, useRef: value => ({ current: value }), useSyncExternalStore: (_subscribe, get) => get() };
const mods = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
const swift = new Proxy({ Alert: alert }, { get: (target, name) => target[name] ?? String(name) });
const compose = new Proxy({ AlertDialog: dialog, useMaterialColors: () => ({ surface: 'surface', onSurface: 'text' }) },
  { get: (target, name) => target[name] ?? String(name) });
const initialCard = value => ({ value, busy: false, failed: false });
function state(overrides = {}) {
  return { screen: 'content', operator: false, paddon: initialCard({ free_movement_enabled: false, worker_visibility_enabled: true }),
    appUpdate: initialCard(false), lamination: initialCard({ print_wip_remainder_labels: true, print_film_remainder_labels: false }),
    qolip: initialCard({ automatic_confirmation_enabled: false, revision: 1 }), confirmFreeMovement: false, confirmationSerial: 0, notice: null, ...overrides };
}
function render(platform, initial, navigation) {
  const calls = [], controller = { getSnapshot: () => initial, refresh: () => { calls.push('refresh'); }, retryCard: name => calls.push(['retry', name]),
    resolveFreeMovement: value => calls.push(['confirm', value]), requestFreeMovement: value => calls.push(['free', value]),
    setWorkerVisibility: value => calls.push(['visibility', value]), setAppUpdate: value => calls.push(['app', value]),
    setLaminationWip: value => calls.push(['wip', value]), setLaminationFilm: value => calls.push(['film', value]), setQolip: value => calls.push(['qolip', value]) };
  const native = { View: 'View', Text: 'NativeText', Pressable: 'Pressable', PlatformColor: value => value,
    StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }) };
  const mocks = { react, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods,
    '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': mods,
    'react-native': native, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/BaseHost.android': { BaseHost: 'BaseHost' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } }, '../shared/localization': l10n,
    './additionalSettingsViewModel': viewModel, './useAdditionalSettings': { useAdditionalSettings: () => ({ state: initial, controller }) } };
  const screen = load(`admin/AdditionalSettingsScreen.${platform}.tsx`, mocks).AdditionalSettingsScreen;
  const leading = navigation === null ? null : { icon: navigation ?? 'menu', label: 'Navigation', onPress: () => calls.push('navigation') };
  return { tree: screen({ session: {}, navigation: leading, footer: { type: 'ExistingDock', props: {} } }), calls, controller };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} settings renders all Admin rows and reuses supplied dock`, () => {
    const { tree, calls } = render(platform, state());
    const controls = nodes(tree, n => n.type === (platform === 'ios' ? 'Toggle' : 'Switch'));
    assert.equal(controls.length, 6); assert.equal(nodes(tree, n => n.type === 'ExistingDock').length, 1);
    if (platform === 'ios') { controls[0].props.onIsOnChange(true); controls[1].props.onIsOnChange(true); }
    else {
      const rows = nodes(tree, n => n.type === 'Row' && n.props.modifiers?.some(mod => mod.name === 'toggleable'));
      assert.equal(rows.length, 6); assert.equal(controls[0].props.onCheckedChange, undefined);
      rows[0].props.modifiers.find(mod => mod.name === 'toggleable').args[1]();
      rows[1].props.modifiers.find(mod => mod.name === 'toggleable').args[1]();
    }
    assert.deepEqual(calls[0], ['app', true]); assert.deepEqual(calls[1], ['free', true]);
  });
  test(`${platform} operator renders only Paddon switches and never adds a fake destination`, () => {
    const { tree } = render(platform, state({ operator: true }));
    const controls = nodes(tree, n => n.type === (platform === 'ios' ? 'Toggle' : 'Switch'));
    assert.equal(controls.length, 2); assert.equal(nodes(tree, n => n.type === 'ExistingDock').length, 1);
    assert.equal(nodes(tree, n => n.type === 'Pressable' && n.props.testID === 'additional-settings-refresh').length, platform === 'android' ? 1 : 0);
  });
  test(`${platform} delegates drawer or back choice to the existing shell`, () => {
    for (const icon of ['menu', 'back']) {
      const { tree, calls } = render(platform, state(), icon);
      const leading = platform === 'ios' ? nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerLeft() :
        nodes(tree, n => n.type === 'RoleHeader')[0].props.navigation;
      assert.equal(platform === 'ios' ? leading.props.icon : leading.icon, icon);
      (platform === 'ios' ? leading.props.onPress : leading.onPress)(); assert.deepEqual(calls, ['navigation']);
    }
    const { tree } = render(platform, state(), null);
    assert.equal(platform === 'ios' ? nodes(tree, n => n.type === 'Stack.Screen')[0].props.options.headerLeft :
      nodes(tree, n => n.type === 'RoleHeader')[0].props.navigation, undefined);
  });
  test(`${platform} loading, failure and card retry preserve distinct states`, () => {
    const loading = render(platform, state({ screen: 'loading' })).tree;
    assert.equal(nodes(loading, n => n.type === (platform === 'ios' ? 'Toggle' : 'Switch')).length, 0);
    assert.equal(nodes(loading, n => n.type === (platform === 'ios' ? 'ProgressView' : 'CircularProgressIndicator')).length, 1);
    const failed = render(platform, state({ screen: 'error' }));
    assert.equal(nodes(failed.tree, n => n.type === (platform === 'ios' ? 'Toggle' : 'Switch')).length, 0);
    const retry = nodes(failed.tree, n => n.type === (platform === 'ios' ? 'Button' : 'TextButton'))[0];
    (platform === 'ios' ? retry.props.onPress : retry.props.onClick)(); assert.deepEqual(failed.calls, ['refresh']);
    const cardFailure = render(platform, state({ appUpdate: { value: null, busy: false, failed: true } }));
    const retryCard = nodes(cardFailure.tree, n => n.type === (platform === 'ios' ? 'Button' : 'TextButton'))[0];
    (platform === 'ios' ? retryCard.props.onPress : retryCard.props.onClick)(); assert.deepEqual(cardFailure.calls, [['retry', 'appUpdate']]);
    if (platform === 'android') {
      const row = nodes(cardFailure.tree, n => n.type === 'Row' && n.props.modifiers?.some(mod => mod.name === 'toggleable'))[0];
      assert.equal(row.props.modifiers.find(mod => mod.name === 'toggleable').args[2].enabled, false);
    } else {
      const first = nodes(cardFailure.tree, n => n.type === 'Toggle')[0];
      assert.equal(first.props.modifiers.find(mod => mod.name === 'disabled').args[0], true);
    }
  });
  if (platform === 'ios') test('ios dismissal without a button cancels the pending confirmation', async () => {
    const current = state({ confirmFreeMovement: true, confirmationSerial: 1 }), { tree, calls } = render(platform, current);
    const modal = nodes(tree, n => n.type === alert)[0]; modal.props.onIsPresentedChange(false);
    await new Promise(resolve => setTimeout(resolve, 300)); assert.deepEqual(calls, [['confirm', false]]);
  });
  test(`${platform} confirmation sends yes and cancellation separately to guarded controller`, async () => {
    const current = state({ confirmFreeMovement: true, confirmationSerial: 1 }), { tree, calls } = render(platform, current);
    if (platform === 'ios') {
      const modal = nodes(tree, n => n.type === alert)[0]; assert.ok(modal);
      modal.props.onIsPresentedChange(false);
      const yes = nodes(modal, n => n.type === 'Button' && n.props.label === 'Ha')[0]; assert.ok(yes); yes.props.onPress();
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.deepEqual(calls, [['confirm', true]]);
    } else {
      const modal = nodes(tree, n => n.type === dialog)[0]; assert.ok(modal);
      const yes = nodes(modal, n => n.type === 'TextButton' && nodes(n, x => x.type === 'Text' && x.props.children === 'Ha').length)[0];
      assert.ok(yes); yes.props.onClick(); assert.deepEqual(calls, [['confirm', true]]);
      modal.props.onDismissRequest(); assert.deepEqual(calls[1], ['confirm', false]);
    }
  });
}
