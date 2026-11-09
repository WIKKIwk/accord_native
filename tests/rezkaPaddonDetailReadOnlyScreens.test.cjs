// Source-derived loading, failure and refresh presentation; mocked native controls and no route or backend.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: detail loading, failure retry and refresh call the scoped controller`, () => {
    const snapshot = { session: {} }, binding = {}; let state = { phase: 'loading', binding: null, refreshing: false }, current = true, refreshes = 0;
    const controller = { refresh: () => { refreshes++; return Promise.resolve(); } };
    const components = new Proxy({}, { get: (_value, key) => key });
    const modifiers = new Proxy({}, { get: (_value, key) => (...args) => ({ name: key, args }) });
    const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components,
      '@expo/ui/swift-ui/modifiers': modifiers, 'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
      '../shared/localization': { productionText: (key, locale) => `${locale}:${key}`, localizedGetter: (key, locale) => `${locale}:${key}` },
      './RezkaPaddonDetailBody': { RezkaPaddonDetailBody: 'Body' },
      './useRezkaPaddonDetail': { useRezkaPaddonDetail: (owner, apparatus, code) => {
        assert.deepEqual([owner, apparatus, code], [snapshot, 'a', 'P1']); return { state, controller, isCurrent: () => current }; } },
      './useRezkaShell': { useRezkaLocale: () => 'uz' } };
    const filename = path.resolve(__dirname, `../src/rezka/RezkaPaddonDetailReadOnly.${platform}.tsx`), mod = new Module(filename, module);
    mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
    const render = () => mod.exports.RezkaPaddonDetailReadOnly({ snapshot, apparatusId: 'a', code: 'P1' });
    assert.equal(nodes(render(), n => n.type === (platform === 'ios' ? 'ProgressView' : 'ActivityIndicator')).length, 1);
    state = { phase: 'error', binding: null, refreshing: false }; const error = render(), button = nodes(error, n => n.type === 'Button')[0];
    assert.ok(nodes(error, n => n.type === 'Text').some(node => node.props.children === 'uz:worker.paddon.load_failed'));
    (platform === 'ios' ? button.props.onPress : button.props.onClick)(); assert.equal(refreshes, 1);
    state = { phase: 'ready', binding, refreshing: true }; const body = render(); assert.equal(body.type, 'Body');
    assert.equal(body.props.binding, binding); assert.equal(body.props.snapshot, snapshot); assert.equal(body.props.refreshing, true);
    body.props.onRefresh(); assert.equal(refreshes, 2); current = false; body.props.onRefresh(); assert.equal(refreshes, 2); assert.equal(render(), null);
    current = true; state = { phase: 'invalid', binding: null, refreshing: false }; assert.equal(render(), null);
  });
}
