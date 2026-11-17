import { isValidElement, useLayoutEffect, useMemo, useSyncExternalStore, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdminRootPresentationRenderState } from './adminRootPresentationChain';
import { AdminRootRouterPageProvider } from './AdminRootRouterContext';
import type { AdminRootRouterBinding, AdminRootRouterScene as Scene } from './AdminRootRouterTypes';
import type { AdminRootRouterController } from './adminRootRouterController';

/** No ScreenContainer/NativeStack is mounted inside Android's ComponentDialog. */
function NativeScene({ controller, binding, scene }: { controller: AdminRootRouterController; binding: AdminRootRouterBinding; scene: Scene | null }) {
  useLayoutEffect(() => controller.attachScene(binding) ?? undefined, [controller, binding]); return <View style={styles.fill}>{scene?.descriptor.render()}</View>;
}
export function AdminRootRouterScene({ controller, binding, outlet, state }: { controller: AdminRootRouterController; binding: AdminRootRouterBinding; outlet: ReactElement; state: AdminRootPresentationRenderState }) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot); const scene = controller.scene(binding);
  const authority = useMemo(() => ({ isCurrent: () => controller.readCurrent(binding), canInteract: () => controller.canInteract(binding) }), [controller, binding]);
  const container = controller.container(binding), nativeParent = controller.nativeParent(binding); if (!container || !nativeParent) return null;
  const wrapped = container.render({ binding, nativeParent, sourceScaffoldAncestor: container.sourceScaffoldAncestor, nativeScene: <NativeScene controller={controller} binding={binding} scene={scene} />, outlet, ...authority, retained: state.retained, retired: state.retired });
  if (!isValidElement(wrapped)) throw TypeError('A genuine Source scene container retaining its native scene/outlet is required');
  return <View style={styles.fill} pointerEvents={state.interactive ? 'auto' : 'none'}><AdminRootRouterPageProvider controller={controller} binding={binding}>{wrapped}</AdminRootRouterPageProvider></View>;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
