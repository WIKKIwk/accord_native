/* global __dirname */
const path = require('node:path'), base = require('./adminSupplierDetailViewSupport.cjs'), info = require('./adminProgressQrInfoSectionsSupport.cjs'), technical = require('./adminProgressQrTechnicalMaterialSupport.cjs');
const lower = technical.q.load('admin/adminProgressQrSourceLowercase');
const projection = technical.q.load('admin/adminProgressQrMaterialSectionsPresentation', { './dartJsonString': technical.q.strings,
  './adminProgressQrTechnicalMaterialPresentation': technical.projection, './adminProgressQrInfoSectionsPresentation': info.projection, './adminProgressQrSourceLowercase': lower });
const model = technical.q.load('admin/adminProgressQrMaterialSectionModel', { '../shared/camera/synchronousGuard': technical.q.strict, './adminProgressQrMaterialSectionsPresentation': projection });
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
function fixture(platform, kind = 'status') {
  const ui = new Proxy({ Shape: { RoundedCorner: value => value, Circle: value => ({ type: 'CircleShape', ...value }) } }, { get: (target, key) => target[key] ?? String(key) });
  const card = base.compile(path.resolve(__dirname, `../src/admin/AdminProgressQrInfoSections.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { Text: 'NativeText', StyleSheet: { create: value => value } },
    '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' }, '../components/useBaseTheme': { useBaseTheme: () => ({ colors: base.colors }) },
    './AdminTypography.android': { AdminText: 'Text', useAdminFontsReady: () => true }, './adminFontFamily.android': { adminTextStyle: () => ({ fontFamily: 'GoogleSans' }) }, './adminProgressQrInfoSectionModel': info.model,
  });
  const views = base.compile(path.resolve(__dirname, `../src/admin/AdminProgressQrMaterialSections.${platform}.tsx`), { [`./AdminProgressQrInfoSections.${platform}`]: card, './adminProgressQrMaterialSectionModel': model });
  let current = () => true;
  const props = { report: technical.report(), queueState: 'pending', assignment: null, orderTitle: '', orderNumber: '', apparatusNamesById: new Map(), p: (key, values) => base.l10n.productionText(key, 'uz', values), isCurrent: () => current() };
  const view = kind === 'status' ? views.AdminProgressQrMaterialStatus : views.AdminProgressQrMaterialAssignment;
  return { props, render: () => base.expand(view(props)), current: value => { current = value; } };
}
module.exports = { ...base, projection, model, lower, report: technical.report, fixture, values: info.values };
