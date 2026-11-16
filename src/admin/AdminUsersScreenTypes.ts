import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUsersDetailTicket } from './adminUsersController';
export type AdminUsersNavigationLifetime = Readonly<{ isCurrent: () => boolean; canInteract: () => boolean }>;

/** The future owning shell supplies real navigation and its guarded profile/avatar/account-switch action. */
export type AdminUsersScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  canInteract?: () => boolean;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer?: ReactNode;
  onOpenUser: (ticket: AdminUsersDetailTicket, lifetime: AdminUsersNavigationLifetime) => Promise<boolean>;
};
export type AdminUsersRow = Readonly<{ key: string; id: string; title: string; subtitle: string; revision: string;
  index: number; count: number; entering: boolean; exiting: boolean }>;
