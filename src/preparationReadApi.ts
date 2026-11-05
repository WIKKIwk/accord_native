import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;
function preparationKey(session: Session): string {
  if (session.profile?.role !== 'tayyorlov_masteri' || typeof session.profile?.ref !== 'string' || !session.profile.ref ||
      !session.capabilities?.includes('preparation.access')) throw new WorkerControlException('forbidden', 'Tayyorlov masteri huquqi kerak');
  return `preparation.pending.v1:${session.baseUrl}:${session.profile.ref}`;
}
async function readPreparation(session: Session, path: string) {
  const key = preparationKey(session), guard = () => { if (preparationKey(session) !== key) throw new Error('Akkaunt o‘zgargan'); };
  const response = await authorizedFetch(session, path, {}, guard); guard();
  let raw: unknown; try { raw = await response.json(); } catch { raw = null; }
  const data = object(raw);
  if (response.status !== 200 || !data) throw new WorkerControlException('preparation_request_failed',
    typeof data?.error === 'string' ? data.error : 'Tayyorlov ma’lumotlari olinmadi. Qayta urinib ko‘ring', response.status);
  return data;
}
/** @v2 PreparationResponsibility */
export function preparationResponsibilityFromJson(value: unknown) {
  const row = object(value);
  if (!row || (row.material_id != null && typeof row.material_id !== 'string') ||
      (row.material_name != null && typeof row.material_name !== 'string') || (row.estimated_kg != null && typeof row.estimated_kg !== 'string'))
    throw new TypeError('Invalid preparation responsibility');
  return { material_id: (row.material_id ?? '').trim(), material_name: (row.material_name ?? '').trim(), estimated_kg: row.estimated_kg ?? null };
}
/** @v2 preparationOrderMaterials */
export async function preparationOrderMaterials(session: Session, orderId: string) {
  const id = orderId.trim(); if (!id) throw new WorkerControlException('preparation_invalid', 'Order topilmadi');
  const query = new URLSearchParams({ order_id: id });
  const data = await readPreparation(session, `/v1/mobile/preparation/order-materials?${query}`);
  return Array.isArray(data.materials) ? data.materials.filter(object).map(preparationResponsibilityFromJson) : [];
}
