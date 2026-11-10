import { router } from 'expo-router';
import { WorkerWorkInstructions } from '../../../components/WorkerWorkInstructions';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerInstructions() {
  const { session } = useWorkerSession();
  return <WorkerWorkInstructions session={session} onBack={() => {
    if (router.canGoBack()) router.back(); else router.navigate('/ios-worker');
  }} />;
}
