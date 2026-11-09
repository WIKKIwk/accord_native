// Source-derived passive body from f11910bb aparatchi_paddon_detail_screen methods_02:258–317.
// No route, backend, device, executed Dart oracle or Paddon action is used.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
test('passive detail body composes only the bound header and assigned section with source padding', () => {
  const snapshot = { session: {} }, binding = { owner: snapshot }; let allowed = true, issued = true;
  const mocks = { 'react/jsx-runtime': jsx, 'react-native': { ScrollView: 'ScrollView', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
    './RezkaPaddonDetailHeader': { RezkaPaddonDetailHeader: 'Header' },
    './RezkaPaddonWipSection': { RezkaPaddonWipSection: 'Section' },
    './rezkaPaddonDetailRead': { isRezkaPaddonDetailBinding: (value, owner) => issued && value === binding && owner === snapshot },
    './useRezkaPaddonDetailAccess': { useRezkaPaddonDetailAccess: (owner, value) => allowed && owner === snapshot && value === binding } };
  const filename = path.resolve(__dirname, '../src/rezka/RezkaPaddonDetailBody.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  const render = () => mod.exports.RezkaPaddonDetailBody({ snapshot, binding }), body = render();
  assert.equal(body.type, 'ScrollView'); assert.equal(body.props.automaticallyAdjustContentInsets, false);
  assert.deepEqual(body.props.contentContainerStyle, { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 154 });
  const [header, spacer, section] = body.props.children;
  assert.deepEqual([header.type, spacer.type, section.type], ['Header', 'View', 'Section']);
  assert.deepEqual(spacer.props.style, { height: 12 });
  for (const child of [header, section]) { assert.equal(child.props.snapshot, snapshot); assert.equal(child.props.binding, binding); }
  assert.equal(body.props.refreshControl, undefined); assert.equal(body.props.onRefresh, undefined);
  allowed = false; assert.equal(render(), null); allowed = true; issued = false; assert.equal(render(), null);
});
