/* global __dirname */
const path = require('node:path'), base = require('./adminSupplierDetailViewSupport.cjs'), q = require('./adminProgressQrLookupSupport.cjs');
const projection = q.load('admin/adminProgressQrTechnicalMaterialPresentation', { './dartJsonString': q.strings });
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
const report = fields => q.model.adminProgressQrMaterialReportFromJson({ barcode: 'BAR', warehouse: 'WAREHOUSE', item_code: 'CODE', item_name: 'NAME', item_group: 'GROUP', qty: 2.5, uom: ' kg ', status: 'available', source_receipt_id: 'RECEIPT', reserved_order_id: 'RESERVED', ...fields });
function fixture(platform = 'android', fields = {}) {
  const r = base.runtime(); let current = () => true, top = () => true;
  const hook = base.compile(path.resolve(__dirname, '../src/admin/useAdminProgressQrTechnicalMaterial.ts'), { react: r.react, '../shared/camera/synchronousGuard': q.strict, './adminProgressQrTechnicalMaterialPresentation': projection });
  const disclosure = Object.assign(props => ({ type: 'DisclosureGroup', props }), { Label: 'DisclosureLabel' });
  const ui = new Proxy({ DisclosureGroup: disclosure, Shape: { RoundedCorner: value => value } }, { get: (target, key) => target[key] ?? String(key) });
  const view = base.compile(path.resolve(__dirname, `../src/admin/AdminProgressQrTechnicalMaterial.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Text: 'NativeText', View: 'View', StyleSheet: { create: value => value } }, 'expo-symbols': { SymbolView: 'SymbolView' },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: base.colors }) },
    './AdminTypography.android': { AdminText: 'Text', useAdminFontsReady: () => true }, './adminFontFamily.android': { adminTextStyle: () => ({ fontFamily: 'GoogleSans' }) },
    './useAdminProgressQrTechnicalMaterial': hook,
  }).AdminProgressQrTechnicalMaterial;
  const props = { sectionIdentity: {}, report: report(fields), apparatusNamesById: new Map(), p: key => base.l10n.productionText(key, 'uz'), isCurrent: () => current(), canInteract: () => top() };
  return { props, r, render: () => r.render(() => base.expand(view(props))), current: value => { current = value; }, top: value => { top = value; } };
}
const node = (tree, suffix) => base.byId(tree, `admin-qr-material-${suffix}`);
const expand = (tree, platform, value = true) => { const toggle = node(tree, 'technical-toggle'); platform === 'android' ? toggle.props.onClick() : toggle.props.onIsExpandedChange(value); };
const values = tree => base.nodes(tree, n => ['Text', 'NativeText'].includes(n.type)).map(n => n.props.children);
module.exports = { ...base, q, projection, report, fixture, node, expand, values };
