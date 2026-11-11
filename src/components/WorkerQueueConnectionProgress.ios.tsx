import { HStack, ProgressView, Spacer } from '@expo/ui/swift-ui';
import { useWorkerQueueProgress } from './useWorkerQueueProgress';

/** @v2 _OrdersConnectionProgress */
export function WorkerQueueConnectionProgress({ active }: { active: boolean }) {
  return useWorkerQueueProgress(active) ? <HStack><Spacer /><ProgressView /><Spacer /></HStack> : null;
}
