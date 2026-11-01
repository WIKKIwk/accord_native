import type { ReactNode } from 'react';
import type { QueueLimit } from '../workerQueueLimit';

export type WorkerQueueFilterProps = {
  value: QueueLimit;
  enabled: boolean;
  loading?: boolean;
  backgroundColor: string;
  onChange: (limit: QueueLimit) => void;
  machinePicker?: ReactNode;
};
