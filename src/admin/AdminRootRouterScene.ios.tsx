import { NativeStackView } from 'expo-router';
import { isValidElement, useMemo, useSyncExternalStore, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AdminRootPresentationRenderState } from './adminRootPresentationChain';
import { AdminRootRouterPageProvider } from './AdminRootRouterContext';
import type { AdminRootRouterBinding, AdminRootRouterScene as Scene } from './AdminRootRouterTypes';
import type { AdminRootRouterController } from './adminRootRouterController';
import { useAdminRootRouterSceneMembership } from './useAdminRootRouterSceneMembership';

/** Native header/search controller for this EXACT real route. No placeholder anchor, second body, or synthetic focus.
 * One physical root screen has no previous native Screen: automatic Back/edge-pop remain unsupported. Source pages must provide their genuine explicit headerLeft/onBack.
 */
function NativeScene({ controller, binding, scene }: { controller: AdminRootRouterController; binding: AdminRootRouterBinding; scene: Scene | null }) {
  useAdminRootRouterSceneMembership(controller, binding, scene !== null);
  return scene ? <NativeStackView state={{ index: 0, routes: [scene.route] }} descriptors={{ [binding.routeKey]: scene.descriptor }}
      emit={event => { if (controller.readCurrent(binding) && (event.target === undefined || event.target === binding.routeKey)) scene.frame.emit(event); }}
      isPreloaded={scene.frame.isPreloaded} isRemovalPrevented={scene.frame.isRemovalPrevented} pop={(count, source) => controller.requestBack(binding, source, count)} /> : null;
}
export function AdminRootRouterScene({ controller, binding, outlet, state }: { controller: AdminRootRouterController; binding: AdminRootRouterBinding; outlet: ReactElement; state: AdminRootPresentationRenderState }) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot); const scene = controller.resourceScene(binding);
  const authority = useMemo(() => ({ isCurrent: () => controller.sourceCurrent(binding), canInteract: () => controller.canInteract(binding) }), [controller, binding]);
  const container = controller.container(binding), nativeParent = controller.nativeParent(binding); if (!container || !nativeParent) return null;
  const wrapped = container.render({ binding, nativeParent, sourceScaffoldAncestor: container.sourceScaffoldAncestor, nativeScene: <NativeScene controller={controller} binding={binding} scene={scene} />, outlet, ...authority, retained: state.retained, retired: state.retired });
  if (!isValidElement(wrapped)) throw TypeError('A genuine Source scene container retaining its native scene/outlet is required');
  return <View style={styles.fill} pointerEvents={state.interactive ? 'auto' : 'none'}><AdminRootRouterPageProvider controller={controller} binding={binding}>{wrapped}</AdminRootRouterPageProvider></View>;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
