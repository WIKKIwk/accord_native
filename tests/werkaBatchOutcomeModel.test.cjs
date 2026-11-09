// Pure result projection and mocked dialog only. No write, activity update, refresh or route is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
function compile(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename); return loaded.exports;
}
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const trim = compile('werka/werkaBatchTrim.ts'), stock = compile('werka/werkaStockIssueLogic.ts');
const model = compile('werka/werkaBatchOutcomeModel.ts', { '../shared/localization': localization,
  './werkaBatchTrim': trim, './werkaStockIssueLogic': stock });

test('batch result projection replays source-equivalent Dart responses without applying side effects', () => {
  const fixture = require('./contracts/f11910bb/werka_batch_outcome_oracle.json');
  for (const sample of fixture.cases) {
    const lines = Array.from({ length: sample.lineCount }, (_, index) => ({ localID: `line-${index}` }));
    const result = { created: sample.created.map(record => ({ record })), failed: sample.failed.map(lineIndex => ({ lineIndex })) };
    const original = structuredClone({ lines, result });
    assert.deepEqual(model.werkaBatchOutcome(lines, result), sample.expected, sample.name);
    assert.deepEqual({ lines, result }, original, `${sample.name} inputs`);
  }
});

test('source counts null created records and ignores duplicate, negative and out-of-range failure indices', () => {
  const outcome = model.werkaBatchOutcome([{}, {}, {}], { created: [{ record: null }, { record: null }],
    failed: [{ lineIndex: 2 }, { lineIndex: 0 }, { lineIndex: 2 }, { lineIndex: -1 }, { lineIndex: 9 }] });
  assert.equal(outcome.sourceCreatedCount, 2); assert.deepEqual(outcome.sourceFailedIndices, [0, 2]); assert.equal(outcome.sourceBranch, 'partial');
  assert.deepEqual(outcome.sourcePendingRecords, []); assert.deepEqual(outcome.sourceActivityCodes, []);
  assert.equal(model.werkaBatchOutcome([{}], { created: [], failed: [{ lineIndex: 99 }] }).sourceBranch, 'success');
});

test('partial result labels match f119 text and require actual failed-line count', () => {
  const expected = {
    uz: ['Natija', '2 ta jo‘natma yaratildi', '1 ta jo‘natma xato bo‘ldi', 'Yopish'],
    en: ['Result', '2 shipments created', '1 shipments failed', 'Close'],
    ru: ['Результат', 'Создано 2 отправок', '1 отправок завершились ошибкой', 'Закрыть'],
    ur: ['نتیجہ', '2 کھیپیں بنائی گئیں', '1 کھیپیں ناکام ہوئیں', 'بند کریں'],
  };
  for (const [locale, values] of Object.entries(expected)) {
    const labels = model.werkaBatchPartialResultLabels(2, 1, locale);
    assert.deepEqual([labels.title, labels.created, labels.failed, labels.close], values);
  }
  for (const [created, failed] of [[-1, 1], [0, 0], [0, -1], [1.5, 1], [0, NaN]]) {
    assert.throws(() => model.werkaBatchPartialResultLabels(created, failed, 'en'), RangeError);
  }
});

test('partial result dialog presents real counts and reports only one dismissal', () => {
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const dialog = compile('werka/WerkaBatchPartialResultDialog.tsx', { 'react/jsx-runtime': jsx,
    react: { useRef: value => ({ current: value }) }, '../components/WorkerAlert': { WorkerAlert: 'WorkerAlert' },
    './werkaBatchOutcomeModel': model }).WerkaBatchPartialResultDialog;
  let dismissals = 0; const tree = dialog({ createdCount: 2, failedCount: 1, locale: 'en', onDismiss: () => { dismissals++; } });
  assert.equal(tree.type, 'WorkerAlert'); assert.deepEqual(tree.props.alert, { title: 'Result',
    message: '2 shipments created\n1 shipments failed', confirmLabel: 'Close' });
  assert.equal(dismissals, 0); tree.props.onDismiss(); tree.props.onDismiss(); assert.equal(dismissals, 1);
});
