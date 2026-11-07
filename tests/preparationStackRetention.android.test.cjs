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

test('Android preparation keeps earlier native screens attached with the default animation', () => {
  const session = { profile: { role: 'tayyorlov_masteri' }, capabilities: ['preparation.access'] };
  const Stack = Object.assign(() => {}, { Screen: 'Stack.Screen' });
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { createContext: () => ({ Provider: 'Context.Provider' }), useContext() {}, useEffect() {}, useRef: value => ({ current: value }),
      useState: () => [session, () => {}] },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'role-background' }) },
    'expo-router': { Redirect: 'Redirect', Stack, router: {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: 'android' }, View: 'View' },
    '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    './PreparationUI.android': { PreparationDialogs: 'PreparationDialogs' },
    './PreparationDrawer.android': { PreparationDrawer: 'PreparationDrawer' },
    './PreparationFab.android': { PreparationFabProvider: 'PreparationFabProvider' },
    './usePreparationHome': { usePreparationHome: () => ({ controller: {} }) },
  };
  const filename = path.resolve(__dirname, '../src/preparation/PreparationContext.android.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') ? {} : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  const page = mod.exports.PreparationLayout();
  const navigator = nodes(page, node => node.type === Stack)[0];
  assert.ok(navigator);
  assert.equal(navigator.props.screenOptions.presentation, 'transparentModal');
  assert.equal(navigator.props.screenOptions.animation, undefined);
  assert.equal(navigator.props.screenOptions.contentStyle.backgroundColor, 'role-background');
  const home = nodes(navigator, node => node.type === 'Stack.Screen' && node.props.name === 'index')[0];
  assert.equal(home.props.options.presentation, 'card');
  assert.equal(home.props.activityEnabled, false);
  const provider = nodes(page, node => typeof node.type === 'function' && node.type.name === 'Provider')[0];
  const layout = provider.type(provider.props);
  const drawer = nodes(layout, node => node.type === 'PreparationDrawer')[0];
  assert.equal(drawer.props.children.type, 'PreparationFabProvider');
  assert.equal(drawer.props.children.props.children.type, Stack);
});
