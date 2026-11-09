import { useCallback } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { useMaterialContext } from './MaterialContext';
import { materialProfileCurrent } from './materialProfileGuard';
export function MaterialProfile() {
  const { session, witness, onLogout } = useMaterialContext();
  const current = useCallback(() => materialProfileCurrent(session, witness), [session, witness]);
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} isCurrent={current} settingsUnavailableMessage="Sozlamalar vaqtincha mavjud emas." />
  </SafeAreaView>;
}
