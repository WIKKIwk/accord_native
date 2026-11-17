import type { productionMapDefinitionFromJson } from '../workerProductionMapSaved';

export type AdminProgressQrInfoSectionRow = Readonly<{ id: string; label: string; value: string }>;
export type AdminProgressQrRowsSection = Readonly<{ id: 'order' | 'queue'; title: string; rows: readonly AdminProgressQrInfoSectionRow[] }>;
export type AdminProgressQrLinesSection = Readonly<{ id: 'material-status' | 'assignment'; title: string; lines: readonly string[] }>;
export type AdminProgressQrInfoSection = AdminProgressQrRowsSection | AdminProgressQrLinesSection;
type Original = Readonly<{ p: (key: string) => string; isCurrent: () => boolean }>;
export type AdminProgressQrOrderDetailsProps = Original & Readonly<{ order: ReturnType<typeof productionMapDefinitionFromJson> | null }>;
/** Original Source map order is required. A Record reconstructed with Object.entries cannot recover integer-key insertion order. */
export type AdminProgressQrQueueStatesProps = Original & Readonly<{
  queueStates: ReadonlyMap<string, ReadonlyMap<string, string>>; apparatusNamesById: ReadonlyMap<string, string>;
}>;
