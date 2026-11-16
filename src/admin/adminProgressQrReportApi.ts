import type { Session } from '../auth';
import { authorizedProgressQrReportSnapshot } from '../authorizedFetch';
import { adminProductionResponsePayload, checkedAdminGuard } from './adminProductionRequest';
import { adminProgressQrReportFromJson, type AdminProgressQrReport } from './adminProgressQrReportModel';
import { dartTrim } from './dartJsonString';

/** @v2 adminProgressQrReport; a fixed POST report read with original authority, not a mutation or a generic guarded POST lane. */
export async function adminProgressQrReport(session: Session, qrPayload: string, guard: () => void, readWitness: () => boolean): Promise<AdminProgressQrReport> {
  const check = checkedAdminGuard(guard);
  if (!check || typeof readWitness !== 'function') throw new TypeError('QR report requires its original guard and witness');
  check();
  try {
    const response = await authorizedProgressQrReportSnapshot(session, dartTrim(qrPayload), check, readWitness); check();
    const value = await adminProductionResponsePayload(response, 'progress_batch_not_found', check); check();
    try { return adminProgressQrReportFromJson(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
