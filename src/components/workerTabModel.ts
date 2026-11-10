import type { ReactNode } from 'react';
import type { PanGesture } from 'react-native-gesture-handler';
import type { Apparatus } from '../workerApi';
import type { SharedValue } from 'react-native-reanimated';
import type { Session } from '../auth';

export type WorkerTab = { id: string; name: string };
export type WorkerTabsProps = {
  session: Session;
  machines: Apparatus[];
  selected: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  header?: ReactNode;
  headerOffset?: SharedValue<number>;
  fontFamily?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  onMenu?: () => void;
  onProfile?: () => void;
  toolbarActions?: ReactNode;
  children: (id: string, pagerGesture?: PanGesture, machinePicker?: ReactNode) => ReactNode;
};

/** V2 order: first assigned apparatus, completed, then the remaining apparatuses. */
export function getWorkerTabs(machines: Apparatus[]): WorkerTab[] {
  const completed = { id: 'completed', name: 'Tugallangan' };
  return machines.length ? [machines[0], completed, ...machines.slice(1)] : [completed];
}
