const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  const overrides = { 'auth.ts': {}, 'authorizedFetch.ts': {}, 'sessionReadScope.ts': {}, 'shared/qolipCatalogRuntime.ts': {} };
  if (name in overrides) return overrides[name]; if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), mod = new Module(filename, module); cache.set(name, mod);
  mod.require = key => key.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), key))}.ts`) : require(key);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return mod.exports;
}
const view = load('qolip/qolipStoragePresentation.ts');
const { MobileApiException } = load('shared/mobileApiException.ts');
const { qolipStorageMoldFromJson } = load('qolip/qolipStorageApi.ts');
const mold = (code, products = [], supplied = {}) => qolipStorageMoldFromJson({ qolip_code: code, products, ...supplied });
const archive = (snapshot, supplied = {}) => ({ id: 'entry', code: 'Q-ONE', warehouse: 'W', snapshot, ...supplied });
test('storage groups sort linked products by name/code, put unlinked last, and preserve original mold identity', () => {
  const a = mold('A', [{ code: ' Z ', name: 'Beta' }, { code: 'A', name: 'alpha' }]), b = mold('B');
  const groups = view.groupQolipStorageProducts([a, b]); assert.deepEqual(groups.map(x => x.key), ['product:a', 'product:z', 'unlinked']);
  assert.equal(groups[0].visibleMolds[0], a); assert.equal(groups[2].visibleMolds[0], b); assert.equal(groups[1].code, 'Z');
});
test('repeated normalized product links retain first group metadata and repeated visible occurrences as in V2', () => {
  const a = mold('A', [{ code: ' X ', name: 'First' }, { code: 'x', name: 'Later' }]);
  const [group] = view.groupQolipStorageProducts([a]); assert.equal(group.code, 'X'); assert.equal(group.name, 'First'); assert.deepEqual(group.visibleMolds, [a, a]);
});
test('a code/set match includes all linked products; product-name search includes only its own group; unlinked name can match', () => {
  const a = mold('Q-ONE', [{ code: 'A', name: 'Alpha' }, { code: 'B', name: 'Beta' }], { qolip_set_id: 'SET' }), b = mold('Q-TWO', [], { item_name: 'Opaque name' });
  assert.equal(view.groupQolipStorageProducts([a], ' q-one ').length, 2); assert.equal(view.groupQolipStorageProducts([a], 'set').length, 2);
  assert.deepEqual(view.groupQolipStorageProducts([a], 'beta').map(x => x.code), ['B']); assert.equal(view.groupQolipStorageProducts([b], 'opaque')[0].unlinked, true);
  assert.deepEqual(view.groupQolipStorageProducts([a, b], 'no match'), []);
});
test('blank/null product codes are unlinked and membership uses opaque case-insensitive source keys', () => {
  const a = mold('A', [{ code: ' \u0085 ', name: 'discard' }, { code: null }]);
  assert.equal(view.groupQolipStorageProducts([a])[0].key, 'unlinked'); assert.equal(view.qolipStorageMoldBelongsToProduct(a, 'unlinked'), true);
  const b = mold('B', [{ code: ' İ ' }]); assert.equal(view.qolipStorageMoldBelongsToProduct(b, 'product:i'), true); assert.equal(view.qolipStorageMoldBelongsToProduct(b, 'unlinked'), false);
});
test('archive projection reads nested/flat snapshots, supplies missing code/warehouse and retains duplicate-entry identities', () => {
  const a = archive({ mold: { qolip_code: ' \u0085 ', products: [] } }), b = archive({ qolip_code: 'Q-ONE', warehouse: '' }, { id: 'second' });
  const map = view.qolipArchiveMolds([a, b]), molds = [...map.keys()]; assert.equal(map.size, 2); assert.notEqual(molds[0], molds[1]);
  assert.equal(molds[0].code, 'Q-ONE'); assert.equal(molds[0].warehouse, 'W'); assert.equal(molds[1].warehouse, ''); assert.equal(map.get(molds[1]), b);
  assert.equal(a.snapshot.mold.qolip_code, ' \u0085 ', 'source snapshot is copied before defaulting');
  assert.throws(() => view.qolipArchiveMolds([archive({ qolip_code: 123 })]), /Expected string/);
});
test('archive pallet count prefers item-array length then nonnegative numeric count and never infers missing data', () => {
  assert.equal(view.qolipArchivePaddonMoldCount(archive({ items: [], paddon: { item_count: 3 } })), 0);
  assert.equal(view.qolipArchivePaddonMoldCount(archive({ paddon: { item_count: 3.9 } })), 3);
  for (const value of [-1, null, '3', NaN]) assert.equal(view.qolipArchivePaddonMoldCount(archive({ paddon: { item_count: value } })), null);
  assert.throws(() => view.qolipArchivePaddonMoldCount(archive({ paddon: { item_count: Infinity } })), RangeError);
});
test('archive location preserves its string exactly and refuses non-string values', () => {
  assert.equal(view.qolipArchivePaddonLocation(archive({ paddon: { location: ' A ' } })), ' A ');
  assert.equal(view.qolipArchivePaddonLocation(archive({})), ''); assert.throws(() => view.qolipArchivePaddonLocation(archive({ paddon: { location: 1 } })), TypeError);
});
test('mold and pallet status precedence matches the source, including empty warehouse filter and custody mismatch', () => {
  const a = mold('A', [], { warehouse: 'W', archived: true, is_in_use: true, is_in_rework: true, is_transferring: true, paddon_code: 'QP-00012' });
  assert.deepEqual(view.qolipStorageMoldStatus(a, ''), { key: 'wrong_warehouse' }); assert.deepEqual(view.qolipStorageMoldStatus(a, 'w'), { key: 'archived' });
  assert.deepEqual(view.qolipStorageMoldStatus({ ...a, custody_mismatch: true }), { key: 'wrong_warehouse' });
  const states = ['in_use', 'in_rework', 'transferring']; const current = { ...a, archived: false };
  for (const key of states) { assert.equal(view.qolipStorageMoldStatus(current).key, key); current[key] = false; }
  assert.deepEqual(view.qolipStorageMoldStatus(current), { key: 'in_paddon', code: 'QP-00012' }); current.paddon_code = ''; assert.equal(view.qolipStorageMoldStatus(current).key, 'available');
  assert.equal(view.qolipPaddonStatusKey({ archived: true, locked: true }), 'archived'); assert.equal(view.qolipPaddonStatusKey({ locked: true }), 'locked'); assert.equal(view.qolipPaddonStatusKey({}), 'open');
});
test('storage error mapping uses only MobileApiException and source-specific code precedence over generic 409', () => {
  const entries = { session_scope_changed: 'session_changed', qolip_in_use: 'in_use', qolip_in_rework: 'in_rework', qolip_in_transfer: 'transferring',
    qolip_warehouse_mismatch: 'wrong_warehouse', qolip_storage_warehouse_changed: 'wrong_warehouse', qolip_paddon_locked: 'locked_error', qolip_archived: 'archived_error',
    qolip_in_paddon: 'in_paddon_error', qolip_paddon_empty: 'empty_error', qolip_paddon_not_empty: 'paddon_not_empty', qolip_storage_forbidden: 'forbidden_error',
    forbidden: 'forbidden_error', qolip_paddon_capacity: 'capacity_error', qolip_storage_too_many_items: 'capacity_error', qolip_storage_not_found: 'not_found' };
  for (const [code, expected] of Object.entries(entries)) assert.equal(view.qolipStorageErrorKey(new MobileApiException({ code, statusCode: 409, message: 'server' })), expected);
  assert.equal(view.qolipStorageErrorKey(new MobileApiException({ code: 'unknown', statusCode: 409, message: 'server' })), 'changed');
  assert.equal(view.qolipStorageErrorKey(new MobileApiException({ code: 'toString', statusCode: 500, message: 'server' })), 'failed');
  assert.equal(view.qolipStorageErrorKey({ code: 'qolip_in_use', statusCode: 409 }), 'failed');
});
