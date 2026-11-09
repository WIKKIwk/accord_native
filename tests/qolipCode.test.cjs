const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/qolip/qolipCode.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
}).outputText, filename);
const { parseQolipBatchCode, qolipBatchMaxCount, qolipCodePrefixSuggestion } = loaded.exports;

test('V2 batch code uses the final number as the count', () => {
  const draft = parseQolipBatchCode('58907-543-453-8');
  assert.equal(draft.count, 8);
  assert.deepEqual(draft.codes, [
    '58907-543-453-1', '58907-543-453-2', '58907-543-453-3', '58907-543-453-4',
    '58907-543-453-5', '58907-543-453-6', '58907-543-453-7', '58907-543-453-8',
  ]);
  assert.deepEqual(parseQolipBatchCode('ABC-X').codes, ['ABC-X']);
  assert.equal(parseQolipBatchCode('ABC-0'), null);
});

test('batch code retains all but the last suffix digit and the trimmed original input', () => {
  assert.deepEqual(parseQolipBatchCode('  ABC -012  '), {
    input: 'ABC -012', prefix: 'ABC-01', count: 2, codes: ['ABC-011', 'ABC-012'],
  });
  assert.deepEqual(parseQolipBatchCode('ABC-001'), {
    input: 'ABC-001', prefix: 'ABC-00', count: 1, codes: ['ABC-001'],
  });
});

test('all nonzero final digits expand from one up to that count', () => {
  assert.equal(qolipBatchMaxCount, 9);
  for (let count = 1; count <= qolipBatchMaxCount; count++) {
    assert.deepEqual(parseQolipBatchCode(`Q-53${count}`), {
      input: `Q-53${count}`,
      prefix: 'Q-53',
      count,
      codes: Array.from({ length: count }, (_, index) => `Q-53${index + 1}`),
    });
  }
});

test('empty codes, any code ending in zero, and empty batch prefixes are rejected', () => {
  for (const input of ['', '  ', 'ABC0', 'ABC-10', '-1', ' -9 ', '\u0085-2']) {
    assert.equal(parseQolipBatchCode(input), null, JSON.stringify(input));
  }
});

test('non-batch input remains a single code even when it contains a non-ASCII digit or a newline', () => {
  for (const input of ['ABC-X', 'ABC-٣', 'ABC-2X', 'AB\nC-2']) {
    assert.deepEqual(parseQolipBatchCode(input), { input, prefix: '', count: 1, codes: [input] });
  }
});

test('Dart native whitespace, including U+0085, is trimmed from input and prefix', () => {
  assert.deepEqual(parseQolipBatchCode('\u0085ABC\u0085-2\u0085'), {
    input: 'ABC\u0085-2', prefix: 'ABC-', count: 2, codes: ['ABC-1', 'ABC-2'],
  });
  assert.equal(parseQolipBatchCode('\u0085\ufeff \u0085'), null);
  assert.equal(qolipCodePrefixSuggestion('\u0085ABC-12\u0085'), 'ABC-1');
});

test('prefix suggestion removes exactly one final ASCII digit after trimming', () => {
  const cases = [
    ['', ''], ['  ', ''], ['ABC', ''], ['  ABC-12  ', 'ABC-1'],
    ['ABC0', 'ABC'], ['5', ''], ['ABC-٣', ''], ['Q-2X', ''],
  ];
  for (const [input, expected] of cases) assert.equal(qolipCodePrefixSuggestion(input), expected);
});
