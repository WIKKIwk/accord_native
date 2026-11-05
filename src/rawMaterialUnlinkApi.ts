import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { productionMapResponseError } from './workerControlsApi';
import { rawMaterialAssignment } from './workerRawMaterials';

/** @v2 adminUnlinkRawMaterialAssignment */
export async function adminUnlinkRawMaterialAssignment(session: Session, orderId: string, barcode: string) {
  const response = await authorizedFetch(session, '/v1/mobile/admin/raw-material-assignments', { method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId.trim(), barcode: barcode.trim() }) });
  if (response.status !== 200) {
    let payload: unknown; try { payload = await response.json(); } catch { payload = null; }
    throw productionMapResponseError(response.status, payload, 'raw_material_assignments');
  }
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid raw material assignment');
  const assignment = (data as { assignment?: unknown }).assignment;
  return rawMaterialAssignment(assignment && typeof assignment === 'object' && !Array.isArray(assignment) ? assignment : data);
}
