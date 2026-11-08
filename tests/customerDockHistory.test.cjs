const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// Exercise the installed SDK 58 stack reducer, not a hand-written stack model.
const { StackRouter } = require(path.resolve(__dirname, '../node_modules/expo-router/build/react-navigation/routers/StackRouter.js'));
const names = ['index', 'status', 'detail', 'notifications', 'chat', 'profile'];
const options = { routeParamList: {}, routeGetIdList: {} };
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function fixture(initialNames) {
  const router = StackRouter({ initialRouteName: 'index' });
  let state = { stale: false, type: 'stack', key: 'customer-stack', index: initialNames.length - 1, routeNames: names,
    routes: initialNames.map((name, index) => ({ key: `${name}-${index}`, name })) };
  const dispatch = action => {
    const result = router.getStateForAction(state, action, options);
    assert.ok(result && result.state, `Unhandled: ${JSON.stringify(action)}`);
    state = result.state;
  };
  const filename = path.resolve(__dirname, '../src/customer/CustomerDock.android.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { useNavigation: parent => {
    assert.equal(parent, '/android-customer'); return { dispatch };
  } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
  '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
  './CustomerContext': { useCustomerText: () => ({ text: key => key }), useCustomerUnread: () => false },
  './customerNavigation': { customerNotificationBadge: () => false } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { dock: mod.exports.CustomerDock, names: () => state.routes.slice(0, state.index + 1).map(route => route.name),
    back: () => dispatch({ type: 'POP', payload: { count: 1 } }) };
}

test('dock pushes an absent destination so back returns to the delivery detail', () => {
  const f = fixture(['index', 'status', 'detail']);
  f.dock({ active: null }).props.onSelect('notifications');
  assert.deepEqual(f.names(), ['index', 'status', 'detail', 'notifications']);
  f.back(); assert.deepEqual(f.names(), ['index', 'status', 'detail']);
});

test('dock pops to an existing destination without duplicating it', () => {
  const f = fixture(['index', 'notifications', 'status', 'detail']);
  f.dock({ active: null }).props.onSelect('notifications');
  assert.deepEqual(f.names(), ['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('home');
  assert.deepEqual(f.names(), ['index']);
});

test('dock pushes an absent chat and ignores the currently active destination', () => {
  const f = fixture(['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('notifications');
  assert.deepEqual(f.names(), ['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('chat');
  assert.deepEqual(f.names(), ['index', 'notifications', 'chat']);
  f.back(); assert.deepEqual(f.names(), ['index', 'notifications']);
});
