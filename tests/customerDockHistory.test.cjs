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
  const router = StackRouter({ initialRouteName: 'index' }), frames = []; let dismisses = 0;
  let state = { stale: false, type: 'stack', key: 'customer-stack', index: initialNames.length - 1, routeNames: names,
    routes: initialNames.map((name, index) => ({ key: `${name}-${index}`, name })) };
  const dispatch = action => {
    const result = router.getStateForAction(state, action, options);
    assert.ok(result && result.state, `Unhandled: ${JSON.stringify(action)}`);
    state = result.state;
  };
  const schedulerFile = path.resolve(__dirname, '../src/customer/customerDockScheduler.ts'), schedulerModule = new Module(schedulerFile, module);
  schedulerModule.filename = schedulerFile; schedulerModule.paths = module.paths;
  schedulerModule.require = id => id === 'react-native' ? { Keyboard: { dismiss() {} } } : require(id);
  schedulerModule._compile(ts.transpileModule(fs.readFileSync(schedulerFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, schedulerFile);
  const queueCustomerDockNavigation = schedulerModule.exports.createCustomerDockScheduler(fn => frames.push(fn), () => { dismisses++; });
  const filename = path.resolve(__dirname, '../src/customer/CustomerDock.android.tsx');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useEffect: fn => { fn(); } },
    './customerDockScheduler': { queueCustomerDockNavigation }, 'expo-router': { useNavigation: parent => {
    assert.equal(parent, '/android-customer'); return { dispatch };
  } }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
  '../shared/navigation/RoleBottomBar.android': { RoleBottomBar: 'RoleBottomBar' },
  './CustomerContext': { useCustomerText: () => ({ text: key => key }), useCustomerUnread: () => false },
  './customerNavigation': { customerNotificationBadge: () => false } };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { dock: mod.exports.CustomerDock, names: () => state.routes.slice(0, state.index + 1).map(route => route.name),
    back: () => dispatch({ type: 'POP', payload: { count: 1 } }), flush: () => { while (frames.length) frames.shift()(); },
    dismisses: () => dismisses };
}

test('dock pushes an absent destination so back returns to the delivery detail', () => {
  const f = fixture(['index', 'status', 'detail']);
  f.dock({ active: null }).props.onSelect('notifications'); f.flush();
  assert.deepEqual(f.names(), ['index', 'status', 'detail', 'notifications']);
  f.back(); assert.deepEqual(f.names(), ['index', 'status', 'detail']);
});

test('dock pops to an existing destination without duplicating it', () => {
  const f = fixture(['index', 'notifications', 'status', 'detail']);
  f.dock({ active: null }).props.onSelect('notifications'); f.flush();
  assert.deepEqual(f.names(), ['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('home'); f.flush();
  assert.deepEqual(f.names(), ['index']);
});

test('dock ignores held Chat and the currently active destination', () => {
  const f = fixture(['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('notifications'); f.flush();
  assert.deepEqual(f.names(), ['index', 'notifications']);
  f.dock({ active: 'notifications' }).props.onSelect('chat'); f.flush();
  assert.deepEqual(f.names(), ['index', 'notifications']);
  assert.equal(f.dismisses(), 0);
});


test('rapid same-frame dock choices coalesce to the last requested destination', () => {
  const f = fixture(['index', 'detail']);
  const dock = f.dock({ active: null });
  dock.props.onSelect('home');
  dock.props.onSelect('notifications');
  assert.deepEqual(f.names(), ['index', 'detail']);
  f.flush();
  assert.deepEqual(f.names(), ['index', 'detail', 'notifications']);
  assert.equal(f.dismisses(), 2);
});
