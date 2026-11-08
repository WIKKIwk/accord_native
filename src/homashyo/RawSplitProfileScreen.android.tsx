import type { ComponentType } from 'react';
import type { Session } from '../auth';
import { ProfileScreen } from '../components/ProfileScreen';
import { usePreparationText } from '../preparation/PreparationUI.android';
import { useRawSplitContext } from './RawSplitContext';
import { RawSplitFrame } from './RawSplitFrame.android';
// Integration main makes onDailyWork optional; the V2 Homashyo profile has no such row.
const SharedProfile = ProfileScreen as ComponentType<{ session: Session; onLogout(): void }>;
export function RawSplitProfileScreen() {
  const { session, onLogout } = useRawSplitContext(), t = usePreparationText();
  return <RawSplitFrame title={t('Profil')} page="profile"><SharedProfile session={session} onLogout={onLogout} /></RawSplitFrame>;
}
