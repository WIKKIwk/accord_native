import type { ReactNode } from 'react';
import type { Session } from '../auth';
import type { SupplierItem } from '../shared/catalogApi';
import type { DispatchRecord } from '../shared/notificationApi';
import type { SupplierStore } from './supplierStore';

export type SupplierPickerProps = { session: Session; onBack: () => void; onChoose: (item: SupplierItem) => void; footer?: ReactNode };
export type SupplierQtyProps = { item: SupplierItem; initialQty?: number; onBack: () => void; onContinue: (qty: number) => void; footer?: ReactNode };
export type SupplierConfirmProps = { session: Session; store: SupplierStore; item: SupplierItem; qty: number;
  onBack: () => void; onSuccess: (record: DispatchRecord) => Promise<void>; footer?: ReactNode };
export type SupplierSuccessProps = { record: DispatchRecord; onBack: () => void; onHome: () => void; footer?: ReactNode };
