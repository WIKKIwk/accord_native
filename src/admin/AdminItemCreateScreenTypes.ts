import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
import type { AdminItemCreateCustomer } from './adminItemCreateModel';
import type { AdminPrimaryActionProps } from './AdminCreateHubTypes';

/** Real destinations must resolve only after their original native route has unmounted. */
export type AdminItemCreateScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; canInteract?: () => boolean;
  initialTabIndex?: number; initialItemGroup?: string; openCreateDialog?: boolean; returnOnCreate?: boolean;
  onOpenItem?: (item: SupplierItem) => Promise<void>;
  onCreateCustomer?: (initialName: string) => Promise<AdminItemCreateCustomer | null>;
  onReturnCreated?: (item: SupplierItem) => void;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer: ReactNode;
  renderPrimaryAction: (props: AdminPrimaryActionProps) => ReactElement;
};
