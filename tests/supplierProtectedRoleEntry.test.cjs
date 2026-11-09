const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function render(platform, role, capabilities = ['supplier.access']) {
  const session = { token: 'token', imageCacheScope: 'scope', profile: { role, ref: 'user' }, capabilities };
  const filename = path.resolve(__dirname, '../src/supplier/SupplierShell.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useEffect() {}, useRef: value => ({ current: value }), useState: () => [session, () => {}] },
    'expo-router': { Redirect: 'Redirect', router: {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Platform: { OS: platform }, View: 'View' },
    '../auth': {}, '../appLock': {}, '../components/WorkerSecurity': { WorkerSecurityProvider: 'WorkerSecurityProvider' },
    '../shared/appRoutes': { appRoutes: { supplierHome: 'supplierHome' }, canOpenRoute: value => value.capabilities.includes('supplier.access') },
    '../shared/navigation/RoleDrawer': {}, '../shared/navigation/roleDrawerContext': {},
    '../shared/navigation/roleDrawerLogout': {}, './SupplierSession': { SupplierProvider: 'SupplierProvider' },
    './supplierNavigationModel': {}, './useSupplierOverview': {},
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports.SupplierShell({ platform, children: 'role-screen' });
}

for (const platform of ['ios', 'android']) test(`${platform} Supplier deep links reject protected roles but retain ordinary Supplier access`, () => {
  for (const role of ['aparatchi', 'tayyorlov_masteri']) {
    const tree = render(platform, role);
    assert.equal(tree.type, 'Redirect'); assert.equal(tree.props.href, '/');
  }
  const normal = render(platform, 'supplier');
  assert.equal(normal.type, 'WorkerSecurityProvider');
  assert.equal(normal.props.children.type, 'SupplierProvider');
  assert.equal(normal.props.children.props.children, 'role-screen');
  assert.equal(render(platform, 'supplier', []).type, 'Redirect');
});
