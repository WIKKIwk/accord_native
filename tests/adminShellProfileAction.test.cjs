/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function fixture() {
  let current = true, available = true, onDestination = () => {};
  const cleanups = [], pushes = [], session = {}, witness = {};
  const shell = { session, witness, isCurrent: () => current,
    destination: (route, platform) => { assert.equal(route, '/profile'); assert.equal(platform, 'android'); onDestination(); return available ? '/android-admin/profile' : null; } };
  const jsx = { jsx: (type, props) => ({ type, props }) };
  const mocks = { 'react/jsx-runtime': jsx, 'expo-router': { router: { push: value => pushes.push(value) }, useIsFocused: () => true },
    react: { useCallback: callback => callback, useRef: current => ({ current }), useLayoutEffect: callback => { cleanups.push(callback()); } },
    'react-native': { Platform: { OS: 'android' } }, '../shared/appRoutes': { appRoutes: { profile: '/profile' } },
    './AdminProfileAction': { AdminProfileAction: 'OriginalNativeProfileAction' }, './AdminShellContext': { useAdminShell: () => shell } };
  const filename = path.resolve(__dirname, '../src/admin/AdminShellProfileAction.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => mocks[id] ?? require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const action = mod.exports.AdminShellProfileAction();
  return { action, shell, pushes, retire: () => { current = false; }, unavailable: () => { available = false; },
    onDestination: callback => { onDestination = callback; }, blur: () => cleanups.forEach(cleanup => cleanup?.()) };
}
test('the actual native profile/account control retains its original shell session and opens the reviewed destination', () => {
  const f = fixture(); assert.equal(f.action.type, 'OriginalNativeProfileAction');
  assert.equal(f.action.props.session, f.shell.session); assert.equal(f.action.props.witness, f.shell.witness);
  assert.equal(f.action.props.isCurrent, f.shell.isCurrent); assert.equal(f.action.props.canInteract(), true);
  f.action.props.onProfile(); assert.deepEqual(f.pushes, ['/android-admin/profile']);
});
test('blur, original-account retirement and unavailable profile destination suppress captured navigation', () => {
  for (const retire of ['blur', 'retire', 'unavailable']) {
    const f = fixture(); f[retire](); f.action.props.onProfile(); assert.deepEqual(f.pushes, []);
  }
  const f = fixture(); f.onDestination(f.retire); f.action.props.onProfile(); assert.deepEqual(f.pushes, []);
});
