import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '../auth';
import { workerDailyWorkVisible, workerInventoryVisible } from '../workerNavigation';
import { WorkerDrawer } from './WorkerDrawer';
import { WorkerPaddons } from './WorkerPaddons';
import { useWorkerColors } from './useWorkerColors';

export function WorkerPaddonPage({ session, apparatus, onBack, onSelect }: {
  session: Session; apparatus: string; onBack(): void; onSelect(id: string): void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false), colors = useWorkerColors();
  return <WorkerDrawer visible={drawerOpen} onOpen={() => setDrawerOpen(true)} onClose={() => setDrawerOpen(false)}
    onSelect={onSelect} displayName={String(session.profile.display_name ?? '')}
    canTransfer={workerInventoryVisible(session)} showDailyWork={workerDailyWorkVisible(session)} active={apparatus ? `paddons:${apparatus}` : 'paddons'}>
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <WorkerPaddons session={session} apparatus={apparatus} onBack={onBack} onSelect={onSelect} />
    </SafeAreaView>
  </WorkerDrawer>;
}
