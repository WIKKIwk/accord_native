import type { ReactNode } from 'react';
import type { SupplierItem } from '../shared/catalogApi';
import type { SupplierCategory } from './supplierScreenModel';
import type { SupplierStatusKind } from './supplierApi';
import type { SupplierStore } from './supplierStore';

type Shell = { store: SupplierStore; footer?: ReactNode };
export type SupplierHomeProps = Shell & { onOpenDrawer: () => void; onStatus: (kind: SupplierStatusKind) => void; onReceipt?: (id: string) => void };
export type SupplierRecentProps = Shell & { onOpenDrawer: () => void; onRepeat?: (item: SupplierItem, quantity: number) => void };
export type SupplierBreakdownProps = Shell & { kind: SupplierStatusKind; onBack: () => void; onCategory: (category: SupplierCategory) => void;
  onDetail: (kind: SupplierStatusKind, itemCode: string, itemName: string) => void };
export type SupplierCategoryProps = Shell & { category: SupplierCategory; onBack: () => void; onReceipt?: (id: string) => void };
export type SupplierStatusDetailProps = Shell & { kind: SupplierStatusKind; itemCode: string; itemName: string; onBack: () => void; onReceipt?: (id: string) => void };
