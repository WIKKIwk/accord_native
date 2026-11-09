const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => name in dependencies ? dependencies[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText, filename);
  return loaded.exports;
}

const shared = load('shared/searchNormalizer.ts');
let normalizerCalls = 0;
const { QolipSearchDocument, QolipSearchQuery, filterQolipSearch } = load('qolip/qolipSearchEngine.ts', {
  '../shared/searchNormalizer': { normalizeForSearch(value) { normalizerCalls++; return shared.normalizeForSearch(value); } },
});
const matches = (query, values) => new QolipSearchQuery(query).matches(new QolipSearchDocument(values));

test('reuses shared normalization and applies Dart native U+0085 edge trimming', () => {
  const before = normalizerCalls;
  const doc = new QolipSearchDocument([' Ғўза  Хомашё ', 'кrоss', 'Q-001', 'q 001', '', '\u0085', 'ъ\u0085А\u0085']);
  assert.ok(normalizerCalls > before);
  assert.deepEqual(doc.normalized, ['goza homashyo', 'kross', 'q-001', 'q 001', 'a']);
  assert.deepEqual(doc.compact, ['gozahomashyo', 'kross', 'q001', 'a']);
  assert.equal(new QolipSearchQuery('\u0085').isEmpty, true);
  assert.equal(matches('\u0085ҒЎЗА\u0085', ['Ғўза']), true);
  assert.deepEqual(new QolipSearchDocument(['абвгдеёжзийклмнопрстуфхцчшщъыьэюяқғҳў']).normalized,
    ['abvgdeyojziyklmnoprstufhtschshshieyuyaqgho']);
});

test('V2 matcher handles scripts, punctuation, edit typos and cross-field words', () => {
  const values = ['Kross model', 'ITEM-001', 'Q-001', 'Customer Iskandar'];
  for (const query of ['кrоss', 'кросс', 'kr oss', 'Q 0-0 1', 'krosss', 'kros', 'krass', 'korss',
    'iskndar kroos', 'model kroos', 'rhjcc', 'лкщыы', 'kr']) assert.equal(matches(query, values), true, query);
  for (const query of ['drass', 'ks', 'loafer', 'Q-002', 'ITEM-002']) assert.equal(matches(query, values), false, query);
  assert.equal(matches('batimka', ['Botinka']), true);
  assert.equal(matches('', []), true);
});

test('wrong-keyboard alternatives are exact only and never generated for digits or mixed scripts', () => {
  assert.equal(matches('rhjcc', ['Kross']), true);
  assert.equal(matches('лкщыы', ['Kross']), true);
  assert.equal(matches('rhjcd', ['Kross']), false);
  assert.equal(matches('rhjcc2', ['Kross']), false);
  assert.equal(matches('rhjcс', ['Kross']), false);
  assert.equal(matches('rhj', ['Kross']), false);
});

test('fuzzy edit limits change at six and ten characters and never guess identifiers', () => {
  const values = ['abcdefghijklmno'];
  for (const query of ['xbcdef', 'xbcdefyhij', 'abxxefghXjklmno']) assert.equal(matches(query, values), true, query);
  for (const query of ['xyzdef', 'xxxdefyhij', 'abxxefghXXklmno', 'abcd2f']) assert.equal(matches(query, values), false, query);
});

test('sliced filtering preserves order and duplicates and does not index an empty query', async () => {
  const values = ['Kross', 'Botinka', 'Kross', 'кросс'];
  assert.deepEqual(await filterQolipSearch(values, 'kroos', value => new QolipSearchDocument([value])),
    ['Kross', 'Kross', 'кросс']);
  assert.deepEqual(await filterQolipSearch(values, '', () => { throw new Error('empty query must not index'); }), values);
  assert.equal(await filterQolipSearch([], '', () => { throw new Error('not called'); }, { isCurrent: () => false }), null);
  let checks = 0;
  assert.equal(await filterQolipSearch(['Kross'], '', () => { throw new Error('not called'); }, {
    isCurrent: () => ++checks === 1,
  }), null);
});

test('large scans yield and discard a superseded query', async () => {
  const values = Array.from({ length: 20000 }, (_, index) => new QolipSearchDocument([`Mahsulot ${index}`, `Q-${index}`]));
  let current = true;
  let visited = 0;
  setTimeout(() => { current = false; }, 0);
  const result = await filterQolipSearch(values, 'topilmaydigan', value => { visited++; return value; }, {
    isCurrent: () => current,
  });
  assert.equal(result, null);
  assert.ok(visited > 0 && visited < values.length);
});

// Straightforward port of test/support/qolip_search_reference.dart. It uses
// window-by-window bounded Damerau distance instead of the optimized engine.
function legacyMatches(query, values) {
  const normalize = value => shared.normalizeForSearch(value).replace(/^[\s\u0085]+|[\s\u0085]+$/g, '');
  const compact = value => value.replace(/[^a-z0-9]+/g, '');
  const tokens = value => value.split(/[^a-z0-9]+/).filter(Boolean);
  const variants = [];
  const add = (value, allowFuzzy) => {
    const normalized = normalize(value);
    if (normalized && !variants.some(variant => variant.value === normalized)) variants.push({ value: normalized, allowFuzzy });
  };
  add(query, true);
  const characters = [...query.toLowerCase()];
  const latin = characters.filter(value => /^[a-z]$/.test(value)).length;
  const cyrillic = characters.filter(value => { const rune = value.codePointAt(0); return rune >= 0x400 && rune <= 0x4ff; }).length;
  const mapKeyboard = (value, from, to) => [...value.toLowerCase()].map(character => {
    const index = from.indexOf(character);
    return index < 0 ? character : to[index];
  }).join('');
  const latinKeys = 'qwertyuiopasdfghjklzxcvbnm', cyrillicKeys = 'йцукенгшщзфывапролдячсмить';
  if (!/[0-9]/.test(query)) {
    if (latin >= 4 && cyrillic === 0) add(mapKeyboard(query, latinKeys, cyrillicKeys), false);
    else if (cyrillic >= 4 && latin === 0) add(mapKeyboard(query, cyrillicKeys, latinKeys), false);
  }
  if (!variants.length) return true;
  const normalizedValues = values.map(normalize).filter(Boolean);
  if (!normalizedValues.length) return false;
  const parts = new Set(normalizedValues.flatMap(value => [compact(value), ...tokens(value)]).filter(Boolean));
  const canFuzzy = value => value.length >= 3 && !/[0-9]/.test(value);
  const distance = (left, right, maxDistance) => {
    if (Math.abs(left.length - right.length) > maxDistance) return null;
    let previousPrevious = [], previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      const current = Array(right.length + 1).fill(0);
      current[0] = i;
      for (let j = 1; j <= right.length; j++) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        let next = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
          next = Math.min(next, previousPrevious[j - 2] + 1);
        }
        current[j] = next;
      }
      previousPrevious = previous;
      previous = current;
    }
    return previous[right.length] <= maxDistance ? previous[right.length] : null;
  };
  const fuzzy = (value, needle) => {
    if (!value || !needle) return false;
    if (value.includes(needle)) return true;
    const max = needle.length <= 6 ? 1 : needle.length <= 10 ? 2 : 3;
    const shortest = Math.min(value.length, Math.max(1, needle.length - max));
    const longest = Math.min(value.length, Math.max(1, needle.length + max));
    for (let length = shortest; length <= longest; length++) {
      for (let start = 0; start <= value.length - length; start++) {
        if (distance(value.substring(start, start + length), needle, max) !== null) return true;
      }
    }
    return false;
  };
  return variants.some(variant => {
    if (normalizedValues.some(value => value.includes(variant.value))) return true;
    const needle = compact(variant.value);
    if (!needle) return false;
    if ([...parts].some(value => value.includes(needle))) return true;
    if (variant.allowFuzzy && canFuzzy(needle) && [...parts].some(value => fuzzy(value, needle))) return true;
    const words = tokens(variant.value).filter(value => value.length >= 2);
    return words.length >= 2 && words.every(word => [...parts].some(value => value.includes(word) ||
      (variant.allowFuzzy && canFuzzy(word) && fuzzy(value, word))));
  });
}

test('optimized engine agrees with the source-derived legacy matcher over 3500 varied cases', () => {
  let seed = 4721;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const word = length => Array.from({ length }, () => 'abcde'[random(5)]).join('');
  const special = ['кросс', 'кrоss', 'rhjcc', 'лкщыы', 'Q-001', 'Q 0-0 1', 'model kroos', 'iskndar kroos', 'kr oss', '', '   '];
  for (let i = 0; i < 3500; i++) {
    const value = word(1 + random(24));
    const values = [value, word(1 + random(12)), 'Kross model', 'Customer Iskandar', 'Q-001'];
    const query = i < special.length ? special[i] : i % 4 === 0 ? word(3 + random(13)) : i % 4 === 1 ?
      (value.length > 3 ? value.substring(1, value.length - 1) : value) : i % 4 === 2 ?
        (value.length > 3 ? `${value[1]}${value[0]}${value.substring(2)}` : value) : `${word(3)} ${word(4)}`;
    assert.equal(matches(query, values), legacyMatches(query, values), `${query} / ${JSON.stringify(values)}`);
  }
});
