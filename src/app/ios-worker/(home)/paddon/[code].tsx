import { workerPaddonListRoute } from '../../../../workerPaddonNavigation';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkerPaddonDetail } from '../../../../components/WorkerPaddonDetail';
import { useWorkerSession } from '../../../../components/WorkerSession';

export default function WorkerPaddonDetailRoute() {
  const { session } = useWorkerSession(), params = useLocalSearchParams<{ code: string; apparatus?: string }>();
  return <WorkerPaddonDetail session={session} code={typeof params.code === 'string' ? params.code : ''}
    apparatus={typeof params.apparatus === 'string' ? params.apparatus : ''} onBack={() => { if (router.canGoBack()) router.back(); else router.navigate(workerPaddonListRoute()); }} />;
}
