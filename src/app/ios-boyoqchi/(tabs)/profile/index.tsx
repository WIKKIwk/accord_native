import { useCallback } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isSessionWitnessCurrent } from '../../../../auth';
import { ProfileScreen } from '../../../../components/ProfileScreen';
import { useBoyoqchiContext } from '../../../../boyoqchi/BoyoqchiContext';
import { BoyoqchiMessage } from '../../../../boyoqchi/BoyoqchiMessage';
import { BOYOQCHI_DEMO_UNAVAILABLE } from '../../../../boyoqchi/returnedPaintDemoGuard';
import { useBoyoqchiText } from '../../../../boyoqchi/useBoyoqchiText';
export default function BoyoqchiProfile() {
  const { session, witness, onLogout } = useBoyoqchiContext(), t = useBoyoqchiText();
  const isCurrent = useCallback(() => witness.session === session && isSessionWitnessCurrent(witness) &&
    session.token !== 'test-mode-token', [session, witness]);
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    {session.token === 'test-mode-token' ? <BoyoqchiMessage title={BOYOQCHI_DEMO_UNAVAILABLE} error />
      : <ProfileScreen session={session} onLogout={onLogout} showDirectLogout={false} isCurrent={isCurrent}
        settingsUnavailableMessage={t('Sozlamalar hozircha mavjud emas.')} />}
  </SafeAreaView>;
}
