import { MobileApiException } from '../shared/mobileApiException';

// V2's _adminApiException uses known server codes verbatim and exposes unknown codes as the message.
export async function adminApiError(response: Response, fallbackCode: string, fallbackMessage: string): Promise<MobileApiException> {
  let code = fallbackCode, message = fallbackMessage, details: string[] = [];
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const row = payload as Record<string, unknown>;
      const error = typeof row.error === 'string' ? row.error.trim() : '';
      if (error) {
        code = error;
        const messages: Record<string, string> = {
          warehouse_assignee_not_allowed: 'Bu rolga ombor biriktirishga server ruxsat bermadi',
          aasx_integrity_failed: 'Aparat AASX ma’lumotlari tekshirilmadi',
          apparatus_persistence_failed: 'Aparatlar bazadan yuklanmadi',
          apparatus_cutover_blocked: 'Aparatlar canonical ma’lumotlari tayyor emas',
          apparatus_projection_invalid: 'Aparat ma’lumotlari formati noto‘g‘ri',
          'worker phone already exists': 'Bu telefon raqami boshqa ishchiga biriktirilgan',
          'worker not found': 'Ishchi topilmadi',
          'worker store failed': 'Ishchi telefoni bazaga saqlanmadi',
        };
        message = messages[error.toLowerCase()] ?? error;
        if (code === 'rezka_worker_has_open_run' && Array.isArray(row.blocked_apparatus_ids)) {
          details = row.blocked_apparatus_ids.filter((item): item is string => typeof item === 'string');
        }
      }
    }
  } catch { /* Preserve V2's fallback on invalid JSON. */ }
  if (message === fallbackMessage) message = `${fallbackMessage} (HTTP ${response.status})`;
  return new MobileApiException({ code, message, statusCode: response.status, details });
}
