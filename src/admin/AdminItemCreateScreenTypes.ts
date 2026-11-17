import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
import type { AdminItemCreateCustomer } from './adminItemCreateModel';
import type { AdminPrimaryActionProps } from './AdminCreateHubTypes';
import type { AdminItemCreateDialog } from './adminItemCreateFormController';
import type { AdminItemCreatePicker } from './adminItemCreateController';
import type { AdminItemCreateMovePrompt } from './adminItemCreateListController';

export type AdminItemCreateOwnedSurface = Readonly<{ kind: 'dialog'; dialog: AdminItemCreateDialog }> |
  Readonly<{ kind: 'picker'; picker: AdminItemCreatePicker }> | Readonly<{ kind: 'move'; prompt: AdminItemCreateMovePrompt }>;

/** Real destinations must resolve only after their original native route has unmounted. */
export type AdminItemCreateScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; canInteract?: () => boolean;
  /** Opt-in genuine OWN native surface top/ready/not-closing authority for these exact original domain objects.
   * Expected page blur does not retire an accepted dialog/picker. Never substitute page focus or a constant available guard.
   * Absent preserves the existing page interaction contract; this does not create a presenter or a native receipt.
   */
  canInteractOwnedSurface?: (surface: AdminItemCreateOwnedSurface) => boolean;
  initialTabIndex?: number; initialItemGroup?: string; openCreateDialog?: boolean; returnOnCreate?: boolean;
  onOpenItem?: (item: SupplierItem) => Promise<void>;
  onCreateCustomer?: (initialName: string) => Promise<AdminItemCreateCustomer | null>;
  onReturnCreated?: (item: SupplierItem) => void;
  onBack: () => void; backLabel: string; profileAction: ReactElement; footer?: ReactNode;
  renderPrimaryAction: (props: AdminPrimaryActionProps) => ReactElement;
};
