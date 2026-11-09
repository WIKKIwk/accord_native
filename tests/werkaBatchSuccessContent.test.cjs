// Supplied-count content only. No backend success, return route or mutation is asserted.
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
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const model = compile('werka/werkaBatchOutcomeModel.ts', { '../shared/localization': localization,
  './werkaBatchTrim': compile('werka/werkaBatchTrim.ts'), './werkaStockIssueLogic': compile('werka/werkaStockIssueLogic.ts') });
const node = (tree, type) => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => node(child, type));
  return [...(tree.type === type ? [tree] : []), ...node(tree.props?.children, type)];
};
const modifier = name => (...args) => ({ name, args });

test('batch success labels follow the source supplied-count branches in all app locales', () => {
  const expected = {
    uz: ['Jo‘natildi', '2 ta jo‘natma yaratildi', '2 ta jo‘natma yuborildi', '1 ta jo‘natma xato bo‘ldi'],
    en: ['Sent', '2 shipments created', '2 shipments sent', '1 shipments failed'],
    ru: ['Отправлено', 'Создано 2 отправок', 'Отправлено 2 отправок', '1 отправок завершились ошибкой'],
    ur: ['بھیج دیا گیا', '2 کھیپیں بنائی گئیں', '2 کھیپیں بھیجی گئیں', '1 کھیپیں ناکام ہوئیں'],
  };
  for (const [locale, labels] of Object.entries(expected)) {
    const full = model.werkaBatchSuccessPresentation({ createdCount: 2, failedCount: 0, returnLabel: 'return', locale });
    const partial = model.werkaBatchSuccessPresentation({ createdCount: 2, failedCount: 1, returnLabel: '', locale });
    assert.deepEqual([full.title, full.created, full.detail, partial.detail], labels); assert.equal(partial.returnLabel, '');
  }
  assert.throws(() => model.werkaBatchSuccessPresentation({ createdCount: -1, failedCount: 0, returnLabel: '', locale: 'en' }), RangeError);
  assert.throws(() => model.werkaBatchSuccessPresentation({ createdCount: 1, failedCount: 1.5, returnLabel: '', locale: 'en' }), RangeError);
  assert.throws(() => model.werkaBatchSuccessPresentation({ createdCount: 1, failedCount: 0, returnLabel: null, locale: 'en' }), TypeError);
});

for (const platform of ['ios', 'android']) test(`${platform} batch success displays supplied counts with return navigation held`, () => {
  const ios = Object.fromEntries(['Button', 'Image', 'Section', 'Text', 'VStack'].map(name => [name, name]));
  const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': ios,
    '@expo/ui/swift-ui/modifiers': { disabled: modifier('disabled') }, '@expo/ui': { Button: 'Button', Host: 'Host' },
    '@expo/ui/jetpack-compose': { useMaterialColors: () => ({ surfaceContainerLow: 'surface', onSecondaryContainer: 'accent', onSurface: 'text', onSurfaceVariant: 'muted' }) },
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { Text: 'Text', View: 'View' },
    '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' }, './werkaBatchOutcomeModel': model };
  const component = compile(`werka/WerkaBatchSuccessContent.${platform}.tsx`, mocks).WerkaBatchSuccessContent;
  const tree = component({ createdCount: 2, failedCount: 0, returnLabel: 'Back to flow', locale: 'en' });
  const text = node(tree, 'Text').map(value => value.props.children), button = node(tree, 'Button')[0];
  assert.ok(text.includes('2 shipments created')); assert.ok(text.includes('2 shipments sent')); assert.equal(button.props.label, 'Back to flow');
  assert.equal(button.props.onPress, undefined);
  if (platform === 'ios') assert.ok(button.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true));
  else assert.equal(button.props.disabled, true);
});
