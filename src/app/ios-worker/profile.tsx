import { PlatformColor } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../components/ProfileScreen';
import { useWorkerSession } from '../../components/WorkerSession';

export default function IosWorkerProfile() {
  const { session, onLogout } = useWorkerSession();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/ios-worker/daily')} />
  </SafeAreaView>;
}
