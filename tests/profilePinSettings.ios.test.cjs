const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadComponent(relativePath, mocks) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = id => id in mocks ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function fixture() {
  const hooks = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect() {},
  };
  const alerts = [];
  const security = {
    hasPin: true, biometric: false, canUseBiometric: false, attempts: [],
    async removePin(pin) {
      this.attempts.push(pin);
      if (pin !== '1234') throw new Error('Joriy PIN noto‘g‘ri.');
      this.hasPin = false;
    },
  };
  const { usePinSetupCore } = loadComponent('src/components/usePinSetupCore.ts', {
    react,
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    './WorkerSecurity': { useWorkerSecurity: () => security },
  });
  const field = { set() {} };
  const ui = {};
  for (const name of ['Button', 'Group', 'HStack', 'Image', 'List', 'NavigationStack', 'Picker', 'SecureField', 'Section', 'Spacer', 'Text', 'Toggle', 'Toolbar', 'ToolbarItem']) {
    ui[name] = function () {};
    ui[name].displayName = name;
  }
  ui.Toolbar.Content = function () {};
  ui.Toolbar.Content.displayName = 'Toolbar.Content';
  const jsxRuntime = {
    Fragment: Symbol('Fragment'),
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
  };
  const modifiers = new Proxy({}, { get: () => () => ({}) });
  let closed = 0;
  const { ProfileSettings } = loadComponent('src/components/ProfileSettings.ios.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
    '@expo/ui/swift-ui': ui,
    '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1' } } },
    '../appAppearance': { isAppearancePreference: () => true },
    './AppSettings': { useAppSettings: () => ({ appearance: 'system', setAppearance: async () => {} }) },
    './usePinSetup.ios': { usePinSetup: () => usePinSetupCore(field, field, field) },
  });
  const render = () => {
    cursor = 0;
    return ProfileSettings({ onClose: () => { closed++; }, onLogout: () => {} });
  };
  return { render, security, alerts, closed: () => closed };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function byName(tree, name, label) {
  const result = find(tree, node => node.type?.displayName === name && (label === undefined || node.props?.label === label));
  assert.ok(result, `${name} ${label ?? ''} was not found`);
  return result;
}

test('Done removes the PIN only after the current PIN is entered correctly', async () => {
  const app = fixture();
  byName(app.render(), 'Button', 'PIN kodni olib tashlash').props.onPress();
  let tree = app.render();

  byName(tree, 'Button', 'Tayyor').props.onPress();
  await new Promise(setImmediate);
  assert.equal(app.closed(), 0);
  assert.equal(app.security.hasPin, true);
  assert.match(app.alerts.at(-1)[1], /Joriy 4 xonali PIN/);

  byName(tree, 'SecureField').props.onTextChange('9999');
  byName(tree, 'Button', 'Tayyor').props.onPress();
  await new Promise(setImmediate);
  assert.equal(app.closed(), 0);
  assert.equal(app.security.hasPin, true);
  assert.match(app.alerts.at(-1)[1], /Joriy PIN noto‘g‘ri/);

  tree = app.render();
  byName(tree, 'SecureField').props.onTextChange('1234');
  byName(tree, 'Button', 'Tayyor').props.onPress();
  await new Promise(setImmediate);
  assert.equal(app.closed(), 1);
  assert.equal(app.security.hasPin, false);
  assert.deepEqual(app.security.attempts, ['9999', '1234']);
});

test('Done closes normal settings without removing the PIN', async () => {
  const app = fixture();
  byName(app.render(), 'Button', 'Tayyor').props.onPress();
  await new Promise(setImmediate);
  assert.equal(app.closed(), 1);
  assert.equal(app.security.hasPin, true);
  assert.deepEqual(app.security.attempts, []);
});
