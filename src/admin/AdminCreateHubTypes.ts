import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminMenuAction } from './adminCreateMenuController';
import type { AdminCreateHubController, AdminCreateHubSnapshot } from './adminCreateHubController';
import type { adminCreateHubLayout } from './adminCreateHubModel';

export type AdminCreateHubProviderProps = {
  children: ReactNode; session: Session; witness: SessionWitness;
  /** Root account/mounted authority, independent from the opening page's focus. */
  isCurrent: () => boolean;
  isRouteAvailable: (route: string) => boolean;
  onOpenRoute: (route: string) => void | Promise<void>;
  /** Actual named profile-route presence, including an obscured profile lower in the active stack. */
  profileOnStack: boolean;
  /** One global owner with per-original-window native hosts. This mode never reads/paints the legacy Activity layout. */
  sourceWindows?: boolean;
};
export type AdminPrimaryActionProps = { isCurrent: () => boolean; canInteract: () => boolean;
  showPrimaryFab?: boolean; actions?: readonly AdminMenuAction[]; replacement?: ReactElement };
export type AdminCreateHubNativeProps = {
  controller: AdminCreateHubController; state: AdminCreateHubSnapshot;
  primary: ReturnType<AdminCreateHubController['primary']>;
  layout: ReturnType<typeof adminCreateHubLayout>;
  labels: { trigger: string; closed: string; close: string };
};
