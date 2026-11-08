import type { Session } from '../auth';
import { MobileApiException } from '../shared/mobileApiException';
import { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
import { adminProductionRequest, type AdminRequestGuard } from './adminProductionRequest';
import { dartTrim } from './dartJsonString';
import { openingWipCreateInputToJson, type AdminOpeningWipCreateInput } from './openingWipInput';

const path = '/v1/mobile/admin/production-maps/opening-wip';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function record(value: unknown, code: string, message: string) {
  if (!object(value)) throw new TypeError('Invalid opening WIP response');
  if (!object(value.record)) throw new MobileApiException({ code, message });
  return openingWipRecordFromJson(value.record);
}
/** Partial f119 live request. Demo mode, exact error parsing and account lifecycle remain open. */
export async function adminCreateOpeningWip(session: Session, input: AdminOpeningWipCreateInput, guard?: AdminRequestGuard) {
  guard?.();
  const body = openingWipCreateInputToJson(input);
  return record(await adminProductionRequest(session, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 'opening_wip_create', guard), 'opening_wip_create', 'Opening WIP yaratilmadi');
}
/** Partial f119 live request. Demo mode, exact error parsing and account lifecycle remain open. */
export async function adminOpeningWipQrReport(session: Session, qrPayload: string, guard?: AdminRequestGuard) {
  guard?.();
  const qr = dartTrim(qrPayload);
  if (!qr) throw new MobileApiException({ code: 'opening_wip_qr_not_found', message: 'Opening WIP QR topilmadi' });
  return record(await adminProductionRequest(session, `${path}/qr/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qr_payload: qr }) }, 'opening_wip_qr_not_found', guard),
    'opening_wip_qr_not_found', 'Opening WIP QR topilmadi');
}
