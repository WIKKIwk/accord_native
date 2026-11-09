// Source-derived mocked view tests only. The calendar node below is a test double, never production code.
// These tests do not establish native mounting, animation, picker callbacks, account safety or device parity.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const src = path.resolve(__dirname, '../src');
function load(file, mocks = {}, cache = new Map()) {
  const filename = [file, `${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]
    .find(value => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!filename) throw new Error(`Cannot load ${file}`);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  cache.set(filename, loaded.exports);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name]
    : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name), mocks, cache) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  cache.set(filename, loaded.exports); return loaded.exports;
}
const localization = load(path.join(src, 'shared/localization'));
const model = load(path.join(src, 'werka/werkaSentArchiveModel.ts'));
const gridModel = load(path.join(src, 'werka/werkaArchivePeriodPresentation.ts'));
const element = (type, props, key) => typeof type === 'function' ? type(props) : ({ type, props, key });
const jsx = { Fragment: 'Fragment', jsx: element, jsxs: element };
const colors = { primaryContainer: 'active', onPrimaryContainer: 'activeText', surfaceContainerHighest: 'inactive',
  onSurfaceVariant: 'secondaryText', surfaceContainerLow: 'card', secondaryContainer: 'action', onSecondaryContainer: 'actionText' };
const modifiers = Object.fromEntries(['accessibilityHidden', 'accessibilityIdentifier', 'accessibilityLabel', 'buttonStyle',
  'clipped', 'disabled', 'font', 'frame', 'hidden', 'padding', 'fillMaxWidth', 'semantics', 'testID', 'weight', 'width']
  .map(name => [name, value => ({ [name]: value })]));
const native = Object.fromEntries(['Button', 'Column', 'FlowRow', 'Host', 'HStack', 'IconButton', 'Image', 'ProgressView',
  'RNHostView', 'Row', 'Section', 'Spacer', 'Text', 'VStack'].map(name => [name, name]));
const mocks = { 'react/jsx-runtime': jsx,
  '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => colors }, '@expo/ui/jetpack-compose/modifiers': modifiers,
  'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator' },
  'react-native-reanimated': { useSharedValue: value => ({ value }) },
  '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
  '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
  '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' } };
function setup(platform, patch = {}) {
  const calls = [], props = { state: { ...model.werkaSentArchiveInitial(new Date(2024, 1, 29, 19)), firstYear: 2021 },
    activeDays: new Set([1, 29]), activeMonths: new Set([2, 11]), activeYears: new Set([2021, 2032]),
    loading: false, error: null, locale: 'uz', dailyCalendar: element('VerifiedDailyCalendar', { testOnly: true }),
    onToggle: panel => calls.push(['toggle', panel]), onPageStep: (panel, step) => calls.push(['page', panel, step]),
    onSelect: query => calls.push(['select', query]), onRefresh: async () => { calls.push(['refresh']); }, ...patch };
  const { WerkaSentArchiveContent } = load(path.join(src, `werka/WerkaSentArchiveContent.${platform}.tsx`), mocks);
  return { tree: WerkaSentArchiveContent(props), props, calls };
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(type === undefined || node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const id = node => node.props?.testID ?? node.props?.modifiers?.map(value => value.testID ?? value.accessibilityIdentifier).find(Boolean);
const find = (tree, wanted) => nodes(tree).find(node => id(node) === wanted);
const isCell = node => /^sent_archive_(month|year)_/.test(id(node) ?? '');
const ymd = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

test('shared grids retain sent-hub source widths, spacing, unique IDs and no standalone empty message', () => {
  const props = { kind: 'sent', page: { period: 'monthly', year: 2024 }, active: new Set(), locale: 'uz' };
  const standalone = gridModel.werkaArchivePeriodGridPresentation(props);
  const sent = gridModel.werkaArchivePeriodGridPresentation({ ...props, variant: 'sent' });
  assert.equal(standalone.monthWidth, 100); assert.equal(standalone.monthSpacing, 10);
  assert.equal(standalone.emptyLabel, localization.localizedGetter('archiveCalendarEmptyYear', 'uz'));
  assert.equal(sent.monthWidth, 86); assert.equal(sent.monthSpacing, 8); assert.equal(sent.emptyLabel, null);
  assert.equal(sent.previousId, 'sent_archive_monthly_previous_page'); assert.equal(sent.nextId, 'sent_archive_monthly_next_page');
  assert.deepEqual(sent.rows.flat().map(cell => cell.id), sent.cells.map(cell => cell.id));
  assert.deepEqual(sent.cells.map(cell => cell.query), standalone.cells.map(cell => cell.query));
  const year = gridModel.werkaArchivePeriodGridPresentation({ ...props, page: { period: 'yearly', firstYear: 2021 }, variant: 'sent' });
  assert.equal(year.previousId, 'sent_archive_yearly_previous_page'); assert.equal(year.emptyLabel, null);
});

for (const platform of ['ios', 'android']) {
  const press = node => node.props[platform === 'ios' ? 'onPress' : 'onClick']();
  test(`${platform} first-load progress and retry replace all cards without date formatting or callbacks`, () => {
    const noFormat = () => { throw new Error('hidden cards must not format dates'); };
    const patch = { activeDays: new Set(), activeMonths: new Set(), activeYears: new Set(), error: Error('server'),
      formatMonthYear: noFormat, formatMediumDate: noFormat };
    const loading = setup(platform, { ...patch, loading: true });
    assert.equal(nodes(loading.tree, platform === 'ios' ? 'ProgressView' : 'ActivityIndicator').length, 1);
    assert.equal(nodes(loading.tree, 'VerifiedDailyCalendar').length, 0);
    assert.equal(nodes(loading.tree, 'Button').length, 0); assert.deepEqual(loading.calls, []);
    const failed = setup(platform, patch);
    assert.deepEqual(nodes(failed.tree, platform === 'ios' ? 'Text' : 'PreparationText').map(node => node.props.children),
      [localization.localizedGetter('serverDisconnectedRetry', 'uz')]);
    const retry = nodes(failed.tree, platform === 'ios' ? 'Button' : 'PreparationRow')[0];
    assert.equal(retry.props[platform === 'ios' ? 'label' : 'title'], localization.localizedGetter('retry', 'uz'));
    retry.props.onPress(); assert.deepEqual(failed.calls, [['refresh']]);
  });

  test(`${platform} cards keep daily/monthly/yearly order and only source action buttons request toggles`, async () => {
    const result = setup(platform), cards = nodes(result.tree, platform === 'ios' ? 'Section' : 'WorkerQueueCard');
    const headers = model.werkaSentArchivePresentation(result.props.state, result.props.locale).headers;
    assert.equal(cards.length, 3); assert.equal(nodes(result.tree, 'VerifiedDailyCalendar').length, 1);
    for (const [index, card] of cards.entries()) {
      assert.deepEqual(nodes(card, 'Text').slice(0, 2).map(node => node.props.children), [headers[index].title, headers[index].value]);
      assert.equal(card.props.onPress, undefined); assert.equal(card.props.onClick, undefined);
      const button = find(card, `sent_archive_toggle_${headers[index].id}`);
      assert.equal(nodes(button, 'Text')[0].props.children, headers[index].action); press(button);
    }
    assert.deepEqual(result.calls, [['toggle', 'daily'], ['toggle', 'monthly'], ['toggle', 'yearly']]);
    const list = nodes(result.tree, platform === 'ios' ? 'PreparationList' : 'OrdersList')[0];
    await list.props[platform === 'ios' ? 'refresh' : 'onRefresh'](); assert.deepEqual(result.calls.at(-1), ['refresh']);
  });

  test(`${platform} closing a panel keeps its subtree while hiding it and blocking closed grid actions`, () => {
    for (const open of [null, 'daily', 'monthly', 'yearly']) {
      const state = { ...model.werkaSentArchiveInitial(new Date(2024, 1, 29)), open }, result = setup(platform, { state });
      assert.equal(nodes(result.tree, 'VerifiedDailyCalendar').length, 1);
      assert.equal(nodes(result.tree, 'Button').filter(isCell).length, 24);
      for (const panel of ['daily', 'monthly', 'yearly']) {
        const wrapper = find(result.tree, `sent_archive_panel_${panel}`), shown = panel === open;
        if (platform === 'ios') {
          const modifier = key => wrapper.props.modifiers.find(value => Object.hasOwn(value, key))?.[key];
          assert.equal(modifier('hidden'), !shown); assert.equal(modifier('disabled'), !shown);
          assert.equal(modifier('accessibilityHidden'), !shown); assert.equal(modifier('frame').height, shown ? undefined : 0);
        } else {
          assert.equal(wrapper.props.pointerEvents, shown ? 'auto' : 'none');
          assert.equal(wrapper.props.accessibilityElementsHidden, !shown);
          assert.equal(wrapper.props.importantForAccessibility, shown ? 'auto' : 'no-hide-descendants');
          assert.equal(wrapper.props.style.height, shown ? undefined : 0);
        }
      }
      for (const panel of ['monthly', 'yearly'].filter(panel => panel !== open)) {
        press(find(result.tree, `sent_archive_${panel}_previous_page`));
        press(find(result.tree, panel === 'monthly' ? 'sent_archive_month_1' : `sent_archive_year_${state.firstYear}`));
      }
      assert.deepEqual(result.calls, []);
    }
  });

  for (const panel of ['monthly', 'yearly']) test(`${platform} open ${panel} panel retains every selection, active marker and page step`, () => {
    const state = { ...model.werkaSentArchiveInitial(new Date(2024, 1, 29)), firstYear: 2021, open: panel };
    const result = setup(platform, { state, loading: true, error: Error('retained') });
    const cells = nodes(result.tree, 'Button').filter(node => new RegExp(`^sent_archive_${panel === 'monthly' ? 'month' : 'year'}_`).test(id(node) ?? ''));
    assert.equal(cells.length, 12); assert.deepEqual(result.calls, []);
    press(find(result.tree, `sent_archive_${panel}_next_page`)); press(find(result.tree, `sent_archive_${panel}_next_page`));
    press(find(result.tree, `sent_archive_${panel}_previous_page`));
    assert.deepEqual(result.calls, [['page', panel, 1], ['page', panel, 1], ['page', panel, -1]]);
    for (const cell of cells) { assert.notEqual(cell.props.enabled, false); assert.equal(cell.props.disabled, undefined); press(cell); }
    const queries = result.calls.filter(call => call[0] === 'select').map(call => call[1]);
    for (const [index, query] of queries.entries()) {
      const year = panel === 'monthly' ? state.displayYear : state.firstYear + index;
      assert.equal(query.kind, 'sent'); assert.equal(query.period, panel);
      assert.deepEqual(ymd(query.from), [year, panel === 'monthly' ? index + 1 : 1, 1]);
      if (panel === 'yearly') assert.deepEqual(ymd(query.to), [year, 12, 31]);
    }
    if (panel === 'monthly') assert.deepEqual(ymd(queries[1].to), [2024, 2, 29]);
    const active = cells.filter(cell => platform === 'ios' ? cell.props.modifiers.some(value => value.buttonStyle === 'borderedProminent')
      : cell.props.colors.containerColor === colors.primaryContainer);
    assert.equal(active.length, 2);
    if (platform === 'android' && panel === 'monthly') {
      assert.equal(nodes(result.tree, 'FlowRow')[0].props.horizontalArrangement.spacedBy, 8);
      assert.equal(cells[0].props.modifiers.find(value => value.width).width, 86);
    }
  });

  test(`${platform} completed-empty hub has all grids, no invented empty-year text and no automatic action`, () => {
    const result = setup(platform, { activeDays: new Set(), activeMonths: new Set(), activeYears: new Set() });
    assert.equal(nodes(result.tree, 'Button').filter(isCell).length, 24);
    const texts = nodes(result.tree, 'Text').map(node => node.props.children);
    assert.equal(texts.includes(localization.localizedGetter('archiveCalendarEmptyYear', 'uz')), false);
    assert.equal(texts.includes(localization.localizedGetter('archiveCalendarEmptyMonth', 'uz')), false);
    assert.deepEqual(result.calls, []);
  });

  test(`${platform} each retained active set keeps content available through loading or error`, () => {
    const none = new Set(), some = new Set([2]);
    for (const [activeDays, activeMonths, activeYears] of [[some, none, none], [none, some, none], [none, none, some]]) {
      const result = setup(platform, { activeDays, activeMonths, activeYears, loading: true, error: Error('retained') });
      assert.equal(nodes(result.tree, platform === 'ios' ? 'Section' : 'WorkerQueueCard').length, 3);
      assert.equal(nodes(result.tree, 'Button').filter(isCell).length, 24); assert.deepEqual(result.calls, []);
    }
  });

  test(`${platform} default labels match declared source date data in all four app locales`, () => {
    const expected = { uz: ['Pay, 29-fev', 'yanvar, 2024', 'yanvar,'], en: ['Thu, Feb 29', 'January 2024', 'January'],
      ru: ['чт, 29 февр.', 'январь 2024\u202fг.', 'январь'], 'ur-PK': ['جمعرات، 29 فروری', 'جنوری 2024', 'جنوری'] };
    for (const [locale, [daily, monthHeader, firstMonth]] of Object.entries(expected)) {
      const result = setup(platform, { locale }), cards = nodes(result.tree, platform === 'ios' ? 'Section' : 'WorkerQueueCard');
      assert.equal(nodes(cards[0], 'Text')[1].props.children, daily);
      assert.equal(nodes(cards[1], 'Text')[1].props.children, monthHeader);
      assert.equal(nodes(find(result.tree, 'sent_archive_month_1'), 'Text')[0].props.children, firstMonth);
      assert.deepEqual(result.calls, []);
    }
  });
}
