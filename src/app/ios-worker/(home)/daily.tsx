import { router } from 'expo-router';
import { DailyWorkScreen } from '../../../components/DailyWorkScreen';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosDailyWork() {
  const { session, onOpenDrawer } = useWorkerSession();
  return <DailyWorkScreen session={session} onOpenDrawer={onOpenDrawer} onBack={() => {
    if (router.canGoBack()) router.back();
    else router.navigate('/ios-worker');
  }} />;
}
