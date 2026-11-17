import { captureSessionWitness, isSessionWitnessCurrent, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { productionNoteText, productionOrderNoteFromJson } from '../shared/productionOrderNote';
import { WorkerControlException } from '../workerControlsApi';
import { preparationGuard, preparationResponse } from './preparationRequest';

export async function savePreparationProductionNote(session: Session, orderId: string, text: string, expectedRevision: number) {
  const id = orderId.trim(), normalized = productionNoteText(text);
  if (!id || id.length > 512 || id.includes('\0')) throw new Error('Buyurtma tanlanmagan');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Eslatma versiyasi noto‘g‘ri');
  }
  const witness = captureSessionWitness(session), accountGuard = preparationGuard(session, true);
  const guard = () => {
    accountGuard();
    if (!isSessionWitnessCurrent(witness)) throw new WorkerControlException('account_changed', 'Akkaunt o‘zgargan. Sahifani qayta oching');
  };
  guard();
  const response = await authorizedFetch(session, '/v1/mobile/preparation/production/order/note', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: id, text: normalized, expected_revision: expectedRevision }),
  }, guard);
  guard();
  const data = await preparationResponse(response);
  guard();
  const note = productionOrderNoteFromJson(data.preparation_note, id);
  if (note.revision !== expectedRevision + 1 || note.text !== normalized) throw new Error('Eslatma saqlangani tasdiqlanmadi');
  guard();
  return note;
}
