import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { AdminCustomerDetail } from './adminCustomerDetailModel';
import type { AdminUserListEntry } from './adminUsersModel';

export type AdminCustomerAvatarProps = { avatarUrl: string; fallbackText: string; displayName: string; size: number; isCurrent: () => boolean; canInteract: () => boolean };
export type AdminCustomerApparatusProps = { customerRef: string; materialTaminotchi: boolean; session: Session; witness: SessionWitness;
  isCurrent: () => boolean; isInteractive: () => boolean; onChanged: () => void };
export type AdminCustomerMaterialWarehouseProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; isInteractive: () => boolean;
  principalRole: 'material_taminotchi'; principalRef: string; displayName: string; assignedWarehouses: readonly string[];
  reloadAssignedWarehouses: () => Promise<readonly string[]>; onChanged: (warehouses: readonly string[]) => void;
  assignedMessage: string; chipKeyPrefix: 'admin-material-detail-warehouse-'; addButtonKey: 'admin-material-detail-add-warehouse'; buttonRadius: 14;
};
/** Genuine subordinate owners are required before this held screen can be composed into app routes. */
export type AdminCustomerDetailScreenProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; customerRef: string; entry?: AdminUserListEntry | null; readOnly?: boolean;
  backLabel: string; onBack: (changed: boolean) => void; profileAction: ReactElement; footer?: ReactNode;
  renderAvatar: (props: AdminCustomerAvatarProps) => ReactElement; chatAction?: ReactElement;
  renderApparatusCard: (props: AdminCustomerApparatusProps) => ReactElement;
  renderMaterialWarehouseEditor: (props: AdminCustomerMaterialWarehouseProps) => ReactElement;
  /** Exact source widget overrides; absent values follow AppRouter's entry/material defaults. */
  title?: string; profileSubtitle?: string; emptyName?: string; namelessLabel?: string;
};
export type AdminCustomerPhoneModel = { detail: AdminCustomerDetail; current: () => boolean; interactive: () => boolean;
  savingPhone: boolean; savePhone: (detail: AdminCustomerDetail, input: string) => Promise<boolean> };
