/* global __dirname */
const path = require('node:path'), React = require('react'), source = require('./adminItemCreateSessionSupport.cjs'), view = require('./adminSupplierDetailViewSupport.cjs'), notices = require('./adminTopNoticeSupport.cjs');
const { flattenStyle } = require('./adminShellFrameViewSupport.cjs');
function fixture(platform = 'android', overrides = {}) {
  const f = source.fixture(overrides), r = view.runtime(), listeners = new Set(), frames = new Map(), fixed = [], fixedHosts = [], leaf = {}, locale = { locale: 'uz', addListener: () => () => {} };
  const clock = source.scheduler(), service = new notices.service.AdminTopNoticeService({ setTimer: clock.set, clearTimer: clock.clear });
  const messenger = new notices.messenger.AdminTopNoticeMessenger({ isCurrent: f.owner.current, subscribeCurrent: callback => { listeners.add(callback); return () => listeners.delete(callback); } }), driver = {}; messenger.attachDriver(driver, false);
  const progress = { value: 1, get() { return this.value; } }; let focused = true, top = true, hookCalls = 0, latest = null, serial = 0;
  const oldFrame = global.requestAnimationFrame, oldCancel = global.cancelAnimationFrame; global.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; }; global.cancelAnimationFrame = id => frames.delete(id);
  const sourceLayout = { metrics: { platform, width: 390, height: 844, viewInsetsBottom: 0, viewPaddingBottom: 20, systemGestureInsetsBottom: 20 }, hostHeight: 199 };
  let hubAvailable = true, noticeAvailable = true, safeAvailable = true, sourceWindowScope = null;
  const safe = { top: 24, left: 11, right: 23, bottom: 20 }, props = { ...f.props, canInteract: () => top, backLabel: 'Back', topNoticeDismissLabel: 'Source localized dismiss', profileAction: React.createElement('GenuineProfileAction'), footer: React.createElement('GenuineDock'), sourceScaffoldAncestor: null,
    fixedSnackBars: { isAvailable: () => true, enqueue: value => fixed.push(value), render: host => { fixedHosts.push(host); return React.createElement('GenuineFixedSnackBarHost', host); } },
    renderPrimaryAction: value => React.createElement('GenuineRootPrimaryAction', value),
    dialogPortal: { isAvailable: () => true, render: value => React.createElement('GenuineOriginalDialogPortal', value) }, windowObserver: { arm() {}, waitForDetach() {}, cancelPending() {}, cancel() {} }, ...overrides.screenProps };
  const owned = source.load('admin/adminItemCreateScreenBoundary', { react: React, '../shared/camera/synchronousGuard': source.strict });
  const safeContext = { current: safe }, inlineSafe = view.compile(path.resolve(__dirname, '../src/admin/AdminShellInlineSafeArea.tsx'), {
    react: { ...r.react, useContext: context => context.current }, 'react-native': { View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', SafeAreaInsetsContext: safeContext },
    './AdminShellSourceWindowLayoutContext': { useAdminShellSourceWindowLayout: () => sourceWindowScope } });
  const hook = view.compile(path.resolve(__dirname, '../src/admin/useAdminItemCreate.ts'), { react: r.react,
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => r.react.useEffect(callback, [callback]) }, 'react-native': { Platform: { OS: platform }, Keyboard: { dismiss() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '../auth': { subscribeSessionWitness: callback => { listeners.add(callback); return () => listeners.delete(callback); } }, '../shared/localization': source.l10n, '../shared/localization/runtime': { localeController: locale }, '../shared/profileSessionGuard': source.profile,
    './AdminOwnedBackContext': { useAdminOwnedBack() {} }, './adminItemCreateSession': f.factory, './dartJsonString': source.strings });
  const scaffold = source.load('admin/useAdminTopNoticeScaffold', { react: r.react, './AdminTopNoticeProvider': { useAdminTopNoticeTarget: () => { if (!noticeAvailable) throw Error('genuine TopNotice provider required'); return { messenger, progress }; } } });
  const bridge = source.load('admin/useAdminItemCreateNoticePresentation', { react: r.react, '../shared/localization': source.l10n, '../shared/localization/runtime': { localeController: locale }, '../shared/camera/synchronousGuard': source.strict, './adminTopNoticeRuntime': { adminTopNoticeService: service } });
  const nativeLeaf = (name, id) => value => { leaf[id] = value; return { type: name, props: value }; };
  const assembly = view.compile(path.resolve(__dirname, `../src/admin/AdminItemCreateScreen.${platform}.tsx`), { react: r.react,
    'expo-router': { Stack: { Screen: 'Stack.Screen' } }, 'react-native': { View: 'View', StyleSheet: { create: value => value } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => { if (!safeAvailable) throw Error('genuine SafeArea provider required'); return safe; } },
    '../components/useBaseTheme': { useBaseTheme: () => ({ colors: view.colors }) }, './AdminCreateHubProvider': { useAdminCreateHubScaffoldLayout: () => { if (!hubAvailable) throw Error('genuine Hub provider required'); return sourceLayout; } },
    './AdminItemCreateHeader.android': { AdminItemCreateHeader: nativeLeaf('GenuineNativeHeader', 'header') }, './AdminItemCreateHeader.ios': { AdminItemCreateHeader: nativeLeaf('GenuineNativeHeader', 'header') },
    './AdminItemCreateList.android': { AdminItemCreateList: nativeLeaf('GenuineNativeCatalogList', 'list') }, './AdminItemCreateList.ios': { AdminItemCreateList: nativeLeaf('GenuineNativeCatalogList', 'list') },
    './AdminItemCreateOverlays.android': { AdminItemCreateOverlays: nativeLeaf('GenuineNativeOverlays', 'overlays') }, './AdminItemCreateOverlays.ios': { AdminItemCreateOverlays: nativeLeaf('GenuineNativeOverlays', 'overlays') },
    './AdminItemCreatePrimaryAction.android': { AdminItemCreatePrimaryAction: nativeLeaf('GenuineNativePrimaryAction', 'primary') }, './AdminItemCreatePrimaryAction.ios': { AdminItemCreatePrimaryAction: nativeLeaf('GenuineNativePrimaryAction', 'primary') },
    './AdminItemCreateScaffold': { AdminItemCreateScaffold: value => ({ type: 'SourceBodyFrame', props: { children: value.children(sourceLayout.metrics === null || sourceLayout.hostHeight === null ? null : sourceLayout.hostHeight + 240) } }) },
    './AdminTopNoticeHost': { AdminTopNoticeHost: nativeLeaf('GenuineInlineTopNoticeHost', 'notice') }, './adminItemCreateScreenBoundary': owned,
    './AdminShellInlineSafeArea': inlineSafe,
    './useAdminItemCreate': { useAdminItemCreate: value => { hookCalls++; latest = hook.useAdminItemCreate(value); return latest; } }, './useAdminItemCreateNoticePresentation': bridge, './useAdminTopNoticeScaffold': scaffold });
  return { ...f, r, props, locale, sourceLayout, safe, messenger, service, clock, fixed, fixedHosts, leaf, hookCalls: () => hookCalls, model: () => latest,
    render: () => r.render(() => view.expand(assembly.AdminItemCreateScreen(props))), focus: value => { focused = value; }, top: value => { top = value; },
    hubAvailable: value => { hubAvailable = value; }, noticeAvailable: value => { noticeAvailable = value; }, safeAvailable: value => { safeAvailable = value; safeContext.current = value ? safe : null; }, sourceWindowScope: value => { sourceWindowScope = value; },
    notify: () => [...listeners].forEach(callback => callback()), frame: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    cleanup: () => { r.unmount(); messenger.retire(); global.requestAnimationFrame = oldFrame; global.cancelAnimationFrame = oldCancel; } };
}
module.exports = { ...source, ...view, fixture, flattenStyle };
