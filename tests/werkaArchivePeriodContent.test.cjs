// Source-derived pure/model and mocked content tests, not Flutter or native-device evidence.
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
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  return loaded.exports;
}
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const dates = compile('werka/werkaArchiveCalendar.ts', {
  '../shared/dispatchRuntimeStores': compile('shared/dispatchRuntimeStores.ts'),
  './werkaBatchTrim': compile('werka/werkaBatchTrim.ts'),
});
const model = compile('werka/werkaArchivePeriodPresentation.ts', {
  '../shared/localization': localization, './werkaArchiveCalendar': dates,
  './werkaArchiveDateLabels': compile('werka/werkaArchiveDateLabels.ts'),
});
const ymd = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()];
const formatMonthYear = date => `Month${date.getMonth() + 1} ${date.getFullYear()}`;
const present = (page, active = new Set(), kind = 'received', locale = 'uz', formatter = formatMonthYear) =>
  model.werkaArchivePeriodPresentation(kind, page, active, locale, formatter);

test('standalone calendars start in the current year or five years before it', () => {
  const now = new Date(2026, 10, 8, 20, 45);
  assert.deepEqual(model.werkaArchivePeriodInitial('monthly', now), { period: 'monthly', year: 2026 });
  assert.deepEqual(model.werkaArchivePeriodInitial('yearly', now), { period: 'yearly', firstYear: 2021 });
  assert.equal(now.getHours(), 20);
});

test('request descriptions load the whole year or twelve-year page for every kind', () => {
  for (const kind of ['received', 'sent', 'returned']) {
    const month = model.werkaArchivePeriodQuery(kind, { period: 'monthly', year: 2024 });
    assert.deepEqual([month.kind, month.period, ymd(month.from), ymd(month.to)],
      [kind, 'yearly', [2024, 1, 1], [2024, 12, 31]]);
    const year = model.werkaArchivePeriodQuery(kind, { period: 'yearly', firstYear: 2021 });
    assert.deepEqual([year.kind, year.period, ymd(year.from), ymd(year.to)],
      [kind, 'yearly', [2021, 1, 1], [2032, 12, 31]]);
  }
});

test('page reducer steps by one or twelve, preserves input and supports repeated and reverse steps', () => {
  for (const page of [{ period: 'monthly', year: 2026 }, { period: 'yearly', firstYear: 2021 }]) {
    const original = { ...page }, next = model.werkaArchivePeriodStep(page, 1);
    assert.deepEqual(page, original);
    assert.deepEqual(model.werkaArchivePeriodStep(next, -1), page);
    let current = page;
    for (let i = 0; i < 3; i++) current = model.werkaArchivePeriodStep(current, 1);
    assert.deepEqual(current, page.period === 'monthly' ? { period: 'monthly', year: 2029 }
      : { period: 'yearly', firstYear: 2057 });
  }
});

test('source blank/loading and retry branches apply only without retained active data', () => {
  for (const error of [null, Error('server')]) {
    assert.equal(model.werkaArchivePeriodBody(true, error, new Set()), 'loading');
    for (const loading of [false, true]) assert.equal(model.werkaArchivePeriodBody(loading, error, new Set([2])), 'content');
  }
  assert.equal(model.werkaArchivePeriodBody(false, Error('server'), new Set()), 'error');
  assert.equal(model.werkaArchivePeriodBody(false, null, new Set()), 'content');
});

test('month cells keep source order, keys, active flags and first-space label splitting', () => {
  const calls = [], active = new Set([2, 12]), page = { period: 'monthly', year: 2024 };
  const result = present(page, active, 'returned', 'en', date => {
    calls.push(ymd(date)); return date.getMonth() === 0 ? ' 2024 January' : `Label${date.getMonth() + 1} more words`;
  });
  assert.deepEqual(calls, Array.from({ length: 12 }, (_, i) => [2024, i + 1, 1]));
  assert.deepEqual(result.cells.map(cell => cell.id), Array.from({ length: 12 }, (_, i) => `archive_month_${i + 1}`));
  assert.equal(result.cells[0].label, '');
  assert.equal(result.cells[1].label, 'Label2');
  assert.deepEqual(result.cells.filter(cell => cell.active).map(cell => cell.id), ['archive_month_2', 'archive_month_12']);
  assert.deepEqual(result.rows.map(row => row.length), [3, 3, 3, 3]);
  assert.equal(result.emptyLabel, null);
  assert.deepEqual([...active], [2, 12]); assert.deepEqual(page, { period: 'monthly', year: 2024 });
  for (const [i, cell] of result.cells.entries()) {
    assert.equal(cell.query.kind, 'returned'); assert.equal(cell.query.period, 'monthly');
    assert.deepEqual(ymd(cell.query.from), [2024, i + 1, 1]);
    assert.equal(cell.query.from.getHours(), 0); assert.equal(cell.query.to.getHours(), 0);
  }
  assert.deepEqual(ymd(result.cells[1].query.to), [2024, 2, 29]);
  assert.deepEqual(ymd(result.cells[11].query.to), [2024, 12, 31]);
});

test('year cells span exactly twelve inclusive years and do not invoke a month formatter', () => {
  const result = present({ period: 'yearly', firstYear: 2021 }, new Set([2021, 2032]), 'sent', 'uz',
    () => { throw new Error('year view must not format months'); });
  assert.equal(result.pageLabel, '2021 - 2032');
  assert.equal(result.previousLabel, '2009 - 2020'); assert.equal(result.nextLabel, '2033 - 2044');
  assert.deepEqual(result.cells.map(cell => cell.label), Array.from({ length: 12 }, (_, i) => `${2021 + i}`));
  assert.deepEqual(result.cells.filter(cell => cell.active).map(cell => cell.id), ['archive_year_2021', 'archive_year_2032']);
  for (const [i, cell] of result.cells.entries()) {
    assert.equal(cell.query.kind, 'sent'); assert.equal(cell.query.period, 'yearly');
    assert.deepEqual(ymd(cell.query.from), [2021 + i, 1, 1]);
    assert.deepEqual(ymd(cell.query.to), [2021 + i, 12, 31]);
  }
});

test('titles and empty year text use existing source keys in each supported locale', () => {
  for (const locale of ['uz', 'en', 'ru', 'ur-PK']) for (const kind of ['received', 'sent', 'returned']) {
    for (const period of ['monthly', 'yearly']) {
      const page = period === 'monthly' ? { period, year: 2026 } : { period, firstYear: 2021 };
      const result = present(page, new Set(), kind, locale);
      const kindKey = { received: 'archiveReceivedTitle', sent: 'archiveSentTitle', returned: 'archiveReturnedTitle' }[kind];
      const periodKey = period === 'monthly' ? 'archiveMonthlyTitle' : 'archiveYearlyTitle';
      assert.equal(result.title, `${localization.localizedGetter(kindKey, locale)} • ${localization.localizedGetter(periodKey, locale)}`);
      assert.equal(result.emptyLabel, localization.localizedGetter('archiveCalendarEmptyYear', locale));
    }
  }
});

test('ranges preserve years below 100 and a formatter cannot mutate the selection date', () => {
  const result = present({ period: 'monthly', year: 50 }, new Set(), 'received', 'uz', date => {
    const label = String(date.getMonth() + 1); date.setFullYear(1999); return label;
  });
  assert.deepEqual(ymd(result.cells[0].query.from), [50, 1, 1]);
  assert.deepEqual(ymd(result.cells[1].query.to), [50, 2, 28]);
  const years = present({ period: 'yearly', firstYear: -5 });
  assert.deepEqual(ymd(years.cells[5].query.from), [0, 1, 1]);
});

const element = (type, props, key) => typeof type === 'function' ? type(props) : ({ type, props, key });
const jsx = { Fragment: 'Fragment', jsx: element, jsxs: element };
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const modifiers = Object.fromEntries(['accessibilityIdentifier', 'accessibilityLabel', 'buttonStyle', 'font', 'frame',
  'fillMaxWidth', 'semantics', 'testID', 'weight', 'width'].map(name => [name, value => ({ [name]: value })]));
const colors = { primaryContainer: 'active', onPrimaryContainer: 'activeText', surfaceContainerHighest: 'inactive', onSurfaceVariant: 'secondary' };
function setup(platform, patch = {}) {
  const calls = [], props = { kind: 'received', page: { period: 'monthly', year: 2024 }, active: new Set([2, 11]),
    loading: false, error: null, locale: 'uz', formatMonthYear,
    onPageStep: step => calls.push(['page', step]), onSelect: query => calls.push(['select', query]),
    onRefresh: async () => { calls.push(['refresh']); }, ...patch };
  const native = Object.fromEntries(['Button', 'Column', 'FlowRow', 'Host', 'HStack', 'IconButton', 'Image', 'RNHostView',
    'Row', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name]));
  const mocks = { 'react/jsx-runtime': jsx, './werkaArchivePeriodPresentation': model, '../shared/localization': localization,
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => colors },
    '@expo/ui/jetpack-compose/modifiers': modifiers, 'expo-symbols': { SymbolView: 'SymbolView' },
    'react-native': { View: 'View' }, 'react-native-reanimated': { useSharedValue: value => ({ value }) },
    '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
    '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
    '../shared/orders/OrdersList': { OrdersList: 'OrdersList' } };
  mocks[`./WerkaArchivePeriodGrid.${platform}`] = compile(`werka/WerkaArchivePeriodGrid.${platform}.tsx`, mocks);
  const { WerkaArchivePeriodContent } = compile(`werka/WerkaArchivePeriodContent.${platform}.tsx`, mocks);
  return { tree: WerkaArchivePeriodContent(props), calls };
}
const id = node => node.props.modifiers?.find(value => value.testID || value.accessibilityIdentifier);

for (const platform of ['ios', 'android']) {
  const press = button => button.props[platform === 'ios' ? 'onPress' : 'onClick']();
  const isCell = node => /archive_(month|year)_/.test(JSON.stringify(id(node)));
  test(`${platform} blank loading and retry branches contain no grid and do not format dates`, async () => {
    const formatter = () => { throw new Error('hidden content must not format months'); };
    const loading = setup(platform, { loading: true, active: new Set(), error: Error('x'), formatMonthYear: formatter });
    assert.equal(loading.tree.type, 'View'); assert.equal(nodes(loading.tree, 'Button').length, 0);
    assert.deepEqual(loading.calls, []);
    const failed = setup(platform, { active: new Set(), error: Error('x'), formatMonthYear: formatter });
    assert.deepEqual(nodes(failed.tree, platform === 'ios' ? 'Text' : 'PreparationText').map(node => node.props.children),
      [localization.localizedGetter('serverDisconnectedRetry', 'uz')]);
    const retry = nodes(failed.tree, platform === 'ios' ? 'Button' : 'PreparationRow')[0];
    assert.equal(retry.props[platform === 'ios' ? 'label' : 'title'], localization.localizedGetter('retry', 'uz'));
    retry.props.onPress(); assert.deepEqual(failed.calls, [['refresh']]);
  });

  for (const period of ['monthly', 'yearly']) test(`${platform} ${period} retains all selectable cells, markers, paging and refresh callbacks`, async () => {
    const page = period === 'monthly' ? { period, year: 2024 } : { period, firstYear: 2021 };
    const active = period === 'monthly' ? new Set([2, 11]) : new Set([2021, 2032]);
    const result = setup(platform, { page, active, loading: true, error: Error('retained') });
    const buttons = nodes(result.tree, 'Button'), cells = buttons.filter(isCell);
    assert.equal(cells.length, 12); assert.deepEqual(result.calls, []);
    const controls = platform === 'ios' ? buttons.filter(node => !isCell(node)) : nodes(result.tree, 'IconButton');
    assert.equal(controls.length, 2);
    press(controls[1]); press(controls[1]); press(controls[0]);
    assert.deepEqual(result.calls, [['page', 1], ['page', 1], ['page', -1]]);
    for (const cell of cells) {
      assert.notEqual(cell.props.enabled, false); assert.equal(cell.props.disabled, undefined); press(cell);
    }
    const selections = result.calls.filter(call => call[0] === 'select').map(call => call[1]);
    const expected = present(page, active).cells.map(cell => cell.query);
    assert.deepEqual(selections, expected);
    const markers = cells.filter(cell => platform === 'ios'
      ? cell.props.modifiers.some(modifier => modifier.buttonStyle === 'borderedProminent')
      : cell.props.colors.containerColor === colors.primaryContainer);
    assert.equal(markers.length, 2);
    assert.equal(nodes(result.tree, 'Text').some(node => node.props.children === localization.localizedGetter('archiveCalendarEmptyYear', 'uz')), false);
    const list = nodes(result.tree, platform === 'ios' ? 'PreparationList' : 'OrdersList')[0];
    await list.props[platform === 'ios' ? 'refresh' : 'onRefresh']();
    assert.deepEqual(result.calls.at(-1), ['refresh']);
  });

  test(`${platform} empty completed data still permits all twelve selections and shows the source empty text last`, () => {
    const result = setup(platform, { active: new Set() }), cells = nodes(result.tree, 'Button').filter(isCell);
    assert.equal(cells.length, 12);
    assert.equal(nodes(result.tree, 'Text').at(-1).props.children, localization.localizedGetter('archiveCalendarEmptyYear', 'uz'));
    press(cells[0]); assert.equal(result.calls[0][0], 'select');
    assert.deepEqual(ymd(result.calls[0][1].from), [2024, 1, 1]);
  });

  test(`${platform} default month labels use the recorded Material format rather than a caller stub`, () => {
    const expected = {
      uz: ['yanvar,', 'fevral,', 'mart,', 'aprel,', 'may,', 'iyun,', 'iyul,', 'avgust,', 'sentabr,', 'oktabr,', 'noyabr,', 'dekabr,'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
      'ur-PK': ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    };
    for (const [locale, labels] of Object.entries(expected)) {
      const result = setup(platform, { locale, formatMonthYear: undefined });
      const cells = nodes(result.tree, 'Button').filter(isCell);
      assert.deepEqual(cells.map(cell => nodes(cell, 'Text')[0].props.children), labels);
      assert.deepEqual(result.calls, []);
    }
  });
}
