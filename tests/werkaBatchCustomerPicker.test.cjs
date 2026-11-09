// Source-derived presentation and mocked native events only; no owner, catalog or device.
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
  }).outputText, filename);
  return loaded.exports;
}
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
const localization = compile('shared/localization/index.ts', { './catalog.json': catalog });
const trim = compile('werka/werkaBatchTrim.ts');
const model = compile('werka/werkaBatchCustomerPicker.ts', { '../shared/localization': localization, './werkaBatchTrim': trim });
const node = (tree, type) => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => node(child, type));
  return [...(tree.type === type ? [tree] : []), ...node(tree.props?.children, type)];
};
const findFunction = tree => {
  if (!tree || typeof tree !== 'object') return undefined;
  if (Array.isArray(tree)) return tree.map(findFunction).find(Boolean);
  return typeof tree.type === 'function' ? tree : findFunction(tree.props?.children);
};
const a = { ref: '1', name: 'First', phone: '\u0085 +998 \u0085' };
const b = { ref: '1', name: 'Second', phone: '\u0085' };
const state = (overrides = {}) => ({ query: '', loading: false, loadingMore: false, hasMore: false,
  hasError: false, customers: [], ...overrides });
function make(overrides = {}) {
  const calls = [], cleanups = [], ui = Object.fromEntries(['Button', 'Column', 'Host', 'Text', 'TextInput'].map(name => [name, name]));
  ui.useNativeState = initial => ({ initial });
  const mocks = { 'react/jsx-runtime': jsx, react: { useRef: value => ({ current: value }), useLayoutEffect: effect => cleanups.push(effect()) }, '@expo/ui': ui,
    'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', View: 'View' },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, './WerkaBatchCustomerPickerRow': { WerkaBatchCustomerPickerRow: 'CustomerRow' },
    './werkaBatchCustomerPicker': model };
  const component = compile('werka/WerkaBatchCustomerPickerContent.tsx', mocks).WerkaBatchCustomerPickerContent;
  const props = { state: state(), locale: 'en', closeLabel: 'Close', queryFieldKey: 'field-1',
    onQueryChange: value => calls.push(['query', value]), onDismiss: () => calls.push('dismiss'),
    onSelect: value => calls.push(['select', value]), onRetry: () => calls.push('retry'),
    onLoadMore: () => calls.push('more'), ...overrides };
  const tree = component(props), fieldNode = findFunction(tree);
  // Function components are not rendered by the JSX mock; inspect the actual child explicitly.
  const field = fieldNode.type(fieldNode.props);
  const fieldCleanup = cleanups[cleanups.length - 1];
  return { tree, field, fieldNode, calls, props, unmount: () => cleanups.forEach(cleanup => cleanup?.()), unmountField: () => fieldCleanup?.(),
    list: node(tree, 'FlatList')[0], close: node(tree, 'WorkerIconButton')[0] };
}

test('customer picker source labels use the four app locales', () => {
  const expected = {
    uz: ['Haridor tanlang', 'Haridor qidiring', 'Server uzilgan. Qayta urining.', 'Qayta urinish', 'Bu ro‘yxatda hozircha yozuv yo‘q.'],
    en: ['Select customer', 'Search customer', 'Server disconnected. Try again.', 'Retry', 'No records in this list yet.'],
    ru: ['Выберите покупателя', 'Поиск покупателя', 'Сервер отключен. Повторите попытку.', 'Повторить', 'В этом списке пока нет записей.'],
    ur: ['گاہک منتخب کریں', 'گاہک تلاش کریں', 'سرور منقطع ہو گیا۔ دوبارہ کوشش کریں۔', 'دوبارہ کوشش کریں', 'اس فہرست میں ابھی کوئی ریکارڈ نہیں۔'],
  };
  for (const [locale, values] of Object.entries(expected)) {
    const v = model.werkaBatchCustomerPickerPresentation(state(), locale);
    assert.deepEqual([v.title, v.hint, v.error, v.retry, v.empty], values);
  }
});

test('source body precedence and supplied order preserve duplicates and Dart-trimmed phone', () => {
  const cases = [
    [state({ loading: true, hasError: true, customers: [a] }), 'loading'],
    [state({ hasError: true, customers: [a] }), 'error'], [state(), 'empty'],
    [state({ customers: [a, b], loadingMore: true, hasMore: true }), 'list'],
  ];
  for (const [input, body] of cases) assert.equal(model.werkaBatchCustomerPickerPresentation(input, 'en').body, body);
  const v = model.werkaBatchCustomerPickerPresentation(cases[3][0], 'en');
  assert.deepEqual(v.rows.map(row => [row.customer.ref, row.title, row.subtitle]), [['1', 'First', '+998'], ['1', 'Second', '']]);
  assert.equal(v.showLoadingMore, true); assert.equal(v.canLoadMore, false);
});

test('scroll threshold describes only a real position and respects invalid geometry', () => {
  for (const y of [0, 559]) assert.equal(model.werkaBatchCustomerPickerNearEnd(y, 1000, 200), false);
  for (const y of [560, 800, 900]) assert.equal(model.werkaBatchCustomerPickerNearEnd(y, 1000, 200), true);
  assert.equal(model.werkaBatchCustomerPickerNearEnd(0, 200, 200), true);
  assert.equal(model.werkaBatchCustomerPickerNearEnd(NaN, 200, 200), false);
  assert.equal(model.werkaBatchCustomerPickerNearEnd(0, 200, 0), false);
});

test('native search field starts with supplied query and forwards actual changes', () => {
  const v = make({ state: state({ query: 'first' }), queryFieldKey: 'reset-2' }), field = node(v.field, 'TextInput')[0];
  assert.equal(v.fieldNode.key, 'reset-2'); assert.equal(field.props.value.initial, 'first');
  assert.equal(field.props.placeholder, 'Search customer'); assert.equal(field.props.autoFocus, false);
  field.props.onChangeText('second'); assert.deepEqual(v.calls, [['query', 'second']]);
});

test('loading, retry and empty branches do not invent choices', () => {
  const loading = make({ state: state({ loading: true, customers: [a] }) });
  assert.equal(node(loading.tree, 'ActivityIndicator').length, 1); assert.equal(loading.list, undefined);
  const failed = make({ state: state({ hasError: true, customers: [a] }) });
  assert.equal(failed.list, undefined); assert.equal(node(failed.tree, 'Button')[0].props.label, 'Retry');
  node(failed.tree, 'Button')[0].props.onPress(); assert.deepEqual(failed.calls, ['retry']);
  const empty = make(); assert.equal(empty.list, undefined);
  assert.ok(node(empty.tree, 'Text').some(value => value.props.children === 'No records in this list yet.'));
});

test('selection reports the actual row once and closes off later events', () => {
  const v = make({ state: state({ customers: [a, b], hasMore: true }) }), rows = v.list.props.data;
  const first = v.list.props.renderItem({ item: rows[0], index: 0 });
  assert.deepEqual([first.props.title, first.props.subtitle], ['First', '+998']);
  first.props.onPress(); first.props.onPress(); v.close.props.onPress();
  node(v.field, 'TextInput')[0].props.onChangeText('late');
  v.list.props.onScroll({ nativeEvent: { contentOffset: { y: 1000 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 } } });
  assert.deepEqual(v.calls, [['select', a]]);
  const second = make({ state: state({ customers: [b] }) });
  const row = second.list.props.renderItem({ item: second.list.props.data[0], index: 0 });
  assert.deepEqual([row.props.title, row.props.subtitle], ['Second', '']);
});

test('dismissal reports once and blocks late query and selection callbacks', () => {
  const v = make({ state: state({ customers: [a] }) }), row = v.list.props.renderItem({ item: v.list.props.data[0] });
  v.close.props.onPress(); v.close.props.onPress(); row.props.onPress();
  node(v.field, 'TextInput')[0].props.onChangeText('late'); assert.deepEqual(v.calls, ['dismiss']);
});

test('unmount after an external dismissal blocks queued callbacks', () => {
  const v = make({ state: state({ customers: [a], hasMore: true }) }), row = v.list.props.renderItem({ item: v.list.props.data[0] });
  v.unmount(); v.close.props.onPress(); row.props.onPress();
  node(v.field, 'TextInput')[0].props.onChangeText('late');
  v.list.props.onScroll({ nativeEvent: { contentOffset: { y: 1000 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 } } });
  assert.deepEqual(v.calls, []);
});

test('a destroyed native search field cannot forward a queued event even if its old key is reused', () => {
  const v = make(), field = node(v.field, 'TextInput')[0];
  v.unmountField(); field.props.onChangeText('stale'); assert.deepEqual(v.calls, []);
});

test('a committed reset fences queued events from the old field and old list', () => {
  const slots = [], calls = []; let cursor = 0;
  const react = {
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useLayoutEffect(effect, deps) {
      const index = cursor++, old = slots[index];
      if (deps && old && deps.length === old.deps.length && deps.every((value, i) => value === old.deps[i])) return;
      old?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
    },
  };
  const ui = Object.fromEntries(['Button', 'Column', 'Host', 'Text', 'TextInput'].map(name => [name, name]));
  ui.useNativeState = initial => ({ initial });
  const mocks = { 'react/jsx-runtime': jsx, react, '@expo/ui': ui,
    'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', View: 'View' },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, './WerkaBatchCustomerPickerRow': { WerkaBatchCustomerPickerRow: 'CustomerRow' },
    './werkaBatchCustomerPicker': model };
  const component = compile('werka/WerkaBatchCustomerPickerContent.tsx', mocks).WerkaBatchCustomerPickerContent;
  const props = { state: state({ customers: [a], hasMore: true }), locale: 'en', closeLabel: 'Close', queryFieldKey: 'first',
    onQueryChange: value => calls.push(['query', value]), onDismiss: () => calls.push('dismiss'),
    onSelect: value => calls.push(['select', value]), onRetry: () => calls.push('retry'), onLoadMore: () => calls.push('more') };
  const render = value => { cursor = 0; return component(value); };
  const first = render(props), oldFieldNode = findFunction(first), oldField = oldFieldNode.type(oldFieldNode.props);
  const oldList = node(first, 'FlatList')[0], oldRow = oldList.props.renderItem({ item: oldList.props.data[0] });
  const second = render({ ...props, queryFieldKey: 'second', state: state({ loading: true }) });
  const newFieldNode = findFunction(second), newField = newFieldNode.type(newFieldNode.props);
  node(oldField, 'TextInput')[0].props.onChangeText('stale'); oldRow.props.onPress();
  oldList.props.onScroll({ nativeEvent: { contentOffset: { y: 1000 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 } } });
  assert.deepEqual(calls, []);
  node(newField, 'TextInput')[0].props.onChangeText('current'); assert.deepEqual(calls, [['query', 'current']]);
  render({ ...props, queryFieldKey: 'second', state: state({ query: 'current' }) });
  node(newField, 'TextInput')[0].props.onChangeText('current plus');
  assert.deepEqual(calls, [['query', 'current'], ['query', 'current plus']]);
});

test('a retry callback from a replaced error view is ignored', () => {
  const slots = [], calls = []; let cursor = 0;
  const react = { useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useLayoutEffect(effect, deps) { const index = cursor++, old = slots[index];
      if (deps && old && deps.length === old.deps.length && deps.every((value, i) => value === old.deps[i])) return;
      old?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; } };
  const ui = Object.fromEntries(['Button', 'Column', 'Host', 'Text', 'TextInput'].map(name => [name, name])); ui.useNativeState = initial => ({ initial });
  const component = compile('werka/WerkaBatchCustomerPickerContent.tsx', { 'react/jsx-runtime': jsx, react, '@expo/ui': ui,
    'react-native': { ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', View: 'View' },
    '../components/WorkerIconButton': { WorkerIconButton: 'WorkerIconButton' }, './WerkaBatchCustomerPickerRow': { WerkaBatchCustomerPickerRow: 'CustomerRow' },
    './werkaBatchCustomerPicker': model }).WerkaBatchCustomerPickerContent;
  const props = { state: state({ hasError: true }), locale: 'en', closeLabel: 'Close', queryFieldKey: 'one',
    onQueryChange: () => {}, onDismiss: () => {}, onSelect: () => {}, onRetry: () => calls.push('retry'), onLoadMore: () => {} };
  cursor = 0; const old = component(props), retry = node(old, 'Button')[0];
  cursor = 0; component({ ...props, state: state({ customers: [a] }) }); retry.props.onPress();
  assert.deepEqual(calls, []);
});

test('only observed near-end scroll requests another page, while owner remains responsible for locking', () => {
  const v = make({ state: state({ customers: [a], hasMore: true }) });
  const event = y => ({ nativeEvent: { contentOffset: { y }, contentSize: { height: 1000 }, layoutMeasurement: { height: 200 } } });
  assert.deepEqual(v.calls, []); v.list.props.onScroll(event(559)); assert.deepEqual(v.calls, []);
  v.list.props.onScroll(event(560)); assert.deepEqual(v.calls, ['more']);
  const busy = make({ state: state({ customers: [a], hasMore: true, loadingMore: true }) });
  assert.equal(busy.list.props.ListFooterComponent.type, 'ActivityIndicator'); busy.list.props.onScroll(event(800)); assert.deepEqual(busy.calls, []);
  const done = make({ state: state({ customers: [a], hasMore: false }) }); done.list.props.onScroll(event(800)); assert.deepEqual(done.calls, []);
});

test('platform customer rows use full-width native pressables and preserve the actual callback', () => {
  const modifier = name => (...args) => ({ name, args });
  for (const platform of ['ios', 'android', 'fallback']) {
    const calls = [], swift = Object.fromEntries(['Button', 'Host', 'Text', 'VStack'].map(name => [name, name]));
    const compose = Object.fromEntries(['Column', 'Host', 'Text', 'TextButton'].map(name => [name, name]));
    const mods = Object.fromEntries(['buttonStyle', 'contentShape', 'font', 'frame', 'fillMaxWidth'].map(name => [name, modifier(name)]));
    mods.shapes = { rectangle: () => 'rectangle' };
    const file = `werka/WerkaBatchCustomerPickerRow${platform === 'fallback' ? '' : `.${platform}`}.tsx`;
    const component = compile(file, { 'react/jsx-runtime': jsx, '@expo/ui/swift-ui': swift, '@expo/ui/swift-ui/modifiers': mods,
      '@expo/ui/jetpack-compose': compose, '@expo/ui/jetpack-compose/modifiers': mods,
      'react-native': { Pressable: 'Pressable', Text: 'Text' } }).WerkaBatchCustomerPickerRow;
    const tree = component({ title: 'First', subtitle: '+998', onPress: () => calls.push('select') });
    assert.deepEqual(node(tree, 'Text').map(value => value.props.children), ['First', '+998']);
    const button = node(tree, platform === 'ios' ? 'Button' : platform === 'android' ? 'TextButton' : 'Pressable')[0];
    (platform === 'android' ? button.props.onClick : button.props.onPress)(); assert.deepEqual(calls, ['select']);
    if (platform === 'ios') {
      const label = node(tree, 'VStack')[0], shape = label.props.modifiers.find(value => value.name === 'contentShape');
      assert.equal(shape.args[0], 'rectangle'); assert.equal(label.props.modifiers.find(value => value.name === 'frame').args[0].maxWidth, Infinity);
    } else if (platform === 'android') {
      assert.ok(button.props.modifiers.some(value => value.name === 'fillMaxWidth'));
      assert.ok(node(tree, 'Column')[0].props.modifiers.some(value => value.name === 'fillMaxWidth'));
    } else assert.equal(button.props.style.width, '100%');
    const empty = component({ title: 'Second', subtitle: '', onPress: () => {} });
    assert.deepEqual(node(empty, 'Text').map(value => value.props.children), ['Second']);
  }
});

test('the controlled body has no catalog, account, route or search-activity dependency', () => {
  for (const file of ['werka/werkaBatchCustomerPicker.ts', 'werka/WerkaBatchCustomerPickerContent.tsx']) {
    const source = fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8');
    assert.doesNotMatch(source, /authorizedFetch|SearchActivityStore|werkaCustomers|expo-router|onEmptyAction/);
  }
});
