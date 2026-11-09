const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { StackRouter } = require(path.resolve(__dirname, '../node_modules/expo-router/build/react-navigation/routers/StackRouter.js'));
const names = ['index', 'status', 'detail', 'notifications', 'chat', 'profile'];
const options = { routeParamList: {}, routeGetIdList: {} };
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, overrides = {}) {
  const filename = path.resolve(__dirname, '../src/customer', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(overrides, id) ? overrides[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const nav = load('customerNavigation.ts');
function fixture(initialNames) {
  const reducer = StackRouter({ initialRouteName: 'index' });
  let state = { stale: false, type: 'stack', key: 'customer-stack', index: initialNames.length - 1, routeNames: names,
    routes: initialNames.map((name, index) => ({ key: `${name}-${index}`, name })) };
  const dispatch = action => {
    const result = reducer.getStateForAction(state, action, options);
    assert.ok(result && result.state, `Unhandled: ${JSON.stringify(action)}`);
    state = result.state;
  };
  const router = { replace: href => {
    const name = href === '/android-customer' ? 'index' : href.slice('/android-customer/'.length);
    dispatch({ type: 'REPLACE', payload: { name } });
  } };
  const drawer = load('CustomerDrawer.tsx', {
    'react/jsx-runtime': jsx, 'react-native': { Platform: { OS: 'android' } },
    'expo-router': { router, usePathname: () => '/android-customer/notifications' },
    '../shared/localization': { uiText: text => text }, '../shared/navigation/RoleDrawer': { RoleDrawer: 'RoleDrawer' },
    '../shared/navigation/roleDrawerContext': { useRoleDrawerState: () => ({ visible: false, onOpen() {}, onClose() {} }) },
    '../shared/navigation/roleDrawerLogout': { confirmRoleDrawerLogout() {} },
    './CustomerContext': { useCustomerContext: () => ({ onLogout() {} }), useCustomerText: () => ({ text: key => key, locale: 'uz' }) },
    './customerNavigation': nav,
  }).CustomerDrawer({ children: 'content' });
  return { drawer, names: () => state.routes.slice(0, state.index + 1).map(route => route.name),
    back: () => dispatch({ type: 'POP', payload: { count: 1 } }) };
}

test('drawer Home replaces only Notifications even when Home already exists', () => {
  const f = fixture(['index', 'status', 'detail', 'notifications']);
  f.drawer.props.onSelect('home');
  assert.deepEqual(f.names(), ['index', 'status', 'detail', 'index']);
  f.back(); assert.deepEqual(f.names(), ['index', 'status', 'detail']);
});

test('drawer Profile replaces only the current route even when absent from the stack', () => {
  const f = fixture(['index', 'status', 'detail', 'notifications']);
  f.drawer.props.onSelect('profile');
  assert.deepEqual(f.names(), ['index', 'status', 'detail', 'profile']);
  f.back(); assert.deepEqual(f.names(), ['index', 'status', 'detail']);
});
