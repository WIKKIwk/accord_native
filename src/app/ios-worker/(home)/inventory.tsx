import { Redirect, router } from 'expo-router';
import { WorkerInventoryScreen } from '../../../components/WorkerInventoryScreen';
import { useWorkerSession } from '../../../components/WorkerSession';
import { workerInventoryVisible } from '../../../workerNavigation';

export default function WorkerInventoryRoute() {
  const { session } = useWorkerSession();
  if (!workerInventoryVisible(session)) return <Redirect href="/ios-worker" />;
  return <WorkerInventoryScreen session={session} onBack={() => {
    if (router.canGoBack()) router.back();
    else router.navigate('/ios-worker');
  }} />;
}
