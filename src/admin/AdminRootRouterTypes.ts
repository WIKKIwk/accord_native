import type { NativeStackDescriptorMap, NativeStackNavigationEventMap, NavigationAction, NavigationState, StandardNavigatorEmit } from 'expo-router';
import type { ReactElement } from 'react';
import type { AdminRootPresentationChain, AdminRootPresentationContent, AdminRootPresentationEntry, AdminRootPresentationOptions, AdminRootPresentationParent, AdminRootPresentationRenderState } from './adminRootPresentationChain';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';

export type AdminRootRouterDescriptor = NativeStackDescriptorMap[string];
/** Same explicit nonpreventable event mapping used by the installed SDK58 native navigator. */
export type AdminRootRouterEventMap = { [Event in keyof NativeStackNavigationEventMap]: NativeStackNavigationEventMap[Event] & { canPreventDefault: false } };
export type AdminRootRouterNavigation = Readonly<{ getState: () => NavigationState | undefined; dispatch: (action: NavigationAction) => void }>;
/** These facts come directly from the real SDK58 standard navigator, never a fabricated scene/context. */
export type AdminRootRouterFrame = Readonly<{
  state: NavigationState; descriptors: Readonly<Record<string, unknown>>; navigation: AdminRootRouterNavigation;
  emit: StandardNavigatorEmit<NativeStackNavigationEventMap>; isPreloaded: (key: string) => boolean; isRemovalPrevented: (key: string) => boolean;
}>;
export type AdminRootRouterBinding = Readonly<{ identity: object; navigatorKey: string; routeKey: string; routeName: string; id: string | null }>;
/** Opaque original Source caller identity. Business arguments/results stay in its genuine typed registry. */
export type AdminRootRouterPage = Readonly<{ id: string; sourceIdentity: object; native: AdminRootPresentationEntry; closed: Promise<'closed' | 'retired'> }>;
export type AdminRootRouterSceneContainerProps = Readonly<{
  binding: AdminRootRouterBinding; nativeParent: AdminRootPresentationParent; sourceScaffoldAncestor: AdminTopNoticeScaffold | null;
  /** Full native scene INCLUDING iOS header and actual descriptor body/footer; preserve it and outlet through retirement. */
  nativeScene: ReactElement; outlet: ReactElement; isCurrent: () => boolean; canInteract: () => boolean; retained: boolean; retired: boolean;
}>;
/** A genuine caller-owned Source Scaffold/Hub/viewport. Invocation and React registration are never a native receipt. */
export type AdminRootRouterSceneContainer = (props: AdminRootRouterSceneContainerProps) => ReactElement;
export type AdminRootRouterPageRequest = Readonly<{
  identity: object; parent: AdminRootPresentationParent; routeName: string; presentation: AdminRootPresentationOptions;
  sourceScaffoldAncestor: AdminTopNoticeScaffold | null; renderSceneContainer: AdminRootRouterSceneContainer;
  /** Original account/parent read lifetime; closing and page blur must not replace it with top-page authority. */
  isCurrent: () => boolean; onRequestClose: () => void;
}>;
export type AdminRootRouterScene = Readonly<{
  binding: AdminRootRouterBinding; route: NavigationState['routes'][number]; descriptor: AdminRootRouterDescriptor; frame: AdminRootRouterFrame;
}>;
export type AdminRootRouterSceneRenderer = (binding: AdminRootRouterBinding, outlet: ReactElement, state: AdminRootPresentationRenderState) => ReactElement;
export type AdminRootRouterRootOptions = Readonly<{
  chain: AdminRootPresentationChain; rootRouteName: string; isCurrent: () => boolean; onRequestClose: () => void;
  sourceScaffoldAncestor: AdminTopNoticeScaffold | null; renderSceneContainer: AdminRootRouterSceneContainer;
}>;
export type AdminRootRouterRootNative = Readonly<{ rootIdentity: object; presentation: AdminRootPresentationOptions }>;
export type AdminRootRouterContent = AdminRootPresentationContent;
