import { ProfileScreen } from '../components/ProfileScreen';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { useRawSplitContext } from './RawSplitContext';
import { RawSplitFrame } from './RawSplitFrame.android';
import { useRawSplitProfileGuard } from './useRawSplitProfileGuard';

export function RawSplitProfileScreen() {
  const { session, onLogout } = useRawSplitContext(), isCurrent = useRawSplitProfileGuard(), t = usePreparationText();
  return <RawSplitFrame title={t('Profil')} page="profile"><ProfileScreen session={session} onLogout={onLogout} isCurrent={isCurrent}
    settingsUnavailableMessage={t('Profil sozlamalari hozircha mavjud emas.')} /></RawSplitFrame>;
}
