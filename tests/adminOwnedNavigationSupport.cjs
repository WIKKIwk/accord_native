const fs = require('node:fs');
const Module = require('node:module');
const s = require('./adminUsersSupport.cjs');
const { runtime, compile } = require('./adminCustomerDetailViewSupport.cjs');
const strict = s.load('shared/camera/synchronousGuard');
const { AdminOwnedRoutes } = s.load('admin/adminOwnedRoutes', { '../shared/appRoutes': s.routes, '../shared/camera/synchronousGuard': strict, './adminUsersModel': s.model });
const removal = s.load('admin/adminOwnedRemoval', { '../shared/camera/synchronousGuard': strict });
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter');
const { extendRouter } = require('../node_modules/expo-router/build/react-navigation/routers/extendRouter');
const { RouterActionHandling } = require('../node_modules/expo-router/build/react-navigation/routers/types');
function installed(file, mocks) {
  const filename = require.resolve(file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  const original = mod.require.bind(mod); mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename); return mod.exports;
}
const { stackRouterOverride } = installed('../node_modules/expo-router/build/layouts/stack-router', { '../react-navigation/native': { StackRouter, extendRouter, RouterActionHandling } });
const routeNames = ['index', 'users', 'activity', 'owned/[id]', 'profile'];
const stack = (routes, preloaded = []) => ({ type: 'stack', key: 'original-stack', routeKeySeq: 100, stale: false, index: routes.length - 1, routeNames, routes: [...routes, ...preloaded] });
const home = { key: 'home-key', name: 'index' }, users = { key: 'users-key', name: 'users' }, newer = { key: 'newer-key', name: 'profile' };
const owned = (id, key = `native-${id}`) => ({ key, name: 'owned/[id]', params: { id } });
function native(initial) {
  const router = stackRouterOverride(StackRouter({})), actions = [], applied = [], listeners = new Set(), prevention = new Map(); let state = initial;
  const navigation = { getState: () => state, dispatch(action) {
    actions.push(action); navigation.beforeDispatch?.(action);
    if ([...prevention.values()].some(Boolean) && listeners.size) { for (const listener of [...listeners]) listener({ data: { action } }); return; }
    applied.push(action); const result = router.getStateForAction(state, action, { routeNames, routeGetIdList: {} }); if (result?.state) state = result.state;
  }, addListener(name, listener) { if (name !== 'removePrevented') throw new Error(name); listeners.add(listener); return () => listeners.delete(listener); } };
  return { navigation, actions, applied, prevention, setState(value) { state = value; }, get state() { return state; } };
}
/** Load the installed SDK 58 hook: repeat imperatively disables prevention and dispatches the exact event action. */
function sdkPrevention(value, removal) {
  const r = runtime(), setterContext = {}, preloadedContext = {}, originalReact = r.react;
  const react = { ...originalReact, useId: () => 'actual-sdk-hook', use: context => context === setterContext ? (id, enabled) => value.prevention.set(id, enabled) : false };
  const { usePreventRemove } = installed('../node_modules/expo-router/build/react-navigation/core/usePreventRemove', {
    react, '../../global-state/removalPrevention': { ScreenRemovalPreventionSetterContext: setterContext },
    '../../utils/useLatestCallback': { __esModule: true, default: callback => callback }, './IsPreloadedContext': { IsPreloadedContext: preloadedContext },
    './useClientLayoutEffect': { useClientLayoutEffect: r.react.useLayoutEffect }, './useNavigation': { useNavigation: () => value.navigation },
    './usePreventBeforeUnload': { usePreventBeforeUnload: () => () => {} },
  });
  const render = () => r.render(() => usePreventRemove(!removal.getSnapshot().permitRemove, ({ data, repeat }) => removal.blocked(data.action, repeat)));
  render(); return { render, unmount: r.unmount };
}
module.exports = { ...s, strict, runtime, compile, installed, AdminOwnedRoutes, ...removal, stack, home, users, newer, owned, native, sdkPrevention };
