import { StackRouter, createStandardRouterNavigator, type NativeStackNavigationOptions, type NavigatorContentProps, type NavigationState } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';
import { AdminRootPresentationRootCarrier } from './AdminRootPresentation.ios';
import type { AdminRootRouterController } from './adminRootRouterController';
import type { AdminRootRouterEventMap, AdminRootRouterNavigation, AdminRootRouterRootNative } from './AdminRootRouterTypes';
import { useAdminRootRouterHost } from './useAdminRootRouterHost';

type Props = { controller: AdminRootRouterController; nativeRoot: AdminRootRouterRootNative };
type Facts = { actualState: NavigationState; actualNavigation: AdminRootRouterNavigation; isPreloaded: (key: string) => boolean; isRemovalPrevented: (key: string) => boolean };
function Content(props: NavigatorContentProps<NativeStackNavigationOptions, AdminRootRouterEventMap, Props, Facts>) {
  const frame = useMemo(() => ({ state: props.actualState, descriptors: props.descriptors, navigation: props.actualNavigation, emit: props.emitter.emit, isPreloaded: props.isPreloaded, isRemovalPrevented: props.isRemovalPrevented }), [props.actualState, props.descriptors, props.actualNavigation, props.emitter, props.isPreloaded, props.isRemovalPrevented]);
  const host = useAdminRootRouterHost(props.controller, frame); if (!host.renderContent) return null;
  return <AdminRootPresentationRootCarrier chain={props.controller.chain} {...props.nativeRoot} renderContent={host.renderContent} onRequestClose={host.onRequestClose} />;
}
/** iOS headers are actual NativeStackView scenes inside the genuine UIKit Root presentation. */
const NativeRouter = createStandardRouterNavigator(Content, StackRouter, {
  createProps: ({ state, navigation, isPreloaded, isRemovalPrevented }) => ({ actualState: state, actualNavigation: navigation, isPreloaded, isRemovalPrevented }),
});

/** Source page States remain mounted through blur; React Activity must not pause their owned effects. */
export const AdminRootRouter = Object.assign(function AdminRootRouter(props: Omit<ComponentProps<typeof NativeRouter>, 'activityEnabled'>) {
  return <NativeRouter {...props} activityEnabled={false} />;
}, { Screen: NativeRouter.Screen, Protected: NativeRouter.Protected });
