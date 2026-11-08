import { useCallback } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../../../components/ProfileScreen';
import { useBoyoqchiContext } from '../../../../boyoqchi/BoyoqchiContext';
import { useBoyoqchiProfileSettings } from '../../../../boyoqchi/BoyoqchiProfileSettings.ios';
export default function BoyoqchiProfile() {
  const { session, onLogout } = useBoyoqchiContext(), settings = useBoyoqchiProfileSettings();
  const registerSettingsOpener = useCallback((open: () => void) => settings.register(session, open), [session, settings]);
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} showDirectLogout={false} registerSettingsOpener={registerSettingsOpener} />
  </SafeAreaView>;
}
