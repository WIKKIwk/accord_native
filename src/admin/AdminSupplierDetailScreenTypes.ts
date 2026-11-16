import type { ReactElement, ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';

export type AdminSupplierDetailAvatarProps = {
  avatarUrl: string; fallbackText: string; size: number; isCurrent: () => boolean; canInteract: () => boolean;
  /** Source avatar preview title; AdminProfileAvatar defaults this to the initials. */
  displayName: string;
};
type Common = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean; supplierRef: string;
  onBack: (changed: boolean) => void; backLabel: string; footer?: ReactNode;
  profileAction: ReactElement; renderAvatar: (props: AdminSupplierDetailAvatarProps) => ReactElement; chatAction?: ReactElement;
};
export type AdminSupplierDetailScreenProps = Common & (
  { readOnly: true; onViewItems?: never; onAddItem?: never } |
  { readOnly?: false; onViewItems: (rawSupplierRef: string) => void | Promise<unknown>; onAddItem: (rawSupplierRef: string) => void | Promise<unknown> }
);
