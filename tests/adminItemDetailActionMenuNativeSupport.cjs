/* global __dirname */
const path = require('node:path');
const domain = require('./adminItemDetailDecisionSupport.cjs');
const base = require('./adminSupplierDetailViewSupport.cjs');
const modifiers = new Proxy({}, { get: (_target, name) => (...args) => ({ name: String(name), args }) });
async function fixture(platform, kind = 'finished', locale = 'uz') {
  const f = domain.fixture({}, domain.detail({ is_finished_goods: true, item_group: kind === 'combo' ? 'Kombo' : 'Tayyor mahsulot' })); await f.start();
  const controller = domain.menus.createAdminItemDetailActionMenus(f.owner); controller.start();
  const ticket = controller.request(f.initial), r = base.runtime(), closes = []; let interact = () => true, mode = 'light';
  const hook = domain.load('admin/useAdminItemDetailActionMenuContent', { react: r.react,
    '../shared/camera/synchronousGuard': domain.sync, './adminItemDetailActionMenuModel': domain.menuModel });
  const native = new Proxy({ Shape: { RoundedCorner: value => value } }, { get: (target, name) => target[name] ?? String(name) });
  const view = base.compile(path.resolve(__dirname, `../src/admin/AdminItemDetailActionMenuContent.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': native, '@expo/ui/swift-ui': native, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, 'react-native': { ScrollView: 'RN.ScrollView', StyleSheet: { create: value => value } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: base.colors, mode }) }, './AdminTypography.android': { AdminText: 'Text' },
    './useAdminItemDetailActionMenuContent': hook,
  }).AdminItemDetailActionMenuContent;
  const props = { controller, ticket, generation: controller.interactionGeneration, canInteract: () => interact(), onCloseRequested: close => closes.push(close), a: key => domain.l10n.adminText(key, locale) };
  return { ...f, controller, ticket, props, closes, r, render: () => r.render(() => base.expand(view(props))), interact: value => { interact = value; }, mode: value => { mode = value; } };
}
const rows = tree => base.nodes(tree, node => ['TextButton', 'Button'].includes(node.type));
const press = (row, platform) => row.props[platform === 'android' ? 'onClick' : 'onPress']();
const rowID = row => row.props.modifiers.find(modifier => ['testID', 'accessibilityIdentifier'].includes(modifier.name)).args[0];
const disabled = (row, platform) => platform === 'android' ? row.props.enabled === false : row.props.modifiers.some(value => value.name === 'disabled' && value.args[0] === true);
module.exports = { ...domain, ...base, fixture, rows, press, rowID, disabled };
