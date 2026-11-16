const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const base = require('./adminItemDetailViewsSupport.cjs'), s = require('./adminItemDetailDecisionSupport.cjs');
function fixture(platform = 'android', options = {}) {
  const r = base.runtime(), { react, jsx } = r, f = s.fixture(options.deps, options.detail), closes = [], buffers = [];
  const colors = { surface: '#FFFFFF', surfaceContainerLow: '#F8F8F8', surfaceContainerHigh: '#EEEEEE', surfaceContainerHighest: '#FEFEFE', outlineVariant: '#CCCCCC', onSurface: '#111111', onSurfaceVariant: '#555555', primary: '#3344CC', onPrimary: '#FFFFFF', primaryContainer: '#DDEEFF', onPrimaryContainer: '#113366', error: '#BA1A1A', onError: '#FFFFFF' };
  function NativeState(initial) { return { value: initial, reads: 0, get() { this.reads++; if (this.released) throw Error('released'); return this.value; }, set(value) { this.value = value; } }; }
  const nativeStateHook = initial => { const ref = react.useRef(null); if (!ref.current) { ref.current = NativeState(initial); buffers.push(ref.current); } return ref.current; };
  const modifiers = new Proxy({}, { get: (_, type) => (...args) => ({ type, args }) });
  const field = Object.assign(props => jsx.jsx('OutlinedTextField', props), { Label: 'FieldLabel', LeadingIcon: 'LeadingIcon', TrailingIcon: 'TrailingIcon' });
  const ui = new Proxy({ useNativeState: nativeStateHook, Shape: { RoundedCorner: value => ({ type: 'rounded', value }) } }, { get: (target, key) => key in target ? target[key] : String(key) });
  function FlatList(props) { return jsx.jsx('FlatList', { ...props, children: props.data.map((item, index) => jsx.jsxs('Fragment', { children: [index && props.ItemSeparatorComponent ? jsx.jsx(props.ItemSeparatorComponent, {}) : null, props.renderItem({ item, index })] }, props.keyExtractor(item))) }); }
  const mocks = { react, 'react/jsx-runtime': jsx, 'react-native': { View: 'View', ScrollView: 'ScrollView', FlatList, StyleSheet: { create: value => value } },
    '@expo/ui/jetpack-compose': ui, '@expo/ui/jetpack-compose/modifiers': modifiers, '@expo/ui/swift-ui': ui, '@expo/ui/swift-ui/modifiers': modifiers,
    'expo-symbols': { SymbolView: 'SymbolView' }, '../components/BaseHost.android': { BaseHost: 'BaseHost' }, '../components/BaseHost.ios': { BaseHost: 'BaseHost' },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors, mode: options.mode ?? 'light', direction: options.direction ?? 'ltr' }) },
    './AdminTextFields.android': { AdminOutlinedTextField: field }, './AdminTypography.android': { AdminText: 'Text' }, './AdminLoadingIndicator.android': { AdminLoadingIndicator: 'AdminLoadingIndicator' },
    '../shared/camera/synchronousGuard': s.sync, './dartJsonString': s.strings, './adminItemDetailGroupModel': s.group,
  };
  const loaded = new Map();
  function moduleFor(name) { if (loaded.has(name)) return loaded.get(name); const filename = path.resolve(__dirname, '../src/admin', name), mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths;
    mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('./AdminItemDetail') ? moduleFor(id.slice(2) + (fs.existsSync(path.resolve(__dirname, '../src/admin', id.slice(2) + '.tsx')) ? '.tsx' : '.ts')) : require(id);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename); loaded.set(name, mod.exports); return mod.exports; }
  const lifetime = moduleFor('AdminItemDetailDecisionContentOwner.ts'), customer = moduleFor('AdminItemDetailCustomerContentOwner.ts');
  let props, model, live = true, top = true;
  const current = () => live, canInteract = () => top, onCloseRequested = value => { closes.push(value); options.onClose?.(value); };
  async function open(kind) { await f.start(); const detail = f.owner.getSnapshot().detail;
    if (kind === 'edit') f.owner.requestEdit(detail); else if (kind === 'delete') f.owner.requestDelete(detail); else if (kind === 'group') await f.owner.requestGroup(detail); else f.owner.requestCustomers(detail);
    const dialog = f.owner.getSnapshot().dialogs.at(-1);
    props = { surfaceIdentity: {}, controller: f.owner, dialogId: dialog.id, kind, generation: f.owner.interactionGeneration, isCurrent: current, canInteract, onCloseRequested,
      a: (key, values) => key + (values ? JSON.stringify(values) : ''), t: key => `common.${key}`, ...(['group', 'customers'].includes(kind) ? { viewport: { width: 400, height: 800, paddingBottom: 24 } } : {}) };
    return dialog;
  }
  function Harness(value) { model = value.kind === 'customers' ? customer.useAdminItemDetailCustomerContent(value) : lifetime.useAdminItemDetailDecisionContent(value); return jsx.jsx('Model', { model }); }
  const content = kind => moduleFor(`${kind === 'customers' ? 'AdminItemDetailCustomerContent' : 'AdminItemDetailDecisionContent'}.${platform}.tsx`)[kind === 'customers' ? 'AdminItemDetailCustomerContent' : 'AdminItemDetailDecisionContent'];
  return { ...r, f, closes, buffers, colors, jsx, moduleFor, lifetime, customer, open, props: changes => { props = { ...props, ...changes }; }, propsValue: () => props,
    read: () => { r.render(jsx.jsx(Harness, props)); return model; }, model: () => model,
    renderContent: () => r.render(jsx.jsx(content(props.kind), props)), current: value => { live = value; }, top: value => { top = value; },
    activate: () => f.owner.activateCustomers(props.dialogId), dialog: () => f.dialog(props.dialogId), ack: () => f.owner.completeClose(closes.at(-1)),
  };
}
const modifier = (node, type) => node.props.modifiers?.find(value => value.type === type)?.args;
const press = node => { if (!node) throw Error('missing native action'); (node.props.onClick ?? node.props.onPress)(); };
const submit = node => modifier(node, 'onSubmit')?.[0]();
function text(tree) { if (tree == null || typeof tree === 'boolean') return ''; if (Array.isArray(tree)) return tree.map(text).join('|'); if (typeof tree !== 'object') return String(tree); return (tree.props?.label ?? '') + text(tree.props?.children); }
module.exports = { ...base, s, fixture, modifier, press, submit, text };
