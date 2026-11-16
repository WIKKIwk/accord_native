import type { Session, SessionWitness } from '../auth';

/** Isolated dialog only; the parent owns Warehouse reload and modal lifetime. No route is exposed. */
export type AdminWarehouseCreateProps = {
  session: Session; witness: SessionWitness; isCurrent: () => boolean;
  onSaved: () => Promise<void>; onClose: () => void;
};
