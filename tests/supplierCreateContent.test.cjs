const assert = require('node:assert/strict');
const test = require('node:test');
const { load, renderedNodes } = require('./support/supplierOverviewHarness.cjs');
const model = load('supplier/supplierScreenModel', {
  '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'),
  '../shared/searchNormalizer': load('shared/searchNormalizer'),
});
const item = { code: 'C-1', name: 'Cotton', uom: 'kg', warehouse: 'Main', item_group: '', requires_dimensions: false,
  order_apparatus_options: {}, order_microns: [], customer_names: [] };
const record = { id: 'R-1', item_code: 'C-1', sent_qty: 12.5, uom: 'kg' };

// Controlled element tests, not native rendering, navigation or network tests.
function fixture(platform, screen, options = {}) {
  let cursor = 0; const slots = [], calls = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useSyncExternalStore(_subscribe, snapshot) { cursor++; return snapshot(); },
  };
  const useNativeState = initial => {
    const [box] = react.useState(() => ({ value: initial, set(next) { this.value = next; } })); return box;
  };
  const jsx = (type, props) => ({ type, props }), components = names => Object.fromEntries(names.split(' ').map(name => [name, name]));
  const OutlinedTextField = Object.assign(props => ({ type: 'OutlinedTextField', props }),
    { Placeholder: 'Placeholder', TrailingIcon: 'TrailingIcon', Suffix: 'Suffix' });
  const picker = { state: { loading: false, error: null, query: '', ...options.state }, items: options.items ?? [item], controller: {
    setQuery: value => calls.push(['query', value]), reload: async () => { calls.push(['reload']); },
  } };
  const confirm = { submitting: options.submitting ?? false, notice: options.notice ?? '',
    controller: { submit: async () => { calls.push(['submit']); } } };
  const modifier = name => (...args) => ({ name, args });
  const views = load(`supplier/SupplierCreateScreens.${platform}`, {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/ui/swift-ui': { ...components('Button HStack Image ProgressView Section Spacer Text TextField VStack'), useNativeState },
    '@expo/ui/swift-ui/modifiers': { accessibilityLabel: modifier('accessibilityLabel'), disabled: modifier('disabled'), keyboardType: modifier('keyboardType') },
    '@expo/ui/jetpack-compose': { ...components('Button CircularProgressIndicator Host IconButton OutlinedButton RNHostView Text TextButton'),
      OutlinedTextField, useMaterialColors: () => ({}), useNativeState },
    '@expo/ui/jetpack-compose/modifiers': { fillMaxWidth: modifier('fillMaxWidth'), semantics: modifier('semantics'),
      size: modifier('size'), testID: modifier('testID') },
    'expo-router': { Stack: { Screen: 'Screen' } }, 'expo-symbols': components('SymbolView'),
    'react-native': { ...components('ActivityIndicator RefreshControl ScrollView View'), PlatformColor: value => value },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../preparation/PreparationUI': { ...components('PreparationList PreparationRow PreparationText'), usePreparationText: () => source => source },
    '../preparation/PreparationNotice': components('PreparationNotice'),
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'en' } },
    '../shared/navigation/RoleHeader.android': components('RoleHeader'), '../shared/navigation/RoleHeaderButton': components('RoleHeaderButton'),
    '../shared/notification/notificationDetailModel': load('shared/notification/notificationDetailModel'), './supplierScreenModel': model,
    './useSupplierCreate': { useSupplierPicker: () => picker, useSupplierConfirm: () => confirm },
  }, 'tsx');
  const footer = { type: 'SupplierFooter', props: {} }, props = { session: {}, item, qty: 12.5, record, store: {}, footer,
    onBack: () => calls.push(['back']), onChoose: selected => calls.push(['choose', selected]),
    onContinue: qty => calls.push(['continue', qty]), onSuccess: async value => calls.push(['success', value]),
    onHome: () => calls.push(['home']), ...options.props };
  return { calls, render() { cursor = 0; return renderedNodes(views[screen](props)); } };
}
const texts = nodes => nodes.flatMap(node => typeof node === 'string' || typeof node === 'number' ? [String(node)]
  : node?.type === 'PreparationRow' ? [node.props.title, node.props.subtitle].filter(value => value != null) : []);
const press = node => (node.props.onPress ?? node.props.onClick)();
const button = (nodes, label) => nodes.find(node => node?.props?.label === label ||
  ((node?.type === 'Button' || node?.type === 'TextButton' || node?.type === 'OutlinedButton') && texts(renderedNodes(node)).includes(label)));
const title = nodes => nodes.find(node => node?.type === 'Screen')?.props.options.title ?? nodes.find(node => node?.type === 'RoleHeader')?.props.title;
const back = nodes => {
  const header = nodes.find(node => node?.type === 'Screen');
  return header ? header.props.options.headerLeft().props.onPress : nodes.find(node => node?.type === 'RoleHeader').props.navigation.onPress;
};
const refresh = nodes => nodes.find(node => node?.type === 'PreparationList')?.props.refresh
  ?? nodes.find(node => node?.type === 'ScrollView')?.props.refreshControl?.props.onRefresh;

// Compared with the four Supplier create screens at V2 f11910bb. All route wiring stays held.
for (const platform of ['ios', 'android']) {
  test(`${platform}: picker renders loading, error and both empty cases with retry/refresh`, () => {
    let f = fixture(platform, 'SupplierItemPickerScreen', { state: { loading: true }, items: [] }), nodes = f.render();
    assert.equal(title(nodes), 'Mahsulot tanlash'); assert.ok(nodes.some(node => ['ProgressView', 'ActivityIndicator'].includes(node?.type)));
    assert.equal(refresh(nodes), undefined);
    f = fixture(platform, 'SupplierItemPickerScreen', { state: { error: Error('offline') }, items: [] }); nodes = f.render();
    assert.ok(texts(nodes).includes('serverDisconnectedRetry')); assert.equal(typeof refresh(nodes), 'function');
    press(button(nodes, 'retry')); refresh(nodes)(); assert.deepEqual(f.calls, [['reload'], ['reload']]);
    for (const [query, message] of [['', 'Bu supplierga item biriktirilmagan.'], ['unknown', 'Mahsulot topilmadi.']]) {
      f = fixture(platform, 'SupplierItemPickerScreen', { state: { query }, items: [] }); nodes = f.render();
      assert.ok(texts(nodes).includes(message)); assert.equal(typeof refresh(nodes), 'function');
    }
  });
  test(`${platform}: picker forwards search, clear, choice, back and dock`, () => {
    const blank = { ...item, code: 'NO-NAME', name: '' };
    const f = fixture(platform, 'SupplierItemPickerScreen', { state: { query: 'cot' }, items: [item, blank] }), nodes = f.render();
    const field = nodes.find(node => ['TextField', 'OutlinedTextField'].includes(node?.type));
    (field.props.onTextChange ?? field.props.onValueChange)('new search');
    const clear = nodes.find(node => node?.type === 'IconButton' || (node?.type === 'Button' && node.props.systemImage === 'xmark.circle.fill'));
    press(clear); assert.deepEqual(f.calls.slice(0, 2), [['query', 'new search'], ['query', '']]);
    assert.equal((field.props.text ?? field.props.value).value, '');
    const rows = nodes.filter(node => node?.type === 'PreparationRow' || (node?.type === 'Button' && ['Cotton', 'NO-NAME'].includes(node.props.label)));
    assert.deepEqual(rows.map(row => row.props.title ?? row.props.label), ['Cotton', 'NO-NAME']); rows.forEach(press);
    back(nodes)(); assert.deepEqual(f.calls.slice(2), [['choose', item], ['choose', blank], ['back']]);
    assert.equal(nodes.filter(node => node?.type === 'SupplierFooter').length, 1);
  });
  test(`${platform}: quantity initializes, rejects invalid input and forwards positive input`, () => {
    const f = fixture(platform, 'SupplierQtyScreen', { props: { initialQty: 7.4 } }); let nodes = f.render();
    assert.equal(title(nodes), 'Miqdor'); let field = nodes.find(node => ['TextField', 'OutlinedTextField'].includes(node?.type));
    assert.equal((field.props.text ?? field.props.value).value, '7'); assert.ok(texts(nodes).includes('Cotton')); assert.ok(texts(nodes).includes('kg'));
    for (const value of ['', '0', '-1', 'not a number']) {
      (field.props.onTextChange ?? field.props.onValueChange)(value); nodes = f.render(); press(button(nodes, 'Davom etish'));
    }
    assert.deepEqual(f.calls, []); field = nodes.find(node => ['TextField', 'OutlinedTextField'].includes(node?.type));
    (field.props.onTextChange ?? field.props.onValueChange)(' 12.5 '); nodes = f.render(); press(button(nodes, 'Davom etish')); back(nodes)();
    assert.deepEqual(f.calls, [['continue', 12.5], ['back']]);
    assert.equal(nodes.filter(node => node?.type === 'SupplierFooter').length, 1);
  });
  test(`${platform}: confirmation shows source rows and blocks controls while busy`, () => {
    let f = fixture(platform, 'SupplierConfirmScreen'), nodes = f.render();
    assert.equal(title(nodes), 'Tasdiqlash');
    for (const value of ['Cotton', 'C-1', 'Mahsulot', 'Nomi', 'Miqdor', '12.50 kg', 'Ombor', 'Main']) assert.ok(texts(nodes).includes(value), value);
    press(button(nodes, 'Ha, jo‘natishni saqlash')); press(button(nodes, 'Orqaga qaytish')); back(nodes)();
    assert.deepEqual(f.calls, [['submit'], ['back'], ['back']]);
    f = fixture(platform, 'SupplierConfirmScreen', { submitting: true, props: { item: { ...item, warehouse: ' \u0085 ' } } }); nodes = f.render();
    assert.ok(!texts(nodes).includes('Ombor')); assert.ok(nodes.some(node => ['ProgressView', 'CircularProgressIndicator'].includes(node?.type)));
    back(nodes)(); assert.deepEqual(f.calls, []);
    const dock = nodes.find(node => node?.type === 'SupplierFooter');
    const wrapper = nodes.find(node => node?.type === 'View' && node.props.children === dock);
    assert.equal(wrapper?.props.pointerEvents, 'none');
    const cancel = button(nodes, 'Orqaga qaytish');
    const submit = nodes.find(node => node?.type === 'Button' && renderedNodes(node).some(child =>
      ['ProgressView', 'CircularProgressIndicator'].includes(child?.type)));
    if (platform === 'ios') for (const control of [submit, cancel]) {
      assert.ok(control.props.modifiers.some(modifier => modifier.name === 'disabled' && modifier.args[0] === true));
    } else for (const control of [submit, cancel]) assert.equal(control.props.enabled, false);
  });
  test(`${platform}: success shows receipt and uses home/back callbacks`, () => {
    const f = fixture(platform, 'SupplierSuccessScreen'), nodes = f.render();
    assert.equal(title(nodes), 'Saqlandi'); assert.ok(texts(nodes).includes('R-1')); assert.ok(texts(nodes).includes('C-1 • 12.50 kg'));
    press(button(nodes, 'Home ga qaytish')); back(nodes)(); assert.deepEqual(f.calls, [['home'], ['back']]);
    assert.equal(nodes.filter(node => node?.type === 'SupplierFooter').length, 1);
  });
}
