import type { ReactNode } from 'react';
import type { Session, SessionWitness } from '../auth';
import type { RawMaterialStock } from '../shared/printApi';
import type { AdminWarehouseStockItem } from './warehouseStockApi';

/** A child keeps this original mounted/account ticket through a legitimate parent-route blur. */
export type AdminWarehouseMainActionContext = { isCurrent: () => boolean; onChanged: () => Promise<void> };
type BaseProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  onBack: () => void; backLabel: string; footer: ReactNode;
  renderProfileAction: (context: { isCurrent: () => boolean; canInteract: () => boolean }) => ReactNode;
  /** Own the real source sheet/read flow; resolve only after that child returns. */
  onItemRolls: (item: AdminWarehouseStockItem, context: AdminWarehouseMainActionContext) => Promise<void>;
  renderReservedOrderDetails: (orderId: string, context: AdminWarehouseMainActionContext) => ReactNode;
  /** Direct native children of the current details sheet, rather than a second first-sheet host. */
  renderDetailActionSurface?: () => ReactNode;
};
/** Providers own the complete source child flow, including its errors/notices, until dismissal. */
type QrProps = { onRawStockQr: (stock: RawMaterialStock, orderId: string, context: AdminWarehouseMainActionContext) => Promise<void> };
export type AdminWarehouseMainScreenProps = BaseProps & (
  | ({ scope: 'admin' } & QrProps)
  | { scope: 'werka' }
  | ({ scope: 'material'; /** Own edit sheet, confirmed update, parent onChanged and source notice. */
      onRawStockEdit: (stock: RawMaterialStock, context: AdminWarehouseMainActionContext) => Promise<void>;
      materialStates: { render: (context: { query: string; onAssetReturned: () => Promise<void>; isCurrent: () => boolean }) => ReactNode;
        search: (query: string) => void; reload: () => Promise<void> } } & QrProps)
);
