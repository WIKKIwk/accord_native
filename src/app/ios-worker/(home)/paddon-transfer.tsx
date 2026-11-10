import { workerPaddonListRoute } from '../../../workerPaddonNavigation';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkerPaddonTransfer } from '../../../components/WorkerPaddonTransfer';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function WorkerPaddonTransferRoute() {
  const { session } = useWorkerSession(), params = useLocalSearchParams<{ apparatus?: string }>();
  return <WorkerPaddonTransfer session={session} apparatus={typeof params.apparatus === 'string' ? params.apparatus : ''}
    onBack={() => { if (router.canGoBack()) router.back(); else router.navigate(workerPaddonListRoute()); }} />;
}
