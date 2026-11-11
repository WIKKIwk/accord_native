import type { Session } from './auth';
import { authorizedFetch } from './authorizedFetch';
import { isCanonicalApparatusId, productionMapResponseError, WorkerControlException } from './workerControlsApi';
import { rezkaReportFromJson } from './workerRezkaReport';

type Obj = Record<string, any>;
const object = (v: unknown): Obj | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null;

/** @v2 AdminRezkaOutputSnapshot */
export function rezkaOutputSnapshotFromJson(value: unknown, apparatus: string, orderId: string) {
  const row = object(value); if (!row) throw new TypeError('Invalid Rezka output report');
  const epoch = row.epoch, counts = row.kadr_counts, revision = row.rev;
  const report = rezkaReportFromJson(row.rezka_output_report,
    row.atomic_frame_save === true && typeof epoch === 'string' ? epoch : '', row.peremotka_supported === true);
  if (row.ok !== true || row.apparatus !== apparatus || row.order_id !== orderId || row.session_status !== 'active' ||
      row.order_control !== 'active' || !report || !Array.isArray(counts) || !counts.length ||
      counts.some(value => !Number.isInteger(value) || value <= 0) || report.frames.some(frame => frame.index > counts.length) ||
      !Number.isInteger(revision) || revision < 0 || typeof epoch !== 'string' || !epoch.trim()) {
    throw new WorkerControlException('production_map_snapshot_contract_invalid', 'Production map navbati server shartnomasiga mos emas: invalid Rezka output report');
  }
  return { report, kadr_counts: counts as number[], revision: revision as number, epoch };
}
/** @v2 adminRezkaOutputReport */
export async function adminRezkaOutputReport(session: Session, apparatus: string, orderId: string, current?: () => boolean) {
  const station = apparatus.trim(), order = orderId.trim();
  if (!isCanonicalApparatusId(station)) throw new WorkerControlException('apparatus_id_invalid', 'Canonical apparatus ID noto‘g‘ri');
  const guard = () => { if (current && !current()) throw new Error('worker.error.sync'); };
  guard();
  const query = new URLSearchParams({ apparatus: station, order_id: order });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const path = `/v1/mobile/admin/production-maps/rezka-output-report?${query}`;
    const response = current ? await authorizedFetch(session, path, { signal: controller.signal }, guard)
      : await authorizedFetch(session, path, { signal: controller.signal });
    const body = await response.text(); guard();
    if (response.status === 404 && !body.trim()) return null;
    if (response.status !== 200) {
      let data: unknown; try { data = JSON.parse(body); } catch { data = null; }
      throw productionMapResponseError(response.status, data, 'rezka_output_report_failed', response.headers);
    }
    return rezkaOutputSnapshotFromJson(JSON.parse(body), station, order);
  } finally { clearTimeout(timer); }
}
