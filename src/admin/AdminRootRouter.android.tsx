import { StackRouter, createStandardRouterNavigator, type NativeStackNavigationOptions, type NavigatorContentProps, type NavigationState } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';
import type { AdminPresentationWindowObserver } from './adminPresentationWindow';
import { AdminRootPresentationRootCarrier } from './AdminRootPresentation.android';
import type { AdminRootRouterController } from './adminRootRouterController';
import type { AdminRootRouterEventMap, AdminRootRouterNavigation, AdminRootRouterRootNative } from './AdminRootRouterTypes';
import { useAdminRootRouterHost } from './useAdminRootRouterHost';

type Props = { controller: AdminRootRouterController; nativeRoot: AdminRootRouterRootNative; windowObserver: AdminPresentationWindowObserver };
type Facts = { actualState: NavigationState; actualNavigation: AdminRootRouterNavigation; isPreloaded: (key: string) => boolean; isRemovalPrevented: (key: string) => boolean };
function Content(props: NavigatorContentProps<NativeStackNavigationOptions, AdminRootRouterEventMap, Props, Facts>) {
  const frame = useMemo(() => ({ state: props.actualState, descriptors: props.descriptors, navigation: props.actualNavigation, emit: props.emitter.emit, isPreloaded: props.isPreloaded, isRemovalPrevented: props.isRemovalPrevented }), [props.actualState, props.descriptors, props.actualNavigation, props.emitter, props.isPreloaded, props.isRemovalPrevented]);
  const host = useAdminRootRouterHost(props.controller, frame); if (!host.renderContent) return null;
  return <AdminRootPresentationRootCarrier chain={props.controller.chain} {...props.nativeRoot} windowObserver={props.windowObserver} renderContent={host.renderContent} onRequestClose={host.onRequestClose} />;
}
/** Real file-based logical stack, rendered once per original Root carrier; not mounted by any current Admin layout. */
const NativeRouter = createStandardRouterNavigator(Content, StackRouter, {
  createProps: ({ state, navigation, isPreloaded, isRemovalPrevented }) => ({ actualState: state, actualNavigation: navigation, isPreloaded, isRemovalPrevented }),
});

/** Source page States remain mounted through blur; React Activity must not pause their owned effects. */
export const AdminRootRouter = Object.assign(function AdminRootRouter(props: Omit<ComponentProps<typeof NativeRouter>, 'activityEnabled'>) {
  return <NativeRouter {...props} activityEnabled={false} />;
}, { Screen: NativeRouter.Screen, Protected: NativeRouter.Protected });
