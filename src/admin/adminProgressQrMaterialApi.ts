import type { Session } from '../auth';
import { authorizedRawMaterialLookupRead } from '../authorizedFetch';
import { isSynchronouslyTrue } from '../shared/camera/synchronousGuard';
import { adminProductionResponsePayload, checkedAdminGuard } from './adminProductionRequest';
import { adminProgressQrMaterialReportFromJson, type AdminProgressQrMaterialReport } from './adminProgressQrFallbackModel';
import { dartTrim } from './dartJsonString';

/** @v2 adminRawMaterialLookup; Source deliberately sends an empty normalized barcode too. */
export async function adminProgressQrMaterialLookup(session: Session, barcode: string, guard: () => void,
  witness: () => boolean): Promise<AdminProgressQrMaterialReport> {
  const check = checkedAdminGuard(guard);
  if (!check || typeof witness !== 'function') throw new TypeError('QR material lookup requires its original guard and witness');
  const current = () => { check(); const valid = isSynchronouslyTrue(witness); check(); return valid; };
  check(); const normalized = dartTrim(barcode);
  try {
    const response = await authorizedRawMaterialLookupRead(session, normalized, check, current); check();
    const value = await adminProductionResponsePayload(response, 'raw_material_assignments', check); check();
    try { return adminProgressQrMaterialReportFromJson(value); } finally { check(); }
  } catch (error) { check(); throw error; }
}
