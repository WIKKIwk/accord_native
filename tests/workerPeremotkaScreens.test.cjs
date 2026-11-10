const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module'), path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
function nodes(node, type) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)]; }
for (const platform of ['ios', 'android']) {
  const native = new Proxy({}, { get: (_, key) => key === 'useMaterialColors' ? () => ({}) : key === 'ListItem' ? Object.assign(function ListItem() {}, { HeadlineContent: 'Headline', SupportingContent: 'Supporting' }) : key });
  const modifiers = new Proxy({}, { get: (_, key) => (...args) => ({ kind: key, args }) });
  const view = compile(`components/WorkerPeremotka.${platform}.tsx`, { 'react/jsx-runtime': jsx,
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers, '@expo/ui/jetpack-compose': native, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'Symbol' }, './BaseHost': { BaseHost: 'Host' }, 'react-native': { useWindowDimensions: () => ({ width: 390, height: 840 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) } });
  const props = () => ({ state: { phase: 'ready', batches: [] }, title: 'Peremotka', error: 'Sync error', empty: 'No rolls', rows: [{ id: 'one', title: 'Rulon', subtitle: '#00031 · 12.3456 kg · reason' }], controller: { close() {}, open() {} } });
  test(`${platform}: native peremotka sheet displays roll details in V2 order without mutating actions`, () => {
    const tree = view.WorkerPeremotkaSheet(props()); assert.deepEqual(nodes(tree, 'Text').map(node => node.props.children), ['Peremotka', 'Rulon', '#00031 · 12.3456 kg · reason']);
    assert.equal(nodes(tree, 'Button').length + nodes(tree, 'IconButton').length, 0);
  });
  test(`${platform}: loading, error and empty states stay distinct and dismissible`, () => {
    const p = props(); p.rows = [];
    for (const [phase, text] of [['loading', null], ['error', 'Sync error'], ['ready', 'No rolls']]) {
      p.state.phase = phase; const tree = view.WorkerPeremotkaSheet(p); assert.deepEqual(nodes(tree, 'Text').map(node => node.props.children), text ? ['Peremotka', text] : ['Peremotka']);
    }
    let closed = false; p.controller.close = () => { closed = true; }; const tree = view.WorkerPeremotkaSheet(p);
    if (platform === 'ios') nodes(tree, 'BottomSheet')[0].props.onIsPresentedChange(false); else nodes(tree, 'ModalBottomSheet')[0].props.onDismissRequest(); assert(closed);
  });
  test(`${platform}: native header button opens the read-only queue and respects the competing picker`, () => {
    const p = props(); let opened = false; p.controller.open = () => { opened = true; }; const tree = view.WorkerPeremotkaButton({ ...p, disabled: true });
    const button = nodes(tree, platform === 'ios' ? 'Button' : 'IconButton')[0]; assert(button);
    if (platform === 'ios') { assert(button.props.modifiers.some(m => m.kind === 'disabled' && m.args[0])); button.props.onPress(); }
    else { assert.equal(button.props.enabled, false); button.props.onClick(); } assert(opened);
  });
}
