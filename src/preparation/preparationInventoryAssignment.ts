import type { Session } from '../auth';
import { readApparatus } from '../apparatusApi';
import { authorizedFetch } from '../authorizedFetch';
import { adminRawMaterialLookup } from '../rawMaterialLookupApi';
import { adminUnlinkRawMaterialAssignment } from '../rawMaterialUnlinkApi';
import { isCanonicalApparatusId, productionMapResponseError } from '../workerControlsApi';
import { productionMapSavedFromJson } from '../workerProductionMapSaved';
import { rawMaterialAssignment } from '../workerRawMaterials';

export { adminRawMaterialLookup, adminUnlinkRawMaterialAssignment };

/** @v2 adminRawMaterialAssignmentCandidateOrders */
export async function preparationAssignmentCandidates(session: Session, barcode: string) {
  const query = new URLSearchParams({ barcode: barcode.trim() });
  const { response, body } = await readApparatus(session, `/v1/mobile/admin/raw-material-assignments/candidate-orders?${query}`, true);
  if (response.status !== 200) {
    let payload: unknown; try { payload = JSON.parse(body); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'raw_material_assignment_candidate_orders');
  }
  const data: unknown = JSON.parse(body);
  if (!Array.isArray(data)) throw new TypeError('Invalid raw material assignment candidates');
  return data.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid raw material assignment candidate');
    const row = value as Record<string, unknown>;
    if (!Array.isArray(row.apparatus_options) || row.apparatus_options.some(id => typeof id !== 'string' || !isCanonicalApparatusId(id.trim())))
      throw new TypeError('Invalid apparatus options');
    return { order: productionMapSavedFromJson(row.order), apparatus_options: (row.apparatus_options as string[]).map(id => id.trim()) };
  });
}

/** @v2 adminAssignRawMaterialToOrder */
export async function preparationAssignMaterial(session: Session, orderId: string, barcode: string, apparatus: string, beforeSend?: () => void) {
  const station = apparatus.trim();
  if (station && !isCanonicalApparatusId(station)) throw new TypeError('Invalid apparatus');
  const response = await authorizedFetch(session, '/v1/mobile/admin/raw-material-assignments', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId.trim(), barcode: barcode.trim(),
      ...(station ? { apparatus: station } : {}) }) }, beforeSend);
  const payload: unknown = await response.json();
  if (response.status !== 200) throw productionMapResponseError(response.status, payload, 'raw_material_assignments');
  return rawMaterialAssignment(payload);
}
