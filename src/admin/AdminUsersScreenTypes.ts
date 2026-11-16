import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUsersDetailTicket } from './adminUsersController';

/** The future owning shell supplies real navigation and its guarded profile/avatar/account-switch action. */
export type AdminUsersScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer?: ReactNode;
  onOpenUser: (ticket: AdminUsersDetailTicket) => Promise<boolean>;
};
export type AdminUsersRow = Readonly<{ key: string; id: string; title: string; subtitle: string; revision: string;
  index: number; count: number; entering: boolean; exiting: boolean }>;
