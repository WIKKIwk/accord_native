import type { Session } from '../auth';
import { WorkInstructionsView } from '../rezka/RezkaWorkInstructions';
import { useWorkerWorkInstructions } from './useWorkerWorkInstructions';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerWorkInstructions({ session, onBack, onOpenDrawer }: { session: Session; onBack(): void; onOpenDrawer?: () => void }) {
  const { t } = useWorkerOrderText();
  return <WorkInstructionsView model={useWorkerWorkInstructions(session)} navigation={{ icon: onOpenDrawer ? 'menu' : 'back', label: t(onOpenDrawer ? 'Bo‘limlar' : 'Orqaga'), onPress: onOpenDrawer ?? onBack }} />;
}
