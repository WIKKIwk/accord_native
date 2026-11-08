import type { ComponentType } from 'react';
import { PlatformColor } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { ProfileScreen } from '../components/ProfileScreen';
import { useRawSplitContext } from './RawSplitContext';
// Integration main makes onDailyWork optional; the V2 Homashyo profile has no such row.
const SharedProfile = ProfileScreen as ComponentType<{ session: Session; onLogout(): void }>;
export function RawSplitProfileScreen() {
  const { session, onLogout } = useRawSplitContext();
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: PlatformColor('systemGroupedBackground') }}>
    <SharedProfile session={session} onLogout={onLogout} />
  </SafeAreaView>;
}
