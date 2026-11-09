const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter');
const { extendRouter } = require('../node_modules/expo-router/build/react-navigation/routers/extendRouter');
const { RouterActionHandling } = require('../node_modules/expo-router/build/react-navigation/routers/types');
// Load the installed Expo Stack override, replacing only its eager native React entry with the real router primitives.
const overridePath = require.resolve('../node_modules/expo-router/build/layouts/stack-router');
const overrideModule = new Module(overridePath, module); overrideModule.filename = overridePath; overrideModule.paths = module.paths;
const localRequire = overrideModule.require.bind(overrideModule);
overrideModule.require = id => id === '../react-navigation/native' ? { StackRouter, extendRouter, RouterActionHandling } : localRequire(id);
overrideModule._compile(fs.readFileSync(overridePath, 'utf8'), overridePath);
const { stackRouterOverride } = overrideModule.exports;
const filename = path.resolve(__dirname, '../src/admin/adminClosedSheetTarget.ts'), mod = new Module(filename, module);
mod.filename = filename; mod.paths = module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { requestAdminClosedSheetTargetedPop: request } = mod.exports;
const home = { key: 'home-key', name: 'home' }, a = { key: 'sheet-a-key', name: 'sheet/[id]', params: { id: 'a' } },
  b = { key: 'sheet-b-key', name: 'sheet/[id]', params: { id: 'b' } };
const stack = (routes = [home, a, b]) => ({ type: 'stack', key: 'stack-key', routeKeySeq: 3, index: routes.length - 1, stale: false,
  routeNames: ['home', 'sheet/[id]'], routes });
const options = { routeNames: ['home', 'sheet/[id]'], routeGetIdList: {} };
function navigation(initial, beforeDispatch = value => value) {
  const router = stackRouterOverride(StackRouter({})); let current = initial; const actions = [];
  return { getState: () => current, dispatch(action) { actions.push(action); current = beforeDispatch(current); const result = router.getStateForAction(current, action, options);
    if (result?.state) current = result.state; }, get current() { return current; }, actions };
}
test('installed Expo Stack router removes the exact lower sheet and preserves a newer sheet', () => {
  const nav = navigation(stack()); assert.equal(request(nav, a.key, 'a'), true);
  assert.deepEqual(nav.actions, [{ type: 'POP', payload: { count: 1 }, source: a.key, target: 'stack-key' }]);
  assert.deepEqual(nav.current.routes.map(route => route.key), [home.key, b.key]); assert.equal(nav.current.index, 1);
});
test('installed Expo Stack router does not pop a successor if the source retires before dispatch', () => {
  const nav = navigation(stack(), () => stack([home, b])); assert.equal(request(nav, a.key, 'a'), true);
  assert.deepEqual(nav.current.routes.map(route => route.key), [home.key, b.key]); assert.equal(nav.current.index, 1);
});
test('a newer route queued before dispatch remains when the original sheet is removed', () => {
  const nav = navigation(stack([home, a]), () => stack()); assert.equal(request(nav, a.key, 'a'), true);
  assert.deepEqual(nav.current.routes.map(route => route.key), [home.key, b.key]);
});
test('only an active matching sheet in a keyed stack can be targeted', () => {
  for (const state of [undefined, { ...stack(), type: 'tab' }, { ...stack(), key: '' }, { ...stack(), index: 0 }, { ...stack(), index: 99 }, stack([home, b]),
    stack([home, { ...a, name: 'other' }, b]), stack([home, { ...a, params: { id: 'other' } }, b]), stack([a, b])]) {
    const nav = navigation(state); assert.equal(request(nav, a.key, 'a'), false); assert.deepEqual(nav.actions, []);
  }
  const nav = navigation(stack()); assert.equal(request(nav, '', 'a'), false); assert.equal(request(nav, a.key, ''), false);
  assert.equal(request({ getState() { throw Error('unmounted'); }, dispatch() { throw Error('unexpected'); } }, a.key, 'a'), false);
  assert.equal(request({ getState: () => stack(), dispatch() { throw Error('unmounted'); } }, a.key, 'a'), false);
});
test('a replaced navigator cannot redirect a targeted pop into an unrelated stack', () => {
  const nav = navigation(stack(), () => ({ ...stack([home, b]), key: 'replacement-stack' }));
  assert.equal(request(nav, a.key, 'a'), true); assert.deepEqual(nav.current.routes.map(route => route.key), [home.key, b.key]);
});
