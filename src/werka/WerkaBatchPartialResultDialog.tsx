import { useRef } from 'react';
import { WorkerAlert } from '../components/WorkerAlert';
import { werkaBatchPartialResultLabels } from './werkaBatchOutcomeModel';

/** Mount only for an actual partial result. The owner handles any later return of failed drafts. */
export function WerkaBatchPartialResultDialog({ createdCount, failedCount, locale, onDismiss }: {
  createdCount: number; failedCount: number; locale: string; onDismiss: () => void;
}) {
  const finished = useRef(false), labels = werkaBatchPartialResultLabels(createdCount, failedCount, locale);
  return <WorkerAlert alert={{ title: labels.title, message: `${labels.created}\n${labels.failed}`, confirmLabel: labels.close }}
    onDismiss={() => { if (!finished.current) { finished.current = true; onDismiss(); } }} />;
}
