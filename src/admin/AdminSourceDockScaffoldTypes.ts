import type { ReactElement } from 'react';
import type { AdminFixedSnackBarReaderOwner, AdminScaffoldLayoutBindingSnapshot } from './adminFixedSnackBarReader';
import type { AdminTopNoticeScaffoldBinding } from './useAdminTopNoticeScaffold';
import type { AdminCreateHubController, AdminCreateHubSnapshot, AdminCreateHubTicket } from './adminCreateHubController';
import type { AdminTopNoticeScaffold } from './adminTopNoticeModel';
import type { AdminSourceDockPrimary, AdminSourceDockSizing } from './adminSourceDockScaffoldPolicy';

export type AdminSourceDockHubRequest = Readonly<{
  controller: AdminCreateHubController; ticket: AdminCreateHubTicket; primary: AdminSourceDockPrimary; state: AdminCreateHubSnapshot;
  windowIdentity: object; sizing: AdminSourceDockSizing;
  /** Original account/page/window read authority, independent of expected own overlay blur. */
  isCurrent: () => boolean;
  /** New footer-primary intent requires the genuine page top plus known geometry. */
  canOpenPrimary: () => boolean;
}>;
/** Required actual SAME global Hub/native-window placement. No default, inferred page focus or per-page overlay owner exists here. */
export type AdminSourceDockHubNativeHost = Readonly<{
  identity: object;
  /** Proves this original ticket/window's actual FAB/footer placement and global-overlay membership are resolved (the overlay may belong to another window). */
  isAvailable: (request: AdminSourceDockHubRequest) => boolean;
  /** Actual own accepted overlay top, distinct from the page's top callback. */
  ownsOverlayTop: (request: AdminSourceDockHubRequest) => boolean;
  renderPrimary: (request: AdminSourceDockHubRequest) => ReactElement;
  /** Full-window host. It must never be clipped/shrunk into the footer marker. */
  renderOverlay: (request: AdminSourceDockHubRequest) => ReactElement;
}>;
export type AdminSourceDockRenderFacts = Readonly<{
  sizing: AdminSourceDockSizing | null; native: AdminScaffoldLayoutBindingSnapshot | null;
  isCurrent: () => boolean; canInteract: () => boolean;
}>;
export type AdminSourceDockScaffoldProps = Readonly<{
  identity: object; reader: AdminFixedSnackBarReaderOwner; scaffold: AdminTopNoticeScaffoldBinding;
  /** Exact logical ancestor supplied to the caller's genuine Source Scaffold hook. */
  sourceScaffoldAncestor: AdminTopNoticeScaffold | null;
  isCurrent: () => boolean; canInteract: () => boolean;
  /** Original global Hub registration. Null/unknown keeps Source geometry held. */
  primaryTicket: AdminCreateHubTicket | null;
  /** Actual Source navigation-mode fact; no safe-area or zero fallback. */
  thinGestureBottom: boolean | null;
  /** Entire real native scene including iOS header. Actual content below the platform header must use AdminSourceDockBody; Android's custom header also stays outside that held boundary. */
  nativeScene: ReactElement; outlet: ReactElement;
  renderDock: (facts: AdminSourceDockRenderFacts) => ReactElement;
  /** Explicitly unavailable until genuine original-window FAB/global-overlay placement exists. */
  hubNativeHost: AdminSourceDockHubNativeHost | null;
}>;
