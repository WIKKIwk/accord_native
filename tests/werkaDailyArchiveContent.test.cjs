// Source-derived mocked views only. The calendar is a test double, not a native/device or route test.
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
  const loaded = new Module(filename); loaded.filename = filename; loaded.paths = require.main.paths;
  if (cache.has(filename)) return cache.get(filename); cache.set(filename, loaded.exports);
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
const native = Object.fromEntries(['Button', 'Column', 'Host', 'HStack', 'Image', 'RNHostView', 'Row', 'Section', 'Spacer', 'Text', 'VStack']
  .map(name => [name, name]));
const modifiers = Object.fromEntries(['accessibilityHidden', 'accessibilityIdentifier', 'buttonStyle', 'clipped', 'disabled', 'font',
  'frame', 'hidden', 'padding', 'fillMaxWidth', 'testID', 'weight'].map(name => [name, value => ({ [name]: value })]));
const mocks = { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
  '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => colors }, '@expo/ui/jetpack-compose/modifiers': modifiers,
  'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { View: 'View' },
  'react-native-reanimated': { useSharedValue: value => ({ value }) },
  '../preparation/PreparationUI.ios': { PreparationList: 'PreparationList' },
  '../preparation/PreparationUI.android': { PreparationRow: 'PreparationRow', PreparationText: 'PreparationText' },
  '../shared/orders/OrdersList': { OrdersList: 'OrdersList' }, '../components/WorkerQueueCard.android': { WorkerQueueCard: 'WorkerQueueCard' } };
const model = load(path.join(src, 'werka/werkaDailyArchiveModel.ts'));
const localization = load(path.join(src, 'shared/localization'));
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(type === undefined || node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const id = node => node.props?.testID ?? node.props?.modifiers?.map(value => value.testID ?? value.accessibilityIdentifier).find(Boolean);
const find = (tree, wanted) => nodes(tree).find(node => id(node) === wanted);
function setup(platform, patch = {}) {
  const calls = [], renders = [], state = { ...model.werkaDailyArchiveInitial(new Date(2024, 1, 29, 19)), calendarOpen: true };
  const props = { kind: 'received', state, activeDays: new Set([1, 29]), loading: false, error: null, locale: 'uz',
    renderCalendar: enabled => { renders.push(enabled); return element('CalendarSlot', { enabled }); },
    onToggle: () => calls.push('toggle'), onRefresh: async () => { calls.push('refresh'); }, ...patch };
  const { WerkaDailyArchiveContent } = load(path.join(src, `werka/WerkaDailyArchiveContent.${platform}.tsx`), mocks);
  return { tree: WerkaDailyArchiveContent(props), props, calls, renders };
}

for (const platform of ['ios', 'android']) {
  const press = node => node.props[platform === 'ios' ? 'onPress' : 'onClick']();
  test(`${platform} loading is blank and error exposes only retry, without building the calendar`, async () => {
    const invalid = { ...model.werkaDailyArchiveInitial(new Date(2024, 1, 29)), selectedDate: new Date(NaN) };
    const failIfRendered = () => { throw Error('calendar must not render'); };
    const loading = setup(platform, { state: invalid, activeDays: new Set(), loading: true, error: Error('x'), renderCalendar: failIfRendered });
    assert.equal(nodes(loading.tree, 'CalendarSlot').length, 0); assert.equal(nodes(loading.tree, 'Button').length, 0);
    assert.deepEqual(loading.calls, []);
    const failed = setup(platform, { state: invalid, activeDays: new Set(), error: Error('x'), renderCalendar: failIfRendered });
    const message = nodes(failed.tree, platform === 'ios' ? 'Text' : 'PreparationText')[0].props.children;
    assert.equal(message, localization.localizedGetter('serverDisconnectedRetry', 'uz'));
    const retry = nodes(failed.tree, platform === 'ios' ? 'Button' : 'PreparationRow')[0];
    assert.equal(retry.props[platform === 'ios' ? 'label' : 'title'], localization.localizedGetter('retry', 'uz'));
    retry.props.onPress(); assert.deepEqual(failed.calls, ['refresh']);
  });

  test(`${platform} source labels, summary, toggle and refresh stay controlled`, async () => {
    const result = setup(platform), expected = model.werkaDailyArchivePresentation(result.props.kind, result.props.state,
      result.props.activeDays, false, null, result.props.locale);
    const texts = nodes(result.tree, 'Text').map(node => node.props.children);
    assert.deepEqual(texts, [expected.dateTitle, expected.selectedDateLabel, expected.action, expected.summary]);
    assert.deepEqual(result.renders, [true]); assert.deepEqual(result.calls, []);
    assert.equal(nodes(result.tree, 'CalendarSlot')[0].props.enabled, true);
    press(find(result.tree, 'daily_archive_toggle')); assert.deepEqual(result.calls, ['toggle']);
    const list = nodes(result.tree, platform === 'ios' ? 'PreparationList' : 'OrdersList')[0];
    await list.props[platform === 'ios' ? 'refresh' : 'onRefresh'](); assert.deepEqual(result.calls, ['toggle', 'refresh']);
  });

  test(`${platform} closed calendar remains in the subtree but is hidden, disabled and marked inaccessible`, () => {
    const state = { ...model.werkaDailyArchiveInitial(new Date(2024, 1, 29)), calendarOpen: false };
    const result = setup(platform, { state }), panel = find(result.tree, 'daily_archive_calendar');
    assert.deepEqual(result.renders, [false]); assert.equal(nodes(panel, 'CalendarSlot')[0].props.enabled, false);
    if (platform === 'ios') {
      const modifier = key => panel.props.modifiers.find(value => Object.hasOwn(value, key))?.[key];
      assert.equal(modifier('hidden'), true); assert.equal(modifier('disabled'), true);
      assert.equal(modifier('accessibilityHidden'), true); assert.equal(modifier('frame').height, 0);
    } else {
      assert.equal(panel.props.pointerEvents, 'none'); assert.equal(panel.props.accessibilityElementsHidden, true);
      assert.equal(panel.props.importantForAccessibility, 'no-hide-descendants'); assert.equal(panel.props.style.height, 0);
    }
    assert.deepEqual(result.calls, []);
  });

  test(`${platform} retained active data survives loading or error; completed empty uses source summary`, () => {
    for (const loading of [true, false]) for (const error of [null, Error('retained')]) {
      const result = setup(platform, { loading, error });
      assert.equal(nodes(result.tree, 'CalendarSlot').length, 1); assert.equal(result.renders[0], true);
      assert.ok(nodes(result.tree, 'Text').some(node => node.props.children === '2 ta faol kun'));
      assert.deepEqual(result.calls, []);
    }
    const empty = setup(platform, { activeDays: new Set() });
    assert.ok(nodes(empty.tree, 'Text').some(node => node.props.children === localization.localizedGetter('archiveCalendarEmptyMonth', 'uz')));
    assert.equal(nodes(empty.tree, 'CalendarSlot').length, 1);
  });

  test(`${platform} every archive kind and app locale shows its source-derived date and action`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur-PK']) for (const kind of ['received', 'sent', 'returned']) {
      const result = setup(platform, { locale, kind });
      const expected = model.werkaDailyArchivePresentation(kind, result.props.state, result.props.activeDays, false, null, locale);
      const texts = nodes(result.tree, 'Text').map(node => node.props.children);
      assert.deepEqual(texts, [expected.dateTitle, expected.selectedDateLabel, expected.action, expected.summary]);
      assert.deepEqual(result.calls, []);
    }
  });
}
