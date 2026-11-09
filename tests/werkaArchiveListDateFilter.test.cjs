// Mocked controlled views only. No native calendar, account owner, PDF or route is exercised.
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
  if (!filename) throw Error(file);
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
const element = (type, props, key) => typeof type === 'function' ? type(props) : ({ type, props, key });
const jsx = { Fragment: 'Fragment', jsx: element, jsxs: element };
const colors = { surfaceContainerLow: 'card', onSurfaceVariant: 'secondary', secondaryContainer: 'action', onSecondaryContainer: 'actionText' };
const native = Object.fromEntries(['Button', 'Column', 'Host', 'HStack', 'Image', 'ProgressView', 'RNHostView', 'Row', 'Section', 'Spacer', 'Text', 'VStack']
  .map(name => [name, name]));
const modifiers = Object.fromEntries(['accessibilityHidden', 'accessibilityIdentifier', 'buttonStyle', 'clipped', 'disabled', 'font',
  'frame', 'hidden', 'padding', 'fillMaxWidth', 'testID', 'weight'].map(name => [name, value => ({ [name]: value })]));
const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => colors }, '@expo/ui/jetpack-compose/modifiers': modifiers,
  'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View', Text: 'RNText', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator' },
  'react-native-reanimated': { useSharedValue: value => ({ value }) },
  '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
  '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
  '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' } };
const localization = load(path.join(src, 'shared/localization'));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(type === undefined || node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const id = node => node.props?.testID ?? node.props?.modifiers?.map(value => value.testID ?? value.accessibilityIdentifier).find(Boolean);
const find = (tree, wanted) => nodes(tree).find(node => id(node) === wanted);
const record = { id: 'one', supplier_ref: '', supplier_name: 'Supplier', item_code: 'SKU', item_name: 'Item', highlight: '',
  sent_qty: 5, accepted_qty: 2, uom: 'kg' };
function setup(platform, patch = {}) {
  const calls = [], renders = [];
  const dailyFilter = { selectedDateLabel: 'selected date', calendarOpen: true,
    onToggle: () => calls.push('toggle'), renderCalendar: enabled => { renders.push(enabled); return element('CalendarSlot', { enabled }); } };
  const props = { kind: 'received', data: { summary: { recordCount: 1, totalsByUOM: [] }, items: [record] },
    loading: false, error: null, locale: 'uz', dailyFilter, onRefresh: async () => { calls.push('refresh'); }, ...patch };
  const { WerkaArchiveListContent } = load(path.join(src, `werka/WerkaArchiveListContent.${platform}.tsx`), mocks);
  return { tree: WerkaArchiveListContent(props), props, calls, renders };
}

for (const platform of ['ios', 'android']) {
  const press = node => node.props[platform === 'ios' ? 'onPress' : 'onClick']();
  test(`${platform} loading and error never build the daily filter`, () => {
    const noRender = () => { throw Error('must not build calendar'); };
    const filter = { selectedDateLabel: 'selected date', calendarOpen: true, onToggle: () => {}, renderCalendar: noRender };
    const loading = setup(platform, { data: null, loading: true, dailyFilter: filter });
    assert.equal(find(loading.tree, 'archive_list_date_toggle'), undefined); assert.deepEqual(loading.calls, []);
    const failed = setup(platform, { data: null, error: Error('x'), dailyFilter: filter });
    assert.equal(find(failed.tree, 'archive_list_date_toggle'), undefined);
    nodes(failed.tree, platform === 'ios' ? 'Button' : 'PreparationRow')[0].props.onPress();
    assert.deepEqual(failed.calls, ['refresh']);
  });

  test(`${platform} an empty daily list still displays the date filter, but has no pull-to-refresh`, () => {
    const result = setup(platform, { data: { summary: { recordCount: 0, totalsByUOM: [] }, items: [] } });
    assert.deepEqual(result.renders, [true]); assert.equal(nodes(result.tree, 'CalendarSlot').length, 1);
    const all = nodes(result.tree), toggle = find(result.tree, 'archive_list_date_toggle');
    const empty = all.find(node => node.props?.children === localization.localizedGetter('archiveNoItems', 'uz')
      || node.props?.title === localization.localizedGetter('archiveNoItems', 'uz'));
    assert.ok(all.indexOf(toggle) < all.indexOf(empty));
    const list = nodes(result.tree, platform === 'ios' ? 'PreparationList' : 'ScrollView')[0];
    assert.equal(list.props[platform === 'ios' ? 'refresh' : 'refreshControl'], undefined);
    press(toggle); assert.deepEqual(result.calls, ['toggle']);
  });

  test(`${platform} nonempty list keeps the filter ahead of records and only requests controlled actions`, async () => {
    const result = setup(platform), all = nodes(result.tree), toggle = find(result.tree, 'archive_list_date_toggle');
    assert.deepEqual(result.renders, [true]); assert.ok(all.indexOf(toggle) < all.findIndex(node => node.props?.children === '1 ta yozuv'
      || node.props?.title === '1 ta yozuv'));
    press(toggle); const list = nodes(result.tree, platform === 'ios' ? 'PreparationList' : 'OrdersList')[0];
    await list.props[platform === 'ios' ? 'refresh' : 'onRefresh'](); assert.deepEqual(result.calls, ['toggle', 'refresh']);
    assert.equal(nodes(result.tree, 'PreparationRow').some(node => typeof node.props.onPress === 'function'), false);
  });

  test(`${platform} closing the calendar keeps its subtree gated and passes disabled to the caller`, () => {
    const base = setup(platform).props.dailyFilter, result = setup(platform, { dailyFilter: { ...base, calendarOpen: false } });
    const panel = find(result.tree, 'archive_list_date_calendar');
    assert.equal(nodes(panel, 'CalendarSlot')[0].props.enabled, false);
    if (platform === 'ios') {
      const modifier = key => panel.props.modifiers.find(value => Object.hasOwn(value, key))?.[key];
      assert.equal(modifier('hidden'), true); assert.equal(modifier('disabled'), true); assert.equal(modifier('accessibilityHidden'), true);
      assert.equal(modifier('frame').height, 0);
    } else {
      assert.equal(panel.props.pointerEvents, 'none'); assert.equal(panel.props.accessibilityElementsHidden, true);
      assert.equal(panel.props.importantForAccessibility, 'no-hide-descendants'); assert.equal(panel.props.style.height, 0);
    }
  });

  test(`${platform} supplied selected date and source action label remain localized across app languages`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur-PK']) {
      const result = setup(platform, { locale });
      const texts = nodes(result.tree, 'Text').map(node => node.props.children);
      assert.ok(texts.includes(localization.localizedGetter('archiveDateTitle', locale)));
      assert.ok(texts.includes(localization.localizedGetter('archiveSelectDateAction', locale)));
      assert.ok(texts.includes('selected date')); assert.deepEqual(result.calls, []);
    }
  });
}
