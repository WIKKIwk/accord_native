import { ActivityIndicator, View } from 'react-native';
import { useWorkerQueueProgress } from './useWorkerQueueProgress';
import { useWorkerColors } from './useWorkerColors';

/** @v2 _OrdersConnectionProgress */
export function WorkerQueueConnectionProgress({ active }: { active: boolean }) {
  const colors = useWorkerColors();
  return useWorkerQueueProgress(active) ? <View style={{ padding: 8 }}><ActivityIndicator color={colors.icon} /></View> : null;
}
