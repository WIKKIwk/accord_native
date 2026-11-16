import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminSupplierItemsScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; supplierRef: string; mode: 'add' | 'view';
  canInteract?: () => boolean;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer: ReactNode;
};
export type AdminSupplierItemsPageProps = Omit<AdminSupplierItemsScreenProps, 'mode'>;
