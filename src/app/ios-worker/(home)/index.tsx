import { router } from 'expo-router';
import { WorkerScreen } from '../../../WorkerScreen';
import { useWorkerSession } from '../../../components/WorkerSession';

export default function IosWorkerHome() {
  const { session, onLogout, onOpenDrawer } = useWorkerSession();
  return <WorkerScreen session={session} onLogout={onLogout} onOpenDrawer={onOpenDrawer} nativeNavigation onNavigate={id => {
    if (id === 'profile') router.navigate('/ios-worker/profile');
    else if (id === 'daily') router.navigate('/ios-worker/daily');
    else router.navigate('/ios-worker/chat');
  }} />;
}
