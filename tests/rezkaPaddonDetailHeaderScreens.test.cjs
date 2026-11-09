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
  test(`${platform}: detail header is read-only and redacts when its captured witness or route is stale`, () => {
    const snapshot = { session: {} }, data = { paddon: {} }, catalog = [], binding = { owner: snapshot, data, catalog }, calls = [];
    let allowed = true, issued = true, overflow = false;
    const content = { code: '00001', peremotka: 'Peremotka', location: 'Rezka 1', creatorLabel: 'Created by', creator: 'Operator',
      gross: 'Gross: 24.375 kg', net: 'Net: 23.125 kg', locked: 'Locked', wip: 'WIP: 3', bobinaTitle: 'Bobina',
      bobina: [{ units: 2_000_000, label: '2 kg', countText: '2 ta' }, { units: 0, label: 'Unknown', countText: '1 ta' }], note: 'Note' };
    const components = new Proxy({ useMaterialColors: () => ({}) }, { get: (value, key) => value[key] ?? key });
    const modifiers = new Proxy({}, { get: (_value, key) => (...args) => ({ name: key, args }) });
    const { RezkaPaddonDetailHeader } = load(`rezka/RezkaPaddonDetailHeader.${platform}.tsx`, {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      '../components/WorkerQueueCard.android': { WorkerQueueCard: 'Card' },
      '../shared/localization': { productionText: (key, locale) => `${locale}:${key}`, adminText: (key, locale) => `${locale}:${key}`,
        localizedMethod: (key, locale, values) => `${locale}:${key}:${values.count}` },
      './rezkaPaddonDetailModel': { rezkaPaddonDetailHeader: (value, machines, text, unspecified, count) => {
        if (overflow) throw new RangeError(); calls.push([value, machines, text('title'), unspecified, count(3)]); return content; } },
      './rezkaPaddonDetailRead': { isRezkaPaddonDetailBinding: (value, owner) => issued && value === binding && owner === snapshot },
      './useRezkaPaddonDetailAccess': { useRezkaPaddonDetailAccess: value => value === snapshot && allowed },
      './useRezkaShell': { useRezkaLocale: () => 'uz' } });
    const render = () => RezkaPaddonDetailHeader({ snapshot, binding });
    const view = render(); assert.deepEqual(calls[0], [data, catalog, 'uz:title', 'uz:wip.unspecified', 'uz:productionCount:3']);
    assert.deepEqual(nodes(view, n => n.type === 'Text').map(n => n.props.children), ['00001', 'Peremotka', 'Rezka 1', 'Created by', 'Operator',
      'Gross: 24.375 kg', 'Net: 23.125 kg', 'Locked', 'WIP: 3', 'Bobina', '2 kg', '2 ta', 'Unknown', '1 ta', 'Note']);
    assert.equal(nodes(view, n => ['Button', 'Pressable', 'IconButton', 'Toggle'].includes(n.type)).length, 0);
    if (platform === 'android') { const card = nodes(view, n => n.type === 'Card')[0]; assert.equal(card.props.onPress, undefined); assert.equal(card.props.onLongPress, undefined); }
    content.locked = ''; content.peremotka = ''; content.location = ''; content.bobinaTitle = ''; content.note = '';
    const emptyOptional = nodes(render(), n => n.type === 'Text').map(n => n.props.children);
    assert.deepEqual(emptyOptional, ['00001', 'Created by', 'Operator', 'Gross: 24.375 kg', 'Net: 23.125 kg', 'WIP: 3']);
    issued = false; assert.equal(render(), null); issued = true; overflow = true; assert.equal(render(), null); overflow = false;
    allowed = false; assert.equal(render(), null);
  });
}
