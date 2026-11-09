const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
const cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/'); if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const api = load('qolip/qolipProductContainer.ts');
const row = (code, name, qolip_code, overrides = {}) => ({ is_extension: false, qolip_set_id: 'set', set_id: 'set', warehouse: 'W', code, name,
  item_group: ' Group ', customer_names: [], qolip_code, first_qolip_code: '', size: 0, color: '', has_qolip_spec: true, is_in_use: false,
  is_in_rework: false, order_image_order_id: '', ...overrides });
const container = (children, overrides = {}) => ({ code: 'C', name: 'Name', itemGroup: 'Group', children, imageOrderId: '', ...overrides });

// @v2-test test/qolip_products_grouping_test.dart
test('f119 source grouping example groups products and sorts names and mold codes', () => {
  const groups = api.groupQolipProductsByContainer([row('ITEM-002', 'Botinka', 'Q-B-02'), row('ITEM-001', 'Kross', 'Q-A-02'), row('ITEM-001', 'Kross', 'Q-A-01')]);
  assert.deepEqual(groups.map(group => group.name), ['Botinka', 'Kross']);
  assert.deepEqual(groups[1].children.map(child => child.qolip_code), ['Q-A-01', 'Q-A-02']);
  assert.deepEqual(api.groupQolipProductsByContainer([row('ITEM-001', 'Kross', '')]), []);
  const used = api.groupQolipProductsByContainer([row('ITEM-001', 'Kross', 'Q-1'), row('ITEM-001', 'Kross', 'Q-2', { is_in_use: true })]);
  assert.equal(api.qolipContainerHasInUse(used[0]), true);
  const imaged = api.groupQolipProductsByContainer([row('ITEM-001', 'Kross', 'Q-1', { order_image_order_id: 'map-kross-1' })]);
  assert.equal(api.qolipContainerOrderImageId(imaged[0]), 'map-kross-1');
});

test('group identity trims and lowercases code or name, keeps first metadata and original row references', () => {
  const a = row(' I-1 ', ' First ', ' Q-B '), b = row('i-1', 'Different', ' Q-A ', { item_group: 'Other' });
  const c = row('', ' Named ', 'x'), d = row(' ', 'named', 'y');
  const empty = row('I-2', 'Ignored', '\u0085  '), groups = api.groupQolipProductsByContainer([a, b, c, d, empty]);
  assert.deepEqual(groups.map(group => [group.code, group.name, group.itemGroup]), [['I-1', 'First', 'Group'], ['', 'Named', 'Group']]);
  assert.equal(groups[0].children[0], b); assert.equal(groups[0].children[1], a); assert.deepEqual(groups[1].children, [c, d]);
});

test('name fallback and explicit code share the source grouping namespace', () => {
  const byName = row('', 'Same', 'x'), byCode = row(' SAME ', 'Other', 'y');
  const [group] = api.groupQolipProductsByContainer([byName, byCode]);
  assert.equal(group.code, ''); assert.equal(group.name, 'Same'); assert.deepEqual(group.children, [byName, byCode]);
});

test('sorting follows simple lowercase and UTF-16 ordering, rather than locale collation', () => {
  const groups = api.groupQolipProductsByContainer([row('I-1', '\uE000', 'z'), row('I-2', '𐀀', 'z'), row('I-3', 'İ', 'Σ')]);
  assert.deepEqual(groups.map(group => group.name), ['İ', '𐀀', '\uE000']);
  const molds = api.groupQolipProductsByContainer([row('A', 'A', 'ς'), row('A', 'A', 'Σ'), row('A', 'A', 'İ')])[0].children;
  assert.deepEqual(molds.map(item => item.qolip_code), ['İ', 'ς', 'Σ']);
});

test('container key uses even an empty catalog ID, then trimmed code or name', () => {
  assert.equal(api.qolipContainerKey(container([], { catalogId: '', code: 'X' })), '');
  assert.equal(api.qolipContainerKey(container([], { catalogId: 'exact' })), 'exact');
  assert.equal(api.qolipContainerKey(container([], { code: ' İ ', name: 'Name' })), 'i');
  assert.equal(api.qolipContainerKey(container([], { code: ' ', name: ' NAME ' })), 'name');
});

test('set grouping keeps insertion order and extensions overwrite a normal reserved-name set', () => {
  const a = row('C', 'N', '1', { set_id: 'S-1' }), reserved = row('C', 'N', '2', { set_id: 'extensions' });
  const b = row('C', 'N', '3', { set_id: 'S-1' }), extra = row('C', 'N', '4', { is_extension: true, set_id: 'ignored' });
  const sets = api.qolipContainerSets(container([a, reserved, b, extra]));
  assert.deepEqual([...sets.keys()], ['S-1', 'extensions']); assert.deepEqual(sets.get('S-1'), [a, b]); assert.deepEqual(sets.get('extensions'), [extra]);
});

test('cover ID uses the first nonblank sorted child ID before the raw catalog fallback', () => {
  const first = row('C', 'N', 'A', { order_image_order_id: ' \u0085 ' }), second = row('C', 'N', 'B', { order_image_order_id: ' map-id ' });
  assert.equal(api.qolipContainerOrderImageId(container([first, second], { imageOrderId: ' fallback ' })), 'map-id');
  assert.equal(api.qolipContainerOrderImageId(container([first], { imageOrderId: ' fallback ' })), ' fallback ');
  assert.equal(api.qolipContainerOrderImageId(container([], { imageOrderId: '' })), '');
});

test('title and rework count use source fields and count repeated child matches', () => {
  const a = row('C', 'N', ' Q-1 '), b = row('C', 'N', 'q-1'), c = row('C', 'N', 'Q-2');
  const group = container([a, b, c], { name: '', code: ' C ' });
  assert.equal(api.qolipContainerTitle(group), ' C '); assert.equal(api.qolipContainerTitle({ ...group, name: ' ' }), ' ');
  assert.equal(api.qolipContainerReworkCount(group, new Set(['q-1'])), 2); assert.equal(api.qolipContainerHasInUse(group), false);
});

test('catalog adoption keeps window order and only accepts exactly one grouped detail container', () => {
  const items = [{ id: 'one', name: 'Window One', order_image_order_id: 'cover-one' }, { id: 'none', name: 'Window None', order_image_order_id: '' },
    { id: 'bad', name: 'Window Bad', order_image_order_id: 'cover-bad' }];
  const a = row('I-1', 'Detail Name', 'Q-B'), b = row('I-1', 'Detail Name', 'Q-A');
  const details = new Map([['one', [a, b]], ['bad', [row('I-2', 'Two', 'Q-2'), row('I-3', 'Three', 'Q-3')]]]);
  const result = api.qolipAdoptCatalogWindow(items, details);
  assert.deepEqual(result.containers.map(value => value.catalogId), ['one', 'none', 'bad']);
  assert.deepEqual(result.containers.map(value => [value.code, value.name, value.itemGroup, value.imageOrderId]),
    [['I-1', 'Window One', 'Group', 'cover-one'], ['', 'Window None', '', ''], ['', 'Window Bad', '', 'cover-bad']]);
  assert.deepEqual(result.products, [b, a]); assert.equal(details.get('one')[0], a, 'the supplied cache snapshot is not mutated');
});

test('catalog adoption keeps placeholders for empty or code-less detail results', () => {
  const items = [{ id: 'empty', name: 'Empty', order_image_order_id: 'A' }, { id: 'blank', name: 'Blank', order_image_order_id: 'B' }];
  const result = api.qolipAdoptCatalogWindow(items, new Map([['empty', []], ['blank', [row('I', 'Name', '  ')]]]));
  assert.deepEqual(result.containers.map(value => value.children), [[], []]); assert.deepEqual(result.products, []);
});


test('duplicate catalog IDs use the last resolved metadata, matching the source detail map', () => {
  const items = [{ id: 'same', name: 'First', order_image_order_id: 'first' }, { id: 'same', name: 'Last', order_image_order_id: 'last' }];
  const result = api.qolipAdoptCatalogWindow(items, new Map([['same', [row('I', 'Detail', 'Q')]]]));
  assert.equal(result.containers[0], result.containers[1]); assert.equal(result.containers[0].name, 'Last');
  assert.equal(result.containers[0].imageOrderId, 'last'); assert.equal(result.products.length, 2);
});

test('catalog-product projection uses the first child, source defaults and selected cover without sending', () => {
  const first = row('ignored', 'ignored', ' Q-A ', { warehouse: ' W ', first_qolip_code: '  ', customer_names: ['One', 'Two'] });
  const second = row('ignored', 'ignored', 'Q-B', { order_image_order_id: ' map-2 ' });
  const source = container([first, second], { code: ' İ𐐀 ', name: 'Display', itemGroup: 'Group', imageOrderId: 'fallback' });
  const projected = api.qolipContainerCatalogProduct(source);
  assert.deepEqual(projected, { is_extension: false, qolip_set_id: '', set_id: 'legacy:2:i𐐨:w', warehouse: ' W ',
    code: ' İ𐐀 ', name: 'Display', item_group: 'Group', customer_names: ['One', 'Two'], qolip_code: '', first_qolip_code: ' Q-A ',
    size: 0, color: '', has_qolip_spec: false, is_in_use: false, is_in_rework: false, order_image_order_id: 'map-2' });
  assert.equal(projected.customer_names, first.customer_names); first.first_qolip_code = ' Existing ';
  assert.equal(api.qolipContainerCatalogProduct(source).first_qolip_code, ' Existing ');
  assert.throws(() => api.qolipContainerCatalogProduct(container([])), RangeError);
});
