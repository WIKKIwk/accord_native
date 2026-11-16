const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = id => id === 'react/jsx-runtime' ? jsx : Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); return mod.exports;
}
const model = load('admin/adminSettingsController.ts', { './dartJsonString': load('admin/dartJsonString.ts') });
const l10n = load('shared/localization/index.ts', { './catalog.json': require('../src/shared/localization/catalog.json') });
function native(name, slots = []) { const component = props => ({ type: name, props }); slots.forEach(slot => { component[slot] = `${name}.${slot}`; }); return component; }
function render(node) {
  if (Array.isArray(node)) return node.map(render);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return render(node.type(node.props));
  return { ...node, props: { ...node.props, children: render(node.props?.children), header: render(node.props?.header), footer: render(node.props?.footer) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate), ...nodes(node.props?.header, predicate), ...nodes(node.props?.footer, predicate)];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? [text(node.props?.children), text(node.props?.header), text(node.props?.footer)].filter(Boolean).join(' ') : '';
}
function fixture(platform, { phase = 'content', saving = false, additional = true, push = true, locale = 'uz', current = true } = {}) {
  const calls = [], effects = [];
  const state = { phase, fields: Object.fromEntries(model.adminSettingsFieldNames.map(key => [key, `value-${key}`])), fillVersion: 1, saving, changed: false, notice: null };
  const value = { state, current, additional, push, navigation: { icon: 'back', label: 'Back', onPress: () => calls.push('back') },
    change: (name, value) => calls.push(['change', name, value]), reload: () => calls.push('retry'), save: () => calls.push('save'), navigate: route => calls.push(['navigate', route]),
    t: key => l10n.localizedGetter(key, locale), a: key => l10n.adminText(key, locale), p: key => l10n.productionText(key, locale) };
  const modifiers = new Proxy({}, { get: (_obj, key) => (...args) => ({ name: String(key), args }) });
  const controls = { useNativeState: value => ({ get: () => value, set() {} }), useMaterialColors: () => ({ onSurface: 'text', surface: 'bg', onPrimary: 'white' }),
    Shape: { RoundedCorner: value => value }, OutlinedTextField: native('OutlinedTextField', ['Label']),
    ListItem: native('ListItem', ['LeadingContent', 'HeadlineContent', 'TrailingContent']) };
  const ui = new Proxy(controls, { get: (obj, key) => Object.hasOwn(obj, key) ? obj[key] : String(key) });
  const mocks = { react: { useEffect: fn => effects.push(fn), useRef: current => ({ current }) },
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { View: 'View', PlatformColor: value => value, StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../preparation/PreparationNotice': { PreparationNotice: 'PreparationNotice' }, '../shared/appRoutes': { appRoutes: { adminAdditionalSettings: '/additional', adminPushConfig: '/push' } },
    '../shared/navigation/RoleHeader.android': { RoleHeader: 'RoleHeader' }, '../shared/navigation/RoleHeaderButton': { RoleHeaderButton: 'RoleHeaderButton' },
    './adminSettingsController': model, './useAdminSettings': { useAdminSettings: () => value } };
  const View = load(`admin/AdminSettingsScreen.${platform}.tsx`, mocks).AdminSettingsScreen;
  return { tree: render(View({ footer: 'real-dock' })), calls, value, effects };
}
for (const platform of ['ios', 'android']) {
  test(`${platform} settings renders seven native text fields in source order and source capability links`, () => {
    const f = fixture(platform), fields = nodes(f.tree, n => n.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'));
    assert.equal(fields.length, 7); assert.deepEqual(fields.map(node => node.props[platform === 'ios' ? 'text' : 'value'].get()), model.adminSettingsFieldNames.map(key => `value-${key}`));
    fields[1].props[platform === 'ios' ? 'onTextChange' : 'onValueChange']('typed'); assert.deepEqual(f.calls[0], ['change', 'erp_api_key', 'typed']);
    assert.ok(fields.every(node => node.props.visualTransformation === undefined));
    const labels = text(f.tree); assert.ok(labels.includes(l10n.adminText('settings.api_secret', 'uz'))); assert.ok(labels.includes('real-dock'));
    const links = nodes(f.tree, n => platform === 'ios' ? n.type === 'Button' && n.props.modifiers === undefined : n.type === 'ListItem');
    const invoke = node => platform === 'ios' ? node.props.onPress() : node.props.modifiers.find(mod => mod.name === 'combinedClickable').args[0].onClick();
    invoke(links[0]); invoke(links[1]); assert.deepEqual(f.calls.slice(-2), [['navigate', '/additional'], ['navigate', '/push']]);
  });
  test(`${platform} save is native, disabled while saving, and leaves the seven source inputs editable`, () => {
    const f = fixture(platform, { saving: true });
    const button = nodes(f.tree, n => n.type === 'Button' && n.props.modifiers?.some(mod => mod.name === (platform === 'ios' ? 'accessibilityIdentifier' : 'testID') && mod.args[0] === 'admin-settings-save'))[0];
    assert.ok(button); if (platform === 'android') {
      assert.equal(button.props.enabled, false); assert.ok(button.props.modifiers.some(mod => mod.name === 'height' && mod.args[0] === 56));
      assert.deepEqual(Object.values(button.props.shape.cornerRadii), [20, 20, 20, 20]);
    } else assert.ok(button.props.modifiers.some(mod => mod.name === 'disabled' && mod.args[0] === true));
    assert.ok(text(button).includes(l10n.localizedGetter('pinSaving', 'uz')));
    const fields = nodes(f.tree, n => n.type === (platform === 'ios' ? 'TextField' : 'OutlinedTextField'));
    assert.ok(fields.every(node => node.props.enabled !== false));
    if (platform === 'ios') button.props.onPress(); else button.props.onClick(); assert.deepEqual(f.calls, ['save']);
  });
  test(`${platform} source load/error states never expose form credentials; retry uses real owner`, () => {
    const loading = fixture(platform, { phase: 'loading' }); assert.ok(!text(loading.tree).includes('value-erp_api_secret'));
    const failed = fixture(platform, { phase: 'error' }); const retry = nodes(failed.tree, n => n.type === (platform === 'ios' ? 'Button' : 'TextButton'))[0];
    retry.props[platform === 'ios' ? 'onPress' : 'onClick'](); assert.deepEqual(failed.calls, ['retry']);
    assert.equal(nodes(failed.tree, n => n.type === 'TextField' || n.type === 'OutlinedTextField').length, 0);
    assert.equal(nodes(fixture(platform, { current: false }).tree, n => n.type === 'TextField' || n.type === 'OutlinedTextField').length, 0);
  });
  test(`${platform} capability-gated links are omitted and all four locales resolve source field text`, () => {
    for (const locale of ['uz', 'en', 'ru', 'ur']) {
      const f = fixture(platform, { additional: false, push: false, locale });
      assert.ok(text(f.tree).includes(l10n.localizedGetter('erpConnectionTitle', locale)));
      assert.ok(!text(f.tree).includes(l10n.adminText('push.title', locale)));
    }
  });
}
