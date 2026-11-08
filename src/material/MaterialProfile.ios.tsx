import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { useMaterialContext } from './MaterialContext';
export function MaterialProfile() {
  const { session, onLogout } = useMaterialContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} />
  </SafeAreaView>;
}
