import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUserListEntry } from './adminUsersModel';

export type AdminWorkerProfileScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; entry: AdminUserListEntry;
  canInteract?: () => boolean;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer: ReactNode;
};
