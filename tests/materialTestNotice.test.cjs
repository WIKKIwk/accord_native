const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function compile(file, mocks, ext = '.ts') {
  const filename = path.resolve(__dirname, `../src/material/${file}${ext}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return loaded.exports;
}
test('test warning is visible and contains no redirects, logout, profile or network controls', () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const tree = compile('MaterialTestNotice', { 'react/jsx-runtime': jsx, 'react-native': { View: 'View', Text: 'Text' } }, '.tsx').MaterialTestNotice();
  assert.equal(tree.props.children.type, 'Text'); assert.equal(tree.props.children.props.accessibilityRole, 'alert');
  assert.match(tree.props.children.props.children, /test rejimi hali tayyor emas/);
});
test('Home refresh sends no profile request for reserved test token', async () => {
  const session = { token: 'test-mode-token', assigned_item_groups: [] }, witness = {}; let reads = 0;
  const hooks = { useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn };
  const { useMaterialScope } = compile('useMaterialScope', { react: hooks,
    '../auth': { activeSessionToken: () => session.token, isSessionWitnessCurrent: () => true, registerSessionResetHook: () => () => {} },
    '../profileApi': { profile: async () => { reads++; } }, './materialProfileGuard': { materialProfileCurrent: value => value.token !== 'test-mode-token' } });
  await useMaterialScope(session, witness).refresh(); assert.equal(reads, 0);
});
