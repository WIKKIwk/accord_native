/* global __dirname */
const path = require('node:path'), base = require('./adminSupplierDetailViewSupport.cjs'), lookup = require('./adminProgressQrLookupSupport.cjs');
const modifiers = new Proxy({}, { get: (_, name) => (...args) => ({ name: String(name), args }) });
const Buffer = () => ({ value: '', reads: 0, get() { this.reads++; if (this.released) throw Error('released'); return this.value; }, set(value) { this.value = value; } });
async function fixture(platform = 'android', locale = 'uz', reuse = {}) {
  const f = reuse.lookup ?? lookup.fixture(); if (!reuse.lookup) { f.start(); await lookup.flush(); }
  f.focus(() => true); const ticket = f.controller.issueManual(), r = base.runtime(), closes = [], buffer = reuse.buffer ?? Buffer();
  let current = () => true, top = () => true, model;
  const owner = base.compile(path.resolve(__dirname, '../src/admin/AdminProgressQrManualContentOwner.ts'), { react: r.react, '../shared/camera/synchronousGuard': lookup.strict });
  const field = Object.assign(props => ({ type: 'Field', props }), { Label: 'FieldLabel', Placeholder: 'FieldPlaceholder' });
  const ui = new Proxy({}, { get: (_, key) => key === 'useNativeState' ? () => { throw Error('Dialog must not recreate the page native buffer'); } : String(key) });
  const content = base.compile(path.resolve(__dirname, `../src/admin/AdminProgressQrManualContent.${platform}.tsx`), {
    '@expo/ui/jetpack-compose': ui, '@expo/ui/swift-ui': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui/modifiers': modifiers,
    'react-native': { StyleSheet: { create: value => value } }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: base.colors }) }, './AdminTypography.android': { AdminText: 'Text' },
    './AdminItemDetailDecisionNative.android': { DecisionField: field, decisionRounded: radius => radius },
    './AdminProgressQrManualContentOwner': { useAdminProgressQrManualContent: props => (model = owner.useAdminProgressQrManualContent(props)) },
  }).AdminProgressQrManualContent;
  const props = { surfaceIdentity: {}, controller: f.controller, ticket, buffer, isCurrent: () => current(), canInteract: () => top(), onCloseRequested: close => closes.push(close), p: key => base.l10n.productionText(key, locale) };
  f.focus(() => false); // The real manual dialog covers the logical scanner page.
  return { ...f, props, r, closes, buffer, ticket, owner, render: () => r.render(() => base.expand(content(props))), model: () => model,
    surface: value => { current = value; }, top: value => { top = value; }, ack: () => f.controller.completeManualRaw(ticket, closes.at(-1).rawValue) };
}
const id = (tree, name) => base.byId(tree, `admin-progress-qr-manual-${name}`);
const submit = (node, platform, raw) => platform === 'android' ? node.props.keyboardActions.onDone(raw) : node.props.modifiers.find(value => value.name === 'onSubmit').args[0]();
const apiCalls = f => f.calls.filter(([kind]) => ['primary', 'paddon', 'opening', 'material'].includes(kind));
module.exports = { ...base, lookup, fixture, id, submit, apiCalls, Buffer };
