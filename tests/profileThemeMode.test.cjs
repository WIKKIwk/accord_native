const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(mod, id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const modifiers = new Proxy({}, { get: (_, name) => value => ({ name, value }) });
const react = { useEffect() {}, useState: initial => [initial, () => {}], useRef: current => ({ current }),
  useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
const security = { hasPin: false, canUseBiometric: false, biometric: false };

for (const role of ['tayyorlov_masteri', 'aparatchi', 'boyoqchi']) test(`Android ${role} profile exposes appearance choices with the correct palette`, async () => {
  const selected = [], sheets = [];
  let appearance = 'system', closed = 0;
  const ui = new Proxy({}, { get: (_, name) => name });
  const { ProfileSettings } = load('components/ProfileSettings.android.tsx', {
    react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-constants': { default: { expoConfig: { version: '1' } } },
    'react-native': { Alert: { alert: assert.fail }, BackHandler: {} },
    '../nativeSheet': { useNativeSheet: () => ({ open: sheet => sheets.push(sheet), close: () => { closed++; } }) },
    '../shared/localization': { localizedGetter: key => key },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } },
    '../shared/themeRuntime': { themeController: { variant: 'classic', addListener() {} } },
    './AppSettings': { useAppSettings: () => ({ appearance, setAppearance: async value => { selected.push(value); appearance = value; } }) },
    './usePinSetup.android': { usePinSetup: () => ({ mode: null, busy: false, security }) },
    './useSwitchPinSetup.android': { useSwitchPinSetup: () => ({ stage: null, busy: false, hasPin: false }) },
    './BaseHost': { BaseHost: 'Host' }, './AppUpdateProvider': { useAppUpdate: () => () => {} },
  });
  const render = () => ProfileSettings({ session: { profile: { role } }, onClose() {}, onLogout() {} });
  const findId = (tree, id) => nodes(tree, node => node.props?.modifiers?.some(item => item.name === 'testID' && item.value === id))[0];
  const opener = findId(render(), 'profile-appearance');
  assert.deepEqual(nodes(opener, node => node.type === 'Text').map(node => node.props.children), ['Auto']);
  opener.props.onClick();
  const dynamic = role === 'tayyorlov_masteri' || role === 'aparatchi';
  assert.equal(sheets[0].props.dynamicColors, dynamic);
  const options = ['system', 'light', 'dark'].map(id => findId(sheets[0], `profile-appearance-${id}`));
  assert.equal(options.filter(Boolean).length, 3);
  assert.deepEqual(nodes(options[0], node => node.type === 'Text')[0].props.children, ['Auto', ' · accountCurrent']);
  for (const option of options) option.props.onClick();
  assert.deepEqual(selected, ['system', 'light', 'dark']);
  assert.equal(closed, 3);
  assert.deepEqual(nodes(findId(render(), 'profile-appearance'), node => node.type === 'Text').map(node => node.props.children), ['Qorong‘i']);
  for (const id of ['profile-language', 'profile-theme']) {
    findId(render(), id).props.onClick();
    assert.equal(sheets.at(-1).props.dynamicColors, dynamic);
  }
});

test('iOS profile offers Auto in the appearance picker and forwards system', async () => {
  const selected = [];
  const ui = new Proxy({ Toolbar: Object.assign(() => {}, { Content: 'ToolbarContent' }) }, { get: (target, name) => target[name] ?? name });
  const { ProfileSettings } = load('components/ProfileSettings.ios.tsx', {
    react, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-constants': { default: { expoConfig: { version: '1' } } }, 'react-native': { Alert: { alert: assert.fail } },
    '../appAppearance': { isAppearancePreference: value => ['system', 'light', 'dark'].includes(value) },
    './AppSettings': { useAppSettings: () => ({ appearance: 'system', setAppearance: async value => { selected.push(value); } }) },
    './usePinSetup.ios': { usePinSetup: () => ({ mode: null, busy: false, security }) },
    './AppUpdateProvider': { useAppUpdate: () => () => {} },
  });
  const tree = ProfileSettings({ onClose() {}, onLogout() {} });
  const picker = nodes(tree, node => node.type === 'Picker')[0];
  const choices = nodes(picker, node => node.type === 'Text' && node.props.modifiers?.some(item => item.name === 'tag'));
  assert.deepEqual(choices.map(node => node.props.modifiers[0].value), ['system', 'light', 'dark']);
  assert.equal(choices[0].props.children, 'Auto');
  assert.equal(picker.props.selection, 'system');
  picker.props.onSelectionChange('system');
  assert.deepEqual(selected, ['system']);
});

test('Auto removes the native override and resolves both device themes; manual modes stay fixed', async () => {
  const { ThemeController } = load('shared/themeController.ts');
  const saved = new Map();
  const controller = new ThemeController({ getItem: async key => saved.get(key) ?? null,
    setItem: async (key, value) => { saved.set(key, value); } });
  const nativeModes = [], effects = [];
  let deviceMode = 'light';
  const hooks = { ...react, createContext: () => ({ Provider: 'Provider' }), useCallback: fn => fn,
    useEffect: effect => effects.push(effect) };
  const { AppSettingsProvider } = load('components/AppSettings.tsx', {
    react: hooks, 'react-native': { Platform: { OS: 'android' }, Appearance: { setColorScheme: value => nativeModes.push(value) } },
    '../shared/basePreferences': { initializeBasePreferences: async () => {} },
    '../shared/themeRuntime': { themeController: controller },
  });
  const { useBaseTheme } = load('components/useBaseTheme.ts', {
    react: hooks, 'react-native': { useColorScheme: () => deviceMode },
    '../shared/themeRuntime': { themeController: controller },
    '../shared/localization/runtime': { localeController: { locale: 'uz', isUrdu: false, addListener() {} } },
  });
  const render = () => {
    const tree = AppSettingsProvider({ children: null });
    effects.splice(0).forEach(effect => effect());
    return tree.props.value;
  };
  await render().setAppearance('system'); render();
  assert.equal(nativeModes.at(-1), 'auto');
  assert.equal(useBaseTheme().mode, 'light');
  deviceMode = 'dark';
  assert.equal(useBaseTheme().mode, 'dark');
  assert.equal(controller.themeMode, 'system');
  assert.equal(saved.get('app_theme_mode'), 'system');
  await render().setAppearance('light'); render();
  assert.equal(nativeModes.at(-1), 'light');
  assert.equal(useBaseTheme().mode, 'light');
  await render().setAppearance('dark'); render(); deviceMode = 'light';
  assert.equal(nativeModes.at(-1), 'dark');
  assert.equal(useBaseTheme().mode, 'dark');
});
