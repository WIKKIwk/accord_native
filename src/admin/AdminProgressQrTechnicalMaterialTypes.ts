import type { AdminProgressQrMaterialReport } from './adminProgressQrFallbackModel';

export type AdminProgressQrTechnicalMaterialProps = Readonly<{
  /** Actual Source section lifetime: preserve through ordinary report/catalog redraw; replace after the section really unmounts. */
  sectionIdentity: object;
  report: AdminProgressQrMaterialReport; apparatusNamesById: ReadonlyMap<string, string>;
  p: (key: string) => string;
  isCurrent: () => boolean; canInteract: () => boolean;
}>;
