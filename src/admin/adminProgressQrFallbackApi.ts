import type { Session } from '../auth';
import { authorizedOpeningWipQrReportSnapshot } from '../authorizedFetch';
import { paddonSnapshotFromJson } from '../paddonModels';
import { MobileApiException } from '../shared/mobileApiException';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
import { adminProductionRequest, adminProductionResponsePayload, checkedAdminGuard } from './adminProductionRequest';
import type { AdminProgressQrOpeningWipReport, AdminProgressQrPaddonReport } from './adminProgressQrFallbackModel';
import { dartTrim } from './dartJsonString';
import { dartQueryComponent } from './dartUri';

type Guard = () => void;
function original(guard: Guard, witness: () => boolean) {
  const check = checkedAdminGuard(guard); if (!check || typeof witness !== 'function') throw new TypeError('QR fallback requires its original guard and witness');
  const current = () => { check(); const valid = isSynchronouslyTrue(witness); check(); return valid; }; return { check, current };
}
/** @v2 adminPaddonQrReport; Source GET and canonical snapshot parser, with original authority on every redirect/recovery/body boundary. */
export async function adminProgressQrPaddonReport(session: Session, code: string, guard: Guard, witness: () => boolean): Promise<AdminProgressQrPaddonReport> {
  const { check, current } = original(guard, witness); check(); const normalized = dartTrim(code);
  if (!normalized) throw new MobileApiException({ code: 'paddon_not_found', message: 'Paddon topilmadi' });
  try {
    const value = await adminProductionRequest(session, `/v1/mobile/admin/production-maps/paddons/qr/report?code=${dartQueryComponent(normalized)}`, undefined, 'paddon_not_found', check, current); check();
    try { return paddonSnapshotFromJson(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
/** @v2 adminOpeningWipQrReport; a distinct fixed POST read capability, not an arbitrary guarded POST. */
export async function adminProgressQrOpeningWipReport(session: Session, qrPayload: string, guard: Guard, witness: () => boolean): Promise<AdminProgressQrOpeningWipReport> {
  const { check, current } = original(guard, witness); check(); const normalized = dartTrim(qrPayload);
  if (!normalized) throw new MobileApiException({ code: 'opening_wip_qr_not_found', message: 'Opening WIP QR topilmadi' });
  try {
    const response = await authorizedOpeningWipQrReportSnapshot(session, normalized, check, current); check();
    const value = await adminProductionResponsePayload(response, 'opening_wip_qr_not_found', check); check();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid opening WIP response');
    const record = (value as Record<string, unknown>).record;
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new MobileApiException({ code: 'opening_wip_qr_not_found', message: 'Opening WIP QR topilmadi' });
    try { return openingWipRecordFromJson(record); } finally { check(); }
  } catch (error) { check(); throw error; }
}
