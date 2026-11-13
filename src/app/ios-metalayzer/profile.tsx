import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../components/ProfileScreen';
import { useMetalayzerContext } from '../../metalayzer/MetalayzerContext';

export default function Profile() {
  const { session, onLogout, isCurrent } = useMetalayzerContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} isCurrent={isCurrent} />
  </SafeAreaView>;
}
