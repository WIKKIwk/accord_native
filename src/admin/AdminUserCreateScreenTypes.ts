import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminUserCreateCustomer } from './adminUserCreateModel';

type Common = { session: Session; witness: SessionWitness; isCurrent: () => boolean; canInteract?: () => boolean; onBack: () => void; backLabel: string; onProfile: () => void };
export type AdminUserCreateScreenProps = Common & (
  | { mode: 'general'; footer: ReactNode }
  | { mode: 'customer'; initialName?: string; onCreated: (customer: AdminUserCreateCustomer) => void }
);
