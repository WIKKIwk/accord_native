import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { workerDailyWorkVisible, workerInventoryVisible } from '../workerNavigation';
import { DailyWorkScreen } from './DailyWorkScreen';
import { WorkerBottomBar } from './WorkerBottomBar';
import { WorkerDrawer } from './WorkerDrawer';
import { useWorkerColors } from './useWorkerColors';

type Props = { session: Session; onBack: () => void; onSelect: (id: string) => void };

export function WorkerDailyPage({ session, onBack, onSelect }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const colors = useWorkerColors();
  return <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}
    onSelect={onSelect} displayName={String(session.profile.display_name ?? '')}
    canTransfer={workerInventoryVisible(session)} showDailyWork={workerDailyWorkVisible(session)} active="daily">
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colors.background }]}>
      <DailyWorkScreen session={session} onOpenDrawer={() => setDrawerOpen(true)} onBack={onBack} />
      <WorkerBottomBar active="daily" onSelect={onSelect} onScan={() => onSelect('scan')} />
    </SafeAreaView>
  </WorkerDrawer>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
