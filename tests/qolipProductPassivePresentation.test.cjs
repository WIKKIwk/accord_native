const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src'), cache = new Map();
function load(name) {
  name = name.replaceAll('\\', '/'); if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(root, name), loaded = new Module(filename, module); cache.set(name, loaded);
  loaded.require = target => target.startsWith('.') ? load(`${path.relative(root, path.resolve(path.dirname(filename), target))}.ts`) : require(target);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext } }).outputText, filename);
  return loaded.exports;
}
const present = load('qolip/qolipProductPassivePresentation.ts').qolipProductPassivePresentation;
const row = (code, set_id, overrides = {}) => ({ qolip_code: code, set_id, is_extension: false, is_in_use: false, size: 0, color: '', order_image_order_id: '', ...overrides });
const container = (children, overrides = {}) => ({ code: 'I-1', name: 'Product', itemGroup: '', imageOrderId: 'fallback', children, ...overrides });

test('passive product projection preserves source sections, alternative ordinals and rework precedence', () => {
  const a = row(' Q-A ', 'set-a', { size: 42, color: '#E53935', is_in_use: true });
  const b = row('Q-B', 'set-b', { size: 40 }), c = row('Q-C', 'unused', { is_extension: true });
  const result = present(container([a, b, c]), new Set(['q-a']));
  assert.equal(result.title, 'Product'); assert.equal(result.hasDetails, true); assert.equal(result.count, 3); assert.equal(result.inUse, true);
  assert.equal(result.reworkCount, 1); assert.equal(result.coverId, 'fallback');
  assert.deepEqual(result.sections.map(section => [section.id, section.extension, section.alternativeIndex]),
    [['set-a', false, 1], ['set-b', false, 2], ['extensions', true, null]]);
  assert.equal(result.sections[0].members[0].subtitle, 'rework'); assert.equal(result.sections[0].members[0].color, '#E53935');
  assert.equal(result.sections[1].members[0].subtitle, 'size'); assert.equal(result.sections[2].members[0].subtitle, 'empty');
  assert.equal(result.sections[0].members[0].product, a);
});

test('a single normal set has no alternative ordinal and an issued row precedes size', () => {
  const result = present(container([row('Q', 'set', { is_in_use: true, size: 50 })], { name: '', code: 'Raw Code' }), new Set());
  assert.equal(result.title, 'Raw Code'); assert.equal(result.sections[0].alternativeIndex, null);
  assert.equal(result.sections[0].members[0].subtitle, 'issued'); assert.equal(result.sections[0].members[0].color, null);
  assert.equal(present(container([]), new Set()).hasDetails, false);
});

test('reserved extensions key follows source collision and numbering behavior', () => {
  const colliding = row('A', 'extensions'), actualExtension = row('B', 'other', { is_extension: true }), normal = row('C', 'set');
  const result = present(container([colliding, normal, actualExtension]), new Set());
  assert.deepEqual(result.sections.map(section => [section.id, section.alternativeIndex]), [['extensions', null], ['set', null]]);
  assert.deepEqual(result.sections[0].members.map(member => member.product.qolip_code), ['B']);
});
