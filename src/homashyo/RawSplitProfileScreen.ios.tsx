import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '../components/ProfileScreen';
import { usePreparationText } from '../preparation/PreparationUI';
import { useRawSplitContext } from './RawSplitContext';
import { useRawSplitProfileGuard } from './useRawSplitProfileGuard';

export function RawSplitProfileScreen() {
  const { session, onLogout } = useRawSplitContext(), isCurrent = useRawSplitProfileGuard(), t = usePreparationText();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <ProfileScreen session={session} onLogout={onLogout} isCurrent={isCurrent} settingsUnavailableMessage={t('Profil sozlamalari hozircha mavjud emas.')} />
  </SafeAreaView>;
}
