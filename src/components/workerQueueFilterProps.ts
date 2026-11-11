import type { ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import type { QueueLimit } from '../workerQueueLimit';

export type WorkerQueueFilterProps = {
  value: QueueLimit;
  enabled: boolean;
  loading?: boolean;
  backgroundColor: ColorValue;
  onChange: (limit: QueueLimit) => void;
  machinePicker?: ReactNode;
  labels?: { title: string; all: string; counts: Record<number, string> };
};
