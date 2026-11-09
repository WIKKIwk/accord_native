// Source-derived from f11910bb _buildPaddonItemsSection. No Dart or device is used.
const assert = require('node:assert/strict'), fs = require('node:fs'), Module = require('node:module');
const path = require('node:path'), test = require('node:test'), ts = require('typescript');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
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
const model = load('rezka/rezkaPaddonWipSectionModel.ts');
const { productionText, localizedMethod } = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
test('source assigned section uses actual displayed count, conditional free-movement hint and empty text', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
    const t = key => { const value = productionText(key, locale); assert.notEqual(value, key); return value; };
    const count = n => localizedMethod('productionCount', locale, { count: n });
    const items = [{ batch_id: 'a' }, { batch_id: 'b' }];
    const present = model.rezkaPaddonWipSection({ items, free_movement_enabled: true, can_manage_items: true }, t, count);
    assert.equal(present.title, t('worker.paddon.assigned.title')); assert.equal(present.count, count(2));
    assert.equal(present.hint, t('paddon.management.free_movement.hint')); assert.equal(present.empty, ''); assert.equal(present.items, items);
    for (const flags of [[false, true], [true, false], [false, false]]) {
      const empty = model.rezkaPaddonWipSection({ items: [], free_movement_enabled: flags[0], can_manage_items: flags[1] }, t, count);
      assert.equal(empty.hint, ''); assert.equal(empty.count, count(0)); assert.equal(empty.empty, t('worker.paddon.assigned.empty'));
    }
  }
});
for (const platform of ['ios', 'android']) {
  test(`${platform}: assigned section composes passive cards only for the captured owner`, () => {
    const snapshot = { session: {} }, catalog = [], items = [{ batch_id: 'a' }, { batch_id: 'b' }];
    const data = { items, free_movement_enabled: true, can_manage_items: true }, binding = { owner: snapshot, data, catalog };
    let allowed = true; const components = new Proxy({ useMaterialColors: () => ({}) }, { get: (obj, key) => obj[key] ?? key });
    const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: key, args }) });
    const { RezkaPaddonWipSection } = load(`rezka/RezkaPaddonWipSection.${platform}.tsx`, {
      'react/jsx-runtime': jsx, '@expo/ui/swift-ui': components, '@expo/ui/jetpack-compose': components, '@expo/ui/swift-ui/modifiers': modifiers,
      'react-native': { View: 'View' }, '../shared/localization': { productionText: (key, locale) => `${locale}:${key}`,
        localizedMethod: (key, locale, values) => `${locale}:${key}:${values.count}` },
      './RezkaPaddonWipReadOnly': { RezkaPaddonWipReadOnly: 'WipCard' }, './rezkaPaddonWipSectionModel': model,
      './rezkaPaddonDetailRead': { isRezkaPaddonDetailBinding: (value, owner) => value === binding && value.owner === owner },
      './useRezkaPaddonDetailAccess': { useRezkaPaddonDetailAccess: value => value === snapshot && allowed },
      './useRezkaShell': { useRezkaLocale: () => 'uz' } });
    const render = () => RezkaPaddonWipSection({ snapshot, binding }), page = render();
    assert.deepEqual(nodes(page, n => n.type === 'Text').map(n => n.props.children),
      ['uz:paddon.management.free_movement.hint', 'uz:worker.paddon.assigned.title', 'uz:productionCount:2']);
    const cards = nodes(page, n => n.type === 'WipCard'); assert.equal(cards.length, 2);
    for (const [index, card] of cards.entries()) {
      assert.equal(card.props.snapshot, snapshot); assert.equal(card.props.binding, binding); assert.equal(card.props.index, index);
      assert.equal(card.props.onPress, undefined); assert.equal(card.props.onLongPress, undefined);
    }
    assert.equal(nodes(page, n => ['Button', 'Pressable', 'IconButton'].includes(n.type)).length, 0);
    data.items = []; data.can_manage_items = false;
    assert.deepEqual(nodes(render(), n => n.type === 'Text').map(n => n.props.children),
      ['uz:worker.paddon.assigned.title', 'uz:productionCount:0', 'uz:worker.paddon.assigned.empty']);
    binding.owner = { session: {} }; assert.equal(render(), null); binding.owner = snapshot; allowed = false; assert.equal(render(), null);
  });
}
