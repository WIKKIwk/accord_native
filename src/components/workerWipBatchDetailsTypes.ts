import type { Session } from '../auth';
import type { WipOrder } from '../workerWip';

export type WorkerWipBatchDetailsViewProps = {
  session: Session; order: WipOrder;
  title: string; itemName: string; payload: string; qrImage: string;
  rows: readonly [string, string][];
  editLabel: string; closeLabel: string; reprintLabel: string;
  busy: boolean; canReprint: boolean; message: string;
  onEdit?: () => void; onClose: () => void; onReprint: () => void;
};
