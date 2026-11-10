import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
import { paddonSnapshotFromJson } from './paddonModels';
/** @v2 unlockPaddon */
export async function unlockPaddon(session: Session, code: string, current?: () => boolean) {
  const normalized = code.trim();
  const raw = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/paddons/unlock', { code: normalized }, null, !!current, 'paddon_unlock', current);
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, any> : null;
  if (!data || data.ok !== true || !data.paddon || typeof data.paddon !== 'object' || Array.isArray(data.paddon))
    throw new WorkerControlException('paddon_unlock', 'Paddon holati tasdiqlanmadi');
  const snapshot = paddonSnapshotFromJson(data);
  if (snapshot.paddon.code !== normalized) throw new WorkerControlException('paddon_unlock', 'Paddon holati tasdiqlanmadi');
  return snapshot;
}
