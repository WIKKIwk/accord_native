import { dartTrim } from '../shared/dartApparatus';
import { MobileApiException } from '../shared/mobileApiException';
import { materialHistoryErrorMessages } from './materialHistoryErrorMessages';
import { materialHistoryJsonText as jsonText, materialHistoryOptionalText } from './materialHistoryValueText';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as JsonObject : null;

const text = (value: unknown): string => dartTrim(materialHistoryOptionalText(value));
function integer(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError();
  return Math.trunc(value);
}
function diagnosticNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)$/.test(raw)) return null;
  return /^[+-]?NaN$/.test(raw) ? NaN : Number(raw);
}
function millimeters(value: number): string {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return `${value.toFixed(value === rounded ? 0 : 1)} mm`;
}
function widthMismatch(order: number | null, roll: number | null, minimum: number | null, maximum: number | null): string {
  const min = minimum ?? order;
  if (min === null || roll === null) return 'Bu rulon bu buyurtma uchun mos emas';
  if (roll < min) return `Mos emas: rulon eni ${millimeters(roll)}; talab qilinadigan minimum ${millimeters(min)}.`;
  if (maximum !== null) return `Mos emas: rulon eni ${millimeters(roll)}; ruxsat etilgan oraliq ${millimeters(min)}–${millimeters(maximum)}.`;
  return `Rulon eni ${millimeters(roll)}, buyurtma talabi ${millimeters(min)}. Bu rulon mos emas`;
}
function assignmentLocked(title: string, status: string): string {
  const location = title ? `“${title}” buyurtmasida` : 'bu buyurtmada';
  switch (dartTrim(status).toLowerCase()) {
    case 'in_use': return `Bu homashyo ${location} hozir ishlatilmoqda. Ulanishni uzib bo‘lmaydi`;
    case 'consumed': return `Bu homashyo ${location} ishlatilgan. Ulanishni uzib bo‘lmaydi`;
    default: return title ? `Bu homashyo “${title}” buyurtmasi uchun band. Ulanishni uzib bo‘lmaydi`
      : 'Bu homashyo allaqachon ishga tushgan yoki ishlatilgan, uzib bo‘lmaydi';
  }
}

/** History-only projection of f119 _adminProductionMapException: earlyClose false, raw_material_history fallback. */
export function materialHistoryResponseError(response: { status: number; headers?: Pick<Headers, 'get'> }, payload: unknown): MobileApiException {
  let code = 'raw_material_history', apparatusOptions: string[] = [], details: string[] = [], orderTitle = '', rawMaterialStatus = '', apparatusName = '', serverMessage = '';
  let orderWidth: number | null = null, rollWidth: number | null = null, minimumWidth: number | null = null, maximumWidth: number | null = null;
  let activeKadrCount: number | null = null, scannedKadrCount: number | null = null, diagnostics: JsonObject = {};
  let requestId = response.headers?.get('x-request-id') ?? null;
  try {
    const row = object(payload);
    if (row) {
      if (typeof row.error === 'string' && dartTrim(row.error)) code = dartTrim(row.error);
      if (Array.isArray(row.apparatus_options)) apparatusOptions = row.apparatus_options.map(value => dartTrim(jsonText(value))).filter(Boolean);
      if (Array.isArray(row.blockers)) details = row.blockers.flatMap(value => {
        const blocker = object(value), message = blocker ? text(blocker.message) : '';
        return message ? [message] : [];
      });
      diagnostics = row;
      serverMessage = text(row.message ?? row.detail ?? '');
      if (requestId === null && row.request_id != null) requestId = jsonText(row.request_id);
      apparatusName = text(row.apparatus_name); orderTitle = text(row.order_title); rawMaterialStatus = text(row.raw_material_status);
      orderWidth = diagnosticNumber(row.order_width_mm); rollWidth = diagnosticNumber(row.roll_width_mm);
      minimumWidth = diagnosticNumber(row.minimum_width_mm); maximumWidth = diagnosticNumber(row.maximum_width_mm);
      activeKadrCount = integer(row.active_kadr_count); scannedKadrCount = integer(row.scanned_kadr_count);
    }
  } catch { /* V2 keeps fields assigned before a malformed diagnostic aborts decoding. */ }

  const normalized = dartTrim(code).toLowerCase();
  let message: string;
  if (Object.hasOwn(materialHistoryErrorMessages, normalized)) message = materialHistoryErrorMessages[normalized];
  else switch (normalized) {
    case 'rezka_frame_groups_invalid': message = serverMessage || 'Kesish rejasidagi kadrlar taqsimoti mos emas. Production mapdagi Rezka tugunlari va kadr sonini tekshiring.'; break;
    case 'merge_input_frame_count_mismatch': message = activeKadrCount !== null && scannedKadrCount !== null
      ? `Merge qilinmadi: joriy rulon ${activeKadrCount} kadr, scan qilingan WIP ${scannedKadrCount} kadr. Bir xil kadrli WIPni scan qiling`
      : 'Merge qilinmadi: scan qilingan WIPning kadr soni joriy rulon bilan bir xil emas'; break;
    case 'order_delete_blocked': message = details.length ? details.join('\n') : 'Buyurtmani o‘chirib bo‘lmaydi'; break;
    case 'raw_material_assignment_locked': message = assignmentLocked(orderTitle, rawMaterialStatus); break;
    case 'raw_material_already_assigned': message = orderTitle ? `Bu homashyo “${orderTitle}” buyurtmasi uchun band qilingan` : 'Bu homashyo boshqa zakaz uchun band qilingan'; break;
    case 'raw_material_roll_size_mismatch': message = widthMismatch(orderWidth, rollWidth, minimumWidth, maximumWidth); break;
    case 'progress_batch_already_used': message = `Bu rulon ${apparatusName ? `${apparatusName} apparatida ` : ''}allaqachon ishlatilgan. Qayta ish boshlash uchun ishlatilmagan rulon QR sini skanerlang.`; break;
    case 'progress_batch_in_use': message = `Bu rulon hozir ${apparatusName ? `${apparatusName} apparatida ` : ''}ishlatilmoqda. Uni qayta ishga olib bo‘lmaydi.`; break;
    case 'store_failed': case 'production_map_store_failed': message = 'Production map ma’lumotlarini saqlashda server xatosi'; break;
    default: {
      const operation = 'Homashyo tarixi yuklanmadi', statusCode = response.status;
      const retryAdvice = statusCode >= 500 ? '. Serverda vaqtinchalik muammo yuz berdi. Keyinroq qayta urinib ko‘ring.'
        : '. Oynani yangilang va qayta urinib ko‘ring.';
      message = normalized === 'raw_material_history' ? `${operation}${retryAdvice}`
        : `${operation}. Server xato kodi: ${code} (HTTP ${statusCode})${retryAdvice}`;
    }
  }
  return new MobileApiException({ code, message, statusCode: response.status, apparatusOptions, details, activeKadrCount,
    scannedKadrCount, orderTitle, requestId, diagnostics });
}
