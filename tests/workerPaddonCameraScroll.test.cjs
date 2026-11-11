const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), Fragment: 'Fragment' };
function load(native) {
  const calls = [], file = path.resolve(__dirname, '../modules/accord-list-scroll/src/AccordListScrollReader.tsx'), mod = new Module(file, module); mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : id === 'expo' ? {
    requireOptionalNativeModule(name) { calls.push(['module', name]); return native; },
    requireNativeView(moduleName, viewName) { calls.push(['view', moduleName, viewName]); return 'NativeListReader'; },
  } : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  return { calls, render: mod.exports.AccordListScrollReader };
}

test('Expo Go and older binaries keep the same List children without requesting an unavailable native view', () => {
  for (const native of [null, {}]) {
    const h = load(native), list = { type: 'List', props: { swipeActions: true } }, tree = h.render({ targetID: 'camera', children: list });
    assert.equal(tree.type, 'Fragment'); assert.equal(tree.props.children, list);
    assert.deepEqual(h.calls, [['module', 'AccordListScroll']]);
  }
});

test('a rebuilt binary passes the camera target and unchanged List to the native reader', () => {
  const h = load({ supportsListScroll: true }), list = { type: 'List' };
  assert.deepEqual(h.calls, [['module', 'AccordListScroll'], ['view', 'AccordListScroll', 'AccordListScrollReaderView']]);
  assert.deepEqual(h.render({ targetID: 'camera', children: list }), { type: 'NativeListReader', props: { targetID: 'camera', children: list } });
  assert.equal(h.render({ targetID: '', children: list }).props.targetID, '', 'clearing scan mode cancels the native deferred task');
});
