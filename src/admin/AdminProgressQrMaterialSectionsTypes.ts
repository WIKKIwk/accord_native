import type { AdminProgressQrMaterialReport } from './adminProgressQrFallbackModel';

export type AdminProgressQrMaterialText = (key: string, values?: Record<string, unknown>) => string;
type Original = Readonly<{ p: AdminProgressQrMaterialText; isCurrent: () => boolean; queueState: string }>;
export type AdminProgressQrMaterialStatusProps = Original & Readonly<{ report: AdminProgressQrMaterialReport }>;
export type AdminProgressQrMaterialAssignmentProps = Original & Readonly<{
  assignment: AdminProgressQrMaterialReport['assignment']; orderTitle: string; orderNumber: string; apparatusNamesById: ReadonlyMap<string, string>;
}>;
