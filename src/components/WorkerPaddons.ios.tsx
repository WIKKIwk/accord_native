import { router } from 'expo-router';
import type { Session } from '../auth';
import { WorkerPaddonList } from './WorkerPaddonList';
import { workerPaddonDetailRoute, workerPaddonTransferRoute } from '../workerPaddonNavigation';

export function WorkerPaddons(props: { session: Session; apparatus?: string; name?: string; onBack(): void }) {
  return <WorkerPaddonList {...props} onDetail={(code, apparatus, name) => router.push(workerPaddonDetailRoute(code, apparatus, name))}
    onTransfer={apparatus => router.push(workerPaddonTransferRoute(apparatus))} />;
}
