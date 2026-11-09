// Native menu content is isolated from routes; this tests copy, order and callbacks, not device rendering.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const catalog = require('../src/shared/localization/catalog.json');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function compile(file, mocks) {
  const filename = path.resolve(__dirname, '../src/werka', file), loaded = new Module(filename);
  loaded.filename = filename; loaded.paths = require.main.paths;
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return loaded.exports;
}
const model = compile('werkaMenuModel.ts', { '../shared/localization': { localizedGetter: (key, locale) => catalog.getters[key][locale] } });
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
test('create and archive rows retain V2 order, exact Uzbek copy and localized entries', () => {
  const rows = model.werkaMenuItems('create', 'uz');
  assert.deepEqual(rows.map(row => row.id), ['scan', 'unannounced', 'customerIssue', 'batchDispatch']);
  assert.deepEqual(rows.map(row => row.title), ['QR skaner', 'Aytilmagan mahsulot', 'Mahsulot jo‘natish', 'Ko‘p mahsulot chiqarish']);
  assert.equal(rows[0].subtitle, 'Paddon yoki WIP ma’lumotini ko‘rish va ixtiyoriy kirim');
  assert.deepEqual(model.werkaMenuItems('archive', 'uz').map(row => row.title), ['Qabul qilingan', "Jo'natilgan", 'Qaytarilgan']);
  assert.deepEqual(model.werkaMenuItems('period', 'en').map(row => row.title), ['Daily', 'Monthly', 'Yearly']);
});
for (const platform of ['ios', 'android']) test(`${platform} content reuses existing list or rows and forwards each action`, () => {
  const calls = [], mocks = { 'react/jsx-runtime': jsx, './werkaMenuModel': model,
    '@expo/ui/swift-ui': { Button: 'Button', Section: 'Section', Text: 'Text', VStack: 'VStack' },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow' },
    'react-native': { ScrollView: 'ScrollView' } };
  const { WerkaMenuContent } = compile(`WerkaMenuContent.${platform}.tsx`, mocks);
  const tree = WerkaMenuContent({ kind: 'create', locale: 'uz', onSelect: action => calls.push(action) });
  const rows = nodes(tree, platform === 'ios' ? 'Button' : 'PreparationRow');
  assert.equal(rows.length, 4);
  for (const row of rows) row.props.onPress();
  assert.deepEqual(calls, ['scan', 'unannounced', 'customerIssue', 'batchDispatch']);
  assert.equal(nodes(tree, platform === 'ios' ? 'PreparationList' : 'ScrollView').length, 1);
});
