import type { ReactNode } from 'react';
import type { Session } from '../auth';
import type { SupplierStore } from './supplierStore';

export type SupplierNotificationsProps = { session: Session; store: SupplierStore; onOpenDrawer: () => void; onRootBack?: () => void;
  onReceipt?: (id: string) => void; footer?: ReactNode };
