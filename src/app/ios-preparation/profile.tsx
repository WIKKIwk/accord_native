import type { Href } from 'expo-router';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProfileScreen } from '../../components/ProfileScreen';
import { usePreparationContext } from '../../preparation/PreparationContext';
export default function PreparationProfile() {
  const { session, onLogout } = usePreparationContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} onDailyWork={() => router.navigate('/ios-preparation' as Href)} />
  </SafeAreaView>;
}
