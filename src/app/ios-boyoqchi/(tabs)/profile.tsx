import { router, type Href } from 'expo-router';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../../components/ProfileScreen';
import { useBoyoqchiContext } from '../../../boyoqchi/BoyoqchiContext';
export default function BoyoqchiProfile() {
  const { session, onLogout } = useBoyoqchiContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/ios-boyoqchi' as Href)} />
  </SafeAreaView>;
}
