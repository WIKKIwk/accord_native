const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
for (const platform of ['ios', 'android']) {
  test(`${platform}: passive WIP card uses only bound data and has noninteractive EPC`, () => {
    const snapshot = { session: { profile: { ref: 'mine' } } }, batch = {}, catalog = [], binding = { owner: snapshot, data: { items: [batch] }, catalog }, calls = [];
    let allowed = true, issued = true, overflow = false, index = 0;
    const content = { order: 'Buyurtma: 0038 - Bosma', peremotka: 'Peremotka', rows: [
      { key: 'quantity', label: 'Miqdor', value: '1 450 m' }, { key: 'gross', label: 'Brutto', value: '12.5 kg' },
      { key: 'epc', label: 'EPC kodi', value: '4001 1234 5678 90AB CDEF 0001', isEpc: true }] };
    const components = new Proxy({ useMaterialColors: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
    const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
    const { RezkaPaddonWipReadOnly } = load(`rezka/RezkaPaddonWipReadOnly.${platform}.tsx`, {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      'react-native': { Text: 'NativeText', PlatformColor: value => value },
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' }, '../shared/localization': { productionText: (key, locale) => `${locale}:${key}` },
      './rezkaPaddonWipModel': { rezkaPaddonWipContent: (value, machines, viewer, text) => {
        if (overflow) throw new RangeError(); calls.push([value, machines, viewer, text('key')]); return content; } },
      './rezkaPaddonDetailRead': { isRezkaPaddonDetailBinding: (value, owner) => issued && value === binding && value.owner === owner },
      './useRezkaPaddonDetailAccess': { useRezkaPaddonDetailAccess: (value, supplied) => value === snapshot && supplied === binding && allowed },
      './useRezkaShell': { useRezkaLocale: () => 'uz' } });
    const render = () => RezkaPaddonWipReadOnly({ snapshot, binding, index });
    const view = render(); assert.deepEqual(calls[0], [batch, catalog, snapshot.session.profile, 'uz:key']);
    assert.deepEqual(nodes(view, n => n.type === 'Text').map(n => n.props.children), ['Buyurtma: 0038 - Bosma', 'Peremotka', 'Miqdor', '1 450 m', 'Brutto', '12.5 kg', 'EPC kodi']);
    const epc = nodes(view, n => n.type === 'NativeText')[0]; assert.equal(epc.props.children, content.rows[2].value);
    assert.notEqual(epc.props.selectable, true); assert.equal(epc.props.style.writingDirection, 'ltr');
    assert.equal(nodes(view, n => ['Button', 'IconButton', 'Pressable'].includes(n.type)).length, 0);
    if (platform === 'android') { const card = nodes(view, n => n.type === 'Card')[0]; assert.equal(card.props.onPress, undefined); assert.equal(card.props.onLongPress, undefined); }
    const before = calls.length; binding.owner = { session: {} }; assert.equal(render(), null); assert.equal(calls.length, before);
    binding.owner = snapshot; issued = false; assert.equal(render(), null); issued = true;
    for (const invalid of [-1, 1, 0.5, NaN]) { index = invalid; assert.equal(render(), null); }
    index = 0; allowed = false; assert.equal(render(), null); allowed = true; overflow = true; assert.equal(render(), null);
  });
}
