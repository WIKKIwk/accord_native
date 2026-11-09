import { WorkerScreen } from '../../../WorkerScreen';
import { useRezkaShellContext } from '../../../rezka/RezkaShellContext';

export default function IosRezkaHome() {
  const { snapshot, openDrawer, onLogout, navigate } = useRezkaShellContext();
  return <WorkerScreen session={snapshot.session} onLogout={onLogout} nativeNavigation onOpenDrawer={openDrawer}
    onNavigate={destination => { if (destination === 'profile' || destination === 'daily') navigate(destination); }} />;
}
