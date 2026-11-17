/* global __dirname */
const path = require('node:path'), base = require('./adminSupplierDetailViewSupport.cjs'), q = require('./adminProgressQrLookupSupport.cjs');
const numbers = q.load('admin/adminProgressQrTechnicalMaterialPresentation', { './dartJsonString': q.strings });
const projection = q.load('admin/adminProgressQrInfoSectionsPresentation', { './dartJsonString': q.strings, './adminProgressQrTechnicalMaterialPresentation': numbers });
const model = q.load('admin/adminProgressQrInfoSectionModel', { '../shared/camera/synchronousGuard': q.strict, './adminProgressQrInfoSectionsPresentation': projection });
const order = fields => ({ order_number: 'ORDER', title: 'PRODUCT', product_code: 'CODE', customer_name: 'CUSTOMER', roll_count: 3, width_mm: 1.25, order_kg: 4, base_length: 0, ...fields });
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
function fixture(platform, kind = 'order') {
  let current = () => true;
  const ui = new Proxy({ Shape: { RoundedCorner: value => value } }, { get: (target, key) => target[key] ?? String(key) });
  const views = base.compile(path.resolve(__dirname, `../src/admin/AdminProgressQrInfoSections.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Text: 'NativeText', StyleSheet: { create: value => value } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: base.colors }) }, './AdminTypography.android': { AdminText: 'Text', useAdminFontsReady: () => true },
    './adminFontFamily.android': { adminTextStyle: () => ({ fontFamily: 'GoogleSans' }) }, './adminProgressQrInfoSectionModel': model,
  });
  const props = { p: key => base.l10n.productionText(key, 'uz'), isCurrent: () => current(), order: order(), queueStates: new Map([['machine', new Map([['ORDER', 'pending']])]]), apparatusNamesById: new Map([['machine', 'Machine']]) };
  const view = kind === 'order' ? views.AdminProgressQrOrderDetails : views.AdminProgressQrQueueStates;
  return { props, render: () => base.expand(view(props)), current: value => { current = value; } };
}
const values = tree => base.nodes(tree, n => ['Text', 'NativeText'].includes(n.type)).map(n => n.props.children);
module.exports = { ...base, projection, model, order, fixture, values };
