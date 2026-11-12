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
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : id.endsWith('.xml') ? id : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name, args }) });
const field = Object.assign(() => {}, { Label: 'FieldLabel', Placeholder: 'FieldPlaceholder' });
const palette = Object.fromEntries(['onSurface', 'onSurfaceVariant', 'primary', 'primaryContainer', 'onPrimaryContainer', 'surfaceContainerLow', 'outlineVariant', 'error'].map(name => [name, name]));
const ui = new Proxy({ OutlinedTextField: field, useMaterialColors: () => palette, useNativeState: initial => ({ initial }) },
  { get: (target, name) => target[name] ?? name });
const react = { useEffect() {}, useRef: current => ({ current }), useState: initial => [initial, () => {}],
  useSyncExternalStore: (_subscribe, get) => get() };
const common = { react, '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers,
  '../shared/localization': { localizedGetter: key => key },
  '../shared/localization/runtime': { localeController: { locale: 'uz', addListener() {} } } };

test('Android editor keeps name, avatar, save and close actions available without opening the keyboard', () => {
  const { ProfileEditor } = load('ProfileEditor.android.tsx', { ...common, './ProfileAvatar': { ProfileAvatar: 'ProfileAvatar' } });
  const calls = [];
  const props = { session: {}, snapshot: { profile: {} }, avatarToken: 'token', avatarRevision: 2, cachedAvatar: null,
    draftName: 'Abdusamad', draftPhoto: 'file://new-photo', busy: false, saving: false,
    onChangeName: value => calls.push(['name', value]), onChoosePhoto: source => calls.push(['photo', source]),
    onSave: () => calls.push(['save']), onCloseEditor: () => calls.push(['close']) };
  const tree = ProfileEditor(props), input = nodes(tree, node => node.type === field)[0];
  assert.deepEqual(input.props.value, { initial: 'Abdusamad' });
  assert.notEqual(input.props.autoFocus, true);
  assert.equal(nodes(tree, node => node.type === 'ProfileAvatar')[0].props.previewUri, props.draftPhoto);
  assert.match(text(tree), /selectedImageNotice/);
  input.props.onValueChange('Ali');
  nodes(tree, node => node.type === 'TextButton' && text(node) === 'changeImage')[0].props.onClick();
  input.props.keyboardActions.onDone();
  nodes(tree, node => node.type === 'IconButton')[0].props.onClick();
  assert.deepEqual(calls, [['name', 'Ali'], ['photo', 'library'], ['save'], ['close']]);
  const busy = ProfileEditor({ ...props, busy: true, saving: true });
  assert.equal(nodes(busy, node => node.type === field)[0].props.enabled, false);
  assert.equal(nodes(busy, node => node.type === 'Button')[0].props.enabled, false);
  assert.equal(nodes(busy, node => node.type === 'IconButton')[0].props.enabled, false);
  assert.equal(nodes(busy, node => node.type === 'Box')[0].props.modifiers.some(mod => mod.name === 'clickable'), false);
});

test('Android grouped settings preserve PIN, biometric, update and disconnect actions', async () => {
  const calls = [];
  const pin = { mode: null, busy: false, security: { hasPin: true, canUseBiometric: true, biometric: false,
    setBiometric: async value => calls.push(['biometric', value]) }, open: value => calls.push(['pin-open', value]),
    remove: async () => calls.push(['pin-remove']), back: () => calls.push(['pin-back']) };
  const switchPin = { stage: null, busy: false, hasPin: true, open: () => calls.push(['switch-open']),
    remove: async () => calls.push(['switch-remove']), back: () => calls.push(['switch-back']) };
  const { ProfileSettings } = load('ProfileSettings.android.tsx', { ...common,
    'expo-constants': { default: { expoConfig: { version: '1' } } },
    'react-native': { Alert: { alert() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '../nativeSheet': { useNativeSheet: () => ({ open() {}, close() {} }) },
    '../shared/themeRuntime': { themeController: { variant: 'classic', addListener() {} } },
    './AppSettings': { useAppSettings: () => ({ appearance: 'system', setAppearance: async () => {} }) },
    './usePinSetup.android': { usePinSetup: () => pin }, './useSwitchPinSetup.android': { useSwitchPinSetup: () => switchPin },
    './BaseHost': { BaseHost: 'Host' }, './AppUpdateProvider': { useAppUpdate: () => () => calls.push(['update']) },
  });
  const render = () => ProfileSettings({ session: { profile: { role: 'aparatchi' } },
    onClose: () => calls.push(['close']), onLogout: () => calls.push(['disconnect']) });
  const press = (tree, label) => nodes(tree, node => ['TextButton', 'Button'].includes(node.type) && text(node).includes(label))[0].props.onClick();
  const tree = render();
  press(tree, 'pinChange'); press(tree, 'pinRemove'); press(tree, 'switchPinChange'); press(tree, 'switchPinRemove');
  press(tree, 'appUpdateSettingsTitle'); press(tree, 'disconnectSessionTitle');
  const biometric = nodes(tree, node => node.type === 'Switch')[0];
  assert.equal(biometric.props.enabled, true);
  biometric.props.onCheckedChange(true);
  nodes(tree, node => node.type === 'IconButton')[0].props.onClick();
  assert.deepEqual(calls, [['pin-open', 'set'], ['pin-remove'], ['switch-open'], ['switch-remove'], ['update'], ['disconnect'], ['biometric', true], ['close']]);
  pin.mode = 'set'; pin.phase = 'entry'; pin.pin = { initial: '' }; pin.canNext = true;
  pin.change = (name, value) => calls.push([name, value]); pin.next = () => calls.push(['pin-next']);
  const editing = render(), input = nodes(editing, node => node.type === field)[0];
  input.props.onValueChange('1234'); press(editing, 'nextItemAction');
  assert.deepEqual(calls.slice(-2), [['pin', '1234'], ['pin-next']]);
  switchPin.stage = 'confirm'; switchPin.field = { initial: '' }; switchPin.change = value => calls.push(['switch', value]);
  switchPin.submit = async () => calls.push(['switch-submit']);
  const switching = render(), fields = nodes(switching, node => node.type === field);
  fields[1].props.onValueChange('4321'); press(switching, 'save');
  assert.deepEqual(calls.slice(-2), [['switch', '4321'], ['switch-submit']]);
});
