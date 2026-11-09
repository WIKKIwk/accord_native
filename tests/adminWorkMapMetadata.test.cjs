const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const dart = load('admin/dartJsonString.ts'), closed = load('admin/adminWorkMapClosedModel.ts', { './dartJsonString': dart });
const metadata = load('admin/adminWorkMapMetadataModel.ts', { './dartJsonString': dart, './adminWorkMapClosedModel': closed });
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
const text = locale => ({ admin: key => l10n.adminText(key, locale), loading: l10n.localizedGetter('loading', locale) });
const rows = (value, locale = 'uz') => metadata.adminWorkMapMetadataRows(value, 'admin', 'order', text(locale));
test('creation rows are limited to Admin/Brigader opened details and preserve pending versus missing states', () => {
  for (const role of ['admin', 'brigader']) assert.deepEqual(metadata.adminWorkMapMetadataRows(null, role, 'order', text('en')).map(row => row.value), ['Loading...', 'Loading...']);
  for (const role of ['sales_manager', 'werka', 'tayyorlov_masteri', undefined]) assert.deepEqual(metadata.adminWorkMapMetadataRows(null, role, 'order', text('uz')), []);
  assert.deepEqual(metadata.adminWorkMapMetadataRows(null, 'admin', 'pending', text('uz')), []);
  assert.deepEqual(rows(metadata.adminWorkMapMetadataFromSaved({})).map(row => row.value), ['Sana mavjud emas', 'Ma’lumot saqlanmagan']);
  for (const created_at_unix of [0, -1, null]) assert.equal(rows(metadata.adminWorkMapMetadataFromSaved({ created_at_unix }))[0].value, 'Sana mavjud emas');
});
test('creator needs both role and display name, localizes only the four source roles and never substitutes ref', () => {
  for (const creator of [null, { role: '', display_name: 'Ana', ref: 'ignored' }, { role: 'admin', display_name: '', ref: 'ignored' }]) {
    assert.equal(rows(metadata.adminWorkMapMetadataFromSaved({ created_by: creator }))[1].value, 'Ma’lumot saqlanmagan');
  }
  for (const [role, expected] of [['admin', 'Admin'], ['brigader', 'Brigader'], ['sales_manager', 'Sotuv manageri'], ['telegram', 'Telegram'], ['custom', 'custom']]) {
    const value = metadata.adminWorkMapMetadataFromSaved({ created_by: { role: `\u0085${role} `, display_name: ' Ana\u0085' } });
    assert.equal(rows(value)[1].value, `${expected} · Ana`);
  }
});
test('creation labels/missing values match inspected f119 localization including its Urdu translation fallback', () => {
  const expected = {
    uz: ['Tizimga kiritilgan', 'Buyurtmani ochgan', 'Sana mavjud emas', 'Ma’lumot saqlanmagan'],
    en: ['Created in the system', 'Created by', 'Date unavailable', 'Not recorded'],
    ru: ['Создано в системе', 'Заказ создал', 'Дата недоступна', 'Не сохранено'],
    ur: ['سسٹم میں بنایا گیا', 'بنانے والا', 'تاریخ دستیاب نہیں', 'Not recorded'],
  };
  for (const [locale, values] of Object.entries(expected)) {
    const result = rows(metadata.adminWorkMapMetadataFromSaved({}), locale);
    assert.deepEqual([result[0].label, result[1].label, result[0].value, result[1].value], values);
  }
});
test('creation date reuses source local formatter and rejects out-of-domain dates before display', () => {
  const prior = process.env.TZ;
  try {
    for (const [zone, expected] of [['Etc/UTC', '14.11.2023 22:13'], ['Asia/Tashkent', '15.11.2023 03:13'], ['America/New_York', '14.11.2023 17:13']]) {
      process.env.TZ = zone;
      assert.equal(rows(metadata.adminWorkMapMetadataFromSaved({ created_at_unix: 1700000000 }))[0].value, expected);
    }
    assert.throws(() => metadata.adminWorkMapMetadataFromSaved({ created_at_unix: 8640000000001 }), RangeError);
  } finally { if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior; }
});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)] : [];
for (const platform of ['ios', 'android']) test(`${platform} creation rows use native controls in source order without action callbacks`, () => {
  const View = load(`admin/AdminWorkMapMetadata.${platform}.tsx`, { '@expo/ui': { ListItem: 'ListItem' },
    [`@expo/ui/${platform === 'ios' ? 'swift-ui' : 'jetpack-compose'}`]: { Text: 'NativeText', Column: 'Column', VStack: 'VStack' },
    '@expo/ui/swift-ui/modifiers': { font: value => value } }).AdminWorkMapMetadata;
  const source = rows(metadata.adminWorkMapMetadataFromSaved({})), tree = nodes(View({ rows: source }));
  assert.deepEqual(tree.filter(node => node.type === 'ListItem').map(node => [node.props.testID, node.props.supportingText]),
    source.map(row => [`admin-work-map-${row.id}`, row.value]));
  assert.deepEqual(tree.filter(node => node.type === 'NativeText').map(node => node.props.children), source.map(row => row.label));
  assert.equal(tree.some(node => node.props.onPress || node.props.onLongPress || node.props.onClick), false);
});
