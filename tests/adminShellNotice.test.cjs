/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { deferred, flush } = require('./adminUsersSupport.cjs');
function fixture() {
  const query = deferred(), effects = [], shown = [], facts = [];
  let accessible = null, listener, removed = false, source = null;
  const owner = { messenger: {}, show: message => shown.push(message) }, shell = { session: {}, witness: {}, isCurrent: () => true };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const mocks = { 'react/jsx-runtime': jsx,
    react: { createContext: () => ({ Provider: 'OriginalNoticeContext' }), useContext: () => owner, useMemo: callback => callback(),
      useState: () => [accessible, value => { accessible = value; }], useEffect: callback => effects.push(callback), useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() },
    'react-native': { AccessibilityInfo: { addEventListener: (name, callback) => { assert.equal(name, 'screenReaderChanged'); listener = callback; return { remove: () => { removed = true; } }; },
      isScreenReaderEnabled: () => query.promise }, ActivityIndicator: 'NativeLoading', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 4, right: 6 }) },
    '../shared/localization': { localizedGetter: key => key }, '../shared/localization/runtime': { localeController: { locale: 'uz' } },
    './AdminShellContext': { useAdminShell: () => shell }, './AdminShellSourceWindowLayoutContext': { useAdminShellSourceWindowLayout: () => source },
    './AdminTopNoticeHost': { AdminTopNoticeHost: 'InlineNoticeHost' }, './AdminTopNoticeProvider': { AdminTopNoticeProvider: 'OriginalMessengerDriver' },
    './adminTopNoticeSession': { createAdminTopNoticeSession: value => { facts.push(value); return owner; } },
    './useAdminTopNoticeScaffold': { useAdminTopNoticeScaffold: ancestor => { assert.equal(ancestor, null); return { ticket: {} }; } } };
  const filename = path.resolve(__dirname, '../src/admin/AdminShellNoticeProvider.tsx'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod.require = id => mocks[id] ?? require(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return { api: mod.exports, shell, owner, query, effects, shown, facts,
    emit: value => listener(value), isRemoved: () => removed, source: value => { source = value; } };
}
test('one original account Messenger waits for real accessibility state and an older initial query cannot override an event', async () => {
  const f = fixture(), render = () => f.api.AdminShellNoticeProvider({ children: 'RealStack' });
  assert.equal(render().props.children.props.children, 'RealStack');
  assert.equal(render().props.children.props.accessibleNavigation, null); const cleanup = f.effects[0]();
  assert.equal(f.facts[0].session, f.shell.session); assert.equal(f.facts[0].witness, f.shell.witness);
  f.emit(true); f.query.resolve(false); await flush();
  const tree = render(); assert.equal(tree.props.value, f.owner);
  assert.equal(tree.props.children.type, 'OriginalMessengerDriver'); assert.equal(tree.props.children.props.accessibleNavigation, true);
  assert.equal(tree.props.children.props.children, 'RealStack'); cleanup(); assert.equal(f.isRemoved(), true);
  f.emit(false); assert.equal(render().props.children.props.accessibleNavigation, true);
});
test('native accessibility initialization failure retains the actual stack without fabricating accessible-navigation readiness', async () => {
  const f = fixture(); f.api.AdminShellNoticeProvider({ children: 'RealStack' }); const cleanup = f.effects[0]();
  f.query.reject(Error('native query failed')); await flush();
  const tree = f.api.AdminShellNoticeProvider({ children: 'RealStack' });
  assert.equal(tree.props.children.props.children, 'RealStack'); assert.equal(tree.props.children.props.accessibleNavigation, null);
  assert.equal(tree.props.children.props.retainChildrenWhileUnresolved, true); cleanup();
});
test('notice host uses real route-root ancestry and never substitutes Activity geometry for unknown Source window facts', () => {
  const f = fixture(), notice = f.api.useAdminShellNotice();
  assert.deepEqual(notice.topNotice.props.inlineInsets, { left: 4, right: 6 });
  notice.onErrorNotice('Source failure'); notice.showTopNotice('Saved', 'success');
  assert.deepEqual(f.shown, [{ message: 'Source failure', tone: 'error' }, { message: 'Saved', tone: 'success', icon: undefined }]);
  f.source({ safeInsets: null }); assert.equal(f.api.useAdminShellNotice().topNotice.props.inlineInsets, null);
  f.source({ safeInsets: { left: 13, right: 17 } }); assert.deepEqual(f.api.useAdminShellNotice().topNotice.props.inlineInsets, { left: 13, right: 17 });
});
