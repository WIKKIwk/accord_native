import type { AdminWorkMapController, AdminWorkMapDetailTicket } from './adminWorkMapController';

/** Compose raw witnesses; the reader owns strict validation. Nesting its non-reentrant validator rejects valid reads. */
export function adminWorkMapDetailWitness(isCurrent: () => boolean, controller: Pick<AdminWorkMapController, 'detailIsCurrent'>,
  ticket: AdminWorkMapDetailTicket): () => boolean {
  return () => {
    const result = isCurrent();
    // Forward malformed/async results unchanged so the reader's validator fails closed and observes rejections.
    return result === true ? controller.detailIsCurrent(ticket) : result;
  };
}
