import { createContext, useContext, useLayoutEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { findNodeHandle, StyleSheet, View } from 'react-native';
import { AdminCreateHubSourceLayout } from './AdminCreateHubProvider';
import { AdminShellSourceWindowLayout } from './AdminShellSourceWindowLayoutContext';
import type { AdminSourceDockScaffoldProps } from './AdminSourceDockScaffoldTypes';
import { useAdminSourceDockScaffold } from './useAdminSourceDockScaffold';
type BodyScope = Readonly<{ ready: boolean; canInteract: () => boolean }>;
const BodyContext = createContext<BodyScope | null>(null);

/** REQUIRED around real content BELOW the genuine platform header. Android's custom header and iOS's native header remain outside this held boundary. */
export function AdminSourceDockBody({ children }: { children: ReactNode }) {
  const scope = useContext(BodyContext); if (!scope) throw Error('The original Source dock body scope is required');
  return <View testID="admin-source-scaffold-body" pointerEvents={scope.ready && scope.canInteract() ? 'auto' : 'none'} accessibilityElementsHidden={!scope.ready}
    importantForAccessibility={scope.ready ? 'auto' : 'no-hide-descendants'} style={[styles.root, { opacity: scope.ready ? 1 : 0 }]}>{children}</View>;
}

/** @v2 AppShell.build
 * A full original-window Source Scaffold. Measurement bootstraps from REAL markers; retained scenes/outlets never remount on a held frame.
 */
export function AdminSourceDockScaffold(props: AdminSourceDockScaffoldProps) {
  const { owner, state, matches } = useAdminSourceDockScaffold(props), viewport = useRef<ComponentRef<typeof View> | null>(null), dock = useRef<ComponentRef<typeof View> | null>(null);
  const generation = state.generation, target = state.target, current = () => matches && owner.current(generation);
  useLayoutEffect(() => {
    if (!matches || !owner.current(generation)) return; const tag = findNodeHandle(viewport.current);
    if (typeof tag === 'number' && Number.isInteger(tag) && tag > 0 && owner.current(generation)) owner.bindViewport({ tag, nativeID: owner.viewportID }, generation);
  }, [owner, generation, matches]);
  useLayoutEffect(() => {
    if (!matches || !target || !owner.current(generation)) return; const tag = findNodeHandle(dock.current);
    if (typeof tag === 'number' && Number.isInteger(tag) && tag > 0 && owner.current(generation)) owner.bindDock({ tag, nativeID: target.nativeID }, target, generation);
  }, [owner, generation, matches, target]);
  const request = matches ? owner.hubRequest() : null, ready = matches && owner.hostAvailable(request);
  const nativeHost = owner.nativeHost();
  const canInteract = () => matches && owner.hostAvailable(request) && owner.canInteract(generation), interactive = ready && canInteract(), overlayTop = ready && owner.ownsOverlayTop(request);
  // Only the native receipt supplies the Source Scaffold hostHeight. The semantic target may round in native pixels.
  const layout = owner.sourceLayout(ready);
  const facts = { sizing: target?.sizing ?? null, native: state.native, isCurrent: current, canInteract };
  return <AdminCreateHubSourceLayout layout={layout}><AdminShellSourceWindowLayout owner={owner} thinGestureBottom={props.thinGestureBottom} available={ready}><View ref={viewport} collapsable={false} nativeID={owner.viewportID} style={styles.root} testID="admin-source-scaffold-viewport"
    onLayout={() => { if (!current()) return; const tag = findNodeHandle(viewport.current); if (typeof tag === 'number' && Number.isInteger(tag) && tag > 0 && current()) owner.bindViewport({ tag, nativeID: owner.viewportID }, generation); }}>
    <View testID="admin-source-scaffold-scene" pointerEvents="box-none" style={[styles.scene, { bottom: ready ? state.bodyBottom ?? 0 : 0 }]}>
      <BodyContext.Provider value={{ ready, canInteract }}>{props.nativeScene}</BodyContext.Provider>
    </View>
    {target ? <View key={target.nativeID} ref={dock} collapsable={false} nativeID={target.nativeID} pointerEvents={interactive ? 'box-none' : 'none'}
      accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'} testID="admin-source-scaffold-dock-marker"
      style={[styles.dock, { height: target.sizing.hostHeight, opacity: ready ? 1 : 0 }]}
      onLayout={() => { if (!current()) return; const tag = findNodeHandle(dock.current); if (typeof tag === 'number' && Number.isInteger(tag) && tag > 0 && current()) owner.bindDock({ tag, nativeID: target.nativeID }, target, generation); }}>
      <View pointerEvents="box-none" style={[styles.dock, { height: target.sizing.dockHeight }]}>{props.renderDock(facts)}</View>
      {ready && request && target.primary.visible && nativeHost ? nativeHost.renderPrimary(request) : null}
    </View> : null}
    {overlayTop && request && nativeHost ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="admin-source-scaffold-global-overlay">{nativeHost.renderOverlay(request)}</View> : null}
    {props.outlet}
  </View></AdminShellSourceWindowLayout></AdminCreateHubSourceLayout>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, scene: { position: 'absolute', top: 0, left: 0, right: 0 }, dock: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
