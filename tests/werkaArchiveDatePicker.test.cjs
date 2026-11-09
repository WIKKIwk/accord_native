// React/native controls are mocked. Real handlers and retained hook state are exercised, never a device/pager oracle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const src = path.resolve(__dirname, '../src');
function load(file, mocks = {}, cache = new Map()) {
  const filename = [file, `${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')].find(value => fs.existsSync(value) && fs.statSync(value).isFile());
  if (!filename) throw Error(file);
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
function date(year, month, day, hour = 0) {
  const value = new Date(0); value.setHours(hour, 0, 0, 0); value.setFullYear(year, month - 1, day); return value;
}
const ymd = value => [value.getFullYear(), value.getMonth() + 1, value.getDate()];
const geometry = load(path.join(src, 'werka/werkaArchivePickerModel'));
const dateLabels = load(path.join(src, 'werka/werkaArchiveDateLabels'));
const element = (type, props, key) => {
  if (typeof type !== 'function') return { type, props, key };
  const rendered = type(props);
  return key === undefined ? rendered : { ...rendered, key };
};
function nodes(node, type) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(value => nodes(value, type));
  return [...(type === undefined || node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
}
const id = node => node.props?.modifiers?.map(value => value.accessibilityIdentifier ?? value.testID).find(Boolean);
const find = (tree, wanted) => nodes(tree).find(node => id(node) === wanted);
const modifier = (node, key) => node.props.modifiers?.find(value => Object.hasOwn(value, key))?.[key];
function setup(platform, patch = {}) {
  const slots = [], cleanups = [], deps = [], memoDeps = [], calls = [], scrolls = []; let cursor = 0, effects = [], props;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useMemo(factory, dependency) { const i = cursor++;
      if (!(i in memoDeps) || dependency.some((value, index) => !Object.is(value, memoDeps[i][index]))) {
        memoDeps[i] = dependency; slots[i] = factory();
      }
      return slots[i]; },
    useLayoutEffect(effect) { cursor++; effects.push(effect); },
    useEffect(effect, dependency) { const i = cursor++; if (!(i in deps)) { deps[i] = dependency; effects.push(() => { cleanups[i] = effect(); }); } },
  };
  const native = Object.fromEntries(['Button', 'Column', 'HStack', 'IconButton', 'Image', 'LazyColumn', 'RNHostView', 'Row',
    'ScrollView', 'Spacer', 'Text', 'TextButton', 'VStack'].map(name => [name, name]));
  native.HorizontalPager = value => ({ type: 'HorizontalPager', props: value });
  const modifiers = Object.fromEntries(['accessibilityAddTraits', 'accessibilityHidden', 'accessibilityIdentifier', 'accessibilityLabel',
    'animation', 'border', 'buttonStyle', 'disabled', 'font', 'frame', 'tabViewStyle', 'fillMaxWidth', 'height', 'semantics', 'testID', 'weight']
    .map(name => [name, (...value) => ({ [name]: value.length > 1 ? value : value[0] })]));
  modifiers.Animation = { easeInOut: value => value };
  const mocks = { react: hooks, 'react/jsx-runtime': { Fragment: 'Fragment', jsx: element, jsxs: element },
    './WerkaArchivePager.ios': { WerkaArchivePager: value => ({ type: 'ArchivePager', props: { ...value,
      children: Array.from({ length: value.pageCount }, (_, page) => value.renderPage(page)) } }) },
    '@expo/ui/swift-ui': native, '@expo/ui/swift-ui/modifiers': modifiers,
    '@expo/ui/jetpack-compose': { ...native, useMaterialColors: () => ({ primary: 'primary', onPrimary: 'onPrimary',
      onSurface: 'onSurface', onSurfaceVariant: 'secondary' }) }, '@expo/ui/jetpack-compose/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' } };
  const { WerkaArchiveDatePicker } = load(path.join(src, `werka/WerkaArchiveDatePicker.${platform}.tsx`), mocks);
  const localeContext = { firstDayOfWeekIndex: 0, narrowWeekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    formatDecimal: value => String(value), formatYear: value => String(value),
    formatMonthYear: value => dateLabels.werkaArchiveMonthYear(value, 'en'),
    formatFullDate: value => `Full date ${ymd(value).join('-')}`, previousMonthTooltip: 'Previous month',
    nextMonthTooltip: 'Next month', selectYearSemanticsLabel: 'Select year', currentDateLabel: 'Today' };
  props = { initialDate: date(2024, 1, 31, 19), currentDate: date(2024, 2, 29),
    bounds: { firstDate: date(2023, 1, 1), lastDate: date(2025, 12, 31) }, localeContext, enabled: true,
    onDisplayedMonthChanged: value => calls.push(['month', ymd(value)]), onDateChanged: value => calls.push(['date', ymd(value)]),
    onPagerError: error => calls.push(['pagerError', error]), ...patch };
  const render = (update = {}) => {
    props = { ...props, ...update }; cursor = 0; effects = [];
    const tree = WerkaArchiveDatePicker(props); effects.forEach(effect => effect()); return tree;
  };
  const attachPager = (tree, implementation = page => { scrolls.push(page); return Promise.resolve(); }) => {
    const pager = nodes(tree, platform === 'ios' ? 'ArchivePager' : 'HorizontalPager')[0];
    pager.props.ref.current = platform === 'ios' ? { scrollToPage: implementation } : { animateScrollToPage: implementation };
  };
  return { render, calls, scrolls, attachPager, props: () => props,
    unmount: () => cleanups.filter(Boolean).forEach(cleanup => cleanup()) };
}

test('picker initial state and year grid preserve source null selection, padded year order and shown-year marker', () => {
  const bounds = { firstDate: date(2021, 1, 1), lastDate: date(2027, 12, 31) };
  const initial = geometry.werkaArchivePickerInitial(null, date(2026, 11, 8, 19), bounds);
  assert.equal(initial.selectedDate, null); assert.deepEqual(ymd(initial.displayMonth), [2026, 11, 1]); assert.equal(initial.mode, 'day');
  const years = geometry.werkaArchivePickerYears(date(2024, 2, 1), date(2026, 11, 8), bounds);
  assert.deepEqual(years.cells.map(cell => cell.year), Array.from({ length: 18 }, (_, i) => 2016 + i));
  assert.deepEqual(years.cells.filter(cell => cell.enabled).map(cell => cell.year), [2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  assert.deepEqual(years.cells.filter(cell => cell.selected).map(cell => cell.year), [2024]);
  assert.deepEqual(years.cells.filter(cell => cell.today).map(cell => cell.year), [2026]);
  assert.deepEqual(years.rows.map(row => row.length), [3, 3, 3, 3, 3, 3]);
});

for (const platform of ['ios', 'android']) {
  const press = node => node.props[platform === 'ios' ? 'onPress' : 'onClick']();
  const nativePage = (tree, index) => platform === 'ios' ? nodes(tree, 'ArchivePager')[0].props.onPageChanged(index)
    : nodes(tree, 'HorizontalPager')[0].props.onCurrentPageChange(index);
  test(`${platform} mount, prop/callback rerenders and mode toggles never fabricate month or selection callbacks`, () => {
    const instance = setup(platform); let tree = instance.render();
    assert.deepEqual(instance.calls, []); assert.equal(nodes(tree, platform === 'ios' ? 'ArchivePager' : 'HorizontalPager')[0] !== undefined, true);
    tree = instance.render({ initialDate: date(2025, 12, 18), onDisplayedMonthChanged: value => instance.calls.push(['newMonth', ymd(value)]) });
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'January 2024');
    press(find(tree, 'archive_picker_mode')); tree = instance.render();
    assert.equal(find(tree, 'archive_picker_previous_month'), undefined); assert.equal(find(tree, 'archive_picker_next_month'), undefined);
    assert.equal(nodes(tree, platform === 'ios' ? 'Button' : 'TextButton').filter(node => /^archive_picker_year_/.test(id(node) ?? '')).length, 18);
    press(find(tree, 'archive_picker_mode')); tree = instance.render();
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'January 2024'); assert.deepEqual(instance.calls, []);
  });

  test(`${platform} native month events deduplicate, preserve selection and reject invalid or offscreen actions`, () => {
    const instance = setup(platform); let tree = instance.render();
    nativePage(tree, 12); nativePage(tree, -1); nativePage(tree, 36); nativePage(tree, 1.5); assert.deepEqual(instance.calls, []);
    press(find(tree, 'archive_picker_day_2024_2_29')); assert.deepEqual(instance.calls, []);
    nativePage(tree, 13); nativePage(tree, 13); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2024, 2, 1]]]);
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'February 2024');
    press(find(tree, 'archive_picker_day_2024_2_29')); tree = instance.render();
    assert.deepEqual(instance.calls.at(-1), ['date', [2024, 2, 29]]);
    press(find(tree, 'archive_picker_day_2024_2_29')); assert.deepEqual(instance.calls.at(-1), ['date', [2024, 2, 29]]);
    assert.equal(instance.calls.filter(call => call[0] === 'date').length, 2);
  });

  test(`${platform} year choice preserves displayed month, clamps the selected day and emits month before date exactly once`, () => {
    const instance = setup(platform); let tree = instance.render(); nativePage(tree, 13); tree = instance.render();
    press(find(tree, 'archive_picker_mode')); tree = instance.render(); instance.calls.length = 0;
    const oldYear = find(tree, 'archive_picker_year_2025'); press(oldYear); press(oldYear); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2025, 2, 1]], ['date', [2025, 2, 28]]]);
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'February 2025');
    instance.calls.length = 0; press(find(tree, 'archive_picker_mode')); tree = instance.render();
    press(find(tree, 'archive_picker_year_2025')); tree = instance.render();
    assert.deepEqual(instance.calls, [['date', [2025, 2, 28]]]);
  });

  test(`${platform} live enablement and unmount block stored native handlers without resetting picker state`, () => {
    const instance = setup(platform); let tree = instance.render();
    const oldDay = find(tree, 'archive_picker_day_2024_1_31'), oldPager = tree, oldToggle = find(tree, 'archive_picker_mode');
    const oldNext = find(tree, 'archive_picker_next_month');
    instance.attachPager(tree);
    tree = instance.render({ enabled: false }); press(oldDay); press(oldToggle); nativePage(oldPager, 13);
    press(oldNext); assert.deepEqual(instance.calls, []); assert.deepEqual(instance.scrolls, []);
    tree = instance.render({ enabled: true }); nativePage(tree, 13); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2024, 2, 1]]]); instance.calls.length = 0;
    instance.unmount(); press(find(tree, 'archive_picker_day_2024_2_29')); nativePage(tree, 14); press(find(tree, 'archive_picker_mode'));
    assert.deepEqual(instance.calls, []);
  });

  test(`${platform} stale events from a replaced month pager cannot undo a year choice`, () => {
    const instance = setup(platform); let tree = instance.render(); const oldPager = tree;
    press(find(tree, 'archive_picker_mode')); tree = instance.render();
    press(find(tree, 'archive_picker_year_2025')); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2025, 1, 1]], ['date', [2025, 1, 31]]]);
    instance.calls.length = 0;
    nativePage(oldPager, 13);
    if (platform === 'ios') nodes(oldPager, 'ArchivePager')[0].props.onPagerError(Error('old pager'));
    tree = instance.render();
    assert.deepEqual(instance.calls, []);
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'January 2025');
    nativePage(tree, 25); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2025, 2, 1]]]);
  });

  test(`${platform} disabled and re-enabled pager is recreated from retained state and ignores its prior events`, () => {
    const instance = setup(platform); let tree = instance.render(); const oldPager = tree;
    const pagerType = platform === 'ios' ? 'ArchivePager' : 'HorizontalPager';
    const oldKey = nodes(tree, pagerType)[0].key;
    const disabled = instance.render({ enabled: false });
    const disabledKey = nodes(disabled, pagerType)[0].key;
    tree = instance.render({ enabled: true });
    assert.notEqual(oldKey, disabledKey);
    assert.equal(nodes(tree, pagerType)[0].key, oldKey);
    assert.equal(nodes(tree, pagerType)[0].props.initialPage, 12);
    nativePage(oldPager, 13); tree = instance.render();
    assert.deepEqual(instance.calls, []);
    nativePage(tree, 13); tree = instance.render();
    assert.deepEqual(instance.calls, [['month', [2024, 2, 1]]]);
  });

  test(`${platform} boundaries disable cells and navigation without hiding inactive dates; today's semantic suffix is source-shaped`, () => {
    const instance = setup(platform, { initialDate: date(2024, 2, 10), currentDate: date(2024, 2, 15),
      bounds: { firstDate: date(2024, 2, 4), lastDate: date(2024, 2, 18) } });
    let tree = instance.render();
    const dayCells = nodes(tree, platform === 'ios' ? 'Button' : 'TextButton').filter(node => /^archive_picker_day_/.test(id(node) ?? ''));
    assert.equal(dayCells.length, 29);
    const isDisabled = node => platform === 'ios' ? modifier(node, 'disabled') : !node.props.enabled;
    assert.equal(isDisabled(find(tree, 'archive_picker_day_2024_2_3')), true);
    assert.equal(isDisabled(find(tree, 'archive_picker_day_2024_2_4')), false);
    assert.equal(isDisabled(find(tree, 'archive_picker_day_2024_2_19')), true);
    press(find(tree, 'archive_picker_day_2024_2_3')); press(find(tree, 'archive_picker_day_2024_2_19'));
    assert.deepEqual(instance.calls, []);
    const today = find(tree, 'archive_picker_day_2024_2_15');
    const label = platform === 'ios' ? modifier(today, 'accessibilityLabel') : modifier(today, 'semantics').contentDescription;
    assert.equal(label, '15, Full date 2024-2-15, Today');
    assert.equal(isDisabled(find(tree, 'archive_picker_previous_month')), true); assert.equal(isDisabled(find(tree, 'archive_picker_next_month')), true);
    press(find(tree, 'archive_picker_mode')); tree = instance.render();
    const unavailableYear = find(tree, 'archive_picker_year_2023'); assert.equal(isDisabled(unavailableYear), true); press(unavailableYear);
    assert.deepEqual(instance.calls, []);
  });

  test(`${platform} callback date mutation cannot alter retained selected or shown state and changed bounds are never silently reinterpreted`, () => {
    const instance = setup(platform, { onDisplayedMonthChanged: value => value.setFullYear(1990), onDateChanged: value => value.setFullYear(1990) });
    let tree = instance.render(); nativePage(tree, 13); tree = instance.render(); press(find(tree, 'archive_picker_day_2024_2_29')); tree = instance.render();
    assert.equal(nodes(find(tree, 'archive_picker_mode'), 'Text')[0].props.children, 'February 2024');
    const selected = find(tree, 'archive_picker_day_2024_2_29');
    assert.equal(platform === 'ios' ? modifier(selected, 'buttonStyle') === 'borderedProminent' : selected.props.colors.containerColor === 'primary', true);
    assert.throws(() => instance.render({ bounds: { firstDate: date(2022, 1, 1), lastDate: date(2025, 12, 31) } }), RangeError);
  });
}

test('iOS arrows request native scrolling and report only actual page changes', () => {
  const instance = setup('ios'); let tree = instance.render(); instance.attachPager(tree);
  press(find(tree, 'archive_picker_next_month')); press(find(tree, 'archive_picker_next_month')); tree = instance.render();
  assert.deepEqual(instance.scrolls, [13, 13]); assert.deepEqual(instance.calls, []);
  nodes(tree, 'ArchivePager')[0].props.onPageChanged(13); tree = instance.render();
  assert.deepEqual(instance.calls, [['month', [2024, 2, 1]]]);
  nodes(tree, 'ArchivePager')[0].props.onPageChanged(14); tree = instance.render();
  assert.deepEqual(instance.calls.at(-1), ['month', [2024, 3, 1]]);
  function press(node) { node.props.onPress(); }
});

test('Android arrows wait for real native current-page events, not animation promises, and report failures without false changes', async () => {
  const instance = setup('android'); let tree = instance.render(); instance.attachPager(tree);
  find(tree, 'archive_picker_next_month').props.onClick(); await Promise.resolve();
  assert.deepEqual(instance.scrolls, [13]); assert.deepEqual(instance.calls, []);
  nodes(tree, 'HorizontalPager')[0].props.onCurrentPageChange(13); tree = instance.render();
  assert.deepEqual(instance.calls, [['month', [2024, 2, 1]]]);
  const error = Error('native animation failed'); instance.attachPager(tree, async () => { throw error; });
  find(tree, 'archive_picker_next_month').props.onClick(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(instance.calls.at(-1), ['pagerError', error]);
  assert.equal(instance.calls.filter(call => call[0] === 'month').length, 1);
  instance.unmount(); find(tree, 'archive_picker_next_month').props.onClick(); await Promise.resolve(); await Promise.resolve();
  assert.equal(instance.calls.filter(call => call[0] === 'pagerError').length, 1);
});

test('Android synchronous pager errors and missing native handles do not claim a changed month', async () => {
  const instance = setup('android'); const tree = instance.render();
  find(tree, 'archive_picker_next_month').props.onClick(); await Promise.resolve(); await Promise.resolve();
  assert.equal(instance.calls[0][0], 'pagerError'); assert.equal(instance.calls.length, 1);
  const error = Error('native handle failed'); instance.attachPager(tree, () => { throw error; });
  find(tree, 'archive_picker_next_month').props.onClick();
  assert.deepEqual(instance.calls[1], ['pagerError', error]); assert.equal(instance.calls.length, 2);
});

test('Android a replaced pager does not report a late rejected animation after re-enablement', async () => {
  const instance = setup('android'); let tree = instance.render(); let reject;
  instance.attachPager(tree, () => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
  find(tree, 'archive_picker_next_month').props.onClick();
  instance.render({ enabled: false }); tree = instance.render({ enabled: true });
  reject(Error('old native animation')); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(instance.calls, []);
  assert.equal(nodes(tree, 'HorizontalPager')[0].props.initialPage, 12);
});
