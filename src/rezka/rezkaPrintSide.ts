import type { Session } from '../auth';
import { rezkaMasterSavePrintSide } from '../rezkaMasterSettingsApi';
import { guardedRezkaRequest, type RezkaSessionSnapshot } from './rezkaSessionGuard';

/** Rezka consumers must use this scoped wrapper rather than the unguarded legacy call. */
export function rezkaMasterSavePrintSideGuarded(session: Session, orderId: string, standard: boolean, previous: boolean,
  snapshot: RezkaSessionSnapshot): Promise<void> {
  return guardedRezkaRequest(session, 'master', snapshot, true, beforeSend =>
    rezkaMasterSavePrintSide(session, orderId, standard, previous, beforeSend));
}
