import type { Session } from './auth';
import { postWorkerApiRequest, WorkerControlException } from './workerControlsApi';
/** @v2 transferPaddonItems */
export async function transferPaddonItems(session: Session, sourceCode: string, targetCode: string, progressBatchIds: string[], current?: () => boolean): Promise<void> {
  const source = sourceCode.trim(), target = targetCode.trim(), ids = [...new Set(progressBatchIds.map(id => id.trim()))];
  if (!source || !target || source === target || source.length > 128 || target.length > 128 || !ids.length || ids.length > 500 || ids.includes(''))
    throw new WorkerControlException('paddon_invalid_input', 'Invalid paddon transfer');
  const raw = await postWorkerApiRequest(session, '/v1/mobile/admin/production-maps/paddons/items/transfer',
    { source_code: source, target_code: target, progress_batch_ids: ids }, null, !!current, 'paddon_transfer', current);
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, any> : null, returned = data?.progress_batch_ids;
  if (!data || data.ok !== true || data.source_code !== source || data.target_code !== target || !Array.isArray(returned) ||
      returned.length !== ids.length || new Set(returned).size !== ids.length || ids.some(id => !returned.includes(id)))
    throw new WorkerControlException('paddon_transfer', 'Paddon transfer was not confirmed');
}
