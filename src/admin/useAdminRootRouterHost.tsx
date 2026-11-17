import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactElement } from 'react';
import type { AdminRootPresentationParent, AdminRootPresentationRenderState } from './adminRootPresentationChain';
import { AdminRootRouterScene } from './AdminRootRouterScene';
import type { AdminRootRouterBinding, AdminRootRouterFrame } from './AdminRootRouterTypes';
import type { AdminRootRouterController } from './adminRootRouterController';

function OutletGate({ controller, parent, outlet }: { controller: AdminRootRouterController; parent: AdminRootPresentationParent; outlet: ReactElement }) {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useSyncExternalStore(controller.chain.subscribe, controller.chain.getSnapshot, controller.chain.getSnapshot);
  const child = controller.chain.child(parent); return child && !controller.mayMount(child) ? null : outlet;
}
/** The real navigator frame is committed separately from native onShow/arm/dismiss receipts. */
export function useAdminRootRouterHost(controller: AdminRootRouterController, frame: AdminRootRouterFrame) {
  const renderScene = useCallback((binding: AdminRootRouterBinding, outlet: ReactElement, state: AdminRootPresentationRenderState) => {
    const parent = controller.nativeParent(binding); if (!parent) throw Error('Original native Root parent binding is required');
    return <AdminRootRouterScene controller={controller} binding={binding} state={state} outlet={<OutletGate controller={controller} parent={parent} outlet={outlet} />} />;
  }, [controller]);
  const membership = useRef<{ controller: AdminRootRouterController; renderer: typeof renderScene } | null>(null);
  useLayoutEffect(() => { const detach = controller.attachRenderer(renderScene), original = detach ? { controller, renderer: renderScene } : null; membership.current = original;
    return () => { if (membership.current === original) membership.current = null; detach?.(); }; }, [controller, renderScene]);
  useLayoutEffect(() => { if (membership.current?.controller === controller && membership.current.renderer === renderScene) controller.commitFrame(frame); }, [controller, renderScene, frame]);
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot); const binding = controller.rootScene()?.binding;
  const renderContent = useMemo(() => binding ? (outlet: ReactElement, state: AdminRootPresentationRenderState) => renderScene(binding, outlet, state) : null, [binding, renderScene]);
  const onRequestClose = useCallback(() => { if (binding) controller.requestBack(binding); }, [controller, binding]);
  return { binding, renderContent, onRequestClose };
}
