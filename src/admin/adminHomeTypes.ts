import type { ReactNode } from 'react';
import type { Session } from '../auth';
import type { AdminHomeRefreshHub } from './adminHomeController';
import type { AdminStore } from './adminStore';

/** The shell supplies a store and navigation bound to the current session and scope. */
export type AdminHomeScreenProps = {
  session: Session;
  store: AdminStore;
  hub: AdminHomeRefreshHub;
  openRoute: (route: string) => Promise<void>;
  /** Only real, safely integrated destinations may be displayed or opened. */
  isRouteAvailable: (route: string) => boolean;
  navigation: { icon: 'menu' | 'back'; label: string; onPress: () => void; testID?: string } | null;
  footer?: ReactNode;
};
