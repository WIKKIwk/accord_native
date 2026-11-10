import type { Session } from '../auth';
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { WorkInstructionsView } from '../rezka/RezkaWorkInstructions';
import { useWorkerWorkInstructions } from './useWorkerWorkInstructions';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerWorkInstructions({ session, onBack }: { session: Session; onBack(): void }) {
  const { t } = useWorkerOrderText();
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => listener.remove();
  }, [onBack]);
  return <WorkInstructionsView model={useWorkerWorkInstructions(session)} navigation={{ icon: 'back', label: t('Orqaga'), onPress: onBack }} />;
}
