import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkerProfile } from '../../components/WorkerProfile';
import { useWorkerColors } from '../../components/useWorkerColors';
import { useWorkerSession } from '../../components/WorkerSession';

export default function IosWorkerProfile() {
  const { session, onLogout } = useWorkerSession();
  const colors = useWorkerColors();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <WorkerProfile session={session} onLogout={onLogout} />
  </SafeAreaView>;
}
