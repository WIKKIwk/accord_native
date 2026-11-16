import type { AdminWarehouseMainScreenProps } from './AdminWarehouseMainScreenTypes';

type Owned = 'renderProfileAction' | 'onItemRolls' | 'renderReservedOrderDetails' | 'renderDetailActionSurface' | 'onRawStockQr';
type WithProviders<Props> = Props extends unknown ? Omit<Props, Owned> & {
  /** The genuine profile destination, supplied by the owning navigation boundary. */
  onProfile: () => void;
} : never;

/** Material keeps its real edit/state providers required; this composition does not invent those flows. */
export type AdminWarehouseScreenProps = WithProviders<AdminWarehouseMainScreenProps>;
