import { captureSessionWitness, isSessionWitnessCurrent, type Session } from '../auth';
import { authorizedFetch } from '../authorizedFetch';
import { preparationOutputNoteFromJson, type PreparationOutputNote } from '../shared/preparationOutputNote';
import { productionNoteText } from '../shared/productionOrderNote';
import { WorkerControlException } from '../workerControlsApi';
import { preparationGuard, preparationResponse } from './preparationRequest';

export const MAX_OUTPUT_NOTE_ROLLS = 100;

export type OutputNoteTarget = { id: string; note: PreparationOutputNote | null };
export type OutputNoteScope = 'batch' | 'rolls';

export async function savePreparationOutputNotes(session: Session, scope: OutputNoteScope, targets: readonly OutputNoteTarget[], draft: string) {
  const text = productionNoteText(draft);
  const revisions = new Map(targets.map(target => [target.id, target.note?.revision ?? 0]));
  const batchId = targets[0]?.id;
  if (!targets.length || revisions.size !== targets.length || targets.length > MAX_OUTPUT_NOTE_ROLLS ||
      (scope === 'batch' && (targets.length !== 1 || !batchId?.startsWith('batch:') || batchId === 'batch:')) ||
      [...revisions].some(([id, rev]) => !id || id !== id.trim() || id.includes('\0') || id.length > 1024 ||
        !Number.isSafeInteger(rev) || rev < 0 || rev >= Number.MAX_SAFE_INTEGER)) {
    throw new Error('Batch yoki rulonlar noto‘g‘ri tanlangan');
  }
  const body = scope === 'batch'
    ? { scope, text, batch_id: batchId, expected_revision: targets[0].note?.revision ?? 0 }
    : { scope, text, rolls: [...revisions].map(([receipt_name, expected_revision]) => ({ receipt_name, expected_revision })) };
  const witness = captureSessionWitness(session), accountGuard = preparationGuard(session, true);
  const guard = () => {
    accountGuard();
    if (!isSessionWitnessCurrent(witness)) throw new WorkerControlException('account_changed', 'Akkaunt o‘zgargan. Sahifani qayta oching');
  };
  guard();
  const response = await authorizedFetch(session, '/v1/mobile/preparation/production/notes', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, guard);
  guard();
  const { notes } = await preparationResponse(response);
  guard();
  if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.keys(notes).length !== revisions.size) {
    throw new Error('Eslatmalar saqlangani tasdiqlanmadi');
  }
  const result = new Map<string, PreparationOutputNote>();
  for (const [id, rev] of revisions) {
    const note = preparationOutputNoteFromJson((notes as Record<string, unknown>)[id]);
    if (!note || note.revision !== rev + 1 || note.text !== text) throw new Error('Eslatmalar saqlangani tasdiqlanmadi');
    result.set(id, note);
  }
  return result;
}
