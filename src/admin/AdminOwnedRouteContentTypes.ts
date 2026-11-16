import type { ReactElement } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminOwnedRouteEntry } from './adminOwnedRoutes';
import type { AdminOwnedRouteProviders } from './AdminOwnedNavigationTypes';

export type AdminOwnedRouteContentProps = {
  session: Session; witness: SessionWitness; entry: AdminOwnedRouteEntry; isCurrent: () => boolean; canInteract: () => boolean;
  backLabel: string; onBack: (changed?: boolean) => void; onLogout: () => void; onNotice: (message: string) => void;
  profileAction: ReactElement; footer: ReactElement; providers: AdminOwnedRouteProviders;
};
