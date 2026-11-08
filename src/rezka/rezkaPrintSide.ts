import type { Session } from '../auth';
import { rezkaMasterSavePrintSide } from '../rezkaMasterSettingsApi';
import { currentRezkaScope, guardedRezkaRequest } from './rezkaSessionGuard';

/** Rezka consumers must use this scoped wrapper rather than the unguarded legacy call. */
export function rezkaMasterSavePrintSideGuarded(session: Session, orderId: string, standard: boolean, previous: boolean,
  expectedScope = currentRezkaScope(session)): Promise<void> {
  return guardedRezkaRequest(session, 'master', expectedScope, true, beforeSend =>
    rezkaMasterSavePrintSide(session, orderId, standard, previous, beforeSend));
}
