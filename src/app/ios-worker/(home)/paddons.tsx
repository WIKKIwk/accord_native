import { router, useLocalSearchParams } from 'expo-router';
import { WorkerPaddons } from '../../../components/WorkerPaddons';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function WorkerPaddonsRoute() {
  const { session } = useWorkerSession(), params = useLocalSearchParams<{ apparatus?: string; name?: string }>();
  return <WorkerPaddons session={session} apparatus={typeof params.apparatus === 'string' ? params.apparatus : ''}
    name={typeof params.name === 'string' ? params.name : ''} onBack={() => { if (router.canGoBack()) router.back(); else router.navigate('/ios-worker'); }} />;
}
