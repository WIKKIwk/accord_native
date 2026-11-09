const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function load(file, overrides = {}, extension = 'ts') {
  const filename = path.resolve(__dirname, '../../src', `${file}.${extension}`), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return mod.exports;
}
const { SupplierStore } = load('supplier/supplierStore', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
});
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storeFixture(overrides = {}) {
  const calls = [];
  const api = Object.fromEntries(['supplierSummary', 'supplierHistory', 'supplierStatusBreakdown', 'supplierStatusDetails']
    .map(name => [name, async (...args) => { calls.push([name, ...args.slice(1)]); return name === 'supplierSummary'
      ? { pendingCount: 0, submittedCount: 0, returnedCount: 0 } : []; }]));
  const runtime = { subscribe: () => () => {}, applySummary: value => value };
  return { store: new SupplierStore({}, { ...api, ...overrides }, runtime), calls };
}

// Controlled hook lifecycle, not a native renderer or a device interaction test.
function harness() {
  let cursor = 0, pending = [], writes = 0;
  const slots = [];
  const changed = (before, after) => !before || before.length !== after.length || after.some((value, i) => value !== before[i]);
  return {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[i].value, value => { writes++; slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!slots[i] || changed(slots[i].deps, deps)) pending.push(() => {
          slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() };
        });
      },
    },
    render(render) { cursor = 0; pending = []; return render(); },
    commit() { const effects = pending; pending = []; effects.forEach(effect => effect()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    get writes() { return writes; },
  };
}
function hooks(h, overrides = {}) {
  return load('supplier/useSupplierOverview', {
    react: h.react, 'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } }, '../shared/localization': {},
    '../shared/localization/runtime': { localeController: {} },
    '../shared/notificationStoresRuntime': { refreshHub: { subscribe: () => () => {} } }, './supplierMaterialText': {}, ...overrides,
  });
}

function overviewViews(platform, h) {
  const jsx = (type, props) => ({ type, props });
  const components = names => Object.fromEntries(names.split(' ').map(name => [name, name]));
  const text = { t: value => value, l: key => key, lm: (key, values) => `${key}:${JSON.stringify(values)}` };
  return load(`supplier/SupplierOverviewScreens.${platform}`, {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui/swift-ui': components('Button HStack ProgressView Section Spacer Text VStack'),
    '@expo/ui/jetpack-compose': { ...components('Host Text TextButton'), useMaterialColors: () => ({}) },
    'expo-router': { Stack: { Screen: 'Screen' } },
    'react-native': { ...components('ActivityIndicator RefreshControl ScrollView Text View'), PlatformColor: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../preparation/PreparationUI': components('PreparationList PreparationRow PreparationText'),
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' },
    '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
    './supplierScreenModel': load('supplier/supplierScreenModel', {
      '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
      '../shared/searchNormalizer': load('shared/searchNormalizer'),
    }),
    './useSupplierOverview': { ...hooks(h), useSupplierStore: store => store, useSupplierText: () => text },
  }, 'tsx');
}
function renderedNodes(node) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(renderedNodes);
  if (typeof node !== 'object') return [node];
  if (typeof node.type === 'function') return renderedNodes(node.type(node.props));
  return [node, ...renderedNodes(node.props.children)];
}
const isLoading = nodes => nodes.some(node => node?.type === 'ProgressView' || node?.type === 'ActivityIndicator');

module.exports = { load, tick, deferred, storeFixture, harness, hooks, overviewViews, renderedNodes, isLoading };
