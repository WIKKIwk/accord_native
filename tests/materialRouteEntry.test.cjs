const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks, extension = '.tsx') {
  const filename = path.resolve(__dirname, `../src/${file}${extension}`), loaded = new Module(filename, module);
  loaded.filename = filename; loaded.paths = module.paths;
  loaded.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
function setup(platform, authorized = true) {
  const session = { profile: { role: 'material_taminotchi' } }, calls = [];
  let state = null, effect, canOpen = authorized;
  const react = { useCallback: value => value, useState: () => [state, value => { state = value; }],
    useSyncExternalStore: (_sub, get) => get() };
  class Controller {
    constructor(options) { this.options = options; calls.push(['new', options]); }
    activate() { calls.push('activate'); return Promise.resolve(); }
    dispose() { calls.push('dispose'); }
  }
  const router = { navigate: href => calls.push(['navigate', href]) };
  const mocks = { 'react/jsx-runtime': jsx, react, 'expo-router': { router, useFocusEffect: fn => { effect = fn; } },
    'react-native': { Platform: { OS: platform }, View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator' },
    '../shared/appRoutes': { appRoutes: { materialTasks: 'tasks' }, canOpenRoute: () => canOpen },
    '../shared/localization': { localizedGetter: () => 'Access denied' },
    '../shared/localization/runtime': { localeController: { locale: 'uz', addListener: () => () => {} } },
    '../shared/navigation/roleDrawerContext': { useRoleDrawer: () => ({ open: () => calls.push('drawer') }) },
    '../shared/supplyTasks/SupplyTasksController': { SupplyTasksController: Controller },
    '../shared/supplyTasks/supplyTaskApi': { readSupplyTaskWindow: (...args) => { calls.push(['read', ...args]); return Promise.resolve('window'); } },
    './MaterialContext': { useMaterialContext: () => ({ session }) }, './MaterialHome': { MaterialHome: 'MaterialHome' },
    './MaterialTasks': { MaterialTasks: 'MaterialTasks' } };
  const home = compile('material/MaterialHomeRoute', mocks).MaterialHomeRoute;
  const task = compile('material/MaterialTasksRoute', mocks).MaterialTasksRoute;
  return { session, calls, home, task, focus: () => effect(), setAllowed: value => { canOpen = value; }, clearState: () => { state = null; } };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} home reaches the real tasks entry with a focus-bound action`, () => {
    const h = setup(platform); let tree = h.home(); assert.equal(tree.props.handlers.isCurrent(), false);
    const blur = h.focus(); tree = h.home(); const old = tree.props.handlers;
    assert.equal(old.isCurrent(), true); old.tasks(); assert.deepEqual(h.calls, [['navigate', `/${platform}-material/tasks`]]);
    blur(); assert.equal(old.isCurrent(), false);
    h.focus(); h.home(); assert.equal(old.isCurrent(), false);
  });
  test(`${platform} tasks entry activates real reader only for an authorized focus`, async () => {
    const h = setup(platform); assert.equal(h.task().type, 'View'); const blur = h.focus();
    const tree = h.task(); assert.equal(tree.type, 'MaterialTasks');
    const options = h.calls.find(item => Array.isArray(item) && item[0] === 'new')[1];
    const guard = () => true, query = { kind: 'material', limit: 10, apparatus: '', search: '' };
    assert.equal(options.kind, 'material'); assert.equal(options.isCurrent(), true);
    assert.equal(await options.loadWindow(query, guard), 'window');
    assert.deepEqual(h.calls.find(item => Array.isArray(item) && item[0] === 'read'), ['read', h.session, query, guard]);
    tree.props.onMenu(); tree.props.onProfile();
    assert.deepEqual(h.calls.slice(-2), ['drawer', ['navigate', `/${platform}-material/profile`]]);
    blur(); assert.equal(options.isCurrent(), false); assert.equal(h.calls.at(-1), 'dispose');
    h.setAllowed(false); h.clearState(); assert.equal(h.task().props.children.type, 'Text'); h.focus();
    assert.equal(h.calls.filter(item => Array.isArray(item) && item[0] === 'new').length, 1);
  });
  test(`${platform} deep link cannot create a task reader for a different role`, () => {
    const h = setup(platform); h.session.profile.role = 'admin'; assert.equal(h.task().props.children.type, 'Text'); h.focus();
    assert.equal(h.calls.length, 0);
  });
}
