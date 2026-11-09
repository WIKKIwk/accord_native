import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { WorkerControlException } from './workerControlsApi';
const messages: Record<string, string> = { warehouse_assignee_not_allowed: 'Bu rolga ombor biriktirishga server ruxsat bermadi',
  aasx_integrity_failed: 'Aparat AASX ma’lumotlari tekshirilmadi', apparatus_persistence_failed: 'Aparatlar bazadan yuklanmadi',
  apparatus_cutover_blocked: 'Aparatlar canonical ma’lumotlari tayyor emas', apparatus_projection_invalid: 'Aparat ma’lumotlari formati noto‘g‘ri',
  'worker phone already exists': 'Bu telefon raqami boshqa ishchiga biriktirilgan', 'worker not found': 'Ishchi topilmadi',
  'worker store failed': 'Ishchi telefoni bazaga saqlanmadi' };
/** @v2 rezkaMasterSavePrintSide */
export async function rezkaMasterSavePrintSide(session: Session, orderId: string, standard: boolean, previous: boolean,
  beforeSend?: () => void): Promise<void> {
  const response = await authorizedFetch(session, '/v1/mobile/rezka-master/print-side', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, standard_print_side: standard, previous_standard_print_side: previous }) }, beforeSend);
  if (response.status === 200) return;
  let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
  const error = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as { error?: unknown }).error : null;
  const code = typeof error === 'string' && error.trim() ? error.trim() : 'rezka_settings_save_failed';
  const message = code === 'rezka_settings_save_failed' ? `Rezka sozlamalari saqlanmadi (HTTP ${response.status})` : messages[code.toLowerCase()] ?? code;
  throw new WorkerControlException(code, message, response.status);
}
