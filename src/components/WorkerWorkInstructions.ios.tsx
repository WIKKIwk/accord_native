import type { Session } from '../auth';
import { WorkInstructionsView } from '../rezka/RezkaWorkInstructions';
import { useWorkerWorkInstructions } from './useWorkerWorkInstructions';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerWorkInstructions({ session, onBack }: { session: Session; onBack(): void }) {
  const { t } = useWorkerOrderText();
  return <WorkInstructionsView model={useWorkerWorkInstructions(session)} navigation={{ icon: 'back', label: t('Orqaga'), onPress: onBack }} />;
}
