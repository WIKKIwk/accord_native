import type { MaterialLinkRoll } from '../workerMaterialLinkApi';
export type WorkerMaterialRollPickerProps = { rolls: MaterialLinkRoll[]; select: (barcodes: string[] | null) => void };
