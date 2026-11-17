import type { paddonSnapshotFromJson } from '../paddonModels';
import { rawMaterialLookupFromJson } from '../rawMaterialLookupApi';
import type { openingWipRecordFromJson } from '../workerOpeningWipRecordsApi';
import type { AdminProgressQrReport } from './adminProgressQrReportModel';
import { bindProgressQrQueueOrder } from './progressQrQueueOrder';

export type AdminProgressQrPaddonReport = ReturnType<typeof paddonSnapshotFromJson>;
export type AdminProgressQrOpeningWipReport = ReturnType<typeof openingWipRecordFromJson>;
/** Current052 adds this one data flag to f119's unchanged shared raw-material DTO; existing role/auth parsers remain untouched. */
export type AdminProgressQrMaterialReport = Readonly<ReturnType<typeof rawMaterialLookupFromJson> & { is_metalayzer: boolean }>;
export function adminProgressQrMaterialReportFromJson(value: unknown): AdminProgressQrMaterialReport {
  const report = rawMaterialLookupFromJson(value), row = value as Record<string, unknown>;
  return Object.freeze(bindProgressQrQueueOrder({ ...report, is_metalayzer: row.is_metalayzer === true },row.queue_states));
}
export type AdminProgressQrLookupResult = Readonly<{ kind: 'progress'; report: AdminProgressQrReport }> | Readonly<{ kind: 'paddon'; report: AdminProgressQrPaddonReport }> |
  Readonly<{ kind: 'opening-wip'; report: AdminProgressQrOpeningWipReport }> | Readonly<{ kind: 'material'; report: AdminProgressQrMaterialReport }>;
/** Source redirects only the aparatchi principal and only Progress/Opening successes; it does not use the broader operator-role aliases. */
export const adminProgressQrNeedsWorkerQueue = (principalRole: string, kind: AdminProgressQrLookupResult['kind']): boolean =>
  principalRole === 'aparatchi' && (kind === 'progress' || kind === 'opening-wip');
