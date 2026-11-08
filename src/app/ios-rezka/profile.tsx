import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RezkaProfile } from '../../rezka/RezkaProfile';
import { useRezkaShellContext } from '../../rezka/RezkaShellContext';

export default function IosRezkaProfile() {
  const { snapshot, onLogout, navigate } = useRezkaShellContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <RezkaProfile snapshot={snapshot} onLogout={onLogout} onDailyWork={() => navigate('daily')} />
  </SafeAreaView>;
}
